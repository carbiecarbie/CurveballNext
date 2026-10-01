import { afterEach, expect, it, vi } from 'vitest';
import { Authority, type Session } from '../server/authority';
import { OnlineClient } from '../src/multiplayer/client';
import { boxes, startMatch } from '../src/multiplayer/simulation';
import { mountOnline } from '../src/multiplayer/ui';

vi.mock('../src/presentation/audio', () => ({ Sound: class { enabled = true; unlock() {} play() {} toggle() {} } }));
vi.mock('../src/presentation/canvas', () => ({ drawOnline: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function harness() {
  let time = 0, hidden = false, focused = true;
  const win = new EventTarget(), doc = new EventTarget();
  const elements = new Map<string, any>();
  const element = (id: string) => {
    if (!elements.has(id)) elements.set(id, { value: '', hidden: false, disabled: false, textContent: '', onclick: null,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 350, height: 250 }), click() {} });
    return elements.get(id);
  };
  Object.defineProperties(doc, { hidden: { get: () => hidden }, hasFocus: { value: () => focused }, createElement: { value: () => element('anchor') } });
  const root = { hidden: false, innerHTML: '', querySelector: (id: string) => element(id.slice(1)) } as unknown as HTMLElement;
  const timers = new Map<number, () => void>(), frames = new Map<number, () => void>(); let serial = 0;
  vi.stubGlobal('window', win); vi.stubGlobal('document', doc);
  vi.stubGlobal('location', { hash: '', origin: 'http://localhost', pathname: '/' });
  vi.stubGlobal('performance', { now: () => time, timeOrigin: 1_700_000_000_000 });
  vi.stubGlobal('setInterval', (fn: () => void) => { const id = ++serial; timers.set(id, fn); return id; });
  vi.stubGlobal('clearInterval', (id: number) => timers.delete(id));
  vi.stubGlobal('setTimeout', () => ++serial);
  vi.stubGlobal('requestAnimationFrame', (fn: () => void) => { const id = ++serial; frames.set(id, fn); return id; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  const authority = new Authority(() => time, () => 0);
  const sockets: FakeSocket[] = [];
  class FakeSocket {
    static OPEN = 1;
    readyState = 0; bufferedAmount = 0; sent: any[] = []; down: string[] = []; closes = 0; session: Session | null = null;
    onopen: (() => void) | null = null; onclose: (() => void) | null = null; onerror: (() => void) | null = null;
    onmessage: ((e: { data: string }) => void) | null = null;
    constructor(_url?: string) { sockets.push(this); }
    open() {
      if (this.readyState === 3) { this.onopen?.(); return; } // delayed callback after cancellation
      this.readyState = 1; this.session = authority.open({ bufferedAmount: 0, send: raw => this.down.push(raw),
        close: () => this.close(), terminate: () => this.close() }); this.onopen?.();
    }
    send(raw: string) { this.sent.push(JSON.parse(raw)); if (this.session && this.readyState === 1) authority.receive(this.session, raw); }
    close() { if (this.readyState === 3) return; this.closes++; this.readyState = 3; if (this.session) authority.disconnect(this.session, 'test-close'); this.onclose?.(); }
  }
  vi.stubGlobal('WebSocket', FakeSocket);
  let blob: Blob | null = null;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(b => { blob = b as Blob; return 'blob:test'; });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  mountOnline(root, () => { root.hidden = true; });
  const peers: OnlineClient[] = [];
  function flush() {
    for (let i = 0; i < 5; i++) {
      authority.pump();
      for (const socket of sockets) for (const data of socket.down.splice(0)) socket.onmessage?.({ data });
      timers.forEach(fn => fn()); peers.forEach(c => c.pump());
    }
    const queued = [...frames.values()]; frames.clear(); queued.forEach(fn => fn());
  }
  const advance = (ms: number) => { const end = time + ms; while (time < end) { time = Math.min(end, time + 10); flush(); } };
  function visible(value: boolean) { hidden = !value; doc.dispatchEvent(new Event('visibilitychange')); }
  function focus(value: boolean) { focused = value; win.dispatchEvent(new Event(value ? 'focus' : 'blur')); }
  function mouse(captured: number, x = 55, y = 45) {
    const e = new Event('pointermove');
    Object.defineProperties(e, { timeStamp: { value: captured }, pointerType: { value: 'mouse' }, isPrimary: { value: true }, clientX: { value: x }, clientY: { value: y } });
    win.dispatchEvent(e);
  }
  function connect() { element('room-create').onclick(); const ws = sockets.at(-1)!; ws.open(); flush(); return ws; }
  function pair() {
    const ws = connect(), peerSocket = new FakeSocket(); peerSocket.open();
    const peer = new OnlineClient(peerSocket, () => time, 'join', ws.session!.room!.code);
    peerSocket.onmessage = e => peer.receive(e.data); peers.push(peer); flush(); return { ws, peer, room: ws.session!.room! };
  }
  async function diagnostics() { element('online-export').onclick(); return JSON.parse(await blob!.text()); }
  function rally() {
    const p = pair(); startMatch(p.room.state, 0); p.room.state.phaseDeadline = 99999;
    authority.snapshot(p.ws.session!); flush(); advance(200);
    p.room.state.phase = 'Rally'; p.room.state.ball.vz = 2; p.room.state.viewBoxes = boxes(p.room.state);
    authority.snapshot(p.ws.session!); flush(); return p;
  }
  return { authority, root, sockets, elements, connect, pair, rally, mouse, focus, visible, flush, advance, diagnostics,
    at: () => time, setTime: (n: number) => { time = n; }, win, doc, timers, frames, element };
}

it('actual UI rejects Countdown capture 150 delivered after Rally processing 200 without sequence, target or prediction', async () => {
  const h = harness(), p = h.rally(); h.mouse(150); h.flush(); h.advance(40);
  expect(p.ws.sent.filter(f => f.type === 'input')).toHaveLength(0);
  expect(p.ws.session!.seq).toBe(0); expect(p.ws.session!.pending).toBeNull();
  expect(p.room.state.localPaddles[0].x).toBe(175.5);
  const d = await h.diagnostics(); expect(d.prediction).toHaveLength(0);
  expect(d.records.filter((r: any) => r.kind === 'captured-input')).toHaveLength(0);
  h.mouse(239); h.flush(); h.advance(40);
  expect(p.ws.session!.seq).toBe(1); expect(p.room.state.localPaddles[0].tx).toBe(55);
});

it.each([200, 201, NaN, Infinity, -1, 1_700_000_000_200, 1_700_000_000_201])('actual UI rejects equality, future or invalid capture %s at the freshness boundary', async capture => {
  const h = harness(), p = h.rally(); h.mouse(capture); h.flush();
  expect(p.ws.session!.seq).toBe(0); expect((await h.diagnostics()).prediction).toHaveLength(0);
});

it.each([205, 1_700_000_000_205])('actual UI accepts a fresh supported timestamp origin %s', async capture => {
  const h = harness(), p = h.rally(); h.advance(10); h.mouse(capture); h.flush();
  expect(p.ws.session!.seq).toBe(1);
  const r = (await h.diagnostics()).records.find((r: any) => r.kind === 'captured-input');
  expect(r.at).toBe(205); expect(r.handledAt).toBe(210);
});

it('actual UI rejects ambiguous clock origins without substituting handler time', async () => {
  const h = harness(), p = h.rally(); h.advance(10);
  vi.stubGlobal('performance', { now: () => h.at(), timeOrigin: 50 });
  h.mouse(205); h.flush();
  expect(p.ws.session!.seq).toBe(0); expect((await h.diagnostics()).prediction).toHaveLength(0);
});

it('actual UI rejects a queued pre-enable/focus-generation capture delivered after the resume ack', async () => {
  const h = harness(), p = h.rally(); h.focus(false); h.focus(true);
  h.setTime(230); h.flush(); h.mouse(220); h.flush();
  expect(p.ws.session!.seq).toBe(0); expect(p.ws.session!.pending).toBeNull();
  expect((await h.diagnostics()).prediction).toHaveLength(0);
  h.advance(10); h.mouse(239); h.flush(); expect(p.ws.session!.seq).toBe(1);
});

it('actual UI remains static after terminal/hidden closure and retains its known result', async () => {
  const h = harness(), p = h.rally();
  p.room.state.phase = 'MatchEnded'; p.room.state.lives = [0, 3]; p.room.state.lastEventId++;
  p.room.state.result = { matchId: 1, eventId: p.room.state.lastEventId, winner: 1, loser: 0, lives: [0, 3] };
  h.authority.snapshot(p.ws.session!); h.flush(); h.advance(10); h.mouse(209); h.flush();
  expect(p.ws.session!.seq).toBe(0);
  h.visible(false); h.flush(); h.visible(true); h.advance(10); h.mouse(219); h.flush();
  expect(p.ws.closes).toBe(1); expect(p.ws.sent.filter(f => f.type === 'input')).toHaveLength(0);
  const d = await h.diagnostics(); expect(d.state.result.winner).toBe(1); expect(d.status).toBe('Final result received');
  expect(d.frames.at(-1).own).toEqual({ left: 145.5, right: 205.5, top: 105.5, bottom: 145.5 });
  expect(h.element('online-status').textContent).toContain('Opponent wins · final result received · connection closed');
});

it('actual UI rejects old Hold, previous-rally, focus-return and rematch captures; fresh controls resume', async () => {
  const h = harness(), p = h.rally(); h.advance(10); h.mouse(205); h.flush();
  p.room.state.phase = 'LifeLostHold'; authoritySnapshot(); h.advance(10); const holdCapture = h.at(); h.mouse(holdCapture); h.flush();
  p.room.state.phase = 'Rally'; p.room.state.rallyId++; authoritySnapshot(); h.advance(10);
  h.mouse(holdCapture); h.flush(); expect(p.ws.session!.seq).toBe(1);
  h.focus(false); h.focus(true); h.focus(false); h.focus(true); h.flush(); const enabledAt = h.at();
  h.advance(10); h.mouse(enabledAt); h.flush(); expect(p.ws.session!.seq).toBe(1);
  h.mouse(h.at() - 1); h.flush(); h.advance(40); expect(p.ws.session!.seq).toBe(2);
  p.room.state.phase = 'MatchEnded'; p.room.state.lives[0] = 0; p.room.state.lastEventId++;
  p.room.state.result = { matchId: p.room.state.matchId, eventId: p.room.state.lastEventId, winner: 1, loser: 0, lives: [0, 3] };
  h.authority.snapshot(h.sockets[1].session!); authoritySnapshot();
  h.element('room-rematch').onclick(); p.peer.command('rematch', true); h.flush();
  h.advance(10); const countdownCapture = h.at();
  p.room.state.phase = 'Rally'; authoritySnapshot(); h.advance(10); h.mouse(countdownCapture); h.flush();
  expect(p.room.state.localPaddles[0].seq).toBe(0); expect((await h.diagnostics()).prediction).toHaveLength(0);
  h.mouse(h.at() - 1); h.flush(); h.advance(40); expect(p.room.state.localPaddles[0].seq).toBe(1);
  function authoritySnapshot() { h.authority.snapshot(p.ws.session!); h.flush(); }
});

it('hide before open cancels the pending socket; delayed open cannot bind or create a room', () => {
  const h = harness(); h.element('room-create').onclick(); const ws = h.sockets[0];
  h.visible(false); ws.open(); h.advance(6100);
  expect(ws.closes).toBe(1); expect(ws.sent).toHaveLength(0); expect(h.authority.rooms.size).toBe(0);
  expect(h.element('online-status').textContent).toBe('Page hidden · connection cancelled');
});

it('hidden initial connect is refused; visible blur during setup remains non-aborting', () => {
  const h = harness(); h.visible(false); h.element('room-create').onclick(); expect(h.sockets).toHaveLength(0);
  h.visible(true); h.element('room-create').onclick(); const ws = h.sockets[0]; h.focus(false); ws.open(); h.flush();
  expect(ws.closes).toBe(0); expect(ws.sent.some(f => f.type === 'create')).toBe(true);
  expect(ws.sent.some(f => f.type === 'controlFence')).toBe(true);
});

it('hide during open/initial send closes the owner and cleans the room; replaced callbacks are inert', () => {
  const h = harness(); h.element('room-create').onclick(); const old = h.sockets[0], original = old.send.bind(old);
  old.send = raw => { original(raw); h.visible(false); };
  old.open(); h.flush(); h.advance(1100);
  expect(old.closes).toBe(1); expect(h.authority.rooms.size).toBe(0);
  h.visible(true); const current = h.connect();
  const status = h.element('online-status').textContent;
  old.onopen?.(); old.onerror?.(); old.onclose?.(); old.onmessage?.({ data: '{}' }); h.flush();
  expect(current.closes).toBe(0); expect(h.element('online-status').textContent).toBe(status);
  expect(current.session!.room).not.toBeNull();
});

it.each(['online-back', 'pagehide'])('%s cancels pending ownership and delayed callbacks', action => {
  const h = harness(); h.element('room-create').onclick(); const ws = h.sockets[0];
  if (action === 'pagehide') h.win.dispatchEvent(new Event('pagehide')); else h.element(action).onclick();
  ws.open(); h.flush(); expect(ws.closes).toBe(1); expect(ws.sent).toHaveLength(0);
  if (action === 'pagehide') { expect(h.timers.size).toBe(0); expect(h.frames.size).toBe(0); }
});
