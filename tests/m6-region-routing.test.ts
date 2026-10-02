import { expect, it } from 'vitest';
import WebSocket from 'ws';
import { Authority } from '../server/authority';
import { parseUpgradeUrl, startServer } from '../server/index';
import { ERROR_TEXT, onlineEndpoint, prefixOfRegion, regionOfCode } from '../src/multiplayer/regions';

const origin = 'http://127.0.0.1:5173';

it('maps room-code prefixes to regions and builds the join endpoint', () => {
  expect(prefixOfRegion('gru')).toBe('G'); expect(prefixOfRegion('iad')).toBe('V'); expect(prefixOfRegion('ams')).toBeUndefined(); expect(prefixOfRegion(undefined)).toBeUndefined();
  expect(regionOfCode('Vabc-def2-3456')).toBe('iad'); expect(regionOfCode('ABCDEFGHJKLM')).toBeUndefined(); expect(regionOfCode('')).toBeUndefined();
  const base = 'wss://app.fly.dev/online';
  expect(onlineEndpoint(base, 'join', 'VABCDEFGHJKL')).toBe(`${base}?r=iad`);
  expect(onlineEndpoint(base, 'join', 'GABC-DEFG-HJKL')).toBe(`${base}?r=gru`);
  expect(onlineEndpoint(base, 'create', 'VABCDEFGHJKL')).toBe(base);
  expect(onlineEndpoint(base, 'join', 'ABCDEFGHJKLM')).toBe(base);
  expect(ERROR_TEXT['room-unavailable']).toMatch(/No such room/);
});

it('generates region-prefixed codes only on mapped Machines and never a region symbol elsewhere', () => {
  const a = new Authority(() => 0, () => 0, 'V');
  for (let i = 0; i < 200; i++) expect(a.newCode()[0]).toBe('V');
  const plain = new Authority(() => 0, () => 0);
  for (let i = 0; i < 500; i++) { const code = plain.newCode(); expect(code).toMatch(/^[A-HJ-NP-Z2-9]{12}$/); expect(regionOfCode(code)).toBeUndefined(); }
});

it('accepts only /online with an optional known region parameter', () => {
  expect(parseUpgradeUrl('/online')).toEqual({});
  expect(parseUpgradeUrl('/online?r=iad')).toEqual({ region: 'iad' });
  for (const bad of [undefined, '', '/', '/online/', '/online?', '/online?r=', '/online?r=xyz', '/online?r=IAD', '/online?r=iad&x=1', '/online?x=1', '/online?r=iad#a', '//online?r=iad'])
    expect(parseUpgradeUrl(bad as string | undefined)).toBeNull();
});

it('replays a join upgrade for another region, refuses a loop, and upgrades its own region', async () => {
  const app = startServer(0, '127.0.0.1', 'gru');
  await new Promise<void>(resolve => app.http.on('listening', resolve));
  const address = app.http.address(); if (!address || typeof address === 'string') throw new Error('port');
  const base = `ws://127.0.0.1:${address.port}/online`;
  const attempt = (suffix: string, headers: Record<string, string> = {}) => new Promise<{ status: number; replay?: string }>(resolve => {
    const ws = new WebSocket(`${base}${suffix}`, { origin, headers });
    ws.on('open', () => { ws.terminate(); resolve({ status: 101 }); });
    ws.on('unexpected-response', (_req, res) => { resolve({ status: res.statusCode ?? 0, replay: res.headers['fly-replay'] as string | undefined }); res.destroy(); });
    ws.on('error', () => undefined);
  });
  try {
    expect(await attempt('?r=iad')).toEqual({ status: 409, replay: 'region=iad' });
    expect((await attempt('?r=iad', { 'fly-replay-src': 'instance=abc;region=iad' })).status).toBe(421);
    expect((await attempt('?r=ams')).status).toBe(403);
    expect((await attempt('?r=gru')).status).toBe(101);
    expect((await attempt('')).status).toBe(101);
    expect(app.authority.rooms.size).toBe(0);
  } finally { app.close(); await new Promise(resolve => setTimeout(resolve, 1100)); }
});
