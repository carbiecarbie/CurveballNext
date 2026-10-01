import { expect, it } from 'vitest';
import { OnlineView, type DrawModel } from '../src/multiplayer/view';
import { boxes, createOnline, startMatch, step } from '../src/multiplayer/simulation';
import { classify } from '../tools/m5/fairness';

const literalPose = { x: 68.38888888888889, y: 53.94444444444444, px: 68.38888888888889, py: 53.94444444444444, tx: 68.38888888888889, ty: 53.94444444444444 };
const literal = { left: 38.35, right: 98.35, top: 33.9, bottom: 73.9 };
// Plan §5 incoming-ball amendment: a predicting defender presents its own crossing AHEAD of the authority. The incoming
// evidence frame is that claim frame (the C−1 ball with the actually drawn paddle); the event later only labels it.
it.each(['miss', 'finish', 'return'] as const)('wall-top → wall-left → %s: the presented claim frame is the incoming evidence, never redrawn', outcome => {
  let time = 0;
  const s = createOnline(); startMatch(s, 0); s.phase = 'Rally';
  Object.assign(s.ball, { u: -135.5, y: 40, z: 0, vx: -1, vy: 1, vz: -2 });
  if (outcome === 'finish') s.lives[0] = 1;
  if (outcome === 'return') Object.assign(s.localPaddles[0], { x: literalPose.x, y: literalPose.y });
  s.viewBoxes = boxes(s);
  const view = new OnlineView(0, () => time), audio: string[] = [], claims: boolean[] = [], boundaries: DrawModel[] = [];
  view.onAudio = e => audio.push(e.type); view.onClaim = c => claims.push(c.hit); view.onBoundary = (_e, _p, incoming) => boundaries.push(incoming);
  view.accept(s, 0); Object.assign(view.predicted!, literalPose);
  const incoming = view.draw(0, 0, true)!;
  expect(claims).toEqual([true]); expect(incoming.own).toEqual(literal); expect(incoming.ball).toEqual({ left: 25, right: 55, top: 25, bottom: 55 });
  expect(incoming.incomingEventId).toBeNull(); expect(audio).toEqual([]);
  // A claimed hit returns at once along the deterministic return path: no freeze while the authority answers.
  time = 67; const returning = view.draw(time, 0, true)!;
  expect(returning.ballPredicted).toBe(true); expect(returning.ball).not.toEqual(incoming.ball); expect(audio).toEqual(['wall-top', 'wall-left', 'return']);
  const events = step(s);
  expect(events.map(e => e.type)).toEqual(['wall-top', 'wall-left', outcome]);
  for (const event of events) view.accept(structuredClone(s), 100, event);
  view.accept(structuredClone(s), 100);
  time = 180; const after = view.draw(time, 0, true)!;
  expect(boundaries).toEqual([incoming]); expect(incoming.incomingEventId).toBe(events[2].eventId);
  expect(after.incomingEventId).toBeNull(); expect(view.frames.filter(f => f.incomingEventId !== null)).toEqual([incoming]);
  expect(classify(incoming.ball, incoming.own, outcome === 'return')).toBe(outcome === 'return' ? 'apparent-contact-accepted' : 'apparent-contact-rejected');
  time = 197; view.draw(time, 0, true);
  // The predicted return cue plays once; walls follow their events; a rejected claim's authoritative outcome follows.
  expect(audio).toEqual(outcome === 'return' ? ['wall-top', 'wall-left', 'return'] : ['wall-top', 'wall-left', 'return', outcome]);
  if (outcome !== 'return') { expect(view.predicted).toBeNull(); expect(view.history).toHaveLength(0); }
});

it('a draw between wall deliveries keeps the held incoming pose until the contact event settles it', () => {
  let time = 0; const s = createOnline(); startMatch(s, 0); s.phase = 'Rally';
  Object.assign(s.ball, { u: -135.5, y: 40, z: 0, vx: -1, vy: 1, vz: -2 }); s.viewBoxes = boxes(s);
  const v = new OnlineView(0, () => time); v.accept(s, 0); Object.assign(v.predicted!, literalPose);
  const incoming = v.draw(0, 0, true)!; const events = step(s);
  v.accept(s, 100, events[0]); time = 180;
  expect(v.draw(time, 0, true)!.own).toEqual(incoming.own);
  v.accept(s, 100, events[1]); time = 197; expect(v.draw(time, 0, true)!.own).toEqual(incoming.own);
  v.accept(s, 100, events[2]); time = 214;
  expect(v.draw(time, 0, true)!.own.left).toBe(145.5); expect(incoming.incomingEventId).toBe(events[2].eventId);
});

it('a later Rally in the same delivery batch cannot overwrite an earlier transaction capture', () => {
  let time = 0; const s = createOnline(); startMatch(s, 0); s.phase = 'Rally';
  Object.assign(s.ball, { u: -135.5, y: 40, z: 0, vx: -1, vy: 1, vz: -2 }); s.viewBoxes = boxes(s);
  const v = new OnlineView(0, () => time), captured: DrawModel[] = []; v.onBoundary = (_e, _p, incoming) => captured.push(incoming);
  v.accept(s, 0); Object.assign(v.predicted!, literalPose); v.draw(0, 0, true);
  for (const e of step(s)) v.accept(s, 100, e);
  s.rallyId++; s.tick++; s.phase = 'Rally'; s.localPaddles.forEach(p => { p.x = p.tx = 175.5; p.y = p.ty = 125.5; });
  s.viewBoxes = boxes(s); v.accept(s, 110);
  time = 180; v.draw(time, 0, true);
  expect(captured).toHaveLength(1); expect(captured[0].own).toEqual(literal);
  expect(classify(captured[0].ball, captured[0].own, false)).toBe('apparent-contact-rejected');
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
