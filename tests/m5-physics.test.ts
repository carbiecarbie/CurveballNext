import { describe, expect, it } from 'vitest';
import { display, installTwips } from '../src/compat/display';
import { ballBox, boxes, contact, createOnline, move, ownBox, paddle, startMatch, step } from '../src/multiplayer/simulation';
import type { Side } from '../src/multiplayer/types';
import { expectedBox, expectedHit } from './m5-oracle';

describe('M5 numerical provenance and independent interval fixtures', () => {
  it('preserves the literal 31-movement binary64 counterexample for both owners', () => {
    for (const _side of [0, 1]) {
      const p = paddle(); p.x = p.px = 55; p.tx = 61;
      for (let n = 0; n < 30; n++) move(p);
      expect(p.x).toBe(60.99999999999997); move(p);
      expect(p.x).toBe(60.99999999999999); expect(p.dx).toBe(2.1316282072803006e-14);
      expect(installTwips({ x: p.x, y: 125.5, width: 60, height: 40 }).slice(0, 2)).toEqual([619, 1819]);
      expect(ownBox(p).slice(0, 2)).toEqual([620, 1820]);
    }
  });
  it('retains local 55.15 rather than reflecting it twice', () => {
    const p = paddle(); p.x = 55.15;
    expect(175.5 + (p.x - 175.5)).toBe(55.150000000000006);
    expect(ownBox(p).slice(0, 2)).toEqual([503, 1703]);
    expect(351 - (351 - p.x)).toBe(55.14999999999998);
    expect(installTwips({ x: 351 - (351 - p.x), y: p.y, width: 60, height: 40 }).slice(0, 2)).toEqual([502, 1702]);
  });
  it.each([0, 1] as const)('literal edge and corner outcomes for owner %i', side => {
    const s = createOnline(); s.ball.u = side === 0 ? -120.35 : 120.35; s.ball.z = side === 0 ? 0 : 75;
    const b = ballBox(s.ball, side); expect(b).toEqual([803, 1403, 2210, 2810]);
    const p = s.localPaddles[side]; p.x = 100.15;
    expect(ownBox(p)).toEqual([1403, 2603, 2110, 2910]); expect(contact(b, ownBox(p))).toBe(true);
    p.x = 100.20; expect(ownBox(p)[0]).toBe(1404); expect(contact(b, ownBox(p))).toBe(false);
    p.x = 100.15; p.y = 160.5; expect(ownBox(p)[2]).toBe(2810); expect(contact(b, ownBox(p))).toBe(true);
    p.y = 160.55; expect(ownBox(p)[2]).toBe(2811); expect(contact(b, ownBox(p))).toBe(false);
  });
  it.each([0, 1, 74, 75])('independent projection at depth %i, mirrored horizontal operands', z => {
    for (const u of [-135.5, -120.35, -.05, -0, .05, 120.35, 135.5]) {
      const s = createOnline(); Object.assign(s.ball, { u, z, y: 160.55 });
      expect(ballBox(s.ball, 0)).toEqual(expectedBox(u, 160.55, z, 30, 30));
      const mirror = { ...s.ball, u: -u, z: 75 - z };
      expect(ballBox(mirror, 1)).toEqual(ballBox(s.ball, 0));
    }
  });
  it('closed integer inequalities use no epsilon', () => {
    for (let gap = -2; gap <= 2; gap++) {
      const a: [number, number, number, number] = [0, 600, 0, 600], b: typeof a = [600 + gap, 1800, 600 + gap, 1400];
      expect(contact(a, b)).toBe(expectedHit(a, b)); expect(contact(a, b)).toBe(gap <= 0);
    }
  });
  it('does not change Classic installation/readback', () => {
    const pose = { x: 60.99999999999999, y: 125.5, width: 60, height: 40 };
    expect(display.install(pose, { tick: 1, generation: 1 }).left).toBe(30.95);
    expect(display.readInput!({ x: 177.5, y: 127.5 })).toEqual({ x: 178, y: 128 });
  });
});

