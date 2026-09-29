import { describe, expect, test } from 'vitest';
import { classify } from '../src/core/collisions';
import { DIFFICULTIES } from '../src/core/constants';
import { awardPlayerContact } from '../src/core/scoring';
import { createState } from '../src/core/state';
import { tick } from '../src/core/tick';
import type { Action, State } from '../src/core/types';
import { replay } from '../src/debug/replay';
import { Recorder } from '../src/debug/trace';
import { Clock } from '../src/runtime/clock';

const center = { x: 175.5, y: 125.5 };
function command(s: State, action: Action) {
  return { ...action, tick: s.tick + 1, sequence: s.tick + 1, timestamp: (s.tick + 1) * 1000 / 30, late: false };
}
function step(s: State, action?: Action) { return tick(s, action ? [command(s, action)] : []); }
function hold(s: State) { for (let i = 0; i < 19; i++) s = step(s).state; return s; }
function miss(s: State, side: 'player' | 'enemy') {
  const result = step(s, { type: 'debug-miss', side });
  expect(result.events.map(e => e.type)).toContain('miss');
  expect(result.state.phase).toBe('MissHold');
  return result.state;
}
function playerReturn(dx = 0, dy = 0) {
  const s = createState();
  s.phase = 'Rally'; s.ball.z = 1; s.ball.vz = -2;
  s.ball.x += dx; s.ball.y += dy;
  // Keep the installed old ball box centered: logical accuracy is independent.
  return step(s);
}

