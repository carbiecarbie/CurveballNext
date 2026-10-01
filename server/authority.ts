import { randomBytes } from 'node:crypto';
import { parseClient, sameContext, type Frame, type HealthState } from '../src/multiplayer/protocol';
import { LIMITS, RULES } from '../src/multiplayer/rules';
import { boxes, createOnline, paddle, startMatch, step, target } from '../src/multiplayer/simulation';
import { ticking, type OnlineState, type Side } from '../src/multiplayer/types';

export interface Transport { bufferedAmount: number; send(raw: string): void; close(code: number, reason: string): void; terminate(): void }
export class Bucket {
  private tokens: number; private at: number;
  constructor(private rate: number, private burst: number, now: number) { this.tokens = burst; this.at = now; }
  take(now: number) { this.tokens = Math.min(this.burst, this.tokens + (now - this.at) * this.rate / 1000); this.at = now; if (this.tokens < 1) return false; this.tokens--; return true; }
}
interface Issued extends HealthState { time: number; ordinary: boolean; sent: boolean; snapshot: boolean }
export interface Session {
  id: string; transport: Transport; opened: number; room: Room | null; side: Side; credential: string; closing: number | null;
  serial: number; lastSent: string; lastSnapshotSerial: number; generation: number; enabled: boolean; authorized: number; seq: number; pending: Frame | null;
  queue: { frame: Frame; received: number }[]; issued: Map<number, Issued>; sync: Map<number, number>;
  responses: Map<string, string>; events: string[]; latest: string | null; congested: number | null; abuse: number | null;
  inputs: Bucket; commands: Bucket; lastExcess: number; healthAt: number; tickAt: number; healthSerial: number; healthTick: number; beatSeq: number;
  nonces: Map<string, number>; heartbeatAt: number; probe: { probeId: number; c0: number; s1: number } | null;
  /** Recently received targets (read space, unclamped) bounding which claimed poses are reachable, with their control context. */
  targets: { x: number; y: number; at: number; matchId: number; rallyId: number; generation: number }[];
}
export interface Room {
  code: string; epoch: string; created: number; endedAt: number | null; state: OnlineState;
  slots: [Session | null, Session | null]; ready: [boolean, boolean]; rematch: [boolean, boolean]; diagnostics: unknown[];
  sources: { seq: number; generation: number; publishedTick: number; firstUsed: boolean }[];
  /** Paused uncommitted miss awaiting the defender's contact claim (plan §5 amendment). */
  wait: { side: Side; tick: number; deadline: number; generation: number; claim: Frame | null } | null;
}
const codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function normalizeCode(v: string) { return v.toUpperCase().replaceAll('-', ''); }
export class Authority {
  rooms = new Map<string, Room>(); sessions = new Set<Session>(); draining = false; healthy = true;
  private boundary: number; private now: () => number; private bit: () => Side;
  metrics = { ticks: 0, skipped: 0, maxPayload: 0, overruns: 0, snapshotCount: 0, snapshotBytes: 0, deliveredBytes: 0 };
  private lateness: number[] = []; private batches: number[] = [];
  timing() {
    const p99 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * .99)] ?? null;
    return { sampleCount: this.lateness.length, latenessP99Ms: p99(this.lateness), batchP99Ms: p99(this.batches) };
  }
  onDiagnostic: ((record: Record<string, unknown>) => void) | null = null;
  get nextBoundary() { return this.boundary; }
  constructor(now: () => number, bit: () => Side = () => (randomBytes(1)[0] & 1) as Side) { this.now = now; this.bit = bit; this.boundary = now() + 1000 / 30; }
  open(transport: Transport): Session | null {
    if (this.sessions.size >= LIMITS.sockets) { transport.close(1013, 'capacity'); transport.terminate(); return null; }
    const t = this.now();
    const s: Session = { id: randomBytes(16).toString('hex'), transport, opened: t, room: null, side: 0, credential: '', closing: null,
      serial: 0, lastSent: '', lastSnapshotSerial: 0, generation: 0, enabled: true, authorized: 0, seq: 0, pending: null, queue: [], issued: new Map(), sync: new Map(), responses: new Map(),
      events: [], latest: null, congested: null, abuse: null, inputs: new Bucket(30, 60, t), commands: new Bucket(5, 10, t),
      lastExcess: t, healthAt: t, tickAt: t, healthSerial: 0, healthTick: 0, beatSeq: 0, nonces: new Map(), heartbeatAt: t - 1000, probe: null, targets: [] };
    this.sessions.add(s); return s;
  }
  receive(s: Session, raw: string) {
    if (s.closing !== null) return;
    try {
      if (Buffer.byteLength(raw) > 1024) throw new Error('oversize');
      const initial = ['create', 'join'].includes(JSON.parse(raw)?.type);
      const f = parseClient(raw, !!s.room && !initial), now = this.now();
      if (s.room && initial && !s.responses.has(f.requestId as string)) throw new Error('binding');
      if (s.room && !initial && f.roomEpoch !== s.room.epoch) throw new Error('epoch');
      const bucket = f.type === 'input' ? s.inputs : s.commands;
      if (!bucket.take(now)) { s.abuse ??= now; s.lastExcess = now; if (now - s.abuse >= 2000 || f.type !== 'input') this.disconnect(s, 'rate-limit'); return; }
      if (now - s.lastExcess >= 2000) s.abuse = null;
      if (s.queue.length >= 32) throw new Error('inbound-overflow');
      s.queue.push({ frame: f, received: now });
    } catch (e) { this.disconnect(s, e instanceof Error ? e.message : 'schema'); }
  }
  private send(s: Session, type: string, data: Record<string, unknown>, ordinary = false, replaceable = false): number {
    if (s.closing !== null) return 0;
    const now = this.now(), serial = ++s.serial;
    const f = { protocolVersion: 1, roomEpoch: s.room?.epoch ?? 'unbound', serverSerial: serial, serverTime: now, ...data, type };
    const raw = JSON.stringify(f);
    s.lastSent = raw;
    if (type === 'snapshot') { this.metrics.snapshotCount++; this.metrics.snapshotBytes += Buffer.byteLength(raw); this.metrics.maxPayload = Math.max(this.metrics.maxPayload, Buffer.byteLength(raw)); if (Buffer.byteLength(raw) > 2048) { this.disconnect(s, 'snapshot-overflow'); return 0; } }
    if (s.room) { s.issued.set(serial, { matchId: s.room.state.matchId, rallyId: s.room.state.rallyId, phase: s.room.state.phase, tick: s.room.state.tick, time: now, ordinary, sent: false, snapshot: type === 'snapshot' || type === 'joined' });
      while (s.issued.size > 256) { const oldest = [...s.issued.keys()].find(k => k !== s.lastSnapshotSerial)!; s.issued.delete(oldest); } }
    if (s.transport.bufferedAmount > LIMITS.softBuffer) {
      s.congested ??= now;
      if (replaceable) { s.latest = raw; this.metrics.skipped++; }
      else s.events.push(raw);
      if (s.events.length > 32 || s.transport.bufferedAmount >= LIMITS.hardBuffer) this.disconnect(s, 'congestion');
    } else { this.flush(s); if (s.closing === null) this.deliver(s, raw); }
    return serial;
  }
  private deliver(s: Session, raw: string) {
    const serial = JSON.parse(raw).serverSerial, issued = s.issued.get(serial);
    if (issued) { issued.sent = true; if (issued.snapshot && issued.ordinary) s.lastSnapshotSerial = serial; }
    this.metrics.deliveredBytes += Buffer.byteLength(raw); s.transport.send(raw);
  }
  private flush(s: Session) {
    if (s.closing !== null || s.transport.bufferedAmount > LIMITS.softBuffer) return;
    s.congested = null;
    // Serial order is preserved; replaceable snapshots older than queued events are obsolete.
    const frames = [...s.events, ...(s.latest ? [s.latest] : [])].sort((a, b) => JSON.parse(a).serverSerial - JSON.parse(b).serverSerial);
    s.events = []; s.latest = null;
    for (const raw of frames) {
      if (s.transport.bufferedAmount > LIMITS.softBuffer) {
        if (JSON.parse(raw).type === 'snapshot') s.latest = raw; else s.events.push(raw);
        s.congested ??= this.now();
      }
      else this.deliver(s, raw);
      if (s.events.length > LIMITS.events || s.transport.bufferedAmount >= LIMITS.hardBuffer) { this.disconnect(s, 'congestion'); return; }
    }
  }
  snapshot(s: Session, ordinary = true) {
    if (!s.room) return 0;
    return this.send(s, 'snapshot', { ...s.room.state, ready: s.room.ready, occupied: s.room.slots.map(Boolean), rematch: s.room.rematch,
      controlGeneration: s.room.slots.map(p => p?.generation ?? 0), enabled: s.room.slots.map(p => p?.enabled ?? false),
      ackInputSeq: s.room.state.localPaddles.map(p => p.seq), ackInputTick: s.room.state.localPaddles.map(p => p.appliedTick) }, ordinary, true);
  }
  private ack(s: Session, f: Frame, kind: string, sync = false) {
    const stateSerial = s.serial + 1;
    if (sync) { s.sync.set(stateSerial, s.generation); while (s.sync.size > 64) s.sync.delete(s.sync.keys().next().value!); }
    this.send(s, 'controlAck', { requestId: f.requestId, kind, generation: s.generation, enabled: s.enabled, stateSerial, freshSnapshot: s.room!.state });
  }
  private error(s: Session, f: Frame, code: string) { this.send(s, 'error', { requestId: f.requestId ?? '', code }); }
  private cache(s: Session, id: unknown) {
    if (typeof id !== 'string') return;
    // Only lifecycle replies, never inputs/health. The last frame was synchronously serialized.
    s.responses.set(id, s.lastSent); while (s.responses.size > 64) s.responses.delete(s.responses.keys().next().value!);
  }
  private process(s: Session, f: Frame, received: number) {
    const now = this.now();
    if (typeof f.requestId === 'string' && s.responses.has(f.requestId)) {
      const cached = JSON.parse(s.responses.get(f.requestId)!);
      const { type, protocolVersion: _v, roomEpoch: _e, serverSerial: _s, serverTime: _t, ...data } = cached;
      this.send(s, type, data, type === 'snapshot' || type === 'joined'); return;
    }
    if (!s.room) {
      if (this.draining || !this.healthy) { this.error(s, f, 'maintenance'); this.closeSocket(s, 'maintenance'); return; }
      let room: Room | undefined;
      if (f.type === 'create') {
        if (this.rooms.size >= 10) { this.error(s, f, 'capacity'); this.closeSocket(s, 'capacity'); return; }
        let code: string;
        do { code = [...randomBytes(12)].map(n => codeAlphabet[n & 31]).join(''); } while (this.rooms.has(code));
        room = { code, epoch: randomBytes(16).toString('hex'), created: now, endedAt: null, state: createOnline(), slots: [null, null], ready: [false, false], rematch: [false, false], diagnostics: [], sources: [0, 1].map(() => ({ seq: 0, generation: 0, publishedTick: 0, firstUsed: false })), wait: null };
        this.rooms.set(code, room);
      } else {
        const code = normalizeCode(f.roomCode as string);
        if (!/^[A-HJ-NP-Z2-9]{12}$/.test(code)) { this.error(s, f, 'invalid-code'); this.closeSocket(s, 'invalid-code'); return; }
        room = this.rooms.get(code);
        if (!room) { this.error(s, f, 'room-unavailable'); this.closeSocket(s, 'room-unavailable'); return; }
        if (room.state.phase !== 'Waiting' || room.slots.every(Boolean)) { this.error(s, f, 'full'); this.closeSocket(s, 'full'); return; }
      }
      s.room = room; s.side = room.slots[0] ? 1 : 0; room.slots[s.side] = s; s.credential = randomBytes(32).toString('hex'); s.healthAt = now;
      s.authorized = s.serial + 1;
      this.send(s, 'joined', { requestId: f.requestId, roomId: room.code, slot: s.side, playerSessionCredential: s.credential, rulesVersion: RULES.version,
        probeId: f.probeId, echoC0: f.c0, s1: received, s2: now, controlGeneration: 0, enabled: true, initialStateSerial: s.authorized, freshSnapshot: room.state }, true);
      this.cache(s, f.requestId); room.slots.forEach(p => { if (p) this.snapshot(p); }); return;
    }
    const r = s.room, state = r.state;
    if (f.type === 'leave' || f.type === 'unavailable') { this.disconnect(s, f.type === 'leave' ? 'leave' : 'hidden'); return; }
    if (f.type === 'input') {
      const issued = s.issued.get(f.processedSnapshotSerial as number);
      if (state.phase !== 'Rally' || !s.enabled || f.controlGeneration !== s.generation || f.resumeStateSerial !== s.authorized || !sameContext(state, f) || (f.seq as number) <= s.seq) return;
      if (!issued?.sent || !issued.ordinary || !issued.snapshot || issued.matchId !== state.matchId || issued.rallyId !== state.rallyId || state.tick - issued.tick > 15) { this.error(s, f, 'resync'); return; }
      if (issued.phase !== 'Rally') return;
      if ((f.x as number) < -350 || (f.x as number) > 700 || (f.y as number) < -250 || (f.y as number) > 500) { this.disconnect(s, 'target'); return; }
      if (s.pending) {
        const coalesced = { kind: 'coalesced', matchId: state.matchId, rallyId: state.rallyId, side: s.side, seq: s.pending.seq, generation: s.generation, supersededBy: f.seq, at: now };
        r.diagnostics.push(coalesced); this.onDiagnostic?.(coalesced);
        if (r.diagnostics.length > 600) r.diagnostics.shift();
      }
      s.seq = f.seq as number; s.pending = f;
      const read = paddle(); target(read, f.x as number, f.y as number);
      s.targets = s.targets.filter(t => now - t.at <= RULES.claimEnvelopeMs); s.targets.push({ x: read.tx, y: read.ty, at: now, matchId: state.matchId, rallyId: state.rallyId, generation: s.generation }); if (s.targets.length > 64) s.targets.shift();
      const record = { kind: 'received', matchId: state.matchId, rallyId: state.rallyId, seq: s.seq, generation: s.generation, side: s.side, received, validated: now, assignedTick: state.tick + 1 };
      r.diagnostics.push(record); this.onDiagnostic?.(record);
      if (r.diagnostics.length > 600) r.diagnostics.shift(); return;
    }
    if (f.type === 'contactClaim') {
      const w = r.wait;
      if (!w || w.claim || w.side !== s.side || f.tick !== w.tick || f.controlGeneration !== s.generation || f.controlGeneration !== w.generation || !s.enabled || !sameContext(state, f)) return;
      if (received >= w.deadline) {
        // The grace window is closed even if no boundary has committed the miss yet.
        const late = { kind: 'claim-late', matchId: state.matchId, rallyId: state.rallyId, side: s.side, tick: w.tick, received, deadline: w.deadline };
        r.diagnostics.push(late); this.onDiagnostic?.(late); if (r.diagnostics.length > 600) r.diagnostics.shift(); return;
      }
      w.claim = f;
      const record = { kind: 'claim-received', matchId: state.matchId, rallyId: state.rallyId, side: s.side, tick: w.tick, hit: f.hit, x: f.x, y: f.y, dx: f.dx, dy: f.dy, received };
      r.diagnostics.push(record); this.onDiagnostic?.(record);
      if (r.diagnostics.length > 600) r.diagnostics.shift(); return;
    }
    if (f.type === 'heartbeat') {
      s.probe = { probeId: f.probeId as number, c0: f.c0 as number, s1: received };
      const issued = s.issued.get(f.processedServerSerial as number), snap = s.issued.get(f.processedSnapshotSerial as number), nonceAt = s.nonces.get(f.echoNonce as string);
      if (!issued?.sent || !issued.ordinary || !snap?.sent || !snap.ordinary || !snap.snapshot || nonceAt === undefined || now - nonceAt > 5000 || (f.runtimeBeatSeq as number) <= s.beatSeq ||
        (f.processedServerSerial as number) <= s.healthSerial || !sameContext(state, f) || f.phase !== state.phase || !sameContext(state, issued as unknown as Frame) ||
        snap.matchId !== state.matchId || f.processedTick !== snap.tick || state.tick - snap.tick > 15) return;
      s.nonces.delete(f.echoNonce as string); s.healthAt = now; s.beatSeq = f.runtimeBeatSeq as number; s.healthSerial = f.processedServerSerial as number;
      if ((f.processedTick as number) > s.healthTick) { s.healthTick = f.processedTick as number; s.tickAt = now; }
      return;
    }
    if (f.type === 'controlFence') {
      const g = f.generation as number;
      if (g >= Number.MAX_SAFE_INTEGER) { this.disconnect(s, 'generation-exhausted'); return; }
      if (g === s.generation + 1 && g < Number.MAX_SAFE_INTEGER) { s.generation = g; s.enabled = false; s.pending = null; s.sync.clear(); }
      else if (g !== s.generation) { this.error(s, f, 'generation'); return; }
      this.ack(s, f, 'fence'); this.cache(s, f.requestId); return;
    }
    if (f.type === 'controlSync') {
      if (f.generation !== s.generation || s.enabled) return;
      this.ack(s, f, 'sync', true); this.cache(s, f.requestId); return;
    }
    if (f.type === 'controlResume') {
      const serial = f.stateSerial as number, issued = s.issued.get(serial);
      if (f.generation !== s.generation || s.enabled) return;
      if (!sameContext(state, f) || state.phase === 'MatchEnded' || state.phase === 'Aborted' || s.sync.get(serial) !== s.generation ||
        !issued?.sent || issued.matchId !== state.matchId || issued.rallyId !== state.rallyId || state.tick - issued.tick > 15) { this.ack(s, f, 'resync', true); return; }
      s.enabled = true; s.authorized = serial; s.sync.clear(); this.ack(s, f, 'resume'); this.cache(s, f.requestId); return;
    }
    if (f.type === 'ready' && state.phase === 'Waiting') {
      if (!this.healthy) { this.error(s, f, 'maintenance'); return; }
      r.ready[s.side] = f.value as boolean;
      if (!this.draining && r.slots.every(Boolean) && r.ready.every(Boolean)) this.begin(r, this.bit());
    } else if (f.type === 'rematch' && state.phase === 'MatchEnded' && f.matchId === state.matchId) {
      r.rematch[s.side] = f.value as boolean;
      if (!this.draining && r.slots.every(Boolean) && r.rematch.every(Boolean)) this.begin(r, state.initialServingSide === 0 ? 1 : 0);
    } else { this.error(s, f, 'phase'); return; }
    r.slots.forEach(p => { if (p) this.snapshot(p); }); this.cache(s, f.requestId);
  }
  private begin(r: Room, side: Side) {
    startMatch(r.state, side); r.endedAt = null; r.rematch = [false, false]; r.wait = null;
    r.sources = [0, 1].map(() => ({ seq: 0, generation: 0, publishedTick: r.state.tick, firstUsed: false }));
    r.slots.forEach(p => { if (p) { p.pending = null; p.seq = 0; p.tickAt = this.now(); p.healthTick = r.state.tick; p.sync.clear(); } });
  }
  private closeSocket(s: Session, reason: string) {
    if (s.closing !== null) return;
    s.closing = this.now(); s.enabled = false; s.pending = null; s.queue = []; s.credential = ''; s.sync.clear(); s.issued.clear(); s.responses.clear(); s.nonces.clear();
    s.events = []; s.latest = null; s.transport.close(1000, reason.slice(0, 100));
  }
  disconnect(s: Session, reason: string) {
    if (s.closing !== null) return;
    const r = s.room;
    if (r) {
      // The defender's own interruption during a pending claim first commits the original miss/finish, exactly as a
      // timeout would (plan §5 amendment); contactPending must not become an escape. Server-side causes still abort.
      if (r.wait && r.slots[r.wait.side] === s && !['server-overrun', 'expired', 'server-shutdown'].includes(reason)) {
        const now = this.now(); r.wait.claim = null; this.resolveWait(r, now, reason);
        this.commit(r, now, this.onDiagnostic ? structuredClone(r.state) : null, this.onDiagnostic ? structuredClone(r.sources) : null);
      }
      if (r.state.phase === 'Waiting') {
        r.slots[s.side] = null; r.ready = [false, false]; s.room = null;
        r.slots.forEach(p => { if (p) this.snapshot(p); });
        if (!r.slots.some(Boolean)) this.rooms.delete(r.code);
      } else {
        if (r.state.phase !== 'MatchEnded') { r.state.phase = 'Aborted'; r.state.result = null; }
        r.slots.forEach(p => { if (p) {
          // Do not recursively enqueue interruption into the already failing transport.
          if (p.transport.bufferedAmount <= LIMITS.softBuffer && p.events.length < LIMITS.events) this.send(p, 'interrupted', { reason, freshSnapshot: r.state });
          this.closeSocket(p, reason); p.room = null;
        } });
        r.diagnostics = []; r.slots = [null, null]; this.rooms.delete(r.code);
      }
    }
    this.closeSocket(s, reason);
  }
  /** A Rally tick that would commit a miss/finish for an enabled defender pauses for that defender's claim instead. */
  private beginWait(r: Room, now: number) {
    if (r.state.phase !== 'Rally') return false;
    const trial = structuredClone(r.state), end = step(trial).find(e => e.type === 'miss' || e.type === 'finish');
    if (!end || end.side === null) return false;
    const p = r.slots[end.side];
    if (!p?.enabled || p.closing !== null) return false;
    r.wait = { side: end.side, tick: r.state.tick + 1, deadline: now + RULES.contactGraceMs, generation: p.generation, claim: null };
    this.send(p, 'contactPending', { matchId: r.state.matchId, rallyId: r.state.rallyId, tick: r.wait.tick, side: end.side, incomingViewBoxes: r.state.viewBoxes });
    const record = { kind: 'contact-pending', matchId: r.state.matchId, rallyId: r.state.rallyId, side: end.side, tick: r.wait.tick, at: now };
    r.diagnostics.push(record); this.onDiagnostic?.(record); if (r.diagnostics.length > 600) r.diagnostics.shift();
    return true;
  }
  /** Install a reachable claimed hit pose; the ordinary deterministic step then decides contact. Anything else keeps the miss. */
  private resolveWait(r: Room, now: number, interrupted: string | null = null) {
    const w = r.wait!, f = w.claim, p = r.slots[w.side], actor = r.state.localPaddles[w.side]; r.wait = null;
    let accepted = false;
    if (f && f.hit === true && p?.enabled && p.generation === w.generation && sameContext(r.state, f) && f.tick === r.state.tick + 1) {
      // Only targets of this match/rally/control generation: a fence discards earlier targets for the claim too.
      const recent = p.targets.filter(t => now - t.at <= RULES.claimEnvelopeMs && sameContext(r.state, t as unknown as Frame) && t.generation === w.generation);
      // Poses: authoritative C−1, its predecessor C−2 (a fresh rebase may carry that step's displacement) and targets.
      const raw = (axis: 'x' | 'y') => [actor[axis], actor[axis] - actor[axis === 'x' ? 'dx' : 'dy'], actor[axis === 'x' ? 'tx' : 'ty'], ...recent.map(t => t[axis])];
      const axis = (values: number[], lo: number, hi: number) => {
        const clamped = values.map(v => Math.max(lo, Math.min(hi, v)));
        return { lo: Math.min(...clamped), hi: Math.max(...clamped), reach: (Math.max(...values) - Math.min(...values)) / RULES.easing };
      };
      const ax = axis(raw('x'), 55, 296), ay = axis(raw('y'), 45, 206);
      const x = f.x as number, y = f.y as number, dx = f.dx as number, dy = f.dy as number;
      // The client reaches poses through the same binary64 easing; allow its rounding, not extra reach.
      const e = 1e-9, inside = (v: number, a: typeof ax) => v >= a.lo - e && v <= a.hi + e;
      // Pose and previous pose both lie in the clamped envelope; one easing step is bounded by the UNCLAMPED target
      // spread, because a target beyond the field still eases a full step before the paddle is clamped at the wall.
      if (inside(x, ax) && inside(y, ay) && inside(x - dx, ax) && inside(y - dy, ay) && Math.abs(dx) <= ax.reach + e && Math.abs(dy) <= ay.reach + e) {
        actor.x = actor.px = x; actor.y = actor.py = y; actor.dx = dx; actor.dy = dy; r.state.viewBoxes = boxes(r.state); accepted = true;
      }
    }
    const record = { kind: 'contact-resolved', matchId: r.state.matchId, rallyId: r.state.rallyId, side: w.side, tick: w.tick, claimed: !!f, hit: f?.hit ?? null, accepted,
      timedOut: !f && !interrupted && now >= w.deadline, interrupted, at: now };
    r.diagnostics.push(record); this.onDiagnostic?.(record); if (r.diagnostics.length > 600) r.diagnostics.shift();
  }
  /** One synchronous simulation transaction and its publication: events, then the resulting snapshot. */
  private commit(r: Room, now: number, before: OnlineState | null, priorSources: Room['sources'] | null) {
    const beforeRally = r.state.rallyId;
    const events = step(r.state);
    if (r.state.phase === 'Rally') r.state.localPaddles.forEach((actor, side) => {
      const old = r.sources[side]; r.sources[side] = { seq: actor.seq, generation: actor.generation, publishedTick: r.state.tick,
        firstUsed: old.seq === actor.seq && old.generation === actor.generation && old.firstUsed };
    });
    this.onDiagnostic?.({ kind: 'tick', nominal: this.boundary, committed: this.now(), before, after: r.state, priorSources, publishedSources: r.sources, events });
    for (const event of events) r.slots.forEach(p => { if (p) this.send(p, 'event', { ...event, eventType: event.type, lives: [...r.state.lives], result: r.state.result, freshSnapshot: r.state }); });
    if (r.state.phase !== 'Rally') r.slots.forEach(p => { if (p) p.pending = null; });
    if (r.state.rallyId !== beforeRally) {
      r.slots.forEach(p => { if (p) p.pending = null; });
      r.sources = [0, 1].map(() => ({ seq: 0, generation: 0, publishedTick: r.state.tick, firstUsed: false }));
    }
    if (r.state.result !== null && r.endedAt === null) r.endedAt = now;
    r.slots.forEach(p => { if (p) this.snapshot(p); }); this.metrics.ticks++;
  }
  /** Call at <=100 ms, before physics. Network callbacks only enqueue commands. */
  pump() {
    const now = this.now();
    const began = performance.now(), lateness = now >= this.boundary ? now - this.boundary : null;
    for (const s of this.sessions) {
      if (s.closing !== null) { if (now - s.closing >= LIMITS.cleanupMs - 100) { s.transport.terminate(); this.sessions.delete(s); } continue; }
      if (!s.room && now - s.opened >= 5000 || s.room && (now - s.healthAt >= 5000 || ticking(s.room.state.phase) && now - s.tickAt >= 5000)) { this.disconnect(s, 'runtime-timeout'); continue; }
      if (s.transport.bufferedAmount >= LIMITS.hardBuffer || s.congested !== null && now - s.congested >= 2000) { this.disconnect(s, 'congestion'); continue; }
      for (const item of s.queue.splice(0)) { if (s.closing === null) this.process(s, item.frame, item.received); }
      this.flush(s);
    }
    for (const r of this.rooms.values()) {
      if (r.state.phase !== 'Rally') r.slots.forEach(p => { if (p) p.pending = null; });
      if (now - r.created >= LIMITS.ttlMs || r.state.phase === 'Waiting' && now - r.created >= LIMITS.waitingMs || r.endedAt !== null && now - r.endedAt >= LIMITS.endedMs) {
        const p = r.slots.find(Boolean); if (p) this.disconnect(p, 'expired');
      }
    }
    const due = now < this.boundary ? 0 : Math.floor((now - this.boundary) / (1000 / 30)) + 1;
    if (due > 5) {
      this.healthy = false; this.metrics.overruns++; this.boundary = now + 1000 / 30;
      for (const r of this.rooms.values()) if (ticking(r.state.phase)) { const p = r.slots.find(Boolean); if (p) this.disconnect(p, 'server-overrun'); }
    } else {
      if (due > 0) this.healthy = true;
      for (let i = 0; i < due; i++) {
        for (const r of this.rooms.values()) if (ticking(r.state.phase)) {
          let before: OnlineState | null, priorSources: Room['sources'] | null;
          if (r.wait) {
            // Paused before an uncommitted miss: no tick, no input consumption; unchanged snapshots keep both runtimes live.
            const w = r.wait, defender = r.slots[w.side];
            if (!w.claim && now < w.deadline && defender?.enabled && defender.closing === null && defender.generation === w.generation) {
              r.slots.forEach(p => { if (p) this.snapshot(p); }); continue;
            }
            this.resolveWait(r, now);
            before = this.onDiagnostic ? structuredClone(r.state) : null;
            priorSources = this.onDiagnostic ? structuredClone(r.sources) : null;
          } else {
          before = this.onDiagnostic ? structuredClone(r.state) : null;
          priorSources = this.onDiagnostic ? structuredClone(r.sources) : null;
          const ballRuns = r.state.phase === 'Rally' || r.state.phase === 'Countdown' && r.state.tick + 1 >= r.state.phaseDeadline;
          if (ballRuns) r.sources.forEach((source, side) => {
            if (source.seq > 0 && !source.firstUsed) {
              source.firstUsed = true;
              this.onDiagnostic?.({ kind: 'first-use', matchId: r.state.matchId, rallyId: r.state.rallyId, side, seq: source.seq,
                generation: source.generation, publishedTick: source.publishedTick, tick: r.state.tick + 1, used: this.now() });
            }
          });
          r.slots.forEach(p => {
            if (!p?.pending) return;
            const f = p.pending; p.pending = null;
            if (r.state.phase !== 'Rally' || !p.enabled || f.controlGeneration !== p.generation || !sameContext(r.state, f)) return;
            const actor = r.state.localPaddles[p.side]; target(actor, f.x as number, f.y as number); actor.seq = f.seq as number; actor.generation = p.generation; actor.appliedTick = r.state.tick + 1;
            this.onDiagnostic?.({ kind: 'consumed', matchId: r.state.matchId, rallyId: r.state.rallyId, seq: actor.seq, generation: p.generation, side: p.side, tick: actor.appliedTick, consumed: this.now() });
          });
          if (this.beginWait(r, now)) { r.slots.forEach(p => { if (p) this.snapshot(p); }); continue; }
          }
          this.commit(r, now, before, priorSources);
        }
        this.boundary += 1000 / 30;
      }
    }
    for (const s of this.sessions) if (s.room && s.closing === null && now - s.heartbeatAt >= 1000) {
      s.heartbeatAt = now; const nonce = randomBytes(12).toString('hex'); s.nonces.set(nonce, now);
      while (s.nonces.size > 6) s.nonces.delete(s.nonces.keys().next().value!);
      const probe = s.probe; s.probe = null;
      this.send(s, 'heartbeat', { nonce, ...(probe ? { echoProbeId: probe.probeId, echoC0: probe.c0, s1: probe.s1, s2: now } : {}) }, true);
    }
    if (lateness !== null) {
      this.lateness.push(lateness); this.batches.push(performance.now() - began);
      if (this.lateness.length > 600) { this.lateness.shift(); this.batches.shift(); }
    }
  }
  shutdown() { this.draining = true; for (const s of this.sessions) this.disconnect(s, 'server-shutdown'); }
}
