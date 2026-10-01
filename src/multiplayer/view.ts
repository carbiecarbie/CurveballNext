import { contact, move, ownBox, target } from './simulation';
import { ticking, type Bounds, type ContactClaim, type ContactPending, type OnlineEvent, type OnlineState, type Paddle, type Side } from './types';
export interface Rect { left: number; right: number; top: number; bottom: number }
export interface DrawModel { ball: Rect; own: Rect; remote: Rect; z: number; tick: number; missed: boolean; incomingEventId: number | null; sourceTicks: [number, number]; renderedAt: number; snapshotAge: number; frozen: boolean; degraded: boolean; overlayAllowed: boolean;
  bufferMs: number; estimatedServerNow: number; sourceServerTimes: [number, number]; interpolationUnderflow: boolean; predictedLocal: Paddle | null }
const rect = (b: Bounds): Rect => ({ left: b[0] / 20, right: b[1] / 20, top: b[2] / 20, bottom: b[3] / 20 });
const blend = (a: Rect, b: Rect, t: number): Rect => ({ left: a.left + (b.left - a.left) * t, right: a.right + (b.right - a.right) * t, top: a.top + (b.top - a.top) * t, bottom: a.bottom + (b.bottom - a.bottom) * t });
export class OnlineView {
  samples: { state: OnlineState; time: number }[] = []; events: { event: OnlineEvent; time: number; sampled: boolean; incomingOwn: Rect | null }[] = [];
  history: { at: number; x: number; y: number; seq: number; matchId: number; rallyId: number }[] = []; frames: DrawModel[] = [];
  predicted: Paddle | null = null; private previous: Paddle | null = null; private next = 0; private renderTime = -Infinity;
  corrections: { at: number; matchId: number; rallyId: number; tick: number; acknowledgedSeq: number; from: Rect; to: Rect; distance: number; blendMs: number }[] = [];
  private correction: { from: Rect; at: number } | null = null; private lastEvent = 0; private drawnEvent = 0; private pending: OnlineState | null = null;
  private heldIncomingOwn: Rect | null = null; private heldIncomingPrediction: Paddle | null = null;
  private stoppedTransactions = new Map<string, { tail: number; own: Rect; prediction: Paddle | null }>();
  onBoundary: (e: OnlineEvent, preceding: DrawModel | null, incoming: DrawModel) => void = () => {};
  onAudio: (e: OnlineEvent) => void = () => {};
  onClaim: (c: ContactClaim) => void = () => {};
  private contactWait: (ContactPending & { time: number; done: boolean }) | null = null;
  private claims = new Map<string, { own: Rect; prediction: Paddle | null }>();
  constructor(public side: Side, private now: () => number) {}
  /** The authority paused an uncommitted miss; claim from the frame where this transaction is presented. */
  pendingContact(p: ContactPending, serverTime: number) { if (p.side === this.side) this.contactWait = { ...p, time: serverTime, done: false }; }
  input(x: number, y: number, seq: number, capturedAt = this.now()) {
    if (!this.predicted || this.samples.at(-1)?.state.phase !== 'Rally') return;
    target(this.predicted, x, y);
    const state = this.samples.at(-1)!.state;
    const input = { at: capturedAt, x, y, seq, matchId: state.matchId, rallyId: state.rallyId };
    if (this.history.at(-1)?.seq === seq) this.history[this.history.length - 1] = input; else this.history.push(input);
    this.history = this.history.filter(h => h.at >= this.now() - 2000); if (this.history.length > 60) this.history.shift();
  }
  private stopPrediction() { this.history = []; this.predicted = null; this.previous = null; this.correction = null; }
  fence() { this.stopPrediction(); this.heldIncomingOwn = null; this.heldIncomingPrediction = null; this.contactWait = null; }
  private rebase(s: OnlineState) {
    if (s.phase !== 'Rally') { this.stopPrediction(); return; }
    const from = this.predicted ? rect(ownBox(this.predicted)) : null;
    this.predicted = structuredClone(s.localPaddles[this.side]); this.previous = structuredClone(this.predicted);
    this.history = this.history.filter(h => h.matchId === s.matchId && h.rallyId === s.rallyId && h.seq > this.predicted!.seq && h.at >= this.now() - 2000);
    for (const h of this.history) { target(this.predicted, h.x, h.y); move(this.predicted); }
    const to = rect(ownBox(this.predicted));
    const distance = from ? Math.hypot(from.left - to.left, from.top - to.top) : 0;
    this.correction = from && distance <= 4 ? { from, at: this.now() } : null;
    if (from) {
      this.corrections.push({ at: this.now(), matchId: s.matchId, rallyId: s.rallyId, tick: s.tick, acknowledgedSeq: s.localPaddles[this.side].seq, from, to, distance, blendMs: distance <= 4 ? 100 : 0 });
      if (this.corrections.length > 600) this.corrections.shift();
    }
    this.next = this.now() + 1000 / 30;
  }
  accept(s: OnlineState, serverTime: number, event?: OnlineEvent) {
    const old = this.samples.at(-1)?.state;
    if (old && (s.matchId < old.matchId || s.matchId === old.matchId && (s.tick < old.tick || s.rallyId < old.rallyId || s.lives.some((n, i) => n > old.lives[i])))) return;
    if (old && (s.matchId !== old.matchId || s.rallyId !== old.rallyId || old.phase !== 'Rally' && s.phase === 'Rally')) this.stopPrediction();
    if (old?.phase === 'Rally' && s.phase !== 'Rally' && event) {
      const frame = this.frames.at(-1);
      if (frame) {
        this.stoppedTransactions.set(`${s.matchId}/${s.rallyId}/${s.tick}`, { tail: s.lastEventId,
          own: { ...frame.own }, prediction: frame.predictedLocal ? structuredClone(frame.predictedLocal) : null });
        if (this.stoppedTransactions.size > 32) throw new Error('Presentation transaction overflow');
      }
    }
    if (event && event.eventId > this.lastEvent) {
      this.lastEvent = event.eventId;
      this.events.push({ event, time: serverTime, sampled: false, incomingOwn: null });
      if (this.events.length > 32) throw new Error('Presentation event overflow');
    }
    this.samples.push({ state: structuredClone(s), time: serverTime }); if (this.samples.length > 60) this.samples.shift();
    // Every event carries the FINAL state of its simulation transaction. Even a
    // preceding wall can therefore carry Hold/MatchEnded. Defer the entire tail,
    // including not-yet-delivered events identified by lastEventId.
    // A contact-claim pause repeats the same Rally tick: there is no new authoritative motion, so rebasing would pull the
    // shown paddle back to the unmoved pose exactly while the defender's claim frame is due. Keep predicting instead.
    const paused = !event && !!this.predicted && old?.phase === 'Rally' && s.phase === 'Rally' && s.matchId === old.matchId && s.rallyId === old.rallyId && s.tick === old.tick;
    if (this.pending || this.events.some(e => e.event.eventId > this.drawnEvent)) this.pending = structuredClone(s);
    else if (!paused) this.rebase(s);
    if (s.phase !== 'Rally') {
      // Freeze the actual preceding draw, never substitute corrected contact geometry.
      if (old?.phase === 'Rally' && this.pending) {
        const frame = this.frames.at(-1);
        this.heldIncomingOwn = frame ? { ...frame.own } : null;
        this.heldIncomingPrediction = frame?.predictedLocal ? structuredClone(frame.predictedLocal) : null;
      }
      this.stopPrediction();
    }
  }
  draw(serverNow: number, rtt: number, enabled: boolean, closed = false): DrawModel | null {
    if (!this.samples.length) return null;
    const now = this.now(), latest = this.samples.at(-1)!;
    const rally = latest.state.phase === 'Rally' && !closed;
    if (enabled && rally && !this.predicted) this.rebase(latest.state);
    if (!rally) this.stopPrediction();
    if (!enabled || closed) this.fence();
    if (this.predicted) {
      let due = 0;
      while (now >= this.next && due++ < 5) {
        this.previous = structuredClone(this.predicted);
        if (latest.state.phase === 'Rally') move(this.predicted);
        this.next += 1000 / 30;
      }
      if (due > 5) this.next = now + 1000 / 30;
    }
    const delay = Math.max(66.7, Math.min(166.7, rtt / 2 + 66.7));
    this.renderTime = Math.max(this.renderTime, serverNow - delay);
    const time = this.renderTime, older = this.samples.filter(s => s.time <= time).at(-1) ?? this.samples[0];
    const newer = this.samples.find(s => s.time > time) ?? older;
    const a = older.state.viewBoxes[this.side], b = newer.state.viewBoxes[this.side];
    const same = older.state.matchId === newer.state.matchId && older.state.rallyId === newer.state.rallyId && older.state.lastEventId === newer.state.lastEventId;
    const alpha = same && newer.time > older.time ? Math.max(0, Math.min(1, (time - older.time) / (newer.time - older.time))) : 0;
    let own = rally ? rect(a.own) : this.heldIncomingOwn ?? rect(latest.state.viewBoxes[this.side].own);
    if (this.predicted && this.previous) {
      const t = Math.max(0, Math.min(1, 1 - (this.next - now) / (1000 / 30)));
      own = blend(rect(ownBox(this.previous)), rect(ownBox(this.predicted)), t);
      if (this.correction) own = blend(this.correction.from, own, Math.min(1, (now - this.correction.at) / 100));
    }
    const age = serverNow - latest.time, previousFrame = this.frames.at(-1) ?? null;
    let model: DrawModel = { ball: blend(rect(a.ball), rect(b.ball), alpha), own, remote: rally ? blend(rect(a.remote), rect(b.remote), alpha) : rect(latest.state.viewBoxes[this.side].remote),
      z: this.side === 0 ? older.state.ball.z : 75 - older.state.ball.z, tick: older.state.tick,
      missed: older.state.phase === 'LifeLostHold' || older.state.phase === 'MatchEnded', incomingEventId: null,
      sourceTicks: [older.state.tick, newer.state.tick], renderedAt: now, snapshotAge: age, frozen: ticking(latest.state.phase) && age > 500, degraded: ticking(latest.state.phase) && age > 250,
      bufferMs: delay, estimatedServerNow: serverNow, sourceServerTimes: [older.time, newer.time], interpolationUnderflow: time > latest.time,
      predictedLocal: this.predicted ? structuredClone(this.predicted) : this.heldIncomingPrediction ? structuredClone(this.heldIncomingPrediction) : null,
      overlayAllowed: !this.events.some(e => e.event.eventId > this.drawnEvent && e.event.type === 'finish') };
    const w = this.contactWait;
    if (w && !w.done && time >= w.time && !model.frozen) {
      w.done = true;
      if (this.predicted && rally && latest.state.matchId === w.matchId && latest.state.rallyId === w.rallyId) {
        // The claim frame: exact predicted pose (no blend) against the incoming C−1 ball, so the claim is what was shown.
        const box = ownBox(this.predicted), prediction = structuredClone(this.predicted), v = w.incomingViewBoxes[this.side];
        own = rect(box);
        model = { ...model, ball: rect(v.ball), own, remote: rect(v.remote), tick: w.tick - 1, sourceTicks: [w.tick - 1, w.tick - 1], predictedLocal: prediction };
        this.claims.set(`${w.matchId}/${w.rallyId}/${w.tick}`, { own, prediction }); if (this.claims.size > 8) this.claims.delete(this.claims.keys().next().value!);
        this.onClaim({ matchId: w.matchId, rallyId: w.rallyId, tick: w.tick, hit: contact(v.ball, box), x: prediction.x, y: prediction.y, dx: prediction.dx, dy: prediction.dy });
      }
    }
    const dueEvents = this.events.filter(e => e.time <= time && e.event.eventId > this.drawnEvent);
    for (const e of dueEvents) {
      if (['return', 'miss', 'finish'].includes(e.event.type)) break;
      this.drawnEvent = e.event.eventId; this.onAudio(e.event);
    }
    this.events = this.events.filter(e => e.event.eventId > this.drawnEvent);
    const boundary = this.events.find(e => e.time <= time && e.event.eventId > this.drawnEvent);
    if (boundary) {
      const e = boundary.event;
      if (['return', 'miss', 'finish'].includes(e.type) && !boundary.sampled && !model.frozen) {
        const key = `${e.matchId}/${e.rallyId}/${e.tick}`, stopped = this.stoppedTransactions.get(key), claimed = this.claims.get(key);
        // A claimed transaction presents the pose that was claimed; otherwise the actual preceding draw.
        if (claimed && !closed) { own = { ...claimed.own }; model.predictedLocal = claimed.prediction ? structuredClone(claimed.prediction) : null; this.claims.delete(key); }
        else if (stopped && !closed) { own = { ...stopped.own }; model.predictedLocal = stopped.prediction ? structuredClone(stopped.prediction) : null; }
        boundary.sampled = true; boundary.incomingOwn = own;
        model = { ...model, ball: rect(e.incomingViewBoxes[this.side].ball), own, remote: rect(e.incomingViewBoxes[this.side].remote),
          tick: e.incomingBoxTick, incomingEventId: e.eventId, sourceTicks: [e.incomingBoxTick, e.incomingBoxTick], overlayAllowed: false };
        this.onBoundary(e, previousFrame, model);
      } else if (!model.frozen) {
        this.drawnEvent = e.eventId; this.onAudio(e); model.overlayAllowed = true;
        this.heldIncomingOwn = null; this.heldIncomingPrediction = null;
        if (this.pending && this.pending.lastEventId <= this.drawnEvent) {
          if (enabled && rally) this.rebase(this.pending); else this.stopPrediction();
          this.pending = null;
        }
        const endpoint = this.samples.find(s => s.state.lastEventId >= e.eventId)?.state;
        if (endpoint) { const v = endpoint.viewBoxes[this.side]; model = { ...model, ball: rect(v.ball), remote: rally ? rect(v.remote) : rect(latest.state.viewBoxes[this.side].remote), own: this.predicted ? rect(ownBox(this.predicted)) : rect(latest.state.viewBoxes[this.side].own), predictedLocal: this.predicted ? structuredClone(this.predicted) : null, tick: endpoint.tick }; }
        this.events = this.events.filter(e => e.event.eventId > this.drawnEvent);
      }
    }
    for (const [key, transaction] of this.stoppedTransactions) if (transaction.tail <= this.drawnEvent) this.stoppedTransactions.delete(key);
    // Wall-only transactions also settle once their complete tail was presented.
    if (this.pending && this.pending.lastEventId <= this.drawnEvent && !this.events.length) {
      if (enabled && rally) this.rebase(this.pending); else this.stopPrediction();
      this.pending = null; this.heldIncomingOwn = null; this.heldIncomingPrediction = null;
    }
    if (model.frozen && previousFrame) model = { ...previousFrame, renderedAt: now, snapshotAge: age, frozen: true, degraded: true, overlayAllowed: false };
    this.frames.push(model); if (this.frames.length > 600) this.frames.shift(); return model;
  }
}
