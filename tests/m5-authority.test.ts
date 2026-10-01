import { describe, expect, it } from 'vitest';
import { Authority, type Session, type Transport } from '../server/authority';
import { boxes } from '../src/multiplayer/simulation';
import { parseClient } from '../src/multiplayer/protocol';

class Socket implements Transport {
  bufferedAmount = 0; frames: Record<string, any>[] = []; closes: string[] = []; terminated = false;
  send(raw: string) { this.frames.push(JSON.parse(raw)); }
  close(_code: number, reason: string) { this.closes.push(reason); }
  terminate() { this.terminated = true; }
}
function harness() {
  let time = 0, id = 0; const a = new Authority(() => time, () => 0);
  const open = () => { const socket = new Socket(), s = a.open(socket)!; return { s, socket }; };
  const send = (s: Session, type: string, data: Record<string, unknown> = {}) => {
    a.receive(s, JSON.stringify({ type, protocolVersion: 1, ...(!['create', 'join'].includes(type) ? { roomEpoch: s.room?.epoch } : {}),
      ...(!['heartbeat', 'input', 'unavailable'].includes(type) ? { requestId: String(++id) } : {}), ...data })); a.pump();
  };
  const first = open(); send(first.s, 'create', { probeId: 0, c0: 0 });
  const join = () => { const p = open(); send(p.s, 'join', { roomCode: first.s.room!.code, probeId: 0, c0: time }); return p; };
  const beat = (s: Session, socket: Socket, overrides: Record<string, unknown> = {}) => {
    const challenge = socket.frames.filter(f => f.type === 'heartbeat').at(-1)!;
    const snap = [...s.issued].filter(([, v]) => v.ordinary).at(-1)!;
    const state = [...s.issued].filter(([, v]) => v.ordinary && v.snapshot).at(-1)!;
    send(s, 'heartbeat', { runtimeBeatSeq: s.beatSeq + 1, processedServerSerial: snap[0], processedSnapshotSerial: state[0], processedTick: state[1].tick,
      matchId: s.room!.state.matchId, rallyId: s.room!.state.rallyId, phase: s.room!.state.phase, echoNonce: challenge.nonce, probeId: 1, c0: time, c3: time, ...overrides });
  };
  const advance = (duration: number, healthy = false) => { const until = time + duration;
    while (time < until) { time = Math.min(until, time + 10); a.pump(); if (healthy && time % 1000 === 0) for (const s of a.sessions) if (s.room && s.closing === null) beat(s, s.transport as Socket); }
  };
  const ready = (other: ReturnType<typeof open>) => { send(first.s, 'ready', { value: true }); send(other.s, 'ready', { value: true }); };
  return { a, first, open, join, send, beat, advance, ready, setTime: (n: number) => { time = n; }, now: () => time };
}

