import { describe, expect, it } from 'vitest';
import { Authority, type Session } from '../server/authority';
import { OnlineClient } from '../src/multiplayer/client';
import { OnlineView } from '../src/multiplayer/view';
import { boxes, createOnline, startMatch, step } from '../src/multiplayer/simulation';
import { validState } from '../src/multiplayer/protocol';
import type { OnlineEvent, OnlineState } from '../src/multiplayer/types';
import { RULES } from '../src/multiplayer/rules';
// A client that never claims lets an uncommitted miss resolve only after the grace window (plan §5 amendment).
const unclaimedMiss = RULES.contactGraceMs + 80;

function connected() {
  let time = 0; const authority = new Authority(() => time, () => 0);
  const pairs: { client: OnlineClient; session: Session; outbound: string[]; dropUp: boolean; dropDown: boolean }[] = [];
  function open(operation: 'create' | 'join', code?: string) {
    const outbound: string[] = [], down: string[] = [];
    const transport = { bufferedAmount: 0, send: (raw: string) => down.push(raw), close: () => {}, terminate: () => {} };
    const session = authority.open(transport)!;
    const client = new OnlineClient({ readyState: 1, bufferedAmount: 0, send: (raw: string) => outbound.push(raw), close: () => {} }, () => time, operation, code);
    const pair = { client, session, outbound, down, dropUp: false, dropDown: false }; pairs.push(pair); flush(); return pair;
  }
  function flush() {
    for (let n = 0; n < 5; n++) {
      for (const p of pairs) for (const raw of p.outbound.splice(0)) if (!p.dropUp) authority.receive(p.session, raw);
      authority.pump();
      for (const p of pairs) { const down = (p as typeof p & { down: string[] }).down; for (const raw of down.splice(0)) if (!p.dropDown) p.client.receive(raw); p.client.pump(); }
    }
  }
  const a = open('create'), b = open('join', a.client.code);
  const advance = (ms: number) => { const end = time + ms; while (time < end) { time = Math.min(end, time + 10); flush(); } };
  return { authority, a, b, advance, flush, setTime: (n: number) => { time = n; }, now: () => time };
}
describe('M5 connected runtime processing and input handshakes', () => {
  it('continuous non-rally mouse movement is discarded; only a newly captured rally sample moves', () => {
    const h = connected(), c = h.a.client, r = h.a.session.room!, view = new OnlineView(0, h.now);
    c.onState = (s, e, at) => view.accept(s, at!, e); c.onInput = (x, y, seq) => view.input(x, y, seq); c.onFence = () => view.fence();
    view.accept(c.state!, h.now());
    const stationary = () => {
      for (let i = 0; i < 20; i++) {
        c.pointer(i % 2 ? 55 : 296, i % 2 ? 45 : 206); h.advance(10);
        expect(view.draw(h.now(), 0, c.enabled)!.own.left).toBe(145.5);
        expect(r.state.localPaddles[0].x).toBe(175.5); expect(h.a.session.pending).toBeNull();
        expect(view.history).toHaveLength(0);
      }
    };
    stationary(); expect(c.seq).toBe(0);
    c.command('ready', true); h.b.client.command('ready', true); h.flush(); stationary();
    h.advance(2800); expect(c.state!.phase).toBe('Rally'); expect(c.seq).toBe(0);
    expect(r.state.localPaddles[0].x).toBe(175.5);
    c.pointer(55, 45); h.advance(40);
    expect(r.state.localPaddles[0].x).toBe(95.16666666666667); expect(c.seq).toBe(1);
    Object.assign(r.state.ball, { u: -120, z: 0, vz: -2 }); r.state.viewBoxes = boxes(r.state); h.advance(unclaimedMiss);
    expect(c.state!.phase).toBe('LifeLostHold'); expect(r.state.lives).toEqual([2, 3]);
    const holdX = r.state.localPaddles[0].x;
    for (let i = 0; i < 30; i++) { c.pointer(296, 206); h.advance(10); expect(r.state.localPaddles[0].x).toBe(holdX); }
    expect(c.seq).toBe(1); h.advance(340); expect(c.state!.phase).toBe('Countdown'); stationary();
    h.advance(2800); expect(c.state!.phase).toBe('Rally'); expect(r.state.localPaddles[0].x).toBe(175.5); expect(c.seq).toBe(1);
    c.pointer(296, 206); h.advance(40); expect(r.state.localPaddles[0].x).toBe(255.83333333333331); expect(c.seq).toBe(2);
  });
  it('rally activation while fenced and rapid toggles require enablement and a post-ack sample', () => {
    const h = connected(), c = h.a.client; c.command('ready', true); h.b.client.command('ready', true); h.flush();
    c.blur(); c.focus(); c.blur(); h.flush(); h.advance(3000);
    c.pointer(55, 45); h.advance(40); expect(c.enabled).toBe(false); expect(c.seq).toBe(0);
    c.focus(); c.pointer(55, 45); h.flush(); expect(c.enabled).toBe(true);
    h.advance(40); expect(c.seq).toBe(0); expect(h.a.session.room!.state.localPaddles[0].x).toBe(175.5);
    c.pointer(55, 45); h.advance(40); expect(c.seq).toBe(1); expect(h.a.session.room!.state.localPaddles[0].tx).toBe(55);
  });
  it('a launch event without a processed ordinary Rally snapshot cannot authorize input', () => {
    const h = connected(), c = h.a.client, state = createOnline(); startMatch(state, 0);
    const e = Array.from({ length: 90 }, () => step(state)).flat().find(e => e.type === 'launch')!;
    c.receive(JSON.stringify({ ...e, type: 'event', eventType: 'launch', protocolVersion: 1, roomEpoch: c.epoch, serverSerial: c.serial + 1, serverTime: 0, freshSnapshot: state })); c.pump();
    c.pointer(55, 45); c.pump(); expect(c.seq).toBe(0);
    const metadata = { ready: [true, true], occupied: [true, true], rematch: [false, false], controlGeneration: [0, 0], enabled: [true, true], ackInputSeq: [0, 0], ackInputTick: [0, 0] };
    c.receive(JSON.stringify({ ...state, ...metadata, type: 'snapshot', protocolVersion: 1, roomEpoch: c.epoch, serverSerial: c.serial + 1, serverTime: 0 })); c.pump();
    expect(c.seq).toBe(0); h.setTime(h.now() + 1); c.pointer(55, 45); c.pump(); expect(c.seq).toBe(1);
  });
  it('binds two perspectives, bootstraps probes and keeps Waiting healthy', () => {
    const h = connected(); expect(h.a.client.side).toBe(0); expect(h.b.client.side).toBe(1);
    h.advance(30000); expect(h.a.client.closed).toBe(false); expect(h.b.client.closed).toBe(false); expect(h.a.client.probes.length).toBeLessThanOrEqual(20);
    expect(h.a.client.state!.tick).toBe(0); expect(h.a.session.healthAt).toBeGreaterThan(25000);
  });
  it('locks ordinary blur and consumes no retained pointer on return', () => {
    const h = connected(), c = h.a.client;
    c.command('ready', true); h.b.client.command('ready', true); h.flush(); h.advance(3000);
    c.pointer(55, 45); c.blur(); h.flush(); expect(h.a.session.pending).toBeNull(); expect(h.a.session.enabled).toBe(false);
    c.pointer(296, 206); c.focus(); h.flush(); expect(c.enabled).toBe(true); expect(h.a.outbound.some(r => JSON.parse(r).type === 'input')).toBe(false);
    const seq = h.a.session.seq; h.advance(100); expect(h.a.session.seq).toBe(seq);
    c.pointer(296, 206); h.advance(40); expect(h.a.session.room!.state.localPaddles[0].tx).toBe(296);
  });
  it('rapid toggles keep later generation fenced despite queued old acknowledgements', () => {
    const h = connected(), c = h.a.client; c.blur(); c.focus(); c.blur(); h.flush();
    expect(c.generation).toBe(2); expect(c.enabled).toBe(false); expect(h.a.session.generation).toBe(2); expect(h.a.session.enabled).toBe(false);
    c.focus(); h.flush(); expect(c.enabled).toBe(true); expect(h.a.session.authorized).toBe(c.authorized);
  });
  it.each(['up', 'down'] as const)('%s-stream failure expires both runtime watchdogs without inferred winner', direction => {
    const h = connected(); h.a.client.command('ready', true); h.b.client.command('ready', true); h.flush();
    if (direction === 'up') h.a.dropUp = true; else h.a.dropDown = true;
    h.advance(5100); expect(h.a.client.known).toBeNull(); expect(h.a.session.closing).not.toBeNull(); expect(h.authority.rooms.size).toBe(0);
  });
  it('hidden page closes, while 30 seconds visible blur remains healthy', () => {
    const h = connected(); h.a.client.blur(); h.advance(30000); expect(h.a.client.closed).toBe(false); expect(h.a.session.healthAt).toBeGreaterThan(25000);
    h.a.client.hidden(); h.flush(); expect(h.a.client.closed).toBe(true); expect(h.b.session.room!.state.phase).toBe('Waiting'); expect(h.b.client.ready).toEqual([false, false]);
  });
  it('checks elapsed watchdog time before queued state can revive a frozen runtime', () => {
    const h = connected(); h.setTime(5000); h.a.client.receive(JSON.stringify({ type: 'heartbeat', protocolVersion: 1, roomEpoch: h.a.client.epoch, serverSerial: 9999, serverTime: 5000, nonce: 'new' }));
    h.a.client.pump(); expect(h.a.client.closed).toBe(true); expect(h.a.client.serial).toBeLessThan(9999);
  });
  it('final delivery distinguishes known from undelivered and retains knowledge through closure', () => {
    const h = connected(); h.a.client.command('ready', true); h.b.client.command('ready', true); h.flush();
    const r = h.a.session.room!; r.state.phase = 'Rally'; r.state.lives[0] = 1; Object.assign(r.state.ball, { u: -120, z: 0, vz: -2 }); r.state.viewBoxes = boxes(r.state);
    h.b.dropDown = true; h.advance(unclaimedMiss); expect(h.a.client.known?.winner).toBe(1); expect(h.b.client.known).toBeNull();
    h.authority.shutdown(); h.flush(); h.a.client.transportClosed(); h.b.client.transportClosed();
    expect(h.a.client.status).toBe('Final result received'); expect(h.a.client.known?.winner).toBe(1); expect(h.b.client.status).toContain('unknown');
  });
  it('terminal mouse samples and closure cannot move the paddle or erase a validated result', () => {
    const h = connected(), c = h.a.client, v = new OnlineView(0, h.now);
    c.onState = (s, e, at) => v.accept(s, at!, e); c.onInput = (x, y, seq) => v.input(x, y, seq); c.onFence = () => v.fence();
    c.command('ready', true); h.b.client.command('ready', true); h.flush(); h.advance(3010);
    const r = h.a.session.room!; r.state.lives[0] = 1; Object.assign(r.state.ball, { u: -120, z: 0, vz: -2 }); r.state.viewBoxes = boxes(r.state); h.advance(unclaimedMiss);
    expect(c.known?.winner).toBe(1); const result = structuredClone(c.known), seq = c.seq;
    for (let i = 0; i < 20; i++) { c.pointer(55, 45); h.advance(10); expect(v.draw(h.now(), 0, c.enabled)!.own.left).toBe(145.5); }
    expect(c.seq).toBe(seq); expect(v.history).toHaveLength(0); c.leave(); h.flush();
    c.pointer(296, 206); expect(v.draw(h.now(), 0, c.enabled)!.own.left).toBe(145.5); expect(c.known).toEqual(result); expect(c.enabled).toBe(false);
  });
  it('bounded queued terminal state may establish result while closing, without controls', () => {
    const h = connected(), c = h.a.client; const s = createOnline(); startMatch(s, 0);
    const metadata = { ready: [true, true], occupied: [true, true], rematch: [false, false], controlGeneration: [0, 0], enabled: [true, true], ackInputSeq: [0, 0], ackInputTick: [0, 0] };
    c.receive(JSON.stringify({ ...s, ...metadata, type: 'snapshot', protocolVersion: 1, roomEpoch: c.epoch, serverSerial: c.serial + 1, serverTime: 0 })); c.pump();
    s.phase = 'MatchEnded'; s.lives = [0, 3]; s.lastEventId = 1; s.result = { matchId: 1, eventId: 1, loser: 0, winner: 1, lives: [0, 3] };
    c.receive(JSON.stringify({ ...s, ...metadata, type: 'snapshot', protocolVersion: 1, roomEpoch: c.epoch, serverSerial: c.serial + 1, serverTime: 0 })); c.hidden();
    expect(c.known?.winner).toBe(1); expect(c.enabled).toBe(false); expect(c.closed).toBe(true);
  });
  it('valid terminal frames later in a closing runtime batch still establish knowledge', () => {
    const h = connected(), c = h.a.client; c.command('ready', true); h.b.client.command('ready', true); h.flush();
    const s = structuredClone(c.state!); s.phase = 'MatchEnded'; s.lives = [0, 3]; s.lastEventId = 1;
    s.result = { matchId: 1, eventId: 1, loser: 0, winner: 1, lives: [0, 3] };
    c.receive(JSON.stringify({ type: 'interrupted', protocolVersion: 1, roomEpoch: c.epoch, serverSerial: c.serial + 1, serverTime: 0, reason: 'closed', freshSnapshot: { ...s, phase: 'Aborted', result: null } }));
    c.receive(JSON.stringify({ ...s, type: 'snapshot', protocolVersion: 1, roomEpoch: c.epoch, serverSerial: c.serial + 2, serverTime: 0 })); c.pump();
    expect(c.closed).toBe(true); expect(c.known?.winner).toBe(1); expect(c.enabled).toBe(false);
  });
  it('ordinary snapshot backlog coalesces while bounded terminal candidates survive', () => {
    const h = connected(), c = h.a.client, s = structuredClone(c.state!);
    for (let i = 0; i < 100; i++) c.receive(JSON.stringify({ ...s, serverSerial: c.serial + i + 1 }));
    expect(c.inbox).toHaveLength(1); expect(c.closed).toBe(false);
  });
  it('rematch while focused but fenced reacquires through the full handshake', () => {
    const h = connected(); h.a.client.command('ready', true); h.b.client.command('ready', true); h.flush();
    const r = h.a.session.room!; r.state.phase = 'Rally'; r.state.lives[0] = 1; Object.assign(r.state.ball, { u: -120, z: 0, vz: -2 }); r.state.viewBoxes = boxes(r.state);
    h.a.client.blur(); h.flush(); h.advance(40); h.a.client.focus(); h.flush(); expect(h.a.client.enabled).toBe(false);
    h.a.client.command('rematch', true); h.b.client.command('rematch', true); h.flush();
    expect(h.a.client.state!.matchId).toBe(2); expect(h.a.client.known).toBeNull(); expect(h.a.client.generation).toBe(1); expect(h.a.client.enabled).toBe(true);
    expect(h.a.session.seq).toBe(0); h.a.client.pointer(55, 45); h.advance(40); expect(h.a.session.seq).toBe(0);
    h.advance(3000); expect(h.a.session.room!.state.localPaddles[0].x).toBe(175.5);
    h.a.client.pointer(55, 45); h.advance(40); expect(h.a.session.seq).toBe(1);
  });
  it('a queued pointer captured in the prior rally is disposed rather than stamped into the new rally', () => {
    const h = connected(), c = h.a.client; c.command('ready', true); h.b.client.command('ready', true); h.flush();
    h.advance(3000);
    c.pointer(55, 45);
    const state = structuredClone(c.state!); state.rallyId++;
    c.receive(JSON.stringify({ ...state, type: 'snapshot', protocolVersion: 1, roomEpoch: c.epoch, serverSerial: c.serial + 1, serverTime: h.now() }));
    c.pump(); expect(h.a.outbound.some(raw => JSON.parse(raw).type === 'input')).toBe(false);
  });
  it.each([15, 30, 60, 120, 144])('render callbacks at %i Hz do not change authoritative state', hz => {
    const h = connected(); h.a.client.command('ready', true); h.b.client.command('ready', true); h.flush();
    const view = new OnlineView(0, () => h.now()); h.a.client.onState = (s, e, at) => view.accept(s, at!, e);
    let next = 0; for (let i = 0; i < 600; i++) { h.advance(10); if (h.now() >= next) { view.draw(h.now(), 0, false); next += 1000 / hz; } }
    expect(h.a.client.state).toMatchObject({ tick: 180, matchId: 1, lives: h.a.session.room!.state.lives });
  });
});

