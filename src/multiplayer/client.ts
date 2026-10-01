import { validServer, validState, type Frame } from './protocol';
import { LIMITS } from './rules';
import { ticking, type ContactClaim, type ContactPending, type OnlineEvent, type OnlineState, type Result, type Side } from './types';

export interface ClientSocket { bufferedAmount: number; readyState: number; send(raw: string): void; close(): void }
export interface Probe { lo: number; hi: number; at: number; rtt: number; c0: number; s1: number; s2: number; c3: number }
export class OnlineClient {
  state: OnlineState | null = null; known: Result | null = null; side: Side = 0; code = ''; epoch = '';
  status = 'Connecting'; closed = false; enabled = false; focused = true; generation = 0; authorized = 0;
  serial = 0; ordinarySerial = 0; snapshotSerial = 0; snapshotTick = 0; beat = 0; seq = 0;
  occupied = [false, false]; ready = [false, false]; rematch = [false, false];
  probes: Probe[] = []; inbox: unknown[] = []; events: OnlineEvent[] = [];
  records: Record<string, unknown>[] = [];
  onDiagnostic: ((record: Record<string, unknown>) => void) | null = null;
  onState: (s: OnlineState, event?: OnlineEvent, serverTime?: number) => void = () => {};
  onInput: (x: number, y: number, seq: number, capturedAt: number) => void = () => {};
  onFence: () => void = () => {};
  onPending: (pending: ContactPending, serverTime: number) => void = () => {};
  private deadline: number; private lastBeat = -Infinity; private lastSend = -Infinity;
  private target: { x: number; y: number } | null = null; private nonce = ''; private request = 0;
  private syncRequest = ''; private resumeRequest = ''; private syncSerial = 0; private context = ''; private pendingProbe = new Map<number, number>();
  private congested: number | null = null; private closing = false; private credential = '';
  private tickDeadline = Infinity; private lastProbeProcessed = 0;
  private lastServerTime = -Infinity;
  private smoothedOffset: number | null = null;
  private inputSnapshotContext = '';
  private rallyActivatedAt = Infinity; private enabledAt = Infinity;
  constructor(public socket: ClientSocket, private now: () => number, operation: 'create' | 'join', roomCode?: string) {
    this.deadline = now() + 5000;
    const c0 = now(); this.pendingProbe.set(0, c0);
    this.send(operation, { requestId: this.id(), probeId: 0, c0, ...(operation === 'join' ? { roomCode } : {}) });
  }
  private id() { return String(++this.request); }
  private record(data: Record<string, unknown>) {
    const record = { at: this.now(), ...data }; this.records.push(record); if (this.records.length > 600) this.records.shift(); this.onDiagnostic?.(record);
  }
  private send(type: string, data: Record<string, unknown>) {
    if (this.closed || this.closing || this.socket.readyState !== 1) return;
    this.socket.send(JSON.stringify({ type, protocolVersion: 1, ...(this.epoch ? { roomEpoch: this.epoch } : {}), ...data }));
    if (type === 'input') this.record({ kind: 'sent-input', seq: data.seq, generation: data.controlGeneration, matchId: data.matchId, rallyId: data.rallyId, x: data.x, y: data.y });
  }
  receive(raw: string) {
    try {
      if (new TextEncoder().encode(raw).length > 4096) throw new Error('oversize');
      const f = JSON.parse(raw);
      if (f.type === 'heartbeat') this.inbox = this.inbox.filter(v => (v as Frame)?.type !== 'heartbeat');
      if (f.type === 'snapshot' && f.phase !== 'MatchEnded') this.inbox = this.inbox.filter(v => (v as Frame)?.type !== 'snapshot' || (v as Frame)?.phase === 'MatchEnded');
      const lifecycle = this.inbox.filter(v => !['snapshot', 'heartbeat'].includes((v as Frame)?.type));
      if (lifecycle.length >= 32 && !['snapshot', 'heartbeat'].includes(f.type) || this.inbox.length >= 34) { this.interrupt('Incoming queue overflow'); return; }
      this.inbox.push(f);
    } catch { this.interrupt('Invalid server frame'); }
  }
  transportClosed() { this.closing = true; this.finishClose('Connection closed · outcome unknown'); }
  private probe(f: Frame, joined = false) {
    const id = (joined ? f.probeId : f.echoProbeId) as number, c0 = this.pendingProbe.get(id);
    if (c0 === undefined || f.echoC0 !== c0 || typeof f.s1 !== 'number' || typeof f.s2 !== 'number' || f.s2 < f.s1) return false;
    const c3 = this.now(), lo = f.s2 - c3, hi = f.s1 - c0;
    if (lo > hi) return false;
    this.pendingProbe.delete(id); this.lastProbeProcessed = c3; this.probes.push({ lo, hi, at: c3, rtt: c3 - c0 - (f.s2 - f.s1), c0, s1: f.s1, s2: f.s2, c3 });
    if (this.probes.length > 20) this.probes.shift();
    const best = [...this.probes].sort((a, b) => a.rtt - b.rtt)[0], estimate = (best.lo + best.hi) / 2;
    this.smoothedOffset = this.smoothedOffset === null ? estimate : this.smoothedOffset + (estimate - this.smoothedOffset) * .2;
    return true;
  }
  get offset() { return this.smoothedOffset ?? 0; }
  get rtt() { return this.probes.length ? this.probes.reduce((sum, p) => sum + p.rtt, 0) / this.probes.length : 0; }
  private fresh(f: Frame) {
    if (typeof f.serverTime !== 'number' || !this.probes.length) return false;
    const p = [...this.probes].sort((a, b) => a.rtt - b.rtt)[0];
    // Conservative upper age includes interval, residual and bounded clock drift.
    const drift = Math.abs(this.offset - (p.lo + p.hi) / 2) + (this.now() - p.at) * .001;
    const ageUpper = this.now() + p.hi + drift - f.serverTime;
    return ageUpper >= 0 && ageUpper < 5000;
  }
  private apply(s: unknown, event?: OnlineEvent, closing = false, serverTime?: number) {
    if (!validState(s)) return false;
    const old = this.state;
    if (old && (s.matchId < old.matchId || s.matchId === old.matchId && (s.tick < old.tick || s.lives.some((n, i) => n > old.lives[i])))) return false;
    if (closing && (!old || s.matchId !== old.matchId || s.phase !== 'MatchEnded')) return false;
    if (this.known && s.matchId === this.known.matchId && JSON.stringify(s.result) !== JSON.stringify(this.known)) return false;
    if (s.result) { this.known = structuredClone(s.result); if (closing) this.status = 'Final result received'; }
    else if (old && s.matchId > old.matchId) this.known = null;
    if (old && s.matchId > old.matchId) { this.seq = 0; this.target = null; this.onFence(); }
    if (s.phase !== 'Rally' || !old || old.phase !== 'Rally' || s.matchId !== old.matchId || s.rallyId !== old.rallyId) {
      this.target = null; this.inputSnapshotContext = '';
      this.rallyActivatedAt = Infinity;
    }
    if (ticking(s.phase) && (!old || !ticking(old.phase))) this.tickDeadline = this.now() + 5000;
    if (!ticking(s.phase)) this.tickDeadline = Infinity;
    this.state = s; this.onState(s, event, serverTime); return true;
  }
  private process(value: unknown, terminalOnly = false) {
    if (!validServer(value)) { if (!terminalOnly) this.interrupt('Online protocol/update error'); return; }
    const f = value;
    if (this.epoch && f.roomEpoch !== this.epoch || (f.serverSerial as number) <= this.serial) return;
    if (!terminalOnly && f.serverTime < this.lastServerTime) return;
    if (terminalOnly) {
      if ((f.type === 'snapshot' || f.type === 'event') && this.epoch && f.roomEpoch === this.epoch) this.apply(f.type === 'snapshot' ? f : f.freshSnapshot, undefined, true);
      return;
    }
    if (f.type === 'joined') {
      if (this.epoch || f.rulesVersion !== 'online-v1' || ![0, 1].includes(f.slot as number) || typeof f.roomId !== 'string' ||
        typeof f.playerSessionCredential !== 'string' || !/^[a-f0-9]{64}$/.test(f.playerSessionCredential) || !this.probe(f, true) || !validState(f.freshSnapshot)) { this.interrupt('Online setup/update error'); return; }
      this.epoch = f.roomEpoch as string; this.code = f.roomId; this.side = f.slot as Side; this.credential = f.playerSessionCredential;
      this.apply(f.freshSnapshot, undefined, false, f.serverTime as number);
      this.authorized = f.initialStateSerial as number; this.enabled = this.focused; this.status = 'Connected';
      this.enabledAt = this.enabled ? this.now() : Infinity;
      this.snapshotSerial = f.serverSerial as number; this.snapshotTick = this.state!.tick;
      if (!this.focused) this.blur();
    } else if (!this.epoch) { if (f.type === 'error') this.interrupt(String(f.code)); return; }
    else if (f.type === 'snapshot' || f.type === 'event') {
      const event = f.type === 'event' ? { ...f, type: f.eventType } as unknown as OnlineEvent : undefined;
      const oldTick = this.state?.tick ?? 0;
      if (!this.apply(event ? f.freshSnapshot : f, event, false, f.serverTime as number)) return;
      if (event && !this.events.some(e => e.eventId === event.eventId)) { this.events.push(event); if (this.events.length > 32) this.events.shift(); }
      if (!event) {
        this.snapshotSerial = f.serverSerial as number; this.snapshotTick = this.state!.tick;
        const context = this.state!.phase === 'Rally' ? `${this.state!.matchId}/${this.state!.rallyId}` : '';
        if (context && context !== this.inputSnapshotContext) this.rallyActivatedAt = this.now();
        this.inputSnapshotContext = context;
      }
      if (!event && this.snapshotTick > oldTick && this.fresh(f)) this.tickDeadline = this.now() + 5000;
      if (Array.isArray(f.occupied)) this.occupied = f.occupied as boolean[];
      if (Array.isArray(f.ready)) this.ready = f.ready as boolean[];
      if (Array.isArray(f.rematch)) this.rematch = f.rematch as boolean[];
    } else if (f.type === 'heartbeat') { if (typeof f.nonce !== 'string') return; this.nonce = f.nonce; this.probe(f); }
    else if (f.type === 'contactPending') {
      if (f.side === this.side && this.state && this.state.matchId === f.matchId && this.state.rallyId === f.rallyId) {
        this.record({ kind: 'contact-pending', matchId: f.matchId, rallyId: f.rallyId, tick: f.tick });
        this.onPending({ matchId: f.matchId as number, rallyId: f.rallyId as number, tick: f.tick as number, side: f.side as Side, incomingViewBoxes: f.incomingViewBoxes as ContactPending['incomingViewBoxes'] }, f.serverTime);
      }
    }
    else if (f.type === 'controlAck') {
      if (f.generation !== this.generation || !this.focused || !this.apply(f.freshSnapshot, undefined, false, f.serverTime as number)) return;
      if ((f.kind === 'sync' && f.requestId === this.syncRequest || f.kind === 'resync' && f.requestId === this.resumeRequest) && this.state!.phase !== 'MatchEnded') {
        this.syncSerial = f.stateSerial as number; this.resumeRequest = this.id(); this.context = `${this.state!.matchId}/${this.state!.rallyId}`;
        this.send('controlResume', { generation: this.generation, stateSerial: this.syncSerial, matchId: this.state!.matchId, rallyId: this.state!.rallyId, requestId: this.resumeRequest });
      } else if (f.kind === 'resume' && f.requestId === this.resumeRequest && f.enabled === true && this.context === `${this.state!.matchId}/${this.state!.rallyId}`) {
        this.enabled = true; this.authorized = this.syncSerial; this.target = null; this.onFence();
        this.enabledAt = this.now();
      }
    } else if (f.type === 'interrupted') { this.apply(f.freshSnapshot); this.interrupt(`Interrupted: ${String(f.reason)} · outcome unknown`); return; }
    else if (f.type === 'error') {
      this.status = String(f.code);
      if (f.code === 'resync' && this.focused) { this.blur(); this.focus(); }
    }
    else return;
    this.serial = f.serverSerial as number;
    this.lastServerTime = f.serverTime;
    if (['joined', 'snapshot', 'event', 'heartbeat'].includes(f.type) && this.fresh(f)) {
      if (f.type !== 'event') this.ordinarySerial = this.serial;
      this.deadline = this.now() + 5000;
    }
    else if (['snapshot', 'event', 'heartbeat'].includes(f.type)) this.lastBeat = -Infinity;
    if (this.state && !this.enabled && this.focused && !['MatchEnded', 'Aborted'].includes(this.state.phase) && this.context !== `${this.state.matchId}/${this.state.rallyId}`) this.sync();
  }
  /** Called from the responsive runtime, not socket callbacks; watchdog precedes backlog. */
  pump() {
    if (this.closed) return;
    const now = this.now();
    if (now >= this.deadline || now >= this.tickDeadline) { this.interrupt('Server runtime timeout · outcome unknown'); return; }
    if (this.socket.bufferedAmount > LIMITS.softBuffer) this.congested ??= now; else this.congested = null;
    if (this.socket.bufferedAmount >= LIMITS.hardBuffer || this.congested !== null && now - this.congested >= 2000) { this.interrupt('Connection congestion · outcome unknown'); return; }
    for (const f of this.inbox.splice(0)) this.process(f, this.closed);
    if (this.closed || !this.epoch || !this.state) return;
    if (now - this.lastBeat >= 1000 && this.nonce) {
      this.lastBeat = now; const probeId = ++this.beat; this.pendingProbe.set(probeId, now);
      while (this.pendingProbe.size > 20) this.pendingProbe.delete(this.pendingProbe.keys().next().value!);
      this.send('heartbeat', { runtimeBeatSeq: this.beat, processedServerSerial: this.ordinarySerial, processedSnapshotSerial: this.snapshotSerial,
        processedTick: this.snapshotTick, matchId: this.state.matchId, rallyId: this.state.rallyId, phase: this.state.phase,
        echoNonce: this.nonce, probeId, c0: now, c3: this.lastProbeProcessed }); this.nonce = '';
    }
    if (this.inputEligible() && this.target && now - this.lastSend >= 1000 / 30 && this.socket.bufferedAmount <= LIMITS.softBuffer) {
      this.lastSend = now; const t = this.target; this.target = null;
      this.send('input', { ...t, seq: ++this.seq, matchId: this.state.matchId, rallyId: this.state.rallyId, controlGeneration: this.generation,
        resumeStateSerial: this.authorized, processedSnapshotSerial: this.snapshotSerial });
    }
  }
  /** Report what the incoming frame showed. Any unsent target goes first so the authority can bound the claimed pose. */
  claim(c: ContactClaim) {
    if (!this.enabled || this.closed || this.closing || !this.state || this.state.matchId !== c.matchId || this.state.rallyId !== c.rallyId) return;
    if (this.inputEligible() && this.target) {
      this.lastSend = this.now(); const t = this.target; this.target = null;
      this.send('input', { ...t, seq: ++this.seq, matchId: this.state.matchId, rallyId: this.state.rallyId, controlGeneration: this.generation,
        resumeStateSerial: this.authorized, processedSnapshotSerial: this.snapshotSerial });
    }
    this.send('contactClaim', { ...c, controlGeneration: this.generation });
    this.record({ kind: 'sent-claim', ...c, generation: this.generation });
  }
  private inputEligible() {
    return this.enabled && this.focused && !this.closed && !this.closing && this.state?.phase === 'Rally' &&
      this.inputSnapshotContext === `${this.state.matchId}/${this.state.rallyId}`;
  }
  pointer(x: number, y: number, capturedAt = this.now()) {
    const handledAt = this.now();
    // Equality is conservatively ineligible: it cannot establish capture AFTER
    // both ordinary Rally processing and control enablement. Never server time.
    if (!this.inputEligible() || !Number.isFinite(capturedAt) || capturedAt <= Math.max(this.rallyActivatedAt, this.enabledAt) || capturedAt > handledAt ||
      !Number.isFinite(x) || !Number.isFinite(y) || x < -350 || x > 700 || y < -250 || y > 500) return;
    this.target = { x, y }; this.onInput(x, y, this.seq + 1, capturedAt);
    this.record({ kind: 'captured-input', at: capturedAt, handledAt, seq: this.seq + 1, generation: this.generation, matchId: this.state!.matchId, rallyId: this.state!.rallyId, x, y });
  }
  blur() {
    this.focused = false; this.enabled = false; this.target = null; this.onFence(); this.context = ''; this.syncRequest = ''; this.resumeRequest = '';
    this.enabledAt = Infinity;
    if (this.epoch && !this.closed) {
      if (this.generation >= Number.MAX_SAFE_INTEGER - 1) { this.interrupt('Control generation exhausted'); return; }
      this.generation++; this.send('controlFence', { generation: this.generation, requestId: this.id() });
    }
  }
  focus() { if (this.closed) return; this.focused = true; if (!this.enabled) this.sync(); }
  private sync() {
    if (!this.epoch || this.closed || !this.focused || !this.state || this.state.phase === 'MatchEnded' || this.state.phase === 'Aborted') return;
    this.enabled = false; this.target = null; this.onFence(); this.syncRequest = this.id(); this.context = `${this.state.matchId}/${this.state.rallyId}`;
    this.enabledAt = Infinity;
    this.send('controlSync', { generation: this.generation, requestId: this.syncRequest });
  }
  command(type: 'ready' | 'rematch', value: boolean) { this.send(type, { requestId: this.id(), value, ...(type === 'rematch' ? { matchId: this.state?.matchId } : {}) }); }
  leave() { this.send('leave', { requestId: this.id() }); this.interrupt('Left room · outcome unknown'); }
  hidden() { this.send('unavailable', { reason: 'hidden' }); this.interrupt('Page hidden · outcome unknown'); }
  private finishClose(reason: string) {
    const terminal = this.inbox.filter(v => {
      const f = v as Frame; return f?.type === 'snapshot' && f.phase === 'MatchEnded' || f?.type === 'event' && (f.freshSnapshot as OnlineState)?.phase === 'MatchEnded';
    });
    for (const f of terminal.slice(0, 32)) this.process(f, true);
    this.inbox = []; this.closed = true; this.enabled = false; this.target = null; this.credential = ''; this.onFence();
    this.status = this.known ? 'Final result received' : reason;
  }
  interrupt(reason: string) { if (this.closed) return; this.closing = true; this.finishClose(reason); this.socket.close(); }
  diagnostics() { return { schema: 'curveball-online-diagnostics-1', state: this.state, probes: this.probes, events: this.events, records: this.records, status: this.status, enabled: this.enabled, generation: this.generation, rtt: this.rtt, sessionBound: !!this.credential }; }
}
