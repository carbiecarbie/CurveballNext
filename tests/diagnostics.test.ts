import { describe, expect, test } from 'vitest';
import { createState } from '../src/core/state';
import { tick } from '../src/core/tick';
import type { Action, Command, State } from '../src/core/types';
import { replay, validateState } from '../src/debug/replay';
import { Recorder } from '../src/debug/trace';

function commands(state: State, actions: Action[]): Command[] {
  return actions.map((action, i) => ({ ...action, tick: state.tick + 1, sequence: i + 1, timestamp: 0, late: false }));
}
const down: Action = { type: 'down', x: 175.5, y: 125.5 };

describe('contact trace generation provenance', () => {
  test('accepted serve followed by retry does not borrow the replacement ball box', () => {
    const initial = tick(createState()).state;
    const result = tick(initial, commands(initial, [down, { type: 'retry' }]));
    const contact = result.audit.contacts[0];
    expect(result.events.map(e => e.type)).toEqual(['serve', 'retry']);
    expect(contact.accepted).toBe(true);
    expect(contact.oldBallBox.generation).toBe(1);
    expect(result.state.ball.generation).toBe(2);
    expect(contact.newBallBox).toBeUndefined();
    // The serve was superseded by retry: diagnostics must not change that state.
    expect(result.state).toEqual(tick(initial, commands(initial, [{ type: 'retry' }])).state);
  });

  test('multiple retries/resets in a tick keep every contact within its own generation', () => {
    const initial = tick(createState()).state;
    const batch = commands(initial, [down, { type: 'retry' }, down, { type: 'reset', level: 5 }, down, { type: 'retry' }, down]);
    const result = tick(initial, batch);
    expect(result.audit.contacts.map(c => c.oldBallBox.generation)).toEqual([1, 2, 3, 4]);
    expect(result.audit.contacts.map(c => c.accepted)).toEqual([true, false, false, false]);
    for (const contact of result.audit.contacts) {
      expect(contact.before.generation).toBe(contact.oldBallBox.generation);
      if (contact.oldBallBox.generation === result.state.ball.generation) expect(contact.newBallBox).toEqual(result.state.ball.box);
      else expect(contact.newBallBox).toBeUndefined();
    }
    const recorder = new Recorder(initial);
    recorder.record(batch, result);
    expect(replay(JSON.parse(JSON.stringify(recorder.export())))).toEqual(result.state);
  });

  test.each(['serve', 'return'] as const)('ordinary same-generation %s preserves both actual boxes', kind => {
    const initial = tick(createState()).state;
    if (kind === 'return') {
      initial.phase = 'Rally';
      initial.ball.z = 1;
      initial.ball.vz = -2;
    }
    const before = structuredClone(initial);
    const result = tick(initial, commands(initial, kind === 'serve' ? [down] : []));
    const contact = result.audit.contacts[0];
    expect(contact.kind).toBe(kind);
    expect(contact.accepted).toBe(true);
    expect(contact.oldBallBox).toEqual(before.ball.box);
    expect(contact.newBallBox).toEqual(result.state.ball.box);
    expect(contact.newBallBox!.generation).toBe(contact.oldBallBox.generation);
    expect(contact.newBallBox).not.toBe(result.state.ball.box);
    expect(initial).toEqual(before);
  });
});

