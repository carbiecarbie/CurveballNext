import { mkdirSync, writeFileSync } from 'node:fs';
import { Authority, type Session } from '../../server/authority';
import { OnlineClient } from '../../src/multiplayer/client';
import { CapacityMeasurements } from './capacity-report';

const seconds = Number(process.argv[2] ?? 60);
if (!Number.isFinite(seconds) || seconds < 10 || seconds > 7200) throw new Error('Duration must be 10..7200 seconds');
const authority = new Authority(() => performance.now(), () => 0), clients: OnlineClient[] = [];
function open(operation: 'create' | 'join', code?: string) {
  let client: OnlineClient | null = null; const pending: string[] = [];
  const s: Session = authority.open({ bufferedAmount: 0, send: raw => { if (client) client.receive(raw); else pending.push(raw); }, close: () => client?.transportClosed(), terminate: () => {} })!;
  client = new OnlineClient({ readyState: 1, bufferedAmount: 0, send: raw => authority.receive(s, raw), close: () => authority.disconnect(s, 'local-test-close') }, () => performance.now(), operation, code);
  authority.pump(); pending.forEach(raw => client!.receive(raw)); client.pump(); clients.push(client); return client;
}
for (let i = 0; i < 10; i++) { const a = open('create'), b = open('join', a.code); a.command('ready', true); b.command('ready', true); authority.pump(); }
clients[0].blur();
const started = performance.now(), cpu = process.cpuUsage(), measurements = new CapacityMeasurements();
const rematches = new Map<OnlineClient, number>();
const timer = setInterval(() => {
  const now = performance.now();
  for (const c of clients) {
    if (c.state?.phase === 'MatchEnded' && rematches.get(c) !== c.state.matchId) { rematches.set(c, c.state.matchId); c.command('rematch', true); }
    if (c.state?.phase === 'Rally') c.pointer(Math.floor(now / 500) % 2 ? 55 : 296, 125.5);
    c.pump();
  }
  const begin = performance.now(), boundary = authority.nextBoundary, ticksBefore = authority.metrics.ticks;
  authority.pump(); const end = performance.now();
  measurements.observePoll(end - begin, authority.metrics.ticks - ticksBefore, begin >= boundary ? begin - boundary : null, authority.metrics.maxPayload);
  if (now - started >= seconds * 1000) {
    clearInterval(timer); const usage = process.cpuUsage(cpu);
    const report = { schema: 'curveball-online-local-capacity-2', durationSeconds: (end - started) / 1000, transport: 'in-process serialized JSON; not TCP or Fly shared CPU',
      sampling: { warmup: 'none; setup excluded, every poll in the timed run included', percentile: 'nearest rank: sorted[ceil(0.99*N)-1]; empty=null',
        executedBatch: 'Authority.pump wall duration only when room simulation ticks executed; includes command processing, simulation, serialization and synchronous delivery',
        schedulerLateness: 'pump start minus nextBoundary on scheduled wakes, separately from batch duration',
        payload: 'incremental maximum of Authority.metrics.maxPayload; all timed polls counted', rawEvidence: 'run-wide arrays; no idle-duration or payload arrays' },
      roomsAtEnd: authority.rooms.size, socketsAtEnd: authority.sessions.size, liveClients: clients.filter(c => !c.closed).length,
      metrics: authority.metrics, ...measurements.report(), rssBytes: process.memoryUsage().rss,
      cpuUserMs: usage.user / 1000, cpuSystemMs: usage.system / 1000,
      productionCapacityAccepted: false, fairnessAccepted: false };
    mkdirSync('captures-local/m5-local', { recursive: true }); writeFileSync(`captures-local/m5-local/capacity-${Date.now()}.json`, JSON.stringify(report, null, 2));
    const { raw: _raw, ...summary } = report;
    console.log(JSON.stringify(summary, null, 2)); authority.shutdown();
  }
}, 5);
