import { describe, expect, it } from 'vitest';
import { Authority, type Session } from '../server/authority';
import { OnlineClient } from '../src/multiplayer/client';
import { OnlineView, type DrawModel } from '../src/multiplayer/view';
import { boxes, createOnline, startMatch } from '../src/multiplayer/simulation';
import type { Side } from '../src/multiplayer/types';

// Plan §5 incoming-ball amendment: the defender presents its incoming ball ahead of the authority, so its inputs and its
// claim reach the authority by the crossing tick and the authority does not pause.
function network(oneWayMs: number, downMs = oneWayMs, declare = true) {
  const link = { up: oneWayMs, down: downMs };
  let time = 0; const authority = new Authority(() => time, () => 0), records: Record<string, unknown>[] = [];
  authority.onDiagnostic = record => records.push(record);
  type Player = { client: OnlineClient; session: Session; view: OnlineView; up: { at: number; raw: string }[]; down: { at: number; raw: string }[]; frames: DrawModel[] };
  const players: Player[] = [];
  function open(operation: 'create' | 'join', code?: string) {
    const up: Player['up'] = [], down: Player['down'] = [];
    const session = authority.open({ bufferedAmount: 0, send: raw => down.push({ at: time + link.down, raw }), close: () => {}, terminate: () => {} })!;
    const client = new OnlineClient({ readyState: 1, bufferedAmount: 0, send: raw => up.push({ at: time + link.up, raw }), close: () => {} }, () => time, operation, code, declare);
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
  return { authority, a, b, advance, records, now: () => time, link };
}
/** A late defender: aims at the ball it is shown, every frame, but only once the ball is within `depth` of its plane. */
function track(p: { client: OnlineClient; frames: DrawModel[] }, depth = 75) {
  const m = p.frames.at(-1); if (!m || m.z > depth) return;
  p.client.pointer((m.ball.left + m.ball.right) / 2, (m.ball.top + m.ball.bottom) / 2);
}
function serveToward(h: ReturnType<typeof network>, defender: Side, u: number, y = 90) {
  const r = h.a.session.room!;
  expect(r.state.phase).toBe('Rally');
  // A flight from the far plane toward the defender, aimed off-center so the defender must move.
  Object.assign(r.state.ball, { u: defender === 0 ? u : -u, y, z: defender === 0 ? 75 : 0, vx: 0, vy: 0, vz: defender === 0 ? -2 : 2, cx: 0, cy: 0 });
  r.state.viewBoxes = boxes(r.state);
  return r;
}
/** A defender that jerks away only once its shown ball is within `depth` of its plane. */
const jerk = (p: { client: OnlineClient; frames: DrawModel[] }, depth: number) => { const m = p.frames.at(-1); if (m && m.z <= depth) p.client.pointer(296, 206); };
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
  it('an asymmetric upstream (70 ms up, 10 ms down) still returns the late defender: a short wait for the claim, no rejection', () => {
    const h = network(70, 10), r = serveToward(h, 0, -80); h.b.frames.length = 0;
    h.advance(1600, () => track(h.a, 8));
    expect(r.state.lives).toEqual([3, 3]);
    expect(h.records.find(x => x.kind === 'contact-resolved')).toMatchObject({ claimed: true, hit: true, accepted: true });
    // If the claim trails the crossing, the authority waits for it rather than guessing; the wait stays short.
    const pending = h.records.find(x => x.kind === 'contact-pending'), resolved = h.records.find(x => x.kind === 'contact-resolved')!;
    if (pending) expect((resolved.at as number) - (pending.at as number)).toBeLessThan(100);
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
  it.each([[80, 'miss'], [150, 'return']] as const)('a presented miss decides even where the stale authoritative pose would return (upstream spike 10 → %i ms)', (spike, authoritative) => {
    // Centered ball meeting the centered paddle: without the claim the authority returns it. Just before the crossing the
    // upstream degrades, so the defender's jerk and its miss claim arrive after the authority's crossing tick.
    const h = network(10), r = serveToward(h, 0, 0, 125.5); h.a.frames.length = 0;
    h.advance(1600, () => { const m = h.a.frames.at(-1); if (m && m.z <= 12) h.link.up = spike; jerk(h.a, 3); });
    const resolved = h.records.find(x => x.kind === 'contact-resolved');
    // 80 ms: the full lead still delivers the jerk and the claim before the crossing, so both sides agree on the miss.
    // 150 ms: both trail it; the stale pose would return, the authority waits, and the presented miss decides.
    expect(resolved).toMatchObject({ authoritative, claimed: true, hit: false, accepted: true, early: spike === 80 });
    expect(h.records.some(x => x.kind === 'contact-pending')).toBe(spike !== 80);
    expect(r.state.lives).toEqual([2, 3]); expect(h.a.client.events.some(e => e.type === 'return' && e.side === 0)).toBe(false);
    // What the defender was shown never comes back: after its claim frame the ball never moves away from its plane.
    const claimAt = h.a.frames.findIndex(f => f.incomingEventId !== null);
    expect(claimAt).toBeGreaterThan(-1);
    expect(h.a.frames.slice(claimAt).every(f => f.z <= h.a.frames[claimAt].z + 1e-9)).toBe(true);
  });
});

describe('M5 incoming ball: review regressions', () => {
  it('a blur that ends a return wait early keeps the declared protection (no withholding penalty)', () => {
    const h = network(10), r = serveToward(h, 0, 0, 125.5); h.a.frames.length = 0; h.a.view.onClaim = () => {};
    let blurred = false;
    h.advance(1800, () => { if (!blurred && r.wait) { blurred = true; h.a.client.blur(); } });
    expect(blurred).toBe(true);
    expect(h.records.find(x => x.kind === 'contact-resolved')).toMatchObject({ claimed: false, timedOut: false });
    expect(h.a.session.proactive).toBe(true);
  });
  it('a blur right after an accepted return never steps the presented ball back', () => {
    const h = network(25), r = serveToward(h, 0, -80); h.a.frames.length = 0;
    let blurred = false;
    h.advance(1600, () => {
      const m = h.a.frames.at(-1); if (m && m.z <= 12) h.link.up = 200; if (!blurred) track(h.a, 8);
      if (!blurred && h.records.some(x => x.kind === 'contact-resolved' && x.accepted)) { blurred = true; h.a.client.blur(); h.a.client.focus(); }
    });
    expect(blurred).toBe(true); expect(r.state.lives).toEqual([3, 3]);
    const crossing = h.a.client.records.find(x => x.kind === 'sent-claim')!.tick as number, f = h.a.frames.filter(x => x.tick >= crossing);
    for (let i = 1; i < h.a.frames.length; i++) expect(h.a.frames[i].tick).toBeGreaterThanOrEqual(h.a.frames[i - 1].tick);
    for (let i = 1; i < f.length; i++) expect(f[i].z).toBeGreaterThanOrEqual(f[i - 1].z - 1e-9);
  });
  it('rejected claims from a client that never declared proactive claims cannot cause return waits', () => {
    const h = network(10, 10, false), r = serveToward(h, 0, 0, 125.5); h.a.frames.length = 0;
    h.a.view.onClaim = c => h.a.client.claim({ ...c, x: 296 }); // outside the envelope: rejected
    h.advance(5200);
    expect(h.a.session.proactive).toBe(false);
    expect(h.records.some(x => x.kind === 'contact-pending' && x.side === 0 && (h.records.find(y => y.kind === 'contact-resolved' && y.tick === x.tick)?.authoritative === 'return'))).toBe(false);
    expect(r.state.matchId).toBeGreaterThan(0);
  });
  it('an older client that never declares proactive claims keeps the authoritative return without a wait', () => {
    const h = network(10), r = serveToward(h, 0, 0, 125.5); h.a.frames.length = 0;
    h.a.session.proactive = false; h.a.view.onClaim = () => {}; // as a client built before proactive claims
    h.advance(1600);
    expect(h.records.some(x => x.kind === 'contact-pending')).toBe(false); expect(r.state.lives).toEqual([3, 3]);
  });
  it('a declared client that withholds its claims only delays its own returns, each by at most the grace (accepted risk)', () => {
    // Centered straight flights: both paddles return without moving, so the ball comes back to this defender quickly.
    const h = network(10), r = serveToward(h, 0, 0, 125.5); h.a.frames.length = 0;
    expect(h.a.session.proactive).toBe(true); h.a.view.onClaim = () => {};
    h.advance(5200);
    const pauses = h.records.filter(x => x.kind === 'contact-pending' && x.side === 0), resolved = h.records.filter(x => x.kind === 'contact-resolved' && x.side === 0);
    expect(pauses.length).toBeGreaterThanOrEqual(2); expect(resolved.length).toBe(pauses.length);
    for (const [k, x] of resolved.entries()) { expect(x).toMatchObject({ claimed: false, timedOut: true, authoritative: 'return' }); expect((x.at as number) - (pauses[k].at as number)).toBeLessThanOrEqual(500 + 1000 / 30 + 1); }
    expect(r.state.lives).toEqual([3, 3]); // no points gained or lost by withholding
  });
  it('after a drawing stall a later late presented miss still decides (no suspension)', () => {
    // Codex review: a drawing stall left one claimless return wait; a later late miss claim must not be overturned.
    const h = network(10), r = serveToward(h, 0, 0, 125.5); h.a.frames.length = 0;
    h.advance(2200, undefined, false); // no drawing past the first crossing's grace: its wait expires claimless
    h.advance(700);
    expect(h.records.some(x => x.kind === 'contact-resolved' && x.side === 0 && x.claimed === false)).toBe(true);
    const before = h.records.filter(x => x.kind === 'contact-resolved' && x.side === 0).length;
    // Second flight toward this defender: the upstream degrades and the defender jerks away late.
    serveToward(h, 0, 0, 125.5); h.a.frames.length = 0;
    h.advance(1600, () => { const m = h.a.frames.at(-1); if (m && m.z <= 12) h.link.up = 150; jerk(h.a, 3); });
    const second = h.records.filter(x => x.kind === 'contact-resolved' && x.side === 0)[before];
    expect(second).toMatchObject({ authoritative: 'return', claimed: true, hit: false, accepted: true });
    expect(r.state.lives[0]).toBeLessThan(3);
  });
  it('a claim for a tick without any crossing neither enables nor keeps return waits', () => {
    const h = network(10), r = h.a.session.room!; h.a.session.proactive = false;
    h.a.client.claim({ matchId: r.state.matchId, rallyId: r.state.rallyId, tick: r.state.tick + 1, hit: true, x: 175.5, y: 125.5, dx: 0, dy: 0 });
    h.advance(300);
    expect(h.a.session.proactive).toBe(false);
  });
  it('a pause that ends in an accepted hit never steps the presented ball back (upstream spike 25 → 200 ms)', () => {
    const h = network(25), r = serveToward(h, 0, -80); h.a.frames.length = 0;
    h.advance(1600, () => { const m = h.a.frames.at(-1); if (m && m.z <= 12) h.link.up = 200; track(h.a, 8); });
    expect(h.records.some(x => x.kind === 'contact-pending')).toBe(true);
    expect(h.records.find(x => x.kind === 'contact-resolved')).toMatchObject({ claimed: true, hit: true, accepted: true });
    expect(r.state.lives).toEqual([3, 3]);
    // Through the pause and the first tick after it, the presented tick never decreases and the ball never moves back
    // toward this side after its return began.
    const f = h.a.frames.filter(x => x.ballPredicted);
    for (let i = 1; i < f.length; i++) expect(f[i].tick).toBeGreaterThanOrEqual(f[i - 1].tick);
    const crossing = h.a.client.records.find(x => x.kind === 'sent-claim')!.tick as number, after = f.filter(x => x.tick >= crossing);
    expect(after.length).toBeGreaterThan(10);
    for (let i = 1; i < after.length; i++) expect(after[i].z).toBeGreaterThanOrEqual(after[i - 1].z - 1e-9);
  });
  it('a blur after the authority applied the claim keeps the original claim frame as the incoming evidence', () => {
    const h = network(25), r = serveToward(h, 0, -80); h.a.frames.length = 0;
    const boundaries: DrawModel[] = []; h.a.view.onBoundary = (_e, _p, incoming) => boundaries.push(incoming);
    let blurred = false;
    h.advance(1600, () => {
      track(h.a, 8);
      const resolved = h.records.find(x => x.kind === 'contact-resolved');
      if (resolved && !blurred) { blurred = true; h.a.client.blur(); h.a.client.focus(); } // event still in transit
    });
    expect(blurred).toBe(true); expect(r.state.lives).toEqual([3, 3]);
    const sent = h.a.client.records.find(x => x.kind === 'sent-claim')!;
    expect(boundaries).toHaveLength(1);
    expect(boundaries[0].tick).toBe((sent.tick as number) - 1); expect(boundaries[0].incomingEventId).not.toBeNull();
    expect(boundaries[0].predictedLocal).toMatchObject({ x: sent.x, y: sent.y });
  });
  const near = () => {
    const s = createOnline(); startMatch(s, 0); s.phase = 'Rally';
    Object.assign(s.ball, { u: -100, y: 125.5, z: 7, vx: 0, vy: 0, vz: -2, cx: 0, cy: 0 }); s.viewBoxes = boxes(s);
    return s;
  };
  it('a quick blur after a claim, before the crossing, keeps the presented claim deciding (no re-send replaces it)', () => {
    const h = network(15), r = serveToward(h, 0, -80); h.a.frames.length = 0;
    let blurred = false;
    h.advance(1600, () => {
      if (!blurred) track(h.a, 8);
      if (!blurred && h.a.client.records.some(x => x.kind === 'sent-claim') && !h.records.some(x => x.kind === 'contact-resolved')) { blurred = true; h.a.client.blur(); h.a.client.focus(); }
    });
    expect(blurred).toBe(true);
    const sent = h.a.client.records.filter(x => x.kind === 'sent-claim');
    expect(sent).toHaveLength(1); expect(sent[0].generation).toBe(0);
    expect(h.records.find(x => x.kind === 'contact-resolved')).toMatchObject({ claimed: true, hit: true, accepted: true });
    expect(r.state.lives).toEqual([3, 3]);
  });
  it('repeated same-tick snapshots during a claim pause never step the presented ball backward', () => {
    let time = 0; const s = near(), v = new OnlineView(0, () => time); v.accept(s, 0);
    const shown: DrawModel[] = [];
    for (let k = 1; k <= 40; k++) { time = k * 8; if (k % 4 === 0) v.accept(structuredClone(s), time); shown.push(v.draw(time, 0, true)!); }
    for (let i = 1; i < shown.length; i++) { expect(shown[i].tick).toBeGreaterThanOrEqual(shown[i - 1].tick); expect(shown[i].z).toBeLessThanOrEqual(shown[i - 1].z + 1e-9); }
  });
  it('the ball clock keeps at least 0.75× real time when an offset correction pulls the server estimate back', () => {
    let time = 1000; const s = createOnline(); startMatch(s, 0); s.phase = 'Rally'; s.ball.z = 70; s.ball.vz = -2; s.viewBoxes = boxes(s);
    const v = new OnlineView(0, () => time); v.accept(s, 1000);
    let prior = v.draw(1050, 100, true)!.ballTime;
    time += 16; const t = v.draw(1048, 90, true)!.ballTime; // serverNow steps back 2 ms while RTT drops
    expect(t - prior).toBeGreaterThanOrEqual(.75 * 16 - 1e-9); prior = t;
  });
  it('the ball clock stays within 0.75–1.35× real time when the buffered time jumps (RTT drop)', () => {
    let time = 1000; const s = createOnline(); startMatch(s, 0); s.phase = 'Rally'; s.ball.z = 70; s.ball.vz = -2; s.viewBoxes = boxes(s);
    const v = new OnlineView(0, () => time); v.accept(s, 1000);
    let prior = v.draw(time, 100, true)!.ballTime;
    for (const rtt of [50, 50, 20, 200, 20]) { time += 16; const t = v.draw(time, rtt, true)!.ballTime; expect(t - prior).toBeGreaterThanOrEqual(.75 * 16 - 1e-9); expect(t - prior).toBeLessThanOrEqual(1.35 * 16 + 1e-9); prior = t; }
  });
});
