import { describe, expect, it } from 'vitest';
import { OnlineView } from '../src/multiplayer/view';
import { boxes, createOnline, startMatch, step } from '../src/multiplayer/simulation';

const center = { left: 145.5, right: 205.5, top: 105.5, bottom: 145.5 };

describe('M5 stationary non-rally presentation', () => {
  it.each(['Waiting', 'Countdown', 'LifeLostHold', 'MatchEnded', 'Aborted'] as const)('%s ignores continuous mouse samples and creates no prediction history', phase => {
    let now = 0; const s = createOnline(); s.phase = phase;
    const v = new OnlineView(0, () => now); v.accept(s, 0);
    for (let i = 0; i < 30; i++) {
      now = i * 10; v.draw(now, 0, true); v.input(i % 2 ? 55 : 296, i % 2 ? 45 : 206, i + 1);
      expect(v.draw(now, 0, true)!.own).toEqual(center); expect(v.history).toHaveLength(0);
    }
  });
  it('countdown activation discards an obsolete logical target rather than moving on launch', () => {
    const s = createOnline(); startMatch(s, 0); s.localPaddles[0].tx = 55; s.localPaddles[0].ty = 45;
    for (let i = 0; i < 90; i++) step(s);
    expect(s.phase).toBe('Rally'); expect(s.localPaddles[0]).toMatchObject({ x: 175.5, y: 125.5, tx: 175.5, ty: 125.5, dx: 0, dy: 0 });
    step(s); expect(s.localPaddles[0].x).toBe(175.5);
  });
  it('closing holds the latest authoritative paddle without interpolating buffered rally movement', () => {
    let now = 0; const s = createOnline(); s.phase = 'Rally'; const v = new OnlineView(0, () => now);
    v.accept(s, 0); v.draw(0, 0, true); v.input(55, 45, 1);
    s.tick = 1; s.lastEventId = 1; s.localPaddles[0].x = 100; s.viewBoxes = boxes(s);
    v.accept(s, 33, { type: 'return', side: 0, tick: 1, eventId: 1, incomingBoxTick: 0, incomingViewBoxes: s.viewBoxes, matchId: 0, rallyId: 0, lives: [3, 3], result: null });
    for (now = 40; now < 300; now += 10) {
      expect(v.draw(now, 0, false, true)!.own).toEqual({ left: 70, right: 130, top: 105.5, bottom: 145.5 });
      v.input(296, 206, 2); expect(v.history).toHaveLength(0); expect(v.predicted).toBeNull();
    }
  });
  it('a miss holds the actual incoming draw without prediction oscillation, then resets once at countdown', () => {
    let now = 0; const s = createOnline(); startMatch(s, 0); s.phase = 'Rally';
    const v = new OnlineView(0, () => now); v.accept(s, 0); v.draw(0, 0, true); v.input(55, 45, 1);
    now = 100; const preceding = v.draw(now, 0, true)!;
    Object.assign(s.ball, { u: -120, z: 0, vz: -2 }); s.viewBoxes = boxes(s);
    const events = step(s), miss = events.find(e => e.type === 'miss')!;
    expect(s.lives).toEqual([2, 3]); expect(s.phase).toBe('LifeLostHold'); expect(s.phaseDeadline).toBe(20);
    v.accept(s, 100, miss);
    for (now = 110; now <= 150; now += 10) {
      v.input(296, 206, 2); expect(v.draw(now, 0, true)!.own).toEqual(preceding.own);
      expect(v.predicted).toBeNull(); expect(v.history).toHaveLength(0);
    }
    now = 180; const incoming = v.draw(now, 0, true)!;
    expect(incoming.incomingEventId).toBe(miss.eventId); expect(incoming.own).toEqual(preceding.own);
    expect(incoming.predictedLocal).toEqual(preceding.predictedLocal);
    expect(incoming.ball.left).toBe(miss.incomingViewBoxes[0].ball[0] / 20);
    now = 197; expect(v.draw(now, 0, true)!.own).toEqual(center);
    for (let i = 0; i < 18; i++) step(s);
    expect(s.phase).toBe('LifeLostHold'); expect(s.lives).toEqual([2, 3]);
    step(s); expect(s.phase).toBe('Countdown'); expect(s.rallyId).toBe(2);
    v.accept(s, now); v.input(55, 45, 3); expect(v.draw(now, 0, true)!.own).toEqual(center);
    expect(v.frames).toContainEqual(preceding); expect(v.frames).toContainEqual(incoming);
    expect(v.corrections).toHaveLength(0);
  });
  it('delayed prior-rally snapshots cannot resurrect disposed prediction', () => {
    let now = 0; const s = createOnline(); startMatch(s, 0); s.phase = 'Rally'; s.tick = 90;
    const stale = structuredClone(s), v = new OnlineView(0, () => now);
    v.accept(s, now); v.draw(now, 0, true); v.input(55, 45, 1);
    s.tick = 91; s.phase = 'LifeLostHold'; v.accept(s, now);
    v.accept(stale, now); now = 100; expect(v.draw(now, 0, true)!.own).toEqual(center); expect(v.predicted).toBeNull();
    s.rallyId = 2; s.phase = 'Countdown'; s.tick = 110; v.accept(s, now);
    v.accept(stale, now); expect(v.history).toHaveLength(0); expect(v.draw(now, 0, true)!.own).toEqual(center);
    s.phase = 'Rally'; s.tick = 200; v.accept(s, now);
    now = 200; expect(v.draw(now, 0, true)!.own).toEqual(center);
    v.input(55, 45, 2); now = 300;
    // Three owning-local easing steps: 95.1666…, 68.3888…, 59.4629…;
    // the visual installer rounds each projected pose to twips before interpolation.
    expect(v.draw(now, 0, true)!.own.left).toBeCloseTo(29.45, 10);
  });
  it('a delayed reset preserves the actual incoming pose until sampling, then installs the latest static pose', () => {
    let now = 0; const s = createOnline(); startMatch(s, 0); s.phase = 'Rally';
    const v = new OnlineView(0, () => now); v.accept(s, 0); v.draw(0, 0, true); v.input(55, 45, 1);
    now = 100; const previous = v.draw(now, 0, true)!;
    Object.assign(s.ball, { u: -120, z: 0, vz: -2 }); s.viewBoxes = boxes(s);
    const miss = step(s).find(e => e.type === 'miss')!; v.accept(s, 100, miss);
    for (let i = 0; i < 19; i++) step(s);
    v.accept(s, 130); now = 180;
    const incoming = v.draw(now, 0, true)!;
    expect(incoming.incomingEventId).toBe(miss.eventId); expect(incoming.own).toEqual(previous.own);
    now = 197; expect(v.draw(now, 0, true)!.own).toEqual(center); expect(v.history).toHaveLength(0);
    now = 210; expect(v.draw(now, 0, true)!.own).toEqual(center); expect(v.predicted).toBeNull();
  });
});