describe('M5 authoritative lives, launch, hold and contact timing', () => {
  function miss(s: ReturnType<typeof createOnline>, side: Side) {
    s.phase = 'Rally'; Object.assign(s.ball, { z: side === 0 ? 0 : 75, u: side === 0 ? -120.35 : 120.35, y: 125.5, vx: 0, vy: 0, cx: 0, cy: 0, vz: side === 0 ? -2 : 2 });
    s.localPaddles[side].x = s.localPaddles[side].px = 296; s.viewBoxes = boxes(s); return step(s);
  }
  it.each([0, 1] as const)('exact three lives and one finish for side %i', side => {
    const s = createOnline(); startMatch(s, 0);
    for (const lives of [2, 1, 0]) {
      const events = miss(s, side); expect(s.lives[side]).toBe(lives); expect(events).toHaveLength(1);
      expect(events[0].type).toBe(lives ? 'miss' : 'finish');
      const tick = s.tick;
      for (let i = 0; i < 18; i++) { step(s); expect(s.lives[side]).toBe(lives); }
      if (lives) { step(s); expect(s.phase).toBe('Countdown'); expect(s.tick).toBe(tick + 19); expect(s.servingSide).toBe(side); }
      else { expect(s.phase).toBe('MatchEnded'); expect(s.tick).toBe(tick); expect(step(s)).toEqual([]); expect(s.result?.loser).toBe(side); }
    }
  });
  it.each([0, 1] as const)('locked paddles and exact countdown/launch for serve %i', side => {
    const s = createOnline(); startMatch(s, side); s.localPaddles[0].tx = 55;
    for (let i = 0; i < 89; i++) { expect(step(s)).toEqual([]); expect(s.ball.vz).toBe(0); expect(s.localPaddles[0].x).toBe(175.5); }
    const events = step(s); expect(s.tick).toBe(90); expect(events[0].type).toBe('launch'); expect(s.ball.vz).toBe(side === 0 ? 2 : -2);
    expect(s.ball.u).toBe(side === 0 ? -.01 : .01); expect(s.ball.y).toBe(125.51);
  });
  it('contacts the old box despite a newly integrated inside pose and new target', () => {
    const s = createOnline(); startMatch(s, 0); s.phase = 'Rally'; Object.assign(s.ball, { u: -100, z: 0, vx: 100, vz: -2, cx: 0, cy: 0 });
    s.viewBoxes = boxes(s); s.localPaddles[0].tx = 55;
    expect(step(s)[0].type).toBe('miss'); expect(s.lives).toEqual([2, 3]);
  });
  it.each([0, 1] as const)('return uses prior local displacement, retains lateral velocity, and mirrors curve %i', side => {
    const s = createOnline(); startMatch(s, side); s.phase = 'Rally'; s.ball.z = side === 0 ? 0 : 75; s.ball.vz = side === 0 ? -2 : 2; s.ball.vx = 3; s.ball.vy = 2;
    s.localPaddles[side].dx = 2.5; s.localPaddles[side].dy = -5; s.viewBoxes = boxes(s);
    expect(step(s)[0].type).toBe('return'); expect(s.ball.vx).toBe(3); expect(s.ball.vy).toBe(2);
    expect(s.ball.cx).toBe(side === 0 ? -.1 : .1); expect(s.ball.cy).toBe(-.2); expect(Math.abs(s.ball.vz)).toBe(2);
  });
  it('strict crossing and y-wall before x-wall before end contact', () => {
    const s = createOnline(); startMatch(s, 0); s.phase = 'Rally'; Object.assign(s.ball, { z: 2, vz: -2, y: 40, vy: 2, u: -135.5, vx: -2, cx: 0, cy: 0 });
    s.viewBoxes = boxes(s); const events = step(s);
    expect(events.map(e => e.type)).toEqual(['wall-top', 'wall-left']); expect(s.ball.z).toBe(0);
    expect(s.ball.u).toBe(-135.5); expect(s.ball.y).toBe(40); expect(s.ball.vx).toBe(2); expect(s.ball.vy).toBe(-2);
    expect(step(s).at(-1)?.type).toBe('miss');
  });
  it('mirrored multi-wall trajectories produce exactly the same local boxes and discrete results', () => {
    const a = createOnline(), b = createOnline(); startMatch(a, 0); startMatch(b, 1);
    for (let i = 0; i < 2000; i++) {
      const ea = step(a), eb = step(b);
      expect(b.ball.u || 0).toBe(-a.ball.u || 0); expect(b.ball.vx || 0).toBe(-a.ball.vx || 0); expect(b.ball.cx || 0).toBe(-a.ball.cx || 0); expect(b.ball.z).toBe(75 - a.ball.z);
      expect(b.viewBoxes[1].ball).toEqual(a.viewBoxes[0].ball); expect(b.lives).toEqual([...a.lives].reverse());
      expect(eb.map(e => [e.type, e.side === null ? null : 1 - e.side])).toEqual(ea.map(e => [e.type, e.side]));
    }
  });
});
