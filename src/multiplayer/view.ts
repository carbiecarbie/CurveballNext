import { advanceBall, ballBox, contact, move, ownBox, reflect, target } from './simulation';
import { ticking, type Ball, type Bounds, type ContactClaim, type ContactPending, type OnlineEvent, type OnlineState, type Paddle, type Side } from './types';
export interface Rect { left: number; right: number; top: number; bottom: number }
export interface DrawModel { ball: Rect; own: Rect; remote: Rect; z: number; tick: number; missed: boolean; incomingEventId: number | null; sourceTicks: [number, number]; renderedAt: number; snapshotAge: number; frozen: boolean; degraded: boolean; overlayAllowed: boolean;
  bufferMs: number; estimatedServerNow: number; sourceServerTimes: [number, number]; interpolationUnderflow: boolean; predictedLocal: Paddle | null;
  /** Server time at which the ball is presented, and whether it was predicted beyond the latest snapshot (plan §5 incoming-ball amendment). */
  ballTime: number; ballPredicted: boolean }
const rect = (b: Bounds): Rect => ({ left: b[0] / 20, right: b[1] / 20, top: b[2] / 20, bottom: b[3] / 20 });
const blend = (a: Rect, b: Rect, t: number): Rect => ({ left: a.left + (b.left - a.left) * t, right: a.right + (b.right - a.right) * t, top: a.top + (b.top - a.top) * t, bottom: a.bottom + (b.bottom - a.bottom) * t });
const TICK = 1000 / 30;
interface Claimed { hit: boolean; own: Rect; prediction: Paddle; frame: DrawModel | null; preceding: DrawModel | null }
interface BallFrame { ball: Rect; z: number; tick: number; sourceTicks: [number, number]; missed: boolean; predicted: boolean; crossing: { tick: number; key: string; incoming: Bounds } | null }
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
  /** Claims made from this defender's presented frames, keyed by match/rally/crossing tick. */
  private claims = new Map<string, Claimed>();
  /**
   * Evidence of every claim frame presented per crossing, kept through a fence (unlike the control claims above): the event
   * labels the frame whose pose the authority installed, so a blur between application and confirmation keeps the link.
   */
  private evidence = new Map<string, Claimed[]>();
  /** Last presented predicted ball position (fractional tick) per match/rally: the presented flight never steps back. */
  private ballPos: { key: string; pos: number } | null = null;
  /** Audio keys already played, so a predicted sound is not repeated by its authoritative event. */
  private played = new Set<string>();
  private ballTime = -Infinity; private lastDraw = -Infinity;
  constructor(public side: Side, private now: () => number) {}
  /** How far ahead of the estimated server clock the incoming ball is presented: upstream transit, one tick and a jitter margin. */
  lead(rtt: number) { return Math.max(TICK, Math.min(150, rtt / 2 + TICK + 10)); }
  /** Claims are proactive now; a pause notice needs no separate state (the presented crossing claims either way). */
  pendingContact(_p: ContactPending, _serverTime: number) {}
  input(x: number, y: number, seq: number, capturedAt = this.now()) {
    if (!this.predicted || this.samples.at(-1)?.state.phase !== 'Rally') return;
    target(this.predicted, x, y);
    const state = this.samples.at(-1)!.state;
    const input = { at: capturedAt, x, y, seq, matchId: state.matchId, rallyId: state.rallyId };
    if (this.history.at(-1)?.seq === seq) this.history[this.history.length - 1] = input; else this.history.push(input);
    this.history = this.history.filter(h => h.at >= this.now() - 2000); if (this.history.length > 60) this.history.shift();
  }
  private stopPrediction() { this.history = []; this.predicted = null; this.previous = null; this.correction = null; }
  // A fence also drops this defender's claims: the authority discards them with the old control generation, so a resumed
  // defender must claim (and predict) its next crossing afresh.
  fence() { this.stopPrediction(); this.heldIncomingOwn = null; this.heldIncomingPrediction = null; this.claims.clear(); }
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
  /** Play a cue once per transaction/tick/type, whether it was predicted first or arrived as an authoritative event. */
  private sound(e: OnlineEvent) {
    const key = `${e.matchId}/${e.rallyId}/${e.tick}/${e.type}`;
    if (this.played.has(key)) return;
    this.played.add(key); if (this.played.size > 64) this.played.delete(this.played.values().next().value!);
    this.onAudio(e);
  }
  private cue(s: OnlineState, tick: number, type: OnlineEvent['type'], side: Side | null) {
    this.sound({ type, side, matchId: s.matchId, rallyId: s.rallyId, tick, eventId: 0, incomingBoxTick: tick - 1, incomingViewBoxes: s.viewBoxes, lives: [...s.lives], result: s.result });
  }
  /**
   * The ball while this side defends: deterministic flight from the latest authoritative state (walls and curve only
   * change at a paddle). It stops at an unresolved end-plane crossing (the C−1 box), unless this defender's own claim
   * reported a hit, whose return is then exactly what the authority computes from the claimed pose.
   */
  private predictBall(latest: { state: OnlineState; time: number }, t: number, dt: number): BallFrame {
    const s = latest.state, key = `${s.matchId}/${s.rallyId}`;
    let steps = Math.max(0, (t - latest.time) / TICK);
    // A new anchor (e.g. the first tick after a claim pause) must not pull the flight back: continue from what was
    // shown at no less than 0.75× until the anchored prediction catches up.
    if (this.ballPos?.key === key) steps = Math.max(steps, this.ballPos.pos + .75 * dt / TICK - s.tick);
    this.ballPos = { key, pos: s.tick + steps };
    const n = Math.floor(steps), frac = steps - n;
    const balls: Ball[] = [structuredClone(s.ball)];
    const frame = (b: Ball, tick: number, crossing: BallFrame['crossing']): BallFrame =>
      ({ ball: rect(ballBox(b, this.side)), z: this.side === 0 ? b.z : 75 - b.z, tick, sourceTicks: [tick, tick], missed: false, predicted: true, crossing });
    for (let k = 1; k <= n + 1; k++) {
      const b = structuredClone(balls[k - 1]), tick = s.tick + k, shown = k <= n, walls: OnlineEvent['type'][] = [];
      const crossed = advanceBall(b, type => walls.push(type));
      if (crossed !== null) {
        const key = `${s.matchId}/${s.rallyId}/${tick}`, claim = crossed === this.side ? this.claims.get(key) : undefined;
        // An unresolved crossing holds the C−1 ball; its tick (and walls) is presented only by the authoritative event.
        if (!claim) return frame(balls[k - 1], tick - 1, crossed === this.side ? { tick, key, incoming: ballBox(balls[k - 1], this.side) } : null);
        // A claimed miss: the authority stops the ball where this tick left it, past the plane. Show that, held.
        if (!claim.hit) return frame(b, tick, null);
        reflect(b, crossed, claim.prediction);
      }
      // Same order as the authority's events: walls of the tick, then the return.
      if (shown) { for (const type of walls) this.cue(s, tick, type, null); if (crossed === this.side) this.cue(s, tick, 'return', this.side); }
      balls.push(b);
    }
    const a = rect(ballBox(balls[n], this.side)), b = rect(ballBox(balls[n + 1], this.side));
    return { ...frame(balls[n], s.tick + n, null), ball: blend(a, b, frac), sourceTicks: [s.tick + n, s.tick + n + 1] };
  }
  private ballFrame(t: number, dt: number): BallFrame {
    const latest = this.samples.at(-1)!;
    // Anchor prediction at the FIRST sample of the latest tick: a claim pause repeats that tick with later send times,
    // and re-anchoring on each would step the predicted flight backward.
    const sameTick = (x: OnlineState) => x.matchId === latest.state.matchId && x.rallyId === latest.state.rallyId && x.tick === latest.state.tick && x.lastEventId === latest.state.lastEventId;
    const anchor = this.samples.find(x => sameTick(x.state)) ?? latest;
    if (t > anchor.time && latest.state.phase === 'Rally' && this.predicted) return this.predictBall(anchor, t, dt);
    const older = this.samples.filter(s => s.time <= t).at(-1) ?? this.samples[0], newer = this.samples.find(s => s.time > t) ?? older;
    const same = older.state.matchId === newer.state.matchId && older.state.rallyId === newer.state.rallyId && older.state.lastEventId === newer.state.lastEventId;
    const alpha = same && newer.time > older.time ? Math.max(0, Math.min(1, (t - older.time) / (newer.time - older.time))) : 0;
    return { ball: blend(rect(older.state.viewBoxes[this.side].ball), rect(newer.state.viewBoxes[this.side].ball), alpha),
      z: this.side === 0 ? older.state.ball.z : 75 - older.state.ball.z, tick: older.state.tick, sourceTicks: [older.state.tick, newer.state.tick],
      missed: older.state.phase === 'LifeLostHold' || older.state.phase === 'MatchEnded', predicted: false, crossing: null };
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
    // Ball clock: buffered (time) while the ball is far, ahead of the estimated server clock by lead() as it reaches this
    // defender, so the defender's inputs and its claim reach the authority by the crossing tick. Rate-limited, monotonic.
    let goal = time;
    if (this.predicted && rally) {
      // The latest snapshot lags the presented ball, so the full lead is reached once it is within 20% of the court of
      // this side (15 of 75 depth units), not only at the plane: claims then leave with the planned margin.
      const depth = this.side === 0 ? latest.state.ball.z : 75 - latest.state.ball.z, u = Math.max(0, Math.min(1, (1 - depth / 75) / .8));
      goal = time + u * u * (3 - 2 * u) * Math.max(0, serverNow + this.lead(rtt) - time);
    }
    const dt = Number.isFinite(this.lastDraw) ? Math.max(0, now - this.lastDraw) : 0, prior = this.ballTime;
    // Within 0.75–1.35× real time, also when the buffered time itself jumps (RTT/offset changes); only a large
    // discontinuity (first frame, stall, new timeline) snaps.
    let ballTime = !Number.isFinite(prior) || Math.abs(goal - prior) > 500 ? goal : goal >= prior ? Math.max(prior + dt * .75, Math.min(goal, prior + dt * 1.35)) : prior + dt * .75;
    if (Number.isFinite(prior)) ballTime = Math.max(ballTime, prior);
    this.ballTime = ballTime; this.lastDraw = now;
    const shown = this.ballFrame(ballTime, dt);
    let own = rally ? rect(a.own) : this.heldIncomingOwn ?? rect(latest.state.viewBoxes[this.side].own);
    if (this.predicted && this.previous) {
      const t = Math.max(0, Math.min(1, 1 - (this.next - now) / (1000 / 30)));
      own = blend(rect(ownBox(this.previous)), rect(ownBox(this.predicted)), t);
      if (this.correction) own = blend(this.correction.from, own, Math.min(1, (now - this.correction.at) / 100));
    }
    const age = serverNow - latest.time, previousFrame = this.frames.at(-1) ?? null;
    let model: DrawModel = { ball: shown.ball, own, remote: rally ? blend(rect(a.remote), rect(b.remote), alpha) : rect(latest.state.viewBoxes[this.side].remote),
      z: shown.z, tick: shown.tick, missed: shown.missed, incomingEventId: null,
      sourceTicks: shown.sourceTicks, renderedAt: now, snapshotAge: age, frozen: ticking(latest.state.phase) && age > 500, degraded: ticking(latest.state.phase) && age > 250,
      bufferMs: delay, estimatedServerNow: serverNow, sourceServerTimes: [older.time, newer.time], interpolationUnderflow: time > latest.time,
      predictedLocal: this.predicted ? structuredClone(this.predicted) : this.heldIncomingPrediction ? structuredClone(this.heldIncomingPrediction) : null,
      overlayAllowed: !this.events.some(e => e.event.eventId > this.drawnEvent && e.event.type === 'finish'), ballTime, ballPredicted: shown.predicted };
    let claimed: Claimed | null = null;
    const crossing = shown.crossing;
    if (crossing && !this.claims.has(crossing.key) && this.predicted && rally && enabled && !model.frozen) {
      // The claim frame: exact predicted pose (no blend) against the C−1 ball, so the claim is exactly what was shown.
      const box = ownBox(this.predicted), prediction = structuredClone(this.predicted), hit = contact(crossing.incoming, box);
      own = rect(box);
      model = { ...model, own, tick: crossing.tick - 1, sourceTicks: [crossing.tick - 1, crossing.tick - 1], predictedLocal: structuredClone(prediction) };
      claimed = { hit, own, prediction, frame: null, preceding: previousFrame };
      this.claims.set(crossing.key, claimed); if (this.claims.size > 8) this.claims.delete(this.claims.keys().next().value!);
      this.evidence.set(crossing.key, [...this.evidence.get(crossing.key) ?? [], claimed]); if (this.evidence.size > 8) this.evidence.delete(this.evidence.keys().next().value!);
      const s = latest.state;
      this.onClaim({ matchId: s.matchId, rallyId: s.rallyId, tick: crossing.tick, hit, x: prediction.x, y: prediction.y, dx: prediction.dx, dy: prediction.dy });
    }
    const clock = ballTime;
    const dueEvents = this.events.filter(e => e.time <= clock && e.event.eventId > this.drawnEvent);
    for (const e of dueEvents) {
      if (['return', 'miss', 'finish'].includes(e.event.type)) break;
      this.drawnEvent = e.event.eventId; this.sound(e.event);
    }
    this.events = this.events.filter(e => e.event.eventId > this.drawnEvent);
    const boundary = this.events.find(e => e.time <= clock && e.event.eventId > this.drawnEvent);
    if (boundary) {
      const e = boundary.event, key = `${e.matchId}/${e.rallyId}/${e.tick}`, presented = e.side === this.side ? this.evidence.get(key) ?? [] : [];
      // The frame whose claimed pose the authority installed (same paddle box), else the latest presented claim frame.
      const installed = JSON.stringify(rect(e.incomingViewBoxes[this.side].own));
      const ownClaim = presented.find(c => c.frame && JSON.stringify(c.own) === installed) ?? presented.filter(c => c.frame).at(-1);
      const contactEvent = ['return', 'miss', 'finish'].includes(e.type);
      if (contactEvent && ownClaim?.frame && !boundary.sampled) {
        // This defender's crossing was already presented ahead, at its claim frame: never redraw it. Evidence and
        // settlement happen now, and the ball keeps its predicted (or authoritative) flight.
        boundary.sampled = true; boundary.incomingOwn = ownClaim.own;
        ownClaim.frame.incomingEventId = e.eventId; ownClaim.frame.overlayAllowed = false;
        this.onBoundary(e, ownClaim.preceding, ownClaim.frame); this.claims.delete(key); this.evidence.delete(key);
        this.settle(e, enabled, rally);
        model.overlayAllowed = !this.events.some(x => x.event.eventId > this.drawnEvent && x.event.type === 'finish');
        if (!rally) model = { ...model, own: rect(latest.state.viewBoxes[this.side].own) };
      } else if (contactEvent && !boundary.sampled && !model.frozen) {
        const stopped = this.stoppedTransactions.get(key);
        if (stopped && !closed) { own = { ...stopped.own }; model.predictedLocal = stopped.prediction ? structuredClone(stopped.prediction) : null; }
        boundary.sampled = true; boundary.incomingOwn = own;
        model = { ...model, ball: rect(e.incomingViewBoxes[this.side].ball), own, remote: rect(e.incomingViewBoxes[this.side].remote),
          tick: e.incomingBoxTick, incomingEventId: e.eventId, sourceTicks: [e.incomingBoxTick, e.incomingBoxTick], overlayAllowed: false };
        this.onBoundary(e, previousFrame, model);
      } else if (!model.frozen) {
        this.settle(e, enabled, rally); model.overlayAllowed = true;
        const endpoint = this.samples.find(s => s.state.lastEventId >= e.eventId)?.state;
        if (endpoint) { const v = endpoint.viewBoxes[this.side]; model = { ...model, ball: rect(v.ball), remote: rally ? rect(v.remote) : rect(latest.state.viewBoxes[this.side].remote), own: this.predicted ? rect(ownBox(this.predicted)) : rect(latest.state.viewBoxes[this.side].own), predictedLocal: this.predicted ? structuredClone(this.predicted) : null, tick: endpoint.tick }; }
      }
    }
    for (const [key, transaction] of this.stoppedTransactions) if (transaction.tail <= this.drawnEvent) this.stoppedTransactions.delete(key);
    // Wall-only transactions also settle once their complete tail was presented.
    if (this.pending && this.pending.lastEventId <= this.drawnEvent && !this.events.length) {
      if (enabled && rally) this.rebase(this.pending); else this.stopPrediction();
      this.pending = null; this.heldIncomingOwn = null; this.heldIncomingPrediction = null;
    }
    if (model.frozen && previousFrame) model = { ...previousFrame, renderedAt: now, snapshotAge: age, frozen: true, degraded: true, overlayAllowed: false };
    if (claimed) claimed.frame = model;
    this.frames.push(model); if (this.frames.length > 600) this.frames.shift(); return model;
  }
  /** Present an event's discontinuity after its incoming frame: audio, held-pose release and deferred rebase. */
  private settle(e: OnlineEvent, enabled: boolean, rally: boolean) {
    this.drawnEvent = e.eventId; this.sound(e);
    this.heldIncomingOwn = null; this.heldIncomingPrediction = null;
    if (this.pending && this.pending.lastEventId <= this.drawnEvent) {
      if (enabled && rally) this.rebase(this.pending); else this.stopPrediction();
      this.pending = null;
    }
    this.events = this.events.filter(x => x.event.eventId > this.drawnEvent);
  }
}
