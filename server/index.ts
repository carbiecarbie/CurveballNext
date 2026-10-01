import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { Authority, Bucket } from './authority';

export function startServer(port = Number(process.env.PORT ?? 8787), host = process.env.HOST ?? '127.0.0.1') {
  const production = process.env.NODE_ENV === 'production';
  const origins = new Set((process.env.ALLOWED_ORIGINS ?? (production ? '' : 'http://127.0.0.1:5173,http://localhost:5173')).split(',').filter(Boolean));
  if (!origins.size || production && [...origins].some(o => new URL(o).protocol !== 'https:')) throw new Error('Configure exact HTTPS ALLOWED_ORIGINS');
  const authority = new Authority(() => performance.now());
  const limiter = new Map<string, { at: number; upgrades: Bucket; create: Bucket; join: Bucket; unbound: number }>();
  const http = createServer((req, res) => {
    if (req.url !== '/healthz') { res.writeHead(404); res.end(); return; }
    res.writeHead(authority.healthy && !authority.draining ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ healthy: authority.healthy, draining: authority.draining, rooms: authority.rooms.size, sockets: authority.sessions.size, protocolVersion: 1, rulesVersion: 'online-v1' }));
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024, perMessageDeflate: false });
  http.on('upgrade', (req, socket, head) => {
    const now = performance.now();
    const reject = (status: number) => { socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\n\r\n`); setTimeout(() => socket.destroy(), 1000).unref(); };
    if (req.url !== '/online' || !origins.has(req.headers.origin ?? '') || authority.draining) { reject(403); return; }
    // Only Fly's established header is trusted, and only on the explicitly configured Fly ingress.
    const header = process.env.TRUST_FLY_PROXY === '1' ? req.headers['fly-client-ip'] : undefined;
    if (production && process.env.TRUST_FLY_PROXY === '1' && typeof header !== 'string') { reject(403); return; }
    const ip = typeof header === 'string' ? header : req.socket.remoteAddress ?? 'unknown';
    for (const [key, v] of limiter) if (v.unbound === 0 && now - v.at > 60000) limiter.delete(key);
    let entry = limiter.get(ip);
    if (!entry) {
      if (limiter.size >= 10000) { reject(429); return; }
      entry = { at: now, upgrades: new Bucket(.5, 30, now), create: new Bucket(.05, 3, now), join: new Bucket(1 / 3, 20, now), unbound: 0 }; limiter.set(ip, entry);
    }
    entry.at = now;
    if (!entry.upgrades.take(now) || entry.unbound >= 10 || authority.sessions.size >= 64) { reject(429); return; }
    entry.unbound++;
    const limits = entry;
    let anonymous = true;
    const release = () => { if (anonymous) { anonymous = false; limits.unbound--; } };
    socket.once('close', release); socket.once('error', release);
    wss.handleUpgrade(req, socket, head, ws => {
      const session = authority.open({ get bufferedAmount() { return ws.bufferedAmount; }, send: raw => { if (ws.readyState === ws.OPEN) ws.send(raw); },
        close: (code, reason) => ws.close(code, reason), terminate: () => ws.terminate() });
      if (!session) { release(); ws.terminate(); return; }
      ws.on('message', (data, binary) => {
        if (binary) { authority.disconnect(session, 'binary'); return; }
        const raw = data.toString();
        if (!session.room) {
          try { const type = JSON.parse(raw).type; if (!(type === 'create' ? limits.create : limits.join).take(performance.now())) { authority.disconnect(session, 'retry-later'); return; } }
          catch { authority.disconnect(session, 'schema'); return; }
        }
        authority.receive(session, raw);
      });
      ws.on('close', () => { release(); authority.disconnect(session, 'connection-closed'); });
      ws.on('error', () => { release(); authority.disconnect(session, 'connection-error'); });
      const releaseTimer = setInterval(() => { if (session.room || session.closing !== null) { release(); clearInterval(releaseTimer); } }, 100);
      releaseTimer.unref();
    });
  });
  const timer = setInterval(() => authority.pump(), 5);
  const logs = setInterval(() => console.log(JSON.stringify({ event: 'health', rooms: authority.rooms.size, sockets: authority.sessions.size,
    rss: process.memoryUsage().rss, metrics: authority.metrics, timing: authority.timing(), healthy: authority.healthy, draining: authority.draining })), 60000);
  http.listen(port, host);
  let closing = false;
  const close = () => {
    if (closing) return; closing = true; clearInterval(logs);
    authority.shutdown();
    setTimeout(() => { authority.pump(); clearInterval(timer); wss.close(); http.close(); }, 1000);
  };
  return { http, authority, close };
}
