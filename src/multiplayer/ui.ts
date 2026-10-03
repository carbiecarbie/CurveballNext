import { drawOnline } from '../presentation/canvas';
import { Sound } from '../presentation/audio';
import { stagePoint } from '../runtime/viewport';
import { OnlineClient } from './client';
import { OnlineView } from './view';
import { captureTime } from './input-time';
import { REGION_LABELS, onlineEndpoint, regionOfCode } from './regions';

export const CONNECT_TIMEOUT_MS = 10_000;

export function mountOnline(root: HTMLElement, back: () => void) {
  root.innerHTML = `<header><strong class="wordmark">CURVEBALL<span>NEXT</span></strong><button id="online-back">Modes</button></header>
    <section class="online-controls"><h1>Private 1×1</h1><p>Three lives each. If you leave this tab, the match ends with no winner.</p><p class="online-fineprint">Matches can't be resumed after a disconnect.</p>
    <button id="room-create">Create room</button><label>Room code <input id="room-code" maxlength="14" autocomplete="off"></label><button id="room-join">Join</button>
    <p id="room-invite"></p><p id="room-region" class="online-fineprint"></p><button id="room-copy" disabled>Copy invitation</button><button id="room-ready" disabled>Ready</button><button id="room-rematch" disabled>Rematch</button><button id="room-leave" disabled>Leave</button></section>
    <p id="online-status" role="status">Choose Create or Join.</p><p id="online-lobby" class="online-lobby" hidden></p><p id="online-lives">You ●●● · Opponent ●●●</p>
    <div class="canvas-wrap"><canvas id="online-court" width="1050" height="750" tabindex="0" aria-label="Online court. Move your mouse to control the near cyan paddle."></canvas><div id="online-banner" class="online-banner" role="status" hidden></div><div id="online-overlay" class="online-overlay" hidden></div></div>
    <p id="online-phase"></p><button id="online-sound">Sound on</button><button id="online-export">Export diagnostics</button>`;
  const el = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const canvas = el<HTMLCanvasElement>('online-court'), code = el<HTMLInputElement>('room-code'), sound = new Sound();
  let client: OnlineClient | null = null, view: OnlineView | null = null, connecting = false;
  let connection: { socket: WebSocket; client: OnlineClient | null } | null = null, disposed = false;
  let bannerTimer: ReturnType<typeof setTimeout> | null = null;
  /** A point's outcome, presented with its authoritative miss/finish (the original game's score notice). */
  const banner = (text: string, tone: 'won' | 'lost') => {
    const el = root.querySelector<HTMLElement>('#online-banner'); if (!el) return;
    el.textContent = text; el.className = `online-banner ${tone}`; el.hidden = false;
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { el.hidden = true; bannerTimer = null; }, 1400);
  };
  const stopConnection = (hidden: boolean) => {
    const owner = connection;
    if (!owner) return;
    if (owner.client) { if (hidden) owner.client.hidden(); else owner.client.leave(); }
    // Retire identity before close: delayed callbacks cannot affect a replacement.
    connection = null; connecting = false;
    if (!owner.client) {
      el('online-status').textContent = hidden ? 'Page hidden · connection cancelled' : 'Connection cancelled';
      owner.socket.close();
    }
  };
  code.value = location.hash.startsWith('#room=') ? location.hash.slice(6) : '';
  const connect = (operation: 'create' | 'join') => {
    if (disposed || root.hidden || document.hidden || connecting || client && !client.closed) return;
    const endpoint = import.meta.env.VITE_ONLINE_URL ?? (import.meta.env.DEV ? 'ws://127.0.0.1:8787/online' : '');
    try {
      const url = new URL(endpoint);
      if (url.pathname !== '/online' || url.username || url.password || url.hash || url.search || !(url.protocol === 'wss:' || import.meta.env.DEV && url.protocol === 'ws:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) throw new Error('Configure a compatible public WSS endpoint');
      connecting = true; const ws = new WebSocket(onlineEndpoint(endpoint, operation, code.value.trim())), owner = { socket: ws, client: null as OnlineClient | null };
      connection = owner;
      const current = () => !disposed && connection === owner;
      el('online-status').textContent = 'Connecting…';
      // A region whose Machine is down can leave the upgrade pending for ~40 s; give up sooner with a clear message.
      const connectTimer = setTimeout(() => {
        if (!current() || owner.client) return;
        stopConnection(false);
        el('online-status').textContent = 'Could not reach the server in time. That region may be unavailable. Try again, or create a new room.';
      }, CONNECT_TIMEOUT_MS);
      ws.onopen = () => {
        clearTimeout(connectTimer);
        if (!current()) { ws.close(); return; }
        const focused = document.hasFocus();
        if (root.hidden || document.hidden || ws.readyState !== WebSocket.OPEN) { stopConnection(true); return; }
        const created = new OnlineClient(ws, () => performance.now(), operation, code.value.trim(), true);
        // Also cover cancellation during constructor/initial-send callbacks.
        if (!current() || root.hidden || document.hidden) { created.interrupt('Page hidden · outcome unknown'); return; }
        connecting = false; owner.client = created; client = created;
        const createdView = new OnlineView(0, () => performance.now()); view = createdView;
        created.focused = focused;
        created.onState = (s, event, time) => { createdView.side = created.side; createdView.accept(s, time ?? performance.now() + created.offset, event); };
        created.onInput = (x, y, seq, at) => createdView.input(x, y, seq, at); created.onFence = () => createdView.fence();
        created.onPending = (p, time) => createdView.pendingContact(p, time); createdView.onClaim = c => created.claim(c);
        createdView.onAudio = e => {
          const mine = e.side === created.side;
          // A lost life and a won point sound different; the match end plays the defeat or victory cue.
          const type = e.type === 'launch' ? 'serve' : e.type === 'miss' ? (mine ? 'miss' : 'level-intro') : e.type === 'finish' ? (mine ? 'game-over' : 'content-complete') : e.type;
          sound.play([{ type, ...(e.side !== null ? { side: mine ? 'player' as const : 'enemy' as const } : {}) }]);
          if (e.type === 'miss' || e.type === 'finish') banner(mine ? 'LIFE LOST' : 'POINT!', mine ? 'lost' : 'won');
        };
        void sound.unlock();
      };
      ws.onmessage = e => { if (current()) owner.client?.receive(String(e.data)); };
      ws.onclose = () => { if (current()) { connecting = false; owner.client?.transportClosed(); if (!owner.client) connection = null; } };
      ws.onerror = () => { if (current()) {
        if (owner.client) owner.client.interrupt('Connection error · outcome unknown'); else stopConnection(false);
        el('online-status').textContent = 'Online connection failed. Check setup or return to Classic.'; } };
    } catch (error) { connecting = false; el('online-status').textContent = `Online setup/update error: ${error instanceof Error ? error.message : String(error)}`; }
  };
  el('room-create').onclick = () => connect('create'); el('room-join').onclick = () => connect('join');
  el('online-back').onclick = () => { stopConnection(false); back(); };
  el('room-leave').onclick = () => stopConnection(false);
  el('room-ready').onclick = () => { if (client) client.command('ready', !client.ready[client.side]); };
  el('room-rematch').onclick = () => { if (client) client.command('rematch', !client.rematch[client.side]); };
  el('room-copy').onclick = () => { if (client) void navigator.clipboard.writeText(`${location.origin}${location.pathname}#room=${client.code.match(/.{4}/g)?.join('-')}`).catch(() => { el('online-status').textContent = 'Clipboard unavailable; copy the displayed invitation.'; }); };
  el('online-sound').onclick = () => { sound.toggle(); el('online-sound').textContent = sound.enabled ? 'Sound on' : 'Sound off'; };
  el('online-export').onclick = () => {
    const blob = new Blob([JSON.stringify({ ...client?.diagnostics(), frames: view?.frames, prediction: view?.history, corrections: view?.corrections })], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'curveball-online-diagnostics.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const pointer = (e: PointerEvent) => { if (!disposed && !root.hidden && !document.hidden && e.pointerType === 'mouse' && e.isPrimary && document.hasFocus()) {
    const at = captureTime(e.timeStamp, performance.now(), performance.timeOrigin);
    if (at === null) return;
    const p = stagePoint(e.clientX, e.clientY, canvas.getBoundingClientRect()); client?.pointer(p.x, p.y, at);
  } };
  const blur = () => { if (!root.hidden && !document.hidden) client?.blur(); };
  const focus = () => { if (!root.hidden && !document.hidden) client?.focus(); };
  const visibility = () => { if (document.hidden) stopConnection(true); };
  window.addEventListener('pointermove', pointer); window.addEventListener('blur', blur); window.addEventListener('focus', focus);
  document.addEventListener('visibilitychange', visibility);
  const timer = setInterval(() => client?.pump(), 50);
  let animation = 0;
  const dispose = () => {
    if (disposed) return;
    stopConnection(true); disposed = true; clearInterval(timer); cancelAnimationFrame(animation); if (bannerTimer) clearTimeout(bannerTimer);
    window.removeEventListener('pointermove', pointer); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus);
    document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', dispose);
  };
  window.addEventListener('pagehide', dispose);
  const frame = () => {
    if (disposed) return;
    if (!root.hidden && client) {
      const s = client.state;
      const model = view?.draw(performance.now() + client.offset, client.rtt, client.enabled && !client.closed, client.closed);
      if (model) drawOnline(canvas, model);
      const result = client.known ? client.known.winner === client.side ? 'You win' : 'Opponent wins' : null;
      el('online-status').textContent = result ? `${result} · final result received${client.closed ? ' · connection closed' : ''}` : client.closed ? client.status : model?.frozen ? 'Connection stalled · world frozen' : model?.degraded ? 'Connection degraded' : `${client.status}${!client.enabled ? ' · controls fenced' : ''}`;
      if (s) {
        el('online-lives').textContent = `You ${'●'.repeat(s.lives[client.side])}${'○'.repeat(3 - s.lives[client.side])} · Opponent ${'●'.repeat(s.lives[1 - client.side])}${'○'.repeat(3 - s.lives[1 - client.side])}`;
        el('online-phase').textContent = client.closed ? result ? 'Match ended' : 'Session closed' : s.phase === 'Countdown' ? `${s.servingSide === client.side ? 'You serve' : 'Opponent serves'} · ${Math.ceil((s.phaseDeadline - s.tick) / 30)}` : s.phase === 'Waiting' ? client.occupied.every(Boolean) ? 'Both players must Ready' : 'Waiting for opponent' : s.phase === 'LifeLostHold' ? 'Life lost · next serve shortly' : s.phase;
      }
      // Lobby presence: who is in the room and who is ready (or wants a rematch), in plain words.
      const lobby = el('online-lobby'), other = 1 - client.side, mark = (v: boolean) => v ? '✓' : '—';
      lobby.hidden = client.closed || !s || (s.phase !== 'Waiting' && s.phase !== 'MatchEnded');
      if (!lobby.hidden) lobby.textContent = s!.phase === 'Waiting'
        ? client.occupied[other] ? `Opponent connected · Ready: you ${mark(client.ready[client.side])} · opponent ${mark(client.ready[other])}` : 'Waiting for an opponent to join — share the invitation'
        : `Rematch: you ${mark(client.rematch[client.side])} · opponent ${mark(client.rematch[other])}`;
      const region = regionOfCode(client.code);
      el('room-invite').textContent = client.code && !client.closed ? `${location.origin}${location.pathname}#room=${client.code.match(/.{4}/g)?.join('-')}` : '';
      el('room-region').textContent = region && !client.closed ? `Server: ${REGION_LABELS[region]}` : '';
      for (const id of ['room-create', 'room-join']) el<HTMLButtonElement>(id).disabled = !client.closed;
      el<HTMLButtonElement>('room-copy').disabled = !client.code || client.closed;
      el<HTMLButtonElement>('room-ready').disabled = client.closed || s?.phase !== 'Waiting'; el('room-ready').textContent = client.ready[client.side] ? 'Withdraw Ready' : 'Ready';
      el<HTMLButtonElement>('room-rematch').disabled = client.closed || s?.phase !== 'MatchEnded'; el('room-rematch').textContent = client.rematch[client.side] ? 'Withdraw Rematch' : 'Rematch';
      el<HTMLButtonElement>('room-leave').disabled = client.closed;
      const overlay = el('online-overlay'); overlay.hidden = !result || !model?.overlayAllowed; overlay.textContent = result;
    }
    animation = requestAnimationFrame(frame);
  };
  animation = requestAnimationFrame(frame);
  return dispose;
}