describe('M5 admission, binding, lifecycle and context races', () => {
  it('one join claims B among many sequentially serialized contenders', () => {
    const h = harness(), r = h.first.s.room!; const contenders = Array.from({ length: 20 }, () => h.join());
    expect(r.slots.filter(Boolean)).toHaveLength(2); expect(r.slots[1]).toBe(contenders[0].s);
    expect(contenders.slice(1).every(p => p.s.closing !== null)).toBe(true);
  });
  it('pre-match departure releases original slot and resets readiness', () => {
    const h = harness(), b = h.join(), r = h.first.s.room!; h.send(b.s, 'ready', { value: true }); h.a.disconnect(h.first.s, 'leave');
    expect(r.ready).toEqual([false, false]); const c = h.open(); h.send(c.s, 'join', { roomCode: r.code, probeId: 0, c0: 0 });
    expect(r.slots[0]).toBe(c.s); expect(r.slots[1]).toBe(b.s);
  });
  it('create retry returns the same capability and allocates no new room', () => {
    const h = harness(), joined = h.first.socket.frames.find(f => f.type === 'joined')!;
    h.send(h.first.s, 'create', { requestId: joined.requestId, probeId: 0, c0: 0 });
    expect(h.a.rooms.size).toBe(1); expect(h.first.socket.frames.filter(f => f.type === 'joined').at(-1)!.playerSessionCredential).toBe(joined.playerSessionCredential);
  });
  it('enforces ten room and 64 socket bounds including unauthenticated upgrades', () => {
    const h = harness(); for (let i = 1; i < 11; i++) { const p = h.open(); h.send(p.s, 'create', { probeId: 0, c0: 0 }); }
    expect(h.a.rooms.size).toBe(10); while (h.a.sessions.size < 64) h.open(); expect(h.a.open(new Socket())).toBeNull();
  });
  it('does not accept replacement joins during countdown', () => {
    const h = harness(), b = h.join(); h.ready(b); expect(h.join().socket.closes).toContain('full');
  });
  it('coalesces input and rejects stale sequence, generation, context and future snapshot claims', () => {
    const h = harness(), b = h.join(); h.ready(b); const s = h.first.s, r = s.room!;
    h.advance(3010, true);
    const f = { matchId: 1, rallyId: 1, controlGeneration: 0, resumeStateSerial: s.authorized, seq: 1, x: 55, y: 45, processedSnapshotSerial: [...s.issued].filter(([, v]) => v.ordinary && v.snapshot).at(-1)![0] };
    h.send(s, 'input', f); h.send(s, 'input', { ...f, seq: 2, x: 296 }); expect(s.pending?.seq).toBe(2);
    expect(r.diagnostics).toContainEqual(expect.objectContaining({ kind: 'coalesced', seq: 1, supersededBy: 2 }));
    for (const patch of [{ seq: 1 }, { seq: 3, controlGeneration: 1 }, { seq: 3, matchId: 0 }, { seq: 3, rallyId: 0 }, { seq: 3, processedSnapshotSerial: 999999 }]) h.send(s, 'input', { ...f, ...patch });
    expect(s.pending?.seq).toBe(2); h.advance(40); expect(r.state.localPaddles[0].tx).toBe(296); expect(r.state.localPaddles[0].seq).toBe(2);
  });
  it('mutual rematch resets match/input context and alternates initial server while preserving fence', () => {
    const h = harness(), b = h.join(); h.ready(b); const s = h.first.s, r = s.room!;
    h.send(s, 'controlFence', { generation: 1 });
    Object.assign(r.state, { phase: 'MatchEnded', lives: [0, 3], lastEventId: 1, result: { matchId: 1, eventId: 1, loser: 0, winner: 1, lives: [0, 3] } }); r.endedAt = h.now();
    h.send(s, 'rematch', { matchId: 1, value: true }); expect(r.state.matchId).toBe(1);
    h.send(b.s, 'rematch', { matchId: 1, value: true }); expect(r.state.matchId).toBe(2); expect(r.state.lives).toEqual([3, 3]); expect(r.state.initialServingSide).toBe(1);
    expect(s.generation).toBe(1); expect(s.enabled).toBe(false); expect(s.seq).toBe(0); expect(s.pending).toBeNull();
    h.send(s, 'rematch', { matchId: 1, value: true }); expect(r.state.matchId).toBe(2);
  });
});

