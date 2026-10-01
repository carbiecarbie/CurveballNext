import { describe, expect, it } from 'vitest';
import { Authority, type Session } from '../server/authority';
import { OnlineClient } from '../src/multiplayer/client';
import { boxes, move } from '../src/multiplayer/simulation';

// Independent review of the bounded defender contact claim (plan §5 amendment): regressions for the fixed defects and
// the accepted envelope risk.
function connected() {
  let time = 0; const authority = new Authority(() => time, () => 0), records: Record<string, unknown>[] = [];
  authority.onDiagnostic = record => records.push(record);
  const pairs: { client: OnlineClient; session: Session; outbound: string[]; down: string[] }[] = [];
  function open(operation: 'create' | 'join', code?: string) {
    const outbound: string[] = [], down: string[] = [];
    const session = authority.open({ bufferedAmount: 0, send: (raw: string) => down.push(raw), close: () => {}, terminate: () => {} })!;
    const client = new OnlineClient({ readyState: 1, bufferedAmount: 0, send: (raw: string) => outbound.push(raw), close: () => {} }, () => time, operation, code);
    const pair = { client, session, outbound, down }; pairs.push(pair); flush(); return pair;
  }
  function flush() {
    for (let n = 0; n < 5; n++) {
      for (const p of pairs) for (const raw of p.outbound.splice(0)) authority.receive(p.session, raw);
      authority.pump();
      for (const p of pairs) { for (const raw of p.down.splice(0)) p.client.receive(raw); p.client.pump(); }
    }
  }
  const a = open('create'), b = open('join', a.client.code);
  const advance = (ms: number) => { const end = time + ms; while (time < end) { time = Math.min(end, time + 10); flush(); } };
  a.client.command('ready', true); b.client.command('ready', true); flush(); advance(3010);
  return { authority, a, b, advance, flush, records, now: () => time, at: (t: number) => { time = t; } };
}
/** Ball one tick from side 0's plane, far from the centered paddle: the authority alone would commit a miss. */
function approach(h: ReturnType<typeof connected>) {
  h.advance(20); const r = h.a.session.room!;
  expect(r.state.phase).toBe('Rally');
  Object.assign(r.state.ball, { u: -120, y: 125.5, z: 1, vx: 0, vy: 0, vz: -2, cx: 0, cy: 0 });
  // The defender aimed toward the ball (target x=60) but the paddle has not moved: a return is reachable, not authoritative.
  r.state.localPaddles[0].tx = 60; r.state.viewBoxes = boxes(r.state);
  return r;
}
/** Raw frames from a modified client, bypassing OnlineClient's own rules. */
function raw(h: ReturnType<typeof connected>, data: Record<string, unknown>) {
  const s = h.a.session; h.authority.receive(s, JSON.stringify({ protocolVersion: 1, roomEpoch: s.room!.epoch, ...data }));
}
const resolved = (h: ReturnType<typeof connected>) => h.records.find(x => x.kind === 'contact-resolved');

