import { expect, it } from 'vitest';
import { OnlineView } from '../src/multiplayer/view';
import { boxes, createOnline, startMatch, step } from '../src/multiplayer/simulation';
import { classify } from '../tools/m5/fairness';

it.each(['miss', 'finish', 'return'] as const)('wall-top → wall-left → %s retains the actual incoming draw across the whole tick', outcome => {
  let time = 0;
  const s = createOnline(); startMatch(s, 0); s.phase = 'Rally';
  Object.assign(s.ball, { u: -135.5, y: 40, z: 0, vx: -1, vy: 1, vz: -2 });
  if (outcome === 'finish') s.lives[0] = 1;
  if (outcome === 'return') Object.assign(s.localPaddles[0], { x: 68.38888888888889, y: 53.94444444444444 });
  s.viewBoxes = boxes(s);
  const view = new OnlineView(0, () => time), audio: string[] = [];
  view.onAudio = e => audio.push(e.type);
  view.accept(s, 0); view.draw(0, 0, true);
  // A displayed prediction distinct from the centered authoritative miss fixture.
  Object.assign(view.predicted!, { x: 68.38888888888889, y: 53.94444444444444,
    px: 68.38888888888889, py: 53.94444444444444, tx: 68.38888888888889, ty: 53.94444444444444 });
  time = 67; const preceding = view.draw(time, 0, true)!;
  const literal = { left: 38.35, right: 98.35, top: 33.9, bottom: 73.9 };
  expect(preceding.own).toEqual(literal);
  const events = step(s);
  expect(events.map(e => e.type)).toEqual(['wall-top', 'wall-left', outcome]);
  // The authority sends every event with the same final tick state, including the wall events.
  for (const event of events) view.accept(structuredClone(s), 100, event);
  view.accept(structuredClone(s), 100); // ordinary snapshot in the same delivered batch
  if (outcome !== 'return') expect(view.predicted).toBeNull();
  time = 180; const incoming = view.draw(time, 0, true)!;
  expect(incoming.incomingEventId).toBe(events[2].eventId);
  expect(incoming.own).toEqual(literal);
  expect(incoming.ball).toEqual({ left: 25, right: 55, top: 25, bottom: 55 });
  expect(classify(incoming.ball, incoming.own, outcome === 'return')).toBe(outcome === 'return' ? 'apparent-contact-accepted' : 'apparent-contact-rejected');
  expect(audio).toEqual(['wall-top', 'wall-left']);
  time = 197; view.draw(time, 0, true);
  time = 214; view.draw(time, 0, true);
  events.forEach(e => view.accept(structuredClone(s), 100, e));
  time = 231; view.draw(time, 0, true);
  expect(audio).toEqual(['wall-top', 'wall-left', outcome]);
  expect(view.frames).toContainEqual(preceding);
  expect(view.frames).toContainEqual(incoming);
  if (outcome !== 'return') expect(view.history).toHaveLength(0);
});

it('a draw between wall deliveries cannot replace the incoming Hold pose', () => {
  let time = 0; const s = createOnline(); startMatch(s, 0); s.phase = 'Rally';
  Object.assign(s.ball, { u: -135.5, y: 40, z: 0, vx: -1, vy: 1, vz: -2 }); s.viewBoxes = boxes(s);
  const v = new OnlineView(0, () => time); v.accept(s, 0); v.draw(0, 0, true);
  Object.assign(v.predicted!, { x: 68.38888888888889, y: 53.94444444444444, px: 68.38888888888889,
    py: 53.94444444444444, tx: 68.38888888888889, ty: 53.94444444444444 });
  time = 67; const preceding = v.draw(time, 0, true)!; const events = step(s);
  v.accept(s, 100, events[0]); time = 180;
  expect(v.draw(time, 0, true)!.own).toEqual(preceding.own);
  v.accept(s, 100, events[1]); time = 197; v.draw(time, 0, true);
  v.accept(s, 100, events[2]); time = 214;
  expect(v.draw(time, 0, true)!.own).toEqual(preceding.own);
  time = 231; expect(v.draw(time, 0, true)!.own.left).toBe(145.5);
});

it('a later Rally in the same delivery batch cannot overwrite an earlier transaction capture', () => {
  let time = 0; const s = createOnline(); startMatch(s, 0); s.phase = 'Rally';
  Object.assign(s.ball, { u: -135.5, y: 40, z: 0, vx: -1, vy: 1, vz: -2 }); s.viewBoxes = boxes(s);
  const v = new OnlineView(0, () => time); v.accept(s, 0); v.draw(0, 0, true);
  Object.assign(v.predicted!, { x: 68.38888888888889, y: 53.94444444444444, px: 68.38888888888889,
    py: 53.94444444444444, tx: 68.38888888888889, ty: 53.94444444444444 });
  time = 67; v.draw(time, 0, true);
  for (const e of step(s)) v.accept(s, 100, e);
  s.rallyId++; s.tick++; s.phase = 'Rally'; s.localPaddles.forEach(p => { p.x = p.tx = 175.5; p.y = p.ty = 125.5; });
  s.viewBoxes = boxes(s); v.accept(s, 110);
  time = 180; const incoming = v.draw(time, 0, true)!;
  expect(incoming.own).toEqual({ left: 38.35, right: 98.35, top: 33.9, bottom: 73.9 });
  expect(classify(incoming.ball, incoming.own, false)).toBe('apparent-contact-rejected');
});

it('wall-only transactions present each wall once and settle without a fictional contact frame', () => {
  let time = 0; const s = createOnline(); startMatch(s, 0); s.phase = 'Rally';
  Object.assign(s.ball, { u: -135.5, y: 40, z: 30, vx: -1, vy: 1, vz: 2 }); s.viewBoxes = boxes(s);
  const v = new OnlineView(0, () => time), audio: string[] = []; v.onAudio = e => audio.push(e.type);
  v.accept(s, 0); v.draw(0, 0, true);
  const events = step(s); expect(events.map(e => e.type)).toEqual(['wall-top', 'wall-left']);
  events.forEach(e => v.accept(s, 100, e)); time = 180;
  expect(v.draw(time, 0, true)!.incomingEventId).toBeNull(); time = 197; v.draw(time, 0, true);
  expect(audio).toEqual(['wall-top', 'wall-left']); expect(v.events).toHaveLength(0);
});

it('closing never reinstalls a retained prediction; the preceding real frame remains recorded', () => {
  let time = 0; const s = createOnline(); startMatch(s, 0); s.phase = 'Rally'; s.lives[0] = 1;
  Object.assign(s.ball, { u: -135.5, y: 40, z: 0, vx: -1, vy: 1, vz: -2 }); s.viewBoxes = boxes(s);
  const v = new OnlineView(0, () => time); v.accept(s, 0); v.draw(0, 0, true);
  Object.assign(v.predicted!, { x: 68.38888888888889, y: 53.94444444444444, px: 68.38888888888889,
    py: 53.94444444444444, tx: 68.38888888888889, ty: 53.94444444444444 });
  time = 67; const preceding = v.draw(time, 0, true)!; step(s).forEach(e => v.accept(s, 100, e));
  for (const at of [180, 197, 214]) {
    time = at; const frame = v.draw(at, 0, false, true)!;
    expect(frame.own).toEqual({ left: 145.5, right: 205.5, top: 105.5, bottom: 145.5 });
    expect(frame.predictedLocal).toBeNull(); expect(v.predicted).toBeNull();
  }
  expect(v.frames).toContainEqual(preceding);
});