describe('M2 campaign lifecycle', () => {
  test('new game has exact recovered starting state; debug reset does not change New Game level', () => {
    let s = createState(8);
    s = step(s, { type: 'new-game' }).state;
    expect({ score: s.score, level: s.level, playerLives: s.playerLives, enemyLives: s.enemyLives,
      hitScore: s.hitScore, curveBonus: s.curveBonus, superCurveBonus: s.superCurveBonus,
      accuracyBonus: s.accuracyBonus, remainingBonus: s.remainingBonus, bonusCounter: s.bonusCounter,
      phase: s.phase }).toEqual({ score: 0, level: 1, playerLives: 5, enemyLives: 3,
      hitScore: 100, curveBonus: 50, superCurveBonus: 150, accuracyBonus: 100,
      remainingBonus: 3000, bonusCounter: 10, phase: 'ServeWaiting' });
    s = step(s, { type: 'reset', level: 10 }).state;
    expect(s.level).toBe(10);
    s = step(s, { type: 'new-game' }).state;
    expect(s.level).toBe(1);
  });

  test.each(['player', 'enemy'] as const)('%s miss loses exactly one corresponding life, then same-level retry', side => {
    let s = createState();
    s = miss(s, side);
    expect([s.playerLives, s.enemyLives]).toEqual(side === 'player' ? [4, 3] : [5, 2]);
    const before = structuredClone(s);
    for (let i = 0; i < 18; i++) s = step(s).state;
    expect(s.phase).toBe('MissHold');
    expect([s.playerLives, s.enemyLives]).toEqual([before.playerLives, before.enemyLives]);
    s = step(s).state;
    expect(s.phase).toBe('ServeWaiting');
    expect([s.playerLives, s.enemyLives]).toEqual([before.playerLives, before.enemyLives]);
  });

  test('player zero routes to Game Over after hold, with New Game restart', () => {
    let s = createState(); s.playerLives = 1;
    s = miss(s, 'player');
    expect(s.playerLives).toBe(0); expect(s.phase).toBe('MissHold');
    s = hold(s);
    expect(s.phase).toBe('GameOver'); expect(s.level).toBe(1);
    s = step(s, { type: 'new-game' }).state;
    expect([s.phase, s.level, s.score, s.playerLives]).toEqual(['ServeWaiting', 1, 0, 5]);
  });

  test('enemy-depletion branch wins an injected dual-depleted hold', () => {
    let s = createState(); s.phase = 'MissHold'; s.phaseTick = s.missTick = s.tick;
    s.playerLives = 0; s.enemyLives = 0; s.remainingBonus = 2750;
    s = hold(s);
    expect([s.phase, s.level, s.score, s.playerLives, s.enemyLives]).toEqual(['LevelIntro', 2, 2750, 0, 3]);
  });

  test.each([1, 5, 9])('level %s completes into the next original tuple with carried player lives', level => {
    let s = createState(level); s.playerLives = 2; s.score = 440; s.remainingBonus = 2725; s.bonusCounter = 4;
    for (let i = 0; i < 2; i++) { s = hold(miss(s, 'enemy')); expect(s.level).toBe(level); }
    s = miss(s, 'enemy');
    expect(s.enemyLives).toBe(0); expect(s.score).toBe(440);
    s = hold(s);
    expect([s.phase, s.level, s.score, s.playerLives, s.enemyLives]).toEqual(['LevelIntro', level + 1, 3165, 2, 3]);
    expect([s.hitScore, s.curveBonus, s.superCurveBonus, s.accuracyBonus, s.remainingBonus, s.bonusCounter]).toEqual([100, 50, 150, 100, 3000, 10]);
    for (let i = 0; i < 44; i++) s = step(s).state;
    expect([s.phase, s.score]).toEqual(['LevelIntro', 3165]);
    s = step(s).state;
    expect([s.phase, s.score]).toEqual(['ServeWaiting', 3165]);
    expect(DIFFICULTIES[s.level - 1]).toEqual(DIFFICULTIES[level]);
  });

  test('level 10 completes into explicit terminal containment with no level-11 lookup or duplicate bonus', () => {
    let s = createState(10); s.enemyLives = 1; s.score = 1000; s.remainingBonus = 25;
    s = hold(miss(s, 'enemy'));
    expect([s.phase, s.level, s.score, s.enemyLives]).toEqual(['ContentComplete', 10, 1025, 0]);
    for (let i = 0; i < 100; i++) s = step(s).state;
    expect([s.phase, s.level, s.score]).toEqual(['ContentComplete', 10, 1025]);
  });

  test.each(DIFFICULTIES.map((tuple, index) => [index + 1, tuple.speed, tuple.curve, tuple.ai] as const))(
    'debug level %s uses original speed %s, curve divisor %s, AI divisor %s', (level, speed, curve, ai) => {
      let s = step(createState(), { type: 'reset', level }).state;
      expect(DIFFICULTIES[s.level - 1]).toEqual({ speed, curve, ai });
      s = step(s).state;
      s = step(s, { type: 'down', ...center }).state;
      expect(s.ball.vz).toBe(speed);
    });
});