describe('M5 contact claim review regressions', () => {
  // P1/P2 document an ACCEPTED risk (plan §5 amendment, maintainer decision): an honest claim legitimately depends on
  // targets received after contactPending (captured in the ~66.7 ms before the claim frame) and on coalesced targets
  // the prediction already eased toward. The server cannot tell those from a modified client's targets without trusting
  // it, so such a client can widen the envelope. Invitation-only rooms limit exposure; reopen before public matchmaking.
  // If these start failing, the envelope changed: recheck that honest late returns are still accepted.
  it('P1 (accepted risk): a target sent after contactPending widens the envelope', () => {
    const h = connected(), r = approach(h), c = h.a.client;
    h.advance(40); expect(r.wait).not.toBeNull();
    // The paddle never moved; the modified client learns of the miss, then sends a far target and claims there.
    c.pointer(-350, 125.5); h.flush();
    c.claim({ matchId: r.state.matchId, rallyId: r.state.rallyId, tick: r.wait!.tick, hit: true, x: 55, y: 125.5, dx: -80, dy: 0 });
    h.advance(40);
    expect(resolved(h)).toMatchObject({ claimed: true, accepted: true });
  });
  it('P2 (accepted risk): a coalesced target that was never applied widens the envelope', () => {
    const h = connected(), r = approach(h), s = h.a.session;
    const input = (seq: number, x: number) => raw(h, { type: 'input', matchId: r.state.matchId, rallyId: r.state.rallyId, controlGeneration: 0,
      resumeStateSerial: s.authorized, seq, x, y: 125.5, processedSnapshotSerial: s.lastSnapshotSerial });
    // Same tick window: a far-left decoy, then the real centered target. Only the real one reaches the paddle.
    input(100, -350); input(101, 175.5);
    h.advance(40); expect(r.wait).not.toBeNull(); expect(r.state.localPaddles[0].tx).toBeGreaterThan(100);
    h.a.client.claim({ matchId: r.state.matchId, rallyId: r.state.rallyId, tick: r.wait!.tick, hit: true, x: 55, y: 125.5, dx: -80, dy: 0 });
    h.advance(40);
    expect(resolved(h)).toMatchObject({ claimed: true, accepted: true });
  });
  it('P3: an honest one-step claim at the wall while aiming outside the court is accepted', () => {
    const h = connected(), r = approach(h), c = h.a.client;
    // Paddle by the top wall, ball high and to the left: aiming beyond the top keeps a return reachable.
    Object.assign(r.state.localPaddles[0], { y: 50, py: 50, ty: 50 }); r.state.ball.y = 60; r.state.viewBoxes = boxes(r.state);
    c.pointer(60, -250); h.flush();
    h.advance(40); expect(r.wait).not.toBeNull();
    const p = structuredClone(r.state.localPaddles[0]); move(p);
    expect([p.y, p.dy]).toEqual([45, -5]); // the real easing step, clamped at the top limit
    c.claim({ matchId: r.state.matchId, rallyId: r.state.rallyId, tick: r.wait!.tick, hit: true, x: p.x, y: p.y, dx: p.dx, dy: p.dy });
    h.advance(40);
    expect(resolved(h)).toMatchObject({ claimed: true, accepted: true });
  });
  it('P4: a claim processed after contactGraceMs is ignored and the miss commits', () => {
    const h = connected(), r = approach(h), c = h.a.client;
    c.pointer(55, 125.5); h.flush(); h.advance(40);
    const w = r.wait!, p = structuredClone(r.state.localPaddles[0]); move(p);
    c.claim({ matchId: r.state.matchId, rallyId: r.state.rallyId, tick: w.tick, hit: true, x: p.x, y: p.y, dx: p.dx, dy: p.dy });
    const late = h.a.outbound.splice(0);
    while (h.now() < w.deadline - 12) { h.at(h.now() + 10); h.authority.pump(); }
    expect(r.wait).not.toBeNull();
    // The pump wakes after the deadline; the claim is processed in that pump, before its tick.
    h.at(Math.max(w.deadline + 25, h.authority.nextBoundary + 1));
    for (const frame of late) h.authority.receive(h.a.session, frame);
    h.authority.pump();
    expect(resolved(h)).toMatchObject({ accepted: false }); expect(r.state.lives).toEqual([2, 3]);
  });
  // P5 (maintainer decision): an interruption of the defender's own session while its claim is pending first commits the
  // original miss/finish exactly as a timeout would; an opponent interruption still aborts without winner.
  it('P5a: a defender leaving during a last-life pause loses: the finish is committed before the interruption', () => {
    const h = connected(), r = approach(h); r.state.lives = [1, 3];
    h.advance(40); expect(r.wait).not.toBeNull();
    h.a.client.leave(); h.flush();
    expect(r.state.phase).toBe('MatchEnded'); expect(r.state.result).toMatchObject({ loser: 0, winner: 1, lives: [0, 3] });
    expect(h.b.client.known).toMatchObject({ loser: 0, winner: 1 });
  });
  it('P5b: a defender hiding during an ordinary pause still loses that life before the abort', () => {
    const h = connected(), r = approach(h);
    h.advance(40); expect(r.wait).not.toBeNull();
    h.a.client.hidden(); h.flush();
    expect(r.state.phase).toBe('Aborted'); expect(r.state.result).toBeNull(); expect(r.state.lives).toEqual([2, 3]);
  });
  it('P5d: leaving after a valid miss claim during a pause that would return still loses the last life', () => {
    // Paddle on the ball: the authority alone would return it. The proactive defender's presented miss claim arrives
    // during the pause; leaving before the next boundary must not swap it for the stale return.
    const h = connected(), r = approach(h); r.state.lives = [1, 3]; h.a.session.proactive = true;
    Object.assign(r.state.localPaddles[0], { x: 60, px: 60, tx: 60, dx: 0 }); r.state.viewBoxes = boxes(r.state);
    h.advance(40); expect(r.wait).toMatchObject({ authoritative: 'return' });
    raw(h, { type: 'contactClaim', matchId: r.state.matchId, rallyId: r.state.rallyId, tick: r.wait!.tick, controlGeneration: 0, hit: false, x: 120, y: 125.5, dx: 0, dy: 0 });
    h.a.client.leave(); h.flush();
    expect(r.state.phase).toBe('MatchEnded'); expect(r.state.result).toMatchObject({ loser: 0, winner: 1, lives: [0, 3] });
  });
  it('P5c: an opponent leaving during the pause aborts without winner and commits nothing', () => {
    const h = connected(), r = approach(h); r.state.lives = [1, 3];
    h.advance(40); expect(r.wait).not.toBeNull();
    h.b.client.leave(); h.flush();
    expect(r.state.phase).toBe('Aborted'); expect(r.state.result).toBeNull(); expect(r.state.lives).toEqual([1, 3]);
    expect(h.a.client.known).toBeNull();
  });
  it('P6: one coalescence emits one diagnostic record', () => {
    const h = connected(), r = h.a.session.room!, s = h.a.session; h.advance(20);
    const input = (seq: number, x: number) => raw(h, { type: 'input', matchId: r.state.matchId, rallyId: r.state.rallyId, controlGeneration: 0,
      resumeStateSerial: s.authorized, seq, x, y: 100, processedSnapshotSerial: s.lastSnapshotSerial });
    const before = h.records.filter(x => x.kind === 'coalesced').length;
    input(200, 100); input(201, 110); h.authority.pump();
    expect(h.records.filter(x => x.kind === 'coalesced').length - before).toBe(1);
  });
  it('P7: a claim whose previous pose (x - dx) lies outside the field is rejected', () => {
    const h = connected(), r = approach(h), c = h.a.client;
    c.pointer(-350, 125.5); h.flush(); h.advance(40); expect(r.wait).not.toBeNull();
    // x at the left limit with dx +80 implies a previous pose of -25: no easing step can produce it.
    c.claim({ matchId: r.state.matchId, rallyId: r.state.rallyId, tick: r.wait!.tick, hit: true, x: 55, y: 125.5, dx: 80, dy: 0 });
    h.advance(40);
    expect(resolved(h)).toMatchObject({ claimed: true, accepted: false });
  });
  it('P8: a target discarded by a blur fence does not widen the envelope after resume', () => {
    const h = connected(), c = h.a.client; h.advance(20);
    // The far target reaches the server in the same pump as the fence, which discards it before any tick applies it.
    c.pointer(-350, 125.5); c.pump(); c.blur(); h.flush();
    c.focus(); h.flush(); expect(c.enabled).toBe(true); expect(h.a.session.enabled).toBe(true);
    const r = approach(h); expect(r.state.localPaddles[0].x).toBe(175.5);
    h.advance(40); expect(r.wait).not.toBeNull();
    c.claim({ matchId: r.state.matchId, rallyId: r.state.rallyId, tick: r.wait!.tick, hit: true, x: 55, y: 125.5, dx: -80, dy: 0 });
    h.advance(40);
    expect(resolved(h)).toMatchObject({ claimed: true, accepted: false });
  });
});
