import { expect, it } from 'vitest';
import WebSocket from 'ws';
import { startServer } from '../server/index';
import { OnlineClient } from '../src/multiplayer/client';

it('real loopback WebSocket: Origin rejection, two clients, 30 Hz state and graceful cleanup', async () => {
  const app = startServer(0);
  await new Promise<void>(resolve => app.http.on('listening', resolve));
  const address = app.http.address(); if (!address || typeof address === 'string') throw new Error('port');
  const url = `ws://127.0.0.1:${address.port}/online`;
  const denied = new WebSocket(url, { origin: 'https://foreign.invalid' });
  await new Promise<void>(resolve => denied.on('error', () => resolve()));
  expect(app.authority.sessions.size).toBe(0);
  const clients: OnlineClient[] = [], sockets: WebSocket[] = [], timers: ReturnType<typeof setInterval>[] = [];
  const connect = async (operation: 'create' | 'join', code?: string) => {
    const ws = new WebSocket(url, { origin: 'http://127.0.0.1:5173' }); sockets.push(ws);
    await new Promise<void>((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    const client = new OnlineClient(ws, () => performance.now(), operation, code); clients.push(client);
    ws.on('message', data => client.receive(data.toString())); ws.on('close', () => client.transportClosed());
    timers.push(setInterval(() => client.pump(), 10));
    const until = performance.now() + 2000;
    while (!client.epoch && performance.now() < until) await new Promise(resolve => setTimeout(resolve, 10));
    expect(client.epoch).not.toBe(''); return client;
  };
  try {
    const a = await connect('create'), b = await connect('join', a.code);
    a.command('ready', true); b.command('ready', true);
    await new Promise(resolve => setTimeout(resolve, 3300));
    expect(a.state?.phase).toBe('Rally'); expect(b.state?.phase).toBe('Rally'); expect(a.state!.tick).toBeGreaterThanOrEqual(90);
    expect(a.closed).toBe(false); expect(b.closed).toBe(false); expect(app.authority.metrics.maxPayload).toBeLessThanOrEqual(2048);
    a.blur(); await new Promise(resolve => setTimeout(resolve, 100)); a.focus(); await new Promise(resolve => setTimeout(resolve, 100));
    expect(a.enabled).toBe(true); a.hidden(); await new Promise(resolve => setTimeout(resolve, 100));
    expect(app.authority.rooms.size).toBe(0); expect(b.known).toBeNull();
  } finally {
    clients.forEach(c => c.leave()); timers.forEach(clearInterval); sockets.forEach(s => s.terminate()); app.close();
    await new Promise(resolve => setTimeout(resolve, 1100));
  }
}, 10000);
