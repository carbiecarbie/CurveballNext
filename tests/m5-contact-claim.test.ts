import { describe, expect, it } from 'vitest';
import { Authority, type Session } from '../server/authority';
import { OnlineClient } from '../src/multiplayer/client';
import { OnlineView } from '../src/multiplayer/view';
import { boxes, contact, move, ownBox, target } from '../src/multiplayer/simulation';
import { RULES } from '../src/multiplayer/rules';
import type { ContactClaim } from '../src/multiplayer/types';

// Plan §5 amendment: bounded defender contact claim.
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
  const advance = (ms: number, each: () => void = () => {}) => { const end = time + ms; while (time < end) { time = Math.min(end, time + 10); flush(); each(); } };
  a.client.command('ready', true); b.client.command('ready', true); flush(); advance(3010);
  return { authority, a, b, advance, flush, records, now: () => time };
}
/** Ball one tick from side 0's plane, far from the centered paddle: the authority alone would commit a miss. */
function approach(h: ReturnType<typeof connected>) {
  // Capture strictly after Rally activation (equal timestamps are conservatively ineligible).
  h.advance(20); const r = h.a.session.room!;
  expect(r.state.phase).toBe('Rally');
  Object.assign(r.state.ball, { u: -120, y: 125.5, z: 1, vx: 0, vy: 0, vz: -2, cx: 0, cy: 0 }); r.state.viewBoxes = boxes(r.state);
  return r;
}