describe('M5 focus fence, runtime health, congestion and atomic terminal ordering', () => {
  it('a fence discards pending input, retains applied target and requires sync then resume', () => {
    const h = harness(), b = h.join(), s = h.first.s, r = s.room!; h.ready(b); h.advance(3010, true); r.state.localPaddles[0].tx = 296;
    h.send(s, 'input', { matchId: 1, rallyId: 1, controlGeneration: 0, resumeStateSerial: s.authorized, seq: 1, x: 55, y: 45, processedSnapshotSerial: [...s.issued].filter(([, v]) => v.ordinary && v.snapshot).at(-1)![0] });
    expect(s.pending?.seq).toBe(1);
    h.send(s, 'controlFence', { generation: 1 }); expect(s.pending).toBeNull(); expect(r.state.localPaddles[0].tx).toBe(296); expect(s.enabled).toBe(false);
    h.send(s, 'controlResume', { generation: 1, stateSerial: s.serial, matchId: 1, rallyId: 1 }); expect(s.enabled).toBe(false);
    h.send(s, 'controlSync', { generation: 1 }); const serial = s.serial;
    h.send(s, 'controlResume', { generation: 1, stateSerial: serial, matchId: 1, rallyId: 1 }); expect(s.enabled).toBe(true); expect(s.authorized).toBe(serial);
  });
  it('rapid toggle fences and stale resumes cannot reopen controls', () => {
    const h = harness(), s = h.first.s; h.send(s, 'controlFence', { generation: 1 }); h.send(s, 'controlSync', { generation: 1 }); const serial = s.serial;
    h.send(s, 'controlFence', { generation: 2 }); h.send(s, 'controlResume', { generation: 1, stateSerial: serial, matchId: 0, rallyId: 0 }); expect(s.enabled).toBe(false);
    h.send(s, 'controlFence', { generation: 4 }); expect(s.generation).toBe(2);
  });
  it('30-second responsive visible blur keeps normal deadlines and match play', () => {
    const h = harness(), b = h.join(); h.ready(b); h.send(h.first.s, 'controlFence', { generation: 1 }); h.advance(30000, true);
    expect(h.a.rooms.size).toBe(1); expect(h.first.s.enabled).toBe(false); expect(h.first.s.room!.state.tick).toBeGreaterThan(89); expect(h.first.s.closing).toBeNull();
  });
  it('Waiting heartbeat health requires no increasing tick', () => {
    const h = harness(); h.advance(30000, true); expect(h.first.s.room!.state.tick).toBe(0); expect(h.first.s.closing).toBeNull();
  });
  it('pongs and reused nonces cannot replace runtime beats; cleanup is forced at +1 second', () => {
    const h = harness(); h.advance(1000); h.beat(h.first.s, h.first.socket); const at = h.first.s.healthAt;
    h.beat(h.first.s, h.first.socket); expect(h.first.s.healthAt).toBe(at);
    h.advance(5000); expect(h.first.socket.closes).toContain('runtime-timeout'); expect(h.a.rooms.size).toBe(0);
    h.advance(1000); expect(h.first.socket.terminated).toBe(true); expect(h.a.sessions.size).toBe(0);
  });
  it('control acknowledgements do not extend runtime health', () => {
    const h = harness(); for (let i = 1; i < 5; i++) { h.advance(1000); h.send(h.first.s, 'controlFence', { generation: i }); }
    expect(h.first.s.healthAt).toBe(0); h.advance(1000); expect(h.first.s.closing).not.toBeNull();
  });
  it('tick progress has a fresh origin on start while beat deadline is unchanged', () => {
    const h = harness(), b = h.join(); h.advance(4000, true); const old = h.first.s.healthAt; h.ready(b);
    expect(h.first.s.tickAt).toBe(4000); expect(h.first.s.healthAt).toBe(old);
  });
  it('stale snapshot and future health serial fail validation', () => {
    const h = harness(), s = h.first.s; h.advance(1000); h.beat(s, h.first.socket, { processedServerSerial: 999999 }); expect(s.healthAt).toBe(0);
    h.beat(s, h.first.socket, { echoNonce: 'unknown' }); expect(s.healthAt).toBe(0);
  });
  it('sustained congestion has a separate 2-second clock and bounded queued events', () => {
    const h = harness(); h.first.socket.bufferedAmount = 70000; h.advance(1000); expect(h.first.s.congested).toBe(1000);
    h.advance(1990); expect(h.first.s.closing).toBeNull(); h.advance(10); expect(h.first.socket.closes).toContain('congestion');
  });
  it('hard congestion closes immediately even in Waiting', () => {
    const h = harness(); h.first.socket.bufferedAmount = 262144; h.a.pump(); expect(h.first.s.closing).toBe(0);
  });
  it.each([70000, 262144])('congestion at %i bytes during an active match aborts without recursive terminal sends', bytes => {
    const h = harness(), b = h.join(); h.ready(b); const r = h.first.s.room!;
    h.first.socket.bufferedAmount = bytes;
    expect(() => { h.a.pump(); if (bytes < 262144) h.advance(2100); }).not.toThrow();
    expect(h.a.rooms.size).toBe(0); expect(r.state.phase).toBe('Aborted'); expect(r.state.result).toBeNull();
    expect(h.first.s.closing).not.toBeNull(); expect(b.s.closing).not.toBeNull();
  });
  it('queued lifecycle overflow cannot recursively attempt interruption on the same failed socket', () => {
    const h = harness(), b = h.join(); h.ready(b);
    h.first.socket.bufferedAmount = 70000;
    h.first.s.events = Array.from({ length: 33 }, () => h.first.s.lastSent);
    expect(() => h.a.snapshot(h.first.s)).not.toThrow(); expect(h.a.rooms.size).toBe(0);
  });
  it('six overdue ticks abort rather than fast-forward; five are allowed', () => {
    const h = harness(), b = h.join(); h.ready(b); h.setTime(170); h.a.pump(); expect(h.a.rooms.size).toBe(1);
    h.setTime(400); h.a.pump(); expect(h.a.rooms.size).toBe(0); expect(h.first.socket.closes).toContain('server-overrun');
  });
  it.each(['leave', 'unavailable'] as const)('%s before last-life contact aborts without finish', type => {
    const h = harness(), b = h.join(); h.ready(b); const r = h.first.s.room!;
    r.state.phase = 'Rally'; r.state.lives[0] = 1; Object.assign(r.state.ball, { u: -120, z: 0, vz: -2 }); r.state.viewBoxes = boxes(r.state);
    h.a.receive(h.first.s, JSON.stringify({ protocolVersion: 1, roomEpoch: r.epoch, type, ...(type === 'leave' ? { requestId: 'last' } : { reason: 'hidden' }) })); h.advance(40);
    expect(r.state.result).toBeNull(); expect(r.state.phase).toBe('Aborted'); expect(b.socket.frames.some(f => f.type === 'event' && f.eventType === 'finish')).toBe(false);
  });
  it('finish committed before disconnect is immutable and ordinary blur cannot cancel it', () => {
    const h = harness(), b = h.join(); h.ready(b); const r = h.first.s.room!;
    r.state.phase = 'Rally'; r.state.lives[0] = 1; Object.assign(r.state.ball, { u: -120, z: 0, vz: -2 }); r.state.viewBoxes = boxes(r.state);
    h.send(h.first.s, 'controlFence', { generation: 1 }); h.advance(40); const result = structuredClone(r.state.result);
    expect(result?.loser).toBe(0); h.a.disconnect(h.first.s, 'hidden'); expect(r.state.result).toEqual(result); expect(r.state.phase).toBe('MatchEnded');
  });
});

