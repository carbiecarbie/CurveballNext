import { describe, expect, it } from 'vitest';
import { Authority, type Session } from '../server/authority';
import { OnlineClient } from '../src/multiplayer/client';
import { OnlineView, type DrawModel } from '../src/multiplayer/view';
import { boxes } from '../src/multiplayer/simulation';
import type { Side } from '../src/multiplayer/types';

// Plan §5 incoming-ball amendment: the defender presents its incoming ball ahead of the authority, so its inputs and its
// claim reach the authority by the crossing tick and the authority does not pause.
function network(oneWayMs: number) {
  let time = 0; const authority = new Authority(() => time, () => 0), records: Record<string, unknown>[] = [];
  authority.onDiagnostic = record => records.push(record);
  type Player = { client: OnlineClient; session: Session; view: OnlineView; up: { at: number; raw: string }[]; down: { at: number; raw: string }[]; frames: DrawModel[] };
  const players: Player[] = [];
  function open(operation: 'create' | 'join', code?: string) {
    const up: Player['up'] = [], down: Player['down'] = [];
    const session = authority.open({ bufferedAmount: 0, send: raw => down.push({ at: time + oneWayMs, raw }), close: () => {}, terminate: () => {} })!;
    const client = new OnlineClient({ readyState: 1, bufferedAmount: 0, send: raw => up.push({ at: time + oneWayMs, raw }), close: () => {} }, () => time, operation, code);
    const view = new OnlineView(0, () => time), player: Player = { client, session, view, up, down, frames: [] };
    client.onState = (s, e, at) => { view.side = client.side; view.accept(s, at!, e); };
    client.onInput = (x, y, seq, at) => view.input(x, y, seq, at); client.onFence = () => view.fence();
    client.onPending = (p, at) => view.pendingContact(p, at); view.onClaim = c => client.claim(c);
    players.push(player); return player;
  }
  function tick(draw: boolean) {
    for (const p of players) while (p.up.length && p.up[0].at <= time) authority.receive(p.session, p.up.shift()!.raw);
    authority.pump();
    for (const p of players) {
      while (p.down.length && p.down[0].at <= time) p.client.receive(p.down.shift()!.raw);
      p.client.pump();
      if (draw && p.client.epoch) { const m = p.view.draw(time + p.client.offset, p.client.rtt, p.client.enabled && !p.client.closed); if (m) p.frames.push(m); }
    }
  }
  const advance = (ms: number, each: () => void = () => {}, draw = true) => { const end = time + ms; while (time < end) { time += 5; tick(draw); each(); } };
  const a = open('create'); advance(200, undefined, false);
  const b = open('join', a.client.code); advance(200, undefined, false);
  a.client.command('ready', true); b.client.command('ready', true); advance(3200);
  return { authority, a, b, advance, records, now: () => time };
}
/** A late defender: aims at the ball it is shown, every frame, but only once the ball is within `depth` of its plane. */
function track(p: { client: OnlineClient; frames: DrawModel[] }, depth = 75) {
  const m = p.frames.at(-1); if (!m || m.z > depth) return;
  p.client.pointer((m.ball.left + m.ball.right) / 2, (m.ball.top + m.ball.bottom) / 2);
}
function serveToward(h: ReturnType<typeof network>, defender: Side, u: number) {
  const r = h.a.session.room!;
  expect(r.state.phase).toBe('Rally');
  // A flight from the far plane toward the defender, aimed off-center so the defender must move.
  Object.assign(r.state.ball, { u: defender === 0 ? u : -u, y: 90, z: defender === 0 ? 75 : 0, vx: 0, vy: 0, vz: defender === 0 ? -2 : 2, cx: 0, cy: 0 });
  r.state.viewBoxes = boxes(r.state);
  return r;
}
/** Longest run, in ms, during which a Rally frame repeated the same ball rectangle (a visible freeze). */
function longestFreeze(frames: DrawModel[]) {
  let longest = 0, start = 0;
  for (let i = 1; i < frames.length; i++) {
    const same = JSON.stringify(frames[i].ball) === JSON.stringify(frames[i - 1].ball);
    if (!same) start = frames[i].renderedAt; else longest = Math.max(longest, frames[i].renderedAt - start);
  }
  return longest;
}

