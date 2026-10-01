import { OnlineClient } from '../../src/multiplayer/client';
import { OnlineView, type DrawModel } from '../../src/multiplayer/view';
import { drawOnline } from '../../src/presentation/canvas';
import type { OnlineEvent } from '../../src/multiplayer/types';
import type { Stimulus } from './fairness';

const status = document.querySelector('#status')!, api = 'http://127.0.0.1:9055';
const get = async (path: string, body?: unknown) => { const r = await fetch(api + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}); if (!r.ok) throw new Error(await r.text()); return r; };
const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
document.querySelector<HTMLButtonElement>('#start')!.onclick = async () => {
  document.querySelector<HTMLButtonElement>('#start')!.disabled = true;
  const sessions: OnlineClient[] = [], timers: ReturnType<typeof setInterval>[] = [];
  let stopped = false;
  try {
    const { hash, scheduled } = await (await get('/manifest')).json() as { hash: string; scheduled: Stimulus[] };
    const params = new URLSearchParams(location.search);
    const open = async (side: 0 | 1, code?: string) => {
      const ws = new WebSocket(params.get(side ? 'wsB' : 'wsA') ?? 'ws://127.0.0.1:8787/online');
      await new Promise<void>((resolve, reject) => { ws.onopen = () => resolve(); ws.onerror = () => reject(new Error('WebSocket setup')); });
      const client = new OnlineClient(ws, () => performance.now(), side ? 'join' : 'create', code), view = new OnlineView(side, () => performance.now());
      sessions.push(client);
      ws.onmessage = e => client.receive(String(e.data)); ws.onclose = () => client.transportClosed();
      client.onState = (s, e, at) => view.accept(s, at!, e); client.onInput = (x, y, seq) => view.input(x, y, seq); client.onFence = () => view.fence();
      client.onPending = (p, at) => view.pendingContact(p, at); view.onClaim = c => client.claim(c);
      timers.push(setInterval(() => client.pump(), 10)); const until = performance.now() + 5000;
      while (!client.epoch && performance.now() < until) await wait(10); if (!client.epoch) throw new Error(client.status);
      return { client, view, canvas: document.querySelector<HTMLCanvasElement>(side ? '#b' : '#a')! };
    };
    const a = await open(0), b = await open(1, a.client.code), peers = [a, b];
    let active: { stimulus: Stimulus; attempt: number; matchId: number; contactNominal: number } | null = null;
    let captured = false, capture: { event: OnlineEvent; preceding: DrawModel | null; incoming: DrawModel } | null = null;
    let captureTime = 0, actualFrames: number[] = [], lastFrame = 0, nextDraw = 0;
    // The incoming evidence frame is now the defender's claim frame, presented ahead of the authority's answer; keep the
    // recent images keyed by frame time so the evidence uses the PNG of exactly that frame and its predecessor.
    let images: { at: number; url: string }[] = [];
    let writing: Promise<unknown> | null = null, writeFailure = '';
    peers.forEach(p => p.view.onBoundary = (event, preceding, incoming) => {
      if (active && p.client.side === active.stimulus.defender && event.matchId === active.matchId) capture = { event, preceding, incoming };
    });
    const render = (now: number) => {
      if (stopped) return;
      if (active && now < nextDraw) { requestAnimationFrame(render); return; }
      if (active) { nextDraw += 1000 / active.stimulus.hz; if (nextDraw < now) nextDraw = now + 1000 / active.stimulus.hz; }
      for (const p of peers) {
        const model = p.view.draw(now + p.client.offset, p.client.rtt, p.client.enabled);
        if (model) drawOnline(p.canvas, model);
      }
      if (active) {
        actualFrames.push(now - lastFrame); if (actualFrames.length > 600) actualFrames.shift();
        const p = peers[active.stimulus.defender];
        images.push({ at: p.view.frames.at(-1)?.renderedAt ?? now, url: p.canvas.toDataURL('image/png') }); if (images.length > 240) images.shift();
        const incomingImage = capture && images.find(i => i.at === capture!.incoming.renderedAt)?.url;
        const precedingImage = capture?.preceding && images.find(i => i.at === capture!.preceding!.renderedAt)?.url;
        if (capture && !captured && incomingImage && precedingImage) {
          captured = true;
          const bounds = p.canvas.getBoundingClientRect();
          writing = get('/evidence', { id: active.stimulus.id, manifestHash: hash, attempt: active.attempt, matchId: active.matchId,
            expectedHz: active.stimulus.hz, actualFrames, captureTime, inputRecords: p.client.records.filter(r => r.matchId === active!.matchId), contactNominal: active.contactNominal,
            probes: p.client.probes, history: p.view.history, corrections: p.view.corrections.filter(r => r.matchId === active!.matchId), ...capture, incomingImage, precedingImage,
            metadata: { rules: 'online-v1', protocol: 1, userAgent: navigator.userAgent, tcpShapeAttested: false,
              visible: !document.hidden && bounds.left >= 0 && bounds.top >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight } }).catch(e => { writeFailure = String(e); });
        } else if (capture && !captured && (!incomingImage || !precedingImage)) { captured = true; writeFailure = `${active.stimulus.id}: incoming/preceding image no longer retained`; }
      }
      lastFrame = now; requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
    const started = performance.now();
    // ?limit=N captures only the first N predeclared opportunities per defender (smoke runs; cells stay incomplete).
    const limit = Number(params.get('limit') ?? 300);
    for (const stimulus of scheduled.filter(s => s.index < limit)) {
      if (performance.now() - started >= 7200000) throw new Error('Two-hour profile limit; incomplete cell');
      if (peers.some(p => p.client.closed)) throw new Error('Connection interrupted; retain incomplete attempt');
      const fixture = await (await get('/fixture', { id: stimulus.id, manifestHash: hash })).json();
      active = { stimulus, ...fixture }; capture = null; captured = false; actualFrames = []; images = []; nextDraw = performance.now(); writing = null; writeFailure = '';
      const p = peers[stimulus.defender];
      const syncDeadline = performance.now() + 5000;
      while (p.client.state?.matchId !== fixture.matchId && !p.client.closed && performance.now() < syncDeadline) await wait(5);
      if (p.client.state?.matchId !== fixture.matchId || p.client.closed) throw new Error(`${stimulus.id}: fixture state unavailable; retain incomplete attempt`);
      // Margins are before the contact the defender is SHOWN, which leads the authority's crossing by view.lead().
      const at = fixture.contactNominal - p.view.lead(p.client.rtt) - stimulus.marginMs - p.client.offset;
      await wait(Math.max(0, at - performance.now())); captureTime = performance.now(); p.client.pointer(stimulus.target.x, stimulus.target.y);
      const until = performance.now() + 5000; while (!captured && performance.now() < until) await wait(10);
      if (!captured) throw new Error(`${stimulus.id}: missing incoming image/association`);
      await writing; if (writeFailure) throw new Error(writeFailure);
      status.textContent = `Retained ${stimulus.id}. Evidence is unqualified until packet shaping, cadence and independent image/classification review pass.`;
    }
    peers.forEach(p => p.client.leave()); status.textContent = 'Sequence captured. This is not a fairness PASS.';
  } catch (e) { status.textContent = `Blocked: ${e instanceof Error ? e.message : String(e)}`; }
  finally { stopped = true; sessions.forEach(c => c.leave()); timers.forEach(clearInterval); }
};
