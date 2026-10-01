import { expect, it } from 'vitest';
import { Authority } from '../server/authority';
import { OnlineClient } from '../src/multiplayer/client';

// Deterministic application-delivery tests, not TCP loss or measured fairness evidence.
function network(delays: [number, number, number, number]) {
  let now = 0, seed = 0x4d35, order = 0;
  const authority = new Authority(() => now, () => 0);
  const packets: { at: number; order: number; deliver: () => void }[] = [];
  const tail = [0, 0, 0, 0];
  function send(path: number, deliver: () => void) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const jitter = seed % 21 - 10;
    // Ordered streams retain head-of-line delays. No invented application frame loss.
    const at = Math.max(tail[path], now + Math.max(0, delays[path] + jitter)); tail[path] = at;
    packets.push({ at, order: order++, deliver });
  }
  function open(side: number, code?: string) {
    let client: OnlineClient;
    const session = authority.open({ bufferedAmount: 0, send: raw => send(side * 2 + 1, () => client.receive(raw)),
      close: () => send(side * 2 + 1, () => client.transportClosed()), terminate: () => {} })!;
    client = new OnlineClient({ readyState: 1, bufferedAmount: 0, send: raw => send(side * 2, () => authority.receive(session, raw)),
      close: () => send(side * 2, () => authority.disconnect(session, 'test-close')) }, () => now, code ? 'join' : 'create', code);
    return { client, session };
  }
  const clients: OnlineClient[] = [];
  function advance(ms: number) {
    const end = now + ms;
    while (now < end) {
      now = Math.min(end, now + 5);
      packets.sort((a, b) => a.at - b.at || a.order - b.order);
      while (packets[0]?.at <= now) packets.shift()!.deliver();
      authority.pump(); clients.forEach(c => c.pump());
    }
  }
  const a = open(0); clients.push(a.client); advance(300);
  const b = open(1, a.client.code); clients.push(b.client); advance(300);
  return { a, b, authority, advance, now: () => now };
}

it.each([
  [0, 0, 0, 0], [20, 20, 20, 20], [40, 40, 40, 40], [70, 10, 10, 70], [10, 70, 70, 10],
] as [number, number, number, number][] )('ordered delayed/jittered delivery %j retains runtime and exact terminal knowledge', (...delays) => {
  const h = network(delays); h.a.client.command('ready', true); h.b.client.command('ready', true); h.advance(4000);
  expect(h.a.client.closed).toBe(false); expect(h.b.client.closed).toBe(false);
  expect(h.a.client.state?.phase).toBe('Rally'); expect(h.b.client.state?.phase).toBe('Rally');
  h.a.client.pointer(55, 45); h.b.client.pointer(55, 45); h.advance(20000);
  expect(h.a.client.known).not.toBeNull(); expect(h.b.client.known).toEqual(h.a.client.known);
  expect(h.a.client.known!.lives.filter(n => n === 0)).toHaveLength(1);
  expect(h.a.session.closing).toBeNull(); expect(h.b.session.closing).toBeNull();
});

it('delayed fence/sync acknowledgements never authorize samples from rapid prior focus generations', () => {
  const h = network([40, 40, 40, 40]), c = h.a.client;
  c.command('ready', true); h.b.client.command('ready', true); h.advance(3500);
  c.pointer(55, 45); c.blur(); c.focus(); h.advance(20); c.blur(); c.focus();
  h.advance(700); expect(c.generation).toBe(2); expect(c.enabled).toBe(true); expect(h.a.session.generation).toBe(2);
  expect(h.a.session.room!.state.localPaddles[0].tx).toBe(175.5);
  c.pointer(296, 206); h.advance(200); expect(h.a.session.room!.state.localPaddles[0].tx).toBe(296);
});