describe('M2 scoring', () => {
  test('centered fresh serve awards 100 accuracy but no hit score', () => {
    let s = step(createState()).state;
    s = step(s, { type: 'down', ...center }).state;
    expect([s.score, s.accuracyBonus, s.hitScore, s.curveBonus, s.superCurveBonus]).toEqual([100, 90, 100, 50, 150]);
  });

  test.each([[1.25,0,'NONE',100],[1.5,0,'CURVE',150],[3,3,'SUPER',250]] as const)(
    'serve cached displacement (%s, %s) classifies %s and scores %s', (dx, dy, classification, score) => {
      const s = step(createState()).state;
      s.cache!.player.dx = dx; s.cache!.player.dy = dy;
      const result = step(s, { type: 'down', ...center });
      expect(result.events.find(e => e.type === 'serve')?.curve).toBe(classification);
      expect([result.state.score, result.state.hitScore]).toEqual([score, 100]);
    });

  test('ordinary player return awards accuracy before current hit value', () => {
    const result = playerReturn();
    expect(result.events.find(e => e.type === 'return')).toMatchObject({ side: 'player', accurate: true, curve: 'NONE' });
    expect([result.state.score, result.state.accuracyBonus, result.state.hitScore]).toEqual([200, 90, 90]);
  });

  test.each([[7, 5, true],[-7, -5, true],[7.001, 5, false],[7, -5.001, false]] as const)(
    'logical accuracy at offset (%s, %s) is %s despite accepted old-box contact', (dx, dy, expected) => {
      const result = playerReturn(dx, dy);
      expect(result.audit.contacts[0].accepted).toBe(true);
      expect(result.events.find(e => e.type === 'return')?.accurate).toBe(expected);
      expect(result.state.score).toBe(expected ? 200 : 100);
    });

  test('strict curve and super thresholds select only one bucket', () => {
    expect([classify(0.05, 0),classify(0.05001, 0),classify(0.1, 0.1),classify(0.10001, -0.10001)]).toEqual(['NONE','CURVE','CURVE','SUPER']);
    const s = createState();
    awardPlayerContact(s, true, classify(0.10001, -0.10001), false);
    expect([s.score, s.accuracyBonus, s.hitScore, s.curveBonus, s.superCurveBonus]).toEqual([350, 90, 90, 50, 135]);
    awardPlayerContact(s, false, classify(0.1, 0.1), true);
    expect([s.score, s.hitScore, s.curveBonus, s.superCurveBonus]).toEqual([400, 90, 45, 135]);
  });

  test('independent buckets award current value, decrease, and floor at zero', () => {
    const hit = createState(), accuracy = createState(), curve = createState(), superCurve = createState();
    for (let i = 0; i < 12; i++) {
      awardPlayerContact(hit, false, 'NONE', false);
      awardPlayerContact(accuracy, true, 'NONE', true);
      awardPlayerContact(curve, false, 'CURVE', true);
      awardPlayerContact(superCurve, false, 'SUPER', true);
    }
    expect([hit.score, hit.hitScore, accuracy.score, accuracy.accuracyBonus, curve.score, curve.curveBonus, superCurve.score, superCurve.superCurveBonus]).toEqual([550, 0, 550, 0, 275, 0, 825, 0]);
  });

  test('player miss immediately resets all buckets; ordinary enemy miss does not score or reset', () => {
    let s = createState(); Object.assign(s, { score: 500, hitScore: 20, curveBonus: 10, superCurveBonus: 30, accuracyBonus: 40 });
    s = miss(s, 'enemy');
    expect([s.score, s.hitScore, s.curveBonus, s.superCurveBonus, s.accuracyBonus]).toEqual([500, 20, 10, 30, 40]);
    s = hold(s);
    s = miss(s, 'player');
    expect([s.score, s.hitScore, s.curveBonus, s.superCurveBonus, s.accuracyBonus]).toEqual([500, 100, 50, 150, 100]);
  });

  test('enemy return has no direct score', () => {
    const s = createState(); s.phase = 'Rally'; s.ball.z = 74; s.ball.vz = 2;
    const result = step(s);
    expect(result.events.find(e => e.type === 'return')?.side).toBe('enemy');
    expect(result.state.score).toBe(0);
  });
});