describe('M5 wire trust boundary', () => {
  it('rejects a countdown sample delayed until Rally and accepts only a processed Rally proof', () => {
    const h = harness(), b = h.join(), s = h.first.s; h.ready(b); h.advance(2970, true);
    const countdown = [...s.issued].filter(([, v]) => v.ordinary && v.snapshot).at(-1)![0];
    const f = { matchId: 1, rallyId: 1, controlGeneration: 0, resumeStateSerial: s.authorized, seq: 1, x: 55, y: 45, processedSnapshotSerial: countdown };
    h.send(s, 'input', f); expect(s.pending).toBeNull(); expect(s.seq).toBe(0);
    h.advance(40, true); expect(s.room!.state.phase).toBe('Rally');
    h.send(s, 'input', f); expect(s.pending).toBeNull(); expect(s.seq).toBe(0);
    const rally = [...s.issued].filter(([, v]) => v.ordinary && v.snapshot).at(-1)![0];
    h.send(s, 'input', { ...f, processedSnapshotSerial: rally }); expect(s.pending?.seq).toBe(1);
    h.send(s, 'controlFence', { generation: 1 }); expect(s.pending).toBeNull();
    h.send(s, 'input', { ...f, seq: 2, processedSnapshotSerial: rally }); expect(s.pending).toBeNull();
  });
  it.each(['Waiting', 'Countdown', 'LifeLostHold', 'MatchEnded', 'Aborted'] as const)('%s neither queues nor consumes targets', phase => {
    const h = harness(), b = h.join(), s = h.first.s, r = s.room!; h.ready(b); h.advance(3010, true);
    const f = { matchId: 1, rallyId: 1, controlGeneration: 0, resumeStateSerial: s.authorized, seq: 1, x: 55, y: 45, processedSnapshotSerial: [...s.issued].filter(([, v]) => v.ordinary && v.snapshot).at(-1)![0] };
    h.send(s, 'input', f); expect(s.pending?.seq).toBe(1);
    r.state.phase = phase; r.state.phaseDeadline = r.state.tick + 90;
    h.send(s, 'input', { ...f, seq: 2, x: 296 }); expect(s.seq).toBe(1);
    expect(s.pending).toBeNull();
    h.advance(40); expect(r.state.localPaddles[0]).toMatchObject({ x: 175.5, y: 125.5, tx: 175.5, ty: 125.5, seq: 0 });
    expect(s.pending).toBeNull();
  });
  it('records actual first use only after a new target publishes a moving paddle', () => {
    const h = harness(), b = h.join(), records: Record<string, unknown>[] = []; h.a.onDiagnostic = r => records.push(structuredClone(r)); h.ready(b);
    const s = h.first.s; const snap = [...s.issued].filter(([, v]) => v.snapshot).at(-1)![0];
    h.send(s, 'input', { matchId: 1, rallyId: 1, controlGeneration: 0, resumeStateSerial: s.authorized, seq: 1, x: 55, y: 45, processedSnapshotSerial: snap });
    h.advance(2900, true); expect(records.some(r => r.kind === 'first-use' && r.side === 0)).toBe(false);
    h.advance(110, true); expect(s.pending).toBeNull(); expect(s.seq).toBe(0);
    expect(s.room!.state.localPaddles[0]).toMatchObject({ x: 175.5, y: 125.5, tx: 175.5, ty: 125.5 });
    h.send(s, 'input', { matchId: 1, rallyId: 1, controlGeneration: 0, resumeStateSerial: s.authorized, seq: 1, x: 55, y: 45, processedSnapshotSerial: [...s.issued].filter(([, v]) => v.ordinary && v.snapshot).at(-1)![0] });
    h.advance(100, true); const use = records.filter(r => r.kind === 'first-use' && r.side === 0); expect(use).toHaveLength(1);
    expect(use[0]).toMatchObject({ seq: 1, generation: 0, publishedTick: 91, tick: 92 });
  });
  it('heartbeat metadata is not an issued gameplay snapshot', () => {
    const h = harness(), s = h.first.s; h.advance(1000); const heartbeat = h.first.socket.frames.filter(f => f.type === 'heartbeat').at(-1)!;
    h.beat(s, h.first.socket, { processedSnapshotSerial: heartbeat.serverSerial }); expect(s.healthAt).toBe(0);
  });
  it('queued but unsent snapshots cannot acknowledge input or runtime health', () => {
    const h = harness(), b = h.join(), s = h.first.s; h.ready(b); h.advance(3010, true); h.first.socket.bufferedAmount = 70000; const serial = h.a.snapshot(s);
    h.send(s, 'input', { matchId: 1, rallyId: 1, controlGeneration: 0, resumeStateSerial: s.authorized, seq: 1, x: 55, y: 45, processedSnapshotSerial: serial });
    expect(s.pending).toBeNull(); expect(s.issued.get(serial)?.sent).toBe(false);
  });
  it('Waiting and rematch windows expire despite healthy runtime beats', () => {
    const h = harness(); h.advance(600000, true); expect(h.a.rooms.size).toBe(0);
    const q = harness(), b = q.join(); q.ready(b); const r = q.first.s.room!;
    r.state.phase = 'MatchEnded'; r.state.lives = [0, 3]; r.state.lastEventId = 1; r.state.result = { matchId: 1, eventId: 1, winner: 1, loser: 0, lives: [0, 3] }; r.endedAt = 0;
    q.advance(60000, true); expect(q.a.rooms.size).toBe(0);
  });
  it('absolute room TTL is independent of focus and room readiness', () => {
    const h = harness(), b = h.join(); h.ready(b); const r = h.first.s.room!; r.created = -3600000; h.a.pump();
    expect(r.state.phase).toBe('Aborted'); expect(h.a.rooms.size).toBe(0); expect(h.first.socket.closes).toContain('expired');
  });
  it.each([
    '{"type":"hit","protocolVersion":1}', '{"type":"create","protocolVersion":2,"requestId":"a","probeId":0,"c0":0}',
    '{"type":"create","protocolVersion":1,"requestId":"a","probeId":0,"c0":0,"winner":0}',
    '{"type":"create","protocolVersion":1,"requestId":"a","probeId":9007199254740992,"c0":0}',
    '{"type":"create","protocolVersion":1,"requestId":"a","probeId":0,"c0":1e309}', '[]', '{}', 'null', '{', ' '.repeat(1025),
  ])('rejects malformed/forged frame %s', raw => { expect(() => parseClient(raw, false)).toThrow(); });
  it('credentials do not occur in opponent state or diagnostics', () => {
    const h = harness(), b = h.join(); expect(JSON.stringify(b.socket.frames)).not.toContain(h.first.s.credential);
    expect(JSON.stringify(h.first.s.room!.diagnostics)).not.toContain(h.first.s.credential);
  });
});