describe('M5 incoming ball presented ahead (plan §5 amendment)', () => {
  it.each([10, 25, 50])('a late defender (moving four ticks before the shown contact) returns at %i ms one-way without any authority pause or freeze', oneWay => {
    const h = network(oneWay), r = serveToward(h, 0, -80);
    h.a.frames.length = 0; h.b.frames.length = 0;
    const rally = r.state.rallyId;
    h.advance(1600, () => track(h.a, 8));
    expect(r.state.rallyId).toBe(rally); expect(r.state.lives).toEqual([3, 3]);
    expect(h.records.some(x => x.kind === 'contact-pending')).toBe(false);
    expect(h.records.find(x => x.kind === 'contact-resolved')).toMatchObject({ early: true, claimed: true, hit: true, accepted: true });
    expect(h.a.client.events.some(e => e.type === 'return' && e.side === 0)).toBe(true);
    // No frozen ball for the opponent nor the defender (a single repeated frame at 200 Hz is ≤ 5 ms).
    // The defender's ball never stops. The opponent sees at most the plan's single-tick hold at the far impact
    // (never interpolate through an impact), independent of latency, instead of the former RTT-scaled pause.
    expect(longestFreeze(h.a.frames)).toBeLessThan(10); expect(longestFreeze(h.b.frames)).toBeLessThanOrEqual(1000 / 30);
  });
  it('the defender sees its incoming ball ahead of the authority at the crossing, and buffered while far', () => {
    const h = network(25), r = serveToward(h, 0, -80); h.a.frames.length = 0;
    h.advance(1600, () => track(h.a));
    const claimFrame = h.a.frames.find(f => f.incomingEventId !== null)!;
    expect(claimFrame).toBeDefined(); expect(claimFrame.ballPredicted).toBe(true);
    // Ahead of the estimated server clock at the crossing; behind it at the start of the flight.
    expect(claimFrame.ballTime).toBeGreaterThan(claimFrame.estimatedServerNow);
    expect(h.a.frames[0].ballTime).toBeLessThan(h.a.frames[0].estimatedServerNow);
    expect(r.state.lives).toEqual([3, 3]);
  });
  it('a clear miss commits without a pause and without freezing either view', () => {
    const h = network(25), r = serveToward(h, 0, -110); h.a.frames.length = 0; h.b.frames.length = 0;
    h.advance(1600); // the defender never moves
    expect(r.state.lives).toEqual([2, 3]);
    expect(h.records.some(x => x.kind === 'contact-pending')).toBe(false);
    // The defender's flight never stops before its crossing; afterwards the ball is legitimately stopped past the plane.
    const crossing = h.a.client.records.find(x => x.kind === 'sent-claim')!.tick as number;
    expect(longestFreeze(h.a.frames.filter(f => f.tick < crossing - 1))).toBeLessThan(10);
    expect(h.a.frames.some(f => f.ballPredicted && f.tick === crossing)).toBe(true); // shown past the plane before the event
    expect(longestFreeze(h.b.frames.filter(f => !f.missed))).toBeLessThanOrEqual(1000 / 30);
    expect(h.b.client.events.some(e => e.type === 'miss' && e.side === 0)).toBe(true);
  });
  it('the defender reports what it presented: a claimed miss is committed even where the stale authority pose would return', () => {
    const h = network(25), r = serveToward(h, 0, 0);
    // Centered ball and centered paddle: the authority alone would return it. The defender jerks away before the crossing.
    h.advance(900);
    h.advance(700, () => h.a.client.pointer(296, 206));
    expect(h.records.find(x => x.kind === 'contact-resolved')).toMatchObject({ early: true, hit: false, accepted: true });
    expect(r.state.lives).toEqual([2, 3]);
  });
});