describe('M2 level time bonus and replay', () => {
  test('waiting consumes nothing; decrement follows exactly 11 eligible updates', () => {
    let s = createState(); for (let i = 0; i < 40; i++) s = step(s).state;
    expect([s.remainingBonus, s.bonusCounter]).toEqual([3000, 10]);
    s = step(s, { type: 'down', ...center }).state;
    for (let i = 0; i < 9; i++) s = step(s).state;
    expect([s.remainingBonus, s.bonusCounter]).toEqual([3000, 0]);
    s = step(s).state;
    expect([s.remainingBonus, s.bonusCounter]).toEqual([2975, 10]);
  });

  test('miss-detection update consumes nothing and partial counter survives retry', () => {
    let s = createState(); s.bonusCounter = 0; s.remainingBonus = 2750;
    s = miss(s, 'enemy');
    expect([s.remainingBonus, s.bonusCounter]).toEqual([2750, 0]);
    s = hold(s);
    expect([s.remainingBonus, s.bonusCounter]).toEqual([2750, 0]);
    s = step(s).state;
    s = step(s, { type: 'down', ...center }).state;
    expect([s.remainingBonus, s.bonusCounter]).toEqual([2725, 10]);
  });

  test('level bonus floors at zero and stops consuming eligible ticks', () => {
    let s = createState(); s.phase = 'Rally'; s.ball.z = 10; s.ball.vz = 2;
    s.remainingBonus = 25; s.bonusCounter = 0;
    s = step(s).state;
    expect([s.remainingBonus, s.bonusCounter]).toEqual([0, 10]);
    for (let i = 0; i < 5; i++) s = step(s).state;
    expect([s.remainingBonus, s.bonusCounter]).toEqual([0, 10]);
  });

  test('render cadence does not change score, transitions, lives or events', () => {
    const run = (rate: number) => {
      const clock = new Clock(0); let s = createState(); s.playerLives = 1;
      const observed: unknown[] = [];
      const actions = new Map<number, Action>([[1,{type:'debug-miss',side:'enemy'}],[21,{type:'debug-miss',side:'enemy'}],
        [41,{type:'debug-miss',side:'enemy'}],[106,{type:'debug-miss',side:'player'}],[126,{type:'new-game'}]]);
      for (let frame = 1; frame <= rate * 5; frame++) {
        const now = frame === rate * 5 ? 5000 : frame * 1000 / rate;
        const due = clock.due(now);
        for (let i = 0; i < due; i++) {
          const action = actions.get(s.tick + 1);
          const result = tick(s, action ? [command(s, action)] : []);
          s = result.state; observed.push(result.events); clock.advance();
        }
      }
      expect(s.tick).toBe(150); expect(clock.paused).toBe(false);
      return { s, observed };
    };
    const expected = run(30);
    for (const rate of [15, 60, 120, 144]) expect(run(rate)).toEqual(expected);
  });

  test('M1 capture schema is rejected before replaying; malformed M2 campaign fields are rejected', () => {
    const capture = new Recorder(createState()).export();
    expect(capture.schema).toBe('curveball-m2-trace-2');
    const old = structuredClone(capture) as unknown as { schema: string };
    old.schema = 'curveball-m1-trace-1';
    expect(() => replay(old)).toThrow('Unknown trace schema/profile');
    for (const mutate of [
      (s: State) => { s.score = -1; },
      (s: State) => { s.playerLives = 1.5; },
      (s: State) => { s.bonusCounter = -1; },
      (s: State) => { s.accuracyBonus = 99; },
      (s: State) => { s.remainingBonus = 2999; },
      (s: State) => { s.phaseTick = s.tick + 1; },
    ]) {
      const bad = structuredClone(capture);
      mutate(bad.checkpoint);
      expect(() => replay(bad)).toThrow();
    }
  });

  test('scoring, both misses, level completion, game over and restart replay exactly', () => {
    let s = createState(); s.phase = 'Rally'; s.ball.z = 1; s.ball.vz = -2;
    const recorder = new Recorder(s, 600), observed: string[] = [];
    const run = (action?: Action) => { const commands = action ? [command(s, action)] : []; const result = tick(s, commands); s = result.state; recorder.record(commands, result); observed.push(...result.events.map(e => e.type)); };
    run();
    for (let i = 0; i < 3; i++) { run({ type: 'debug-miss', side: 'enemy' }); for (let j = 0; j < 19; j++) run(); }
    for (let j = 0; j < 45; j++) run();
    run(); run({ type: 'down', ...center });
    for (let i = 0; i < 5; i++) { run({ type: 'debug-miss', side: 'player' }); for (let j = 0; j < 19; j++) run(); }
    expect(s.phase).toBe('GameOver');
    expect(observed).toContain('return'); expect(observed).toContain('level-complete'); expect(observed).toContain('game-over');
    const finalScore = s.score;
    run({ type: 'new-game' });
    expect([s.level, s.score, s.playerLives]).toEqual([1, 0, 5]);
    expect(finalScore).toBeGreaterThan(0);
    expect(replay(JSON.parse(JSON.stringify(recorder.export())))).toEqual(s);
  });
});