describe('M5 bounded defender contact claim (authority)', () => {
  it('pauses an uncommitted miss: no tick, no life lost, unchanged snapshots, pending sent only to the defender', () => {
    const h = connected(), r = approach(h), tick = r.state.tick;
    h.advance(40);
    expect(r.wait).toMatchObject({ side: 0, tick: tick + 1 }); expect(r.state.phase).toBe('Rally'); expect(r.state.tick).toBe(tick); expect(r.state.lives).toEqual([3, 3]);
    expect(h.a.client.records.filter(x => x.kind === 'contact-pending')).toHaveLength(1);
    expect(h.b.client.records.filter(x => x.kind === 'contact-pending')).toHaveLength(0);
    h.advance(200); expect(r.state.tick).toBe(tick); expect(h.a.client.closed).toBe(false); expect(h.b.client.closed).toBe(false);
  });
  it('without a claim commits the original miss after the grace window', () => {
    const h = connected(), r = approach(h);
    h.advance(RULES.contactGraceMs - 40); expect(r.state.lives).toEqual([3, 3]);
    h.advance(120); expect(r.state.phase).toBe('LifeLostHold'); expect(r.state.lives).toEqual([2, 3]);
    expect(h.records.find(x => x.kind === 'contact-resolved')).toMatchObject({ claimed: false, accepted: false, timedOut: true });
  });
  it('a miss claim commits the miss at the next boundary rather than waiting', () => {
    const h = connected(), r = approach(h); h.advance(40);
    h.a.client.claim({ matchId: r.state.matchId, rallyId: r.state.rallyId, tick: r.wait!.tick, hit: false, x: 175.5, y: 125.5, dx: 0, dy: 0 });
    h.advance(40); expect(r.state.phase).toBe('LifeLostHold'); expect(r.state.lives).toEqual([2, 3]);
  });
  it('accepts a reachable claimed hit pose and returns the ball with that pose and curve', () => {
    const h = connected(), r = approach(h), c = h.a.client;
    c.pointer(55, 125.5); h.flush();
    h.advance(40); expect(r.wait).not.toBeNull();
    const claim: ContactClaim = { matchId: r.state.matchId, rallyId: r.state.rallyId, tick: r.wait!.tick, hit: true, x: 60, y: 125.5, dx: -40, dy: 0 };
    c.claim(claim); h.advance(40);
    expect(r.state.lives).toEqual([3, 3]); expect(r.state.phase).toBe('Rally'); expect(r.state.ball.vz).toBe(2);
    expect(c.events.some(e => e.type === 'return' && e.side === 0)).toBe(true);
    expect(r.state.ball.cx).toBe(40 / RULES.curve);
    expect(h.records.find(x => x.kind === 'contact-resolved')).toMatchObject({ claimed: true, hit: true, accepted: true });
  });
  it('accepts a pose reached by one binary64 easing step despite rounding at the envelope edge', () => {
    const h = connected(), r = approach(h), c = h.a.client;
    c.pointer(55, 174); h.flush(); h.advance(40); expect(r.wait).not.toBeNull();
    const p = structuredClone(r.state.localPaddles[0]); target(p, 55, 174); move(p);
    expect(Math.abs(p.dy)).toBeGreaterThan((p.ty - 125.5) / RULES.easing); // the literal rounding that rejected real claims
    c.claim({ matchId: r.state.matchId, rallyId: r.state.rallyId, tick: r.wait!.tick, hit: true, x: p.x, y: p.y, dx: p.dx, dy: p.dy });
    h.advance(40); expect(r.state.lives).toEqual([3, 3]);
    expect(h.records.find(x => x.kind === 'contact-resolved')).toMatchObject({ accepted: true });
  });
  it('rejects a claimed pose outside the envelope of the authoritative paddle and recently sent targets', () => {
    const h = connected(), r = approach(h); h.advance(40);
    h.a.client.claim({ matchId: r.state.matchId, rallyId: r.state.rallyId, tick: r.wait!.tick, hit: true, x: 60, y: 125.5, dx: 0, dy: 0 });
    h.advance(40); expect(r.state.lives).toEqual([2, 3]);
    expect(h.records.find(x => x.kind === 'contact-resolved')).toMatchObject({ claimed: true, accepted: false });
  });
  it('rejects a reachable pose whose curve exceeds one easing step across the envelope', () => {
    const h = connected(), r = approach(h), c = h.a.client;
    c.pointer(55, 125.5); h.flush(); h.advance(40);
    c.claim({ matchId: r.state.matchId, rallyId: r.state.rallyId, tick: r.wait!.tick, hit: true, x: 60, y: 125.5, dx: -81, dy: 0 });
    h.advance(40); expect(r.state.lives).toEqual([2, 3]);
  });
  it('ignores claims for another tick or a stale control generation and keeps waiting', () => {
    const h = connected(), r = approach(h); h.advance(40);
    const base = { matchId: r.state.matchId, rallyId: r.state.rallyId, hit: true, x: 175.5, y: 125.5, dx: 0, dy: 0 };
    h.a.client.claim({ ...base, tick: r.wait!.tick + 1 }); h.advance(40);
    expect(r.wait?.claim).toBeNull(); expect(r.state.lives).toEqual([3, 3]);
    // A modified client's claim for another generation: the session itself stays current, so only the check rejects it.
    const s = h.a.session;
    h.authority.receive(s, JSON.stringify({ type: 'contactClaim', protocolVersion: 1, roomEpoch: r.epoch, ...base, tick: r.wait!.tick, controlGeneration: s.generation + 1 }));
    h.advance(40); expect(r.wait?.claim).toBeNull(); expect(r.state.lives).toEqual([3, 3]);
    h.advance(RULES.contactGraceMs); expect(r.state.phase).toBe('LifeLostHold');
    expect(h.records.find(x => x.kind === 'contact-resolved')).toMatchObject({ claimed: false, timedOut: true });
  });
  it('an authoritative contact never waits', () => {
    const h = connected(), r = approach(h);
    Object.assign(r.state.localPaddles[0], { x: 55.5, y: 125.5, px: 55.5, py: 125.5, tx: 55.5, ty: 125.5 }); r.state.viewBoxes = boxes(r.state);
    h.advance(40); expect(r.wait).toBeNull(); expect(r.state.ball.vz).toBe(2);
    expect(h.records.some(x => x.kind === 'contact-pending')).toBe(false);
  });
});

