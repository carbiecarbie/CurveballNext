import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import WebSocket from 'ws';
import { OnlineClient } from '../../src/multiplayer/client';
import { OnlineView } from '../../src/multiplayer/view';

// Deployed soak (test only): nine playing rooms + one Waiting room + recurring unbound sockets, real protocol clients.
// Configuration (environment): SOAK_URL (wss://HOST/online), SOAK_ORIGIN (an allowed Origin), SOAK_INSTANCE (optional Fly Machine
// id forced with fly-force-instance-id), SOAK_MINUTES (default 66), SOAK_OUT (output directory).
const url = process.env.SOAK_URL ?? 'wss://curveballnext.fly.dev/online', origin = process.env.SOAK_ORIGIN ?? 'https://curveballnext.pages.dev';
const instance = process.env.SOAK_INSTANCE, minutes = Number(process.env.SOAK_MINUTES ?? 66), outDir = process.env.SOAK_OUT ?? 'captures-local/m5-soak';
if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240) throw new Error('SOAK_MINUTES must be 1..240');
const headers: Record<string, string> = { Origin: origin, ...(instance ? { 'fly-force-instance-id': instance } : {}) };
const health = url.replace(/^wss:/, 'https:').replace(/\/online$/, '/healthz');
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

interface Bot { c: OnlineClient; returns: number; misses: number; finishes: number; decide: string }
const bots: Bot[] = [], closed: Record<string, number> = {};
mkdirSync(outDir, { recursive: true });
const logFile = `${outDir}/soak.jsonl`; writeFileSync(logFile, '');
const started = performance.now(), end = started + minutes * 60000;
const record = (kind: string, data: Record<string, unknown> = {}) => appendFileSync(logFile, JSON.stringify({ at: Math.round((performance.now() - started) / 1000), kind, ...data }) + '\n');
const sum = (key: 'returns' | 'misses' | 'finishes') => bots.reduce((n, b) => n + b[key], 0);

function open(operation: 'create' | 'join', code: string | undefined, play: boolean): Promise<Bot> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers });
    ws.on('error', reject);
    ws.on('open', () => {
      const c = new OnlineClient(ws as never, () => performance.now(), operation, code), v = new OnlineView(0, () => performance.now());
      const bot: Bot = { c, returns: 0, misses: 0, finishes: 0, decide: '' };
      ws.on('message', data => c.receive(String(data))); ws.on('close', () => c.transportClosed());
      c.onState = (s, e, at) => { v.side = c.side; v.accept(s, at ?? performance.now() + c.offset, e); };
      c.onInput = (x, y, seq, at) => v.input(x, y, seq, at); c.onFence = () => v.fence();
      v.onClaim = claim => c.claim(claim);
      v.onAudio = e => { if (e.side !== c.side) return; if (e.type === 'return') bot.returns++; if (e.type === 'miss') bot.misses++; if (e.type === 'finish') bot.finishes++; };
      let readied = false, reported = false;
      const timer = setInterval(() => {
        c.pump();
        if (c.closed) { if (!reported) { reported = true; closed[c.status] = (closed[c.status] ?? 0) + 1; } clearInterval(timer); return; }
        const s = c.state; if (!c.epoch || !s) return;
        if (play && s.phase === 'Waiting' && !readied) { c.command('ready', true); readied = true; }
        if (play && s.phase === 'MatchEnded' && !c.rematch[c.side]) c.command('rematch', true);
        const m = v.draw(performance.now() + c.offset, c.rtt, c.enabled && !c.closed);
        if (!play || !m || s.phase !== 'Rally') return;
        // Decide once per incoming flight whether to try; a miss now and then lets matches end and rematch.
        const flight = `${s.matchId}/${s.rallyId}/${s.lastEventId}`;
        if (m.z < 35 && bot.decide !== flight) bot.decide = flight + (Math.random() < 0.7 ? ':try' : ':skip');
        if (m.z < 35 && bot.decide.endsWith(':try')) c.pointer((m.ball.left + m.ball.right) / 2, (m.ball.top + m.ball.bottom) / 2);
      }, 12);
      bots.push(bot); resolve(bot);
    });
  });
}

record('start', { url, origin, instance: instance ?? null, minutes });
// Unbound sockets: open and stay silent (the server closes them after 5 s), two every 15 s, for the whole run.
const unbound = setInterval(() => { for (let i = 0; i < 2; i++) { const ws = new WebSocket(url, { headers }); ws.on('error', () => {}); ws.on('close', () => {}); } }, 15000);
const report = setInterval(async () => {
  const live = bots.filter(b => !b.c.closed), rtts = live.map(b => b.c.rtt).filter(Number.isFinite);
  const phases = live.reduce<Record<string, number>>((a, b) => { const p = b.c.state?.phase ?? '?'; a[p] = (a[p] ?? 0) + 1; return a; }, {});
  let server: unknown = null;
  try { server = await (await fetch(health, { headers: instance ? { 'fly-force-instance-id': instance } : {}, signal: AbortSignal.timeout(5000) })).json(); } catch (e) { server = String(e); }
  record('report', { live: live.length, rooms: new Set(live.map(b => b.c.code)).size, phases, returns: sum('returns'), misses: sum('misses'), finishes: sum('finishes'),
    rttMs: rtts.length ? { avg: Math.round(rtts.reduce((n, x) => n + x, 0) / rtts.length), min: Math.round(Math.min(...rtts)), max: Math.round(Math.max(...rtts)) } : null, closed, server });
}, 60000);

// Ramp within the per-IP create limit (burst 3, then one per 20 s).
for (let room = 0; room < 10 && performance.now() < end; room++) {
  try {
    const a = await open('create', undefined, room < 9);
    for (let i = 0; i < 500 && !a.c.code; i++) await wait(10);
    if (room < 9) await open('join', a.c.code, true);
    record('room', { room, code: a.c.code ? 'set' : 'none', waitingOnly: room === 9 });
  } catch (e) { record('room-error', { room, error: String(e) }); }
  await wait(room < 2 ? 1000 : 21000);
}
while (performance.now() < end) await wait(5000);
clearInterval(unbound); clearInterval(report);
const summary = { url, instance: instance ?? null, minutes, returns: sum('returns'), misses: sum('misses'), finishes: sum('finishes'), closed };
record('done', summary); writeFileSync(`${outDir}/summary.json`, JSON.stringify(summary, null, 2));
for (const b of bots) if (!b.c.closed) b.c.leave();
await wait(2000);
process.exit(0);