describe('M5 incoming discontinuity evidence and terminal validation', () => {
  it.each(['miss', 'finish', 'return'] as const)('runtime-validated authority wall-top/wall-left/%s batch preserves literal incoming geometry', outcome => {
    const h = connected(), s = h.a.session.room!.state, v = new OnlineView(0, h.now);
    startMatch(s, 0); s.phase = 'Rally';
    Object.assign(s.ball, { u: -135.5, y: 40, z: 0, vx: -1, vy: 1, vz: -2 });
    if (outcome === 'finish') s.lives[0] = 1;
    if (outcome === 'return') Object.assign(s.localPaddles[0], { x: 68.38888888888889, y: 53.94444444444444 });
    s.viewBoxes = boxes(s); h.a.client.onState = (state, e, at) => v.accept(state, at!, e);
    h.authority.snapshot(h.a.session); h.flush(); v.draw(0, 0, true);
    Object.assign(v.predicted!, { x: 68.38888888888889, y: 53.94444444444444, px: 68.38888888888889,
      py: 53.94444444444444, tx: 68.38888888888889, ty: 53.94444444444444 });
    h.setTime(67); const preceding = v.draw(67, 0, true)!;
    expect(preceding.own).toEqual({ left: 38.35, right: 98.35, top: 33.9, bottom: 73.9 });
    h.setTime(100); h.flush(); if (outcome !== 'return') h.advance(RULES.contactGraceMs + 40);
    expect(h.a.client.closed).toBe(false); expect(h.a.client.events.map(e => e.type)).toEqual(['wall-top', 'wall-left', outcome]);
    const at = h.now() + 80; h.setTime(at); const incoming = v.draw(at, 0, true)!;
    expect(incoming.own).toEqual(preceding.own); expect(incoming.ball).toEqual({ left: 25, right: 55, top: 25, bottom: 55 });
    expect(incoming.incomingEventId).toBe(3); expect(v.frames).toContainEqual(preceding);
    if (outcome === 'finish') expect(h.a.client.known).toMatchObject({ winner: 1, lives: [0, 3] });
  });
  it('retains actual predicted incoming geometry before event-triggered correction/overlay', () => {
    let time = 0; const v = new OnlineView(0, () => time), s = createOnline(); startMatch(s, 0); s.phase = 'Rally';
    v.accept(s, 0); v.draw(0, 0, true); v.input(55, 45, 1); time = 100; const previous = v.draw(100, 0, true)!;
    Object.assign(s.ball, { u: -120, z: 0, vz: -2 }); s.lives[0] = 1; s.viewBoxes = boxes(s);
    const e = step(s).find(e => e.type === 'finish')!; v.accept(s, 100, e);
    expect(v.draw(110, 0, true)!.overlayAllowed).toBe(false);
    time = 180; const incoming = v.draw(180, 0, true)!;
    expect(incoming.incomingEventId).toBe(e.eventId); expect(incoming.ball.left).toBe(e.incomingViewBoxes[0].ball[0] / 20);
    expect(incoming.own.left).not.toBe(s.viewBoxes[0].own[0] / 20); expect(incoming.overlayAllowed).toBe(false);
    expect(v.frames).toContainEqual(previous); time = 197; const after = v.draw(197, 0, true)!;
    expect(after.incomingEventId).toBeNull(); expect(after.overlayAllowed).toBe(true);
  });
  it.each([
    (s: OnlineState) => { s.result!.winner = 0; }, (s: OnlineState) => { s.result!.eventId = 0; },
    (s: OnlineState) => { s.lives[0] = 1; }, (s: OnlineState) => { s.result!.lives = [1, 3]; },
  ])('rejects inconsistent terminal result fields', corrupt => {
    const s = createOnline(); startMatch(s, 0); s.phase = 'MatchEnded'; s.lives = [0, 3]; s.lastEventId = 1; s.result = { matchId: 1, eventId: 1, loser: 0, winner: 1, lives: [0, 3] };
    expect(validState(s)).toBe(true); corrupt(s); expect(validState(s)).toBe(false);
  });
  it('exports exact rectangles with bounded adjacent frame history', () => {
    let time = 0; const v = new OnlineView(1, () => time), s = createOnline();
    for (let i = 0; i < 1000; i++) { time = i; v.accept(s, time); v.draw(time, 0, false); }
    expect(v.frames).toHaveLength(600); expect(v.samples).toHaveLength(60);
  });
  it('reconciliation never replays an unacknowledged prior-rally target into a reset paddle', () => {
    const v = new OnlineView(0, () => 0), s = createOnline(); startMatch(s, 0); s.phase = 'Rally';
    v.accept(s, 0); v.draw(0, 0, true); v.input(55, 45, 1);
    s.rallyId++; s.phase = 'Countdown'; v.accept(s, 0);
    expect(v.history).toHaveLength(0); expect(v.predicted).toBeNull();
    expect(v.draw(0, 0, true)!.own).toEqual({ left: 145.5, right: 205.5, top: 105.5, bottom: 145.5 });
  });
  it('never invents an incoming frame while frozen', () => {
    let time = 0; const v = new OnlineView(0, () => time), s = createOnline(); startMatch(s, 0); v.accept(s, 0); v.draw(0, 0, false);
    time = 600; const model = v.draw(600, 0, false)!; expect(model.frozen).toBe(true); expect(model.overlayAllowed).toBe(false);
    expect(model.incomingEventId).toBeNull();
  });
  it.each(['Waiting', 'MatchEnded'] as const)('%s presentation remains healthy without advancing snapshots', phase => {
    const v = new OnlineView(0, () => 30000), s = createOnline(); s.phase = phase; v.accept(s, 0);
    const model = v.draw(30000, 0, false)!; expect(model.frozen).toBe(false); expect(model.degraded).toBe(false); expect(model.snapshotAge).toBe(30000);
  });
  it('audio fires once at the buffered presentation boundary', () => {
    let time = 0, count = 0; const v = new OnlineView(0, () => time), s = createOnline(); startMatch(s, 0); s.phase = 'Rally';
    const e: OnlineEvent = { type: 'return', side: 0, tick: 1, matchId: 1, rallyId: 1, eventId: 1, incomingBoxTick: 0, incomingViewBoxes: s.viewBoxes, lives: [3, 3], result: null };
    v.onAudio = () => count++; v.accept(s, 0, e); for (let i = 0; i < 60; i++) { time = i * 17; v.draw(time, 0, false); }
    expect(count).toBe(1);
  });
});
