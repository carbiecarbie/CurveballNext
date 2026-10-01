// Test-only fixture/evidence server. Never included in server:build or frontend dist.
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { startServer } from '../../server/index';
import { boxes, startMatch } from '../../src/multiplayer/simulation';
import { manifest, profiles, type Profile } from './fairness';

const profile = (process.env.PROFILE ?? 'C0') as Profile;
if (!Object.hasOwn(profiles, profile)) throw new Error('Unknown profile');
const scheduled = manifest(profile), hash = createHash('sha256').update(JSON.stringify(scheduled)).digest('hex');
const directory = `captures-local/m5-fairness/${profile}-${Date.now()}`; mkdirSync(directory, { recursive: true });
writeFileSync(`${directory}/manifest.json`, JSON.stringify({ profile, hash, scheduled, networkQualified: false, requiredShape: profiles[profile] }, null, 2));
// FAIRNESS_HOST lets an isolated shaped-network harness bind a private test interface.
const host = process.env.FAIRNESS_HOST ?? '127.0.0.1';
const app = startServer(8787, host);
let current = '', attempt = 0;
app.authority.onDiagnostic = record => appendFileSync(`${directory}/authority.jsonl`, JSON.stringify({ id: current, attempt, ...record }) + '\n');
const observer = createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && origin !== 'http://127.0.0.1:5173') { res.writeHead(403); res.end(); return; }
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5173'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.url === '/manifest') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ hash, scheduled, profile })); return; }
  try {
    let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 2 * 1024 * 1024) throw new Error('capture too large'); }
    const data = JSON.parse(raw), stimulus = scheduled.find(s => s.id === data.id);
    if (!stimulus || data.manifestHash !== hash) throw new Error('not predeclared');
    if (req.url === '/fixture') {
      const room = [...app.authority.rooms.values()][0]; if (!room || room.slots.some(p => !p)) throw new Error('bind both clients first');
      current = stimulus.id; attempt++;
      startMatch(room.state, stimulus.initialServingSide); room.wait = null; room.state.phase = 'Rally'; room.state.ball = { ...stimulus.ball }; room.state.viewBoxes = boxes(room.state);
      room.sources = [0, 1].map(() => ({ seq: 0, generation: 0, publishedTick: room.state.tick, firstUsed: false }));
      room.slots.forEach(p => { if (p) { p.pending = null; p.seq = 0; p.tickAt = performance.now(); p.healthTick = room.state.tick; app.authority.snapshot(p); } });
      const contactNominal = app.authority.nextBoundary + 37 * 1000 / 30;
      appendFileSync(`${directory}/fixtures.jsonl`, JSON.stringify({ id: current, attempt, matchId: room.state.matchId, stimulus, initialState: room.state, contactNominal }) + '\n');
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ matchId: room.state.matchId, contactNominal, attempt })); return;
    }
    if (req.url === '/evidence') {
      const prefix = `${stimulus.defender}-${stimulus.index}-${data.attempt}`;
      for (const name of ['incoming', 'preceding']) {
        const encoded = data[`${name}Image`];
        if (typeof encoded !== 'string' || !encoded.startsWith('data:image/png;base64,')) throw new Error('PNG required');
        const bytes = Buffer.from(encoded.slice(22), 'base64'); if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('PNG signature');
        writeFileSync(`${directory}/${prefix}-${name}.png`, bytes); data[`${name}Image`] = { path: `${prefix}-${name}.png`, sha256: createHash('sha256').update(bytes).digest('hex') };
      }
      appendFileSync(`${directory}/presentation.jsonl`, JSON.stringify(data) + '\n'); res.end('retained'); return;
    }
    res.writeHead(404); res.end();
  } catch (e) { res.writeHead(400); res.end(e instanceof Error ? e.message : 'invalid'); }
});
observer.listen(9055, host);
console.log(JSON.stringify({ event: 'test-only-fairness', directory, profile, hash, networkQualified: false }));
process.on('SIGINT', () => { app.close(); observer.close(); });