describe('M5 bounded defender contact claim (presented frame)', () => {
  it('a late move the defender saw reach the ball is honored, and the incoming frame shows the claimed pose', () => {
    const h = connected(), r = approach(h), c = h.a.client, v = new OnlineView(0, h.now), claims: ContactClaim[] = [];
    c.onState = (s, e, at) => v.accept(s, at!, e); c.onInput = (x, y, seq, at) => v.input(x, y, seq, at); c.onFence = () => v.fence();
    c.onPending = (p, at) => v.pendingContact(p, at); v.onClaim = claim => { claims.push(claim); c.claim(claim); };
    h.authority.snapshot(h.a.session); h.flush(); v.draw(h.now(), 0, true);
    c.pointer(55, 125.5);
    h.advance(400, () => v.draw(h.now(), 0, c.enabled));
    expect(claims).toHaveLength(1); const claim = claims[0];
    const claimFrame = v.frames.find(f => f.tick === claim.tick - 1 && f.incomingEventId === null && f.own.left === ownBox({ x: claim.x, y: claim.y } as never)[0] / 20)!;
    expect(claimFrame).toBeDefined();
    // The claim is the closed twip inequality over exactly the drawn ball and paddle.
    const twips = (b: typeof claimFrame.ball) => [b.left, b.right, b.top, b.bottom].map(n => Math.round(n * 20)) as [number, number, number, number];
    expect(twips(claimFrame.own)).toEqual(ownBox({ x: claim.x, y: claim.y } as never));
    expect(claim.hit).toBe(contact(twips(claimFrame.ball), twips(claimFrame.own)));
    expect(claim.hit).toBe(true);
    expect(r.state.lives).toEqual([3, 3]); expect(c.events.some(e => e.type === 'return' && e.side === 0)).toBe(true);
    const incoming = v.frames.find(f => f.incomingEventId !== null)!;
    expect(incoming.own).toEqual(claimFrame.own);
  });
  it('paused same-tick snapshots never pull the shown paddle back to the unmoved authoritative pose', () => {
    const h = connected(), r = approach(h), c = h.a.client, v = new OnlineView(0, h.now);
    c.onState = (s, e, at) => v.accept(s, at!, e); c.onInput = (x, y, seq, at) => v.input(x, y, seq, at);
    h.authority.snapshot(h.a.session); h.flush(); v.draw(h.now(), 0, true);
    c.pointer(55, 125.5); const shown: number[] = [];
    h.advance(300, () => { const m = v.draw(h.now(), 0, c.enabled); if (r.wait) shown.push(m!.own.left); });
    expect(shown.length).toBeGreaterThan(3);
    for (let i = 1; i < shown.length; i++) expect(shown[i]).toBeLessThanOrEqual(shown[i - 1]);
  });
  it('a defender that saw a miss claims a miss', () => {
    const h = connected(), r = approach(h), c = h.a.client, v = new OnlineView(0, h.now), claims: ContactClaim[] = [];
    c.onState = (s, e, at) => v.accept(s, at!, e); c.onInput = (x, y, seq, at) => v.input(x, y, seq, at);
    c.onPending = (p, at) => v.pendingContact(p, at); v.onClaim = claim => { claims.push(claim); c.claim(claim); };
    h.advance(300, () => v.draw(h.now(), 0, c.enabled));
    expect(claims).toMatchObject([{ hit: false, x: 175.5, y: 125.5 }]); expect(r.state.lives).toEqual([2, 3]);
  });
  it('a defender fenced before the miss tick gets no pause: the miss commits at once', () => {
    const h = connected(), r = approach(h), c = h.a.client, v = new OnlineView(0, h.now), claims: ContactClaim[] = [];
    c.onState = (s, e, at) => v.accept(s, at!, e); c.onFence = () => v.fence();
    c.onPending = (p, at) => v.pendingContact(p, at); v.onClaim = claim => claims.push(claim);
    c.blur(); h.advance(80, () => v.draw(h.now(), 0, c.enabled));
    expect(claims).toHaveLength(0); expect(r.state.lives).toEqual([2, 3]);
    expect(h.records.some(x => x.kind === 'contact-pending')).toBe(false);
  });
  it('a defender that blurs during the pause sends no claim and the miss commits', () => {
    const h = connected(), r = approach(h), c = h.a.client, v = new OnlineView(0, h.now), claims: ContactClaim[] = [];
    c.onState = (s, e, at) => v.accept(s, at!, e); c.onFence = () => v.fence();
    c.onPending = (p, at) => v.pendingContact(p, at); v.onClaim = claim => claims.push(claim);
    h.advance(40); expect(r.wait).not.toBeNull(); expect(c.records.some(x => x.kind === 'contact-pending')).toBe(true);
    c.blur(); h.advance(80, () => v.draw(h.now(), 0, c.enabled));
    expect(claims).toHaveLength(0); expect(r.wait).toBeNull(); expect(r.state.lives).toEqual([2, 3]);
    expect(h.records.find(x => x.kind === 'contact-resolved')).toMatchObject({ claimed: false, accepted: false });
  });
});