type Mutation = (s: State) => void;
const invalid: [string, Mutation][] = [
  ['publishedBall.tick = -10', s => { s.publishedBall.tick = -10; }],
  ['ball.box.generation = 1.5', s => { s.ball.box.generation = 1.5; }],
  ['missTick = -100 in MissHold', s => { s.phase = 'MissHold'; s.missTick = -100; }],
  ['missTick outside MissHold', s => { s.missTick = -100; }],
  ['missing missTick in MissHold', s => { s.phase = 'MissHold'; }],
  ['future missTick', s => { s.phase = 'MissHold'; s.missTick = s.tick + 1; }],
  ['fractional missTick', s => { s.phase = 'MissHold'; s.missTick = 0.5; }],
  ['future publication tick', s => { s.publishedBall.tick = s.tick + 1; }],
  ['fractional publication generation', s => { s.publishedBall.generation = 1.5; }],
  ['publication generation differs from ball', s => { s.publishedBall.generation++; }],
  ['negative ball display tick', s => { s.ball.box.tick = -1; }],
  ['future ball display tick', s => { s.ball.box.tick = s.tick + 1; }],
  ['ball display generation differs from ball', s => { s.ball.box.generation++; }],
  ['negative player publication tick', s => { s.player.tick = -1; }],
  ['fractional enemy publication tick', s => { s.enemy.tick = 0.5; }],
  ['future player display tick', s => { s.player.box.tick = s.tick + 1; }],
  ['negative enemy display tick', s => { s.enemy.box.tick = -1; }],
  ['zero player display generation', s => { s.player.box.generation = 0; }],
  ['fractional enemy display generation', s => { s.enemy.box.generation = 1.5; }],
  ['player display generation differs from player', s => { s.player.box.generation++; }],
  ['negative cache tick', s => { s.cache!.tick = -1; }],
  ['fractional cache tick', s => { s.cache!.tick = 0.5; }],
  ['future cache tick', s => { s.cache!.tick = s.tick + 1; }],
  ['negative player cache tick', s => { s.cache!.player.tick = -1; }],
  ['future enemy cache tick', s => { s.cache!.enemy.tick = s.tick + 1; }],
  ['sample newer than cache', s => { s.cache!.tick = 0; }],
  ['zero player cache generation', s => { s.cache!.player.generation = 0; }],
  ['fractional enemy cache generation', s => { s.cache!.enemy.generation = 1.5; }],
  ['cache sample generation differs from paddle', s => { s.cache!.enemy.generation++; }],
  ['unsafe tick', s => { s.tick = Number.MAX_SAFE_INTEGER + 1; }],
  ['zero trial', s => { s.trial = 0; }],
  ['fractional rally', s => { s.rally = 1.5; }],
  ['zero ball generation', s => { s.ball.generation = 0; }],
  ['negative player generation', s => { s.player.generation = -1; }],
  ['unsafe enemy generation', s => { s.enemy.generation = Number.MAX_SAFE_INTEGER + 1; }],
  ['fractional diagnostic counter', s => { s.diagnostics.returns = 0.5; }],
];

describe('replay checkpoint stamp schema', () => {
  test.each(invalid)('rejects %s before executing any tick', (_name, mutate) => {
    const state = tick(createState()).state;
    mutate(state);
    // With no records, output/audit comparison cannot mask missing input validation.
    const capture = new Recorder(state).export();
    const before = structuredClone(capture);
    expect(() => replay(capture)).toThrow();
    expect(capture).toEqual(before);
  });

  test('negative missTick is rejected before it can cause automatic retry', () => {
    const state = tick(createState()).state;
    state.phase = 'MissHold'; state.missTick = -100;
    const recorder = new Recorder(state);
    const result = tick(state);
    expect(result.events[0].type).toBe('auto-retry');
    recorder.record([], result);
    expect(() => replay(recorder.export())).toThrow();
  });

  test('valid initial, retained stopped stamps, retry and reset states replay exactly', () => {
    expect(replay(new Recorder(createState()).export())).toEqual(createState());
    let state = tick(createState()).state;
    state.phase = 'Rally'; state.ball.z = -1;
    state.ball.box.left = 1000; state.ball.box.right = 1030;
    state = tick(state).state;
    expect(state.phase).toBe('MissHold');
    const recorder = new Recorder(state);
    for (let i = 0; i < 22; i++) {
      const batch = i === 21 ? commands(state, [{ type: 'reset', level: 10 }]) : [];
      const result = tick(state, batch); state = result.state;
      expect(() => validateState(state)).not.toThrow();
      recorder.record(batch, result);
    }
    expect(replay(JSON.parse(JSON.stringify(recorder.export())))).toEqual(state);
  });

  test('negative/fractional continuous physics values remain valid', () => {
    const state = tick(createState()).state;
    Object.assign(state.ball, { x: -0.25, y: 1.75, z: -0.5, vx: -1.25, vy: 0.125, cx: -0.015, cy: 0.025 });
    state.target = { x: -900.5, y: 1000.125 };
    expect(replay(new Recorder(state).export())).toEqual(state);
  });
});
