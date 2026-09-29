import { describe, expect, test, vi } from 'vitest';
import { retry } from '../src/core/lifecycle';
import { createState } from '../src/core/state';
import * as simulation from '../src/core/tick';
import type { Action, State } from '../src/core/types';
import { replay, validateState } from '../src/debug/replay';
import { Recorder } from '../src/debug/trace';

function recordFrom(initial: State) {
  let state = initial;
  const recorder = new Recorder(state);
  return {
    get state() { return state; },
    recorder,
    step(action?: Action) {
      const commands = action ? [{ ...action, tick: state.tick + 1, sequence: state.tick + 1, timestamp: state.tick + 1, late: false }] : [];
      const result = simulation.tick(state, commands);
      recorder.record(commands, result); state = result.state;
      return result;
    },
  };
}

describe('F1 mandatory depletion resolution owns the pending miss', () => {
  test.each([
    ['player', 1, 'GameOver'], ['enemy', 1, 'LevelIntro'], ['enemy', 10, 'ContentComplete'],
  ] as const)('%s depletion at level %s rejects Retry until %s, with exact replay', (side, level, phase) => {
    const initial = createState(level);
    initial[side === 'player' ? 'playerLives' : 'enemyLives'] = 1;
    initial.score = 125; initial.remainingBonus = 2750;
    const run = recordFrom(initial);
    run.step({ type: 'debug-miss', side });
    const pending = structuredClone(run.state);
    expect(pending.phase).toBe('MissHold');
    expect(pending[side === 'player' ? 'playerLives' : 'enemyLives']).toBe(0);

    // Even direct lifecycle callers must not discard a mandatory resolution.
    const direct = structuredClone(pending);
    retry(direct);
    expect(direct).toEqual(pending);
    for (let elapsed = 1; elapsed < 19; elapsed++) {
      const result = run.step({ type: 'retry' });
      expect(result.events.some(e => e.type === 'retry')).toBe(false);
      expect(run.state).toMatchObject({ phase: 'MissHold', missTick: pending.missTick,
        rally: pending.rally, ball: { generation: pending.ball.generation },
        playerLives: pending.playerLives, enemyLives: pending.enemyLives, score: 125 });
    }
    const resolved = run.step({ type: 'retry' });
    expect(resolved.events.some(e => e.type === 'retry')).toBe(false);
    expect(run.state.phase).toBe(phase);
    expect(run.state.tick).toBe(pending.missTick! + 19);
    expect(run.state.score).toBe(side === 'enemy' ? 2875 : 125);
    expect(run.state.playerLives).toBe(pending.playerLives);
    expect(run.state.enemyLives).toBe(side === 'enemy' ? level === 10 ? 0 : 3 : 3);
    if (phase === 'LevelIntro') expect(run.state.level).toBe(2);

    // Supported inputs after Game Over cannot produce another loss or negative lives.
    for (let i = 0; i < 50; i++) {
      run.step(side === 'player' && i % 3 === 0 ? { type: 'debug-miss', side: 'player' }
        : side === 'player' && i % 3 === 1 ? { type: 'down', x: 175.5, y: 125.5 } : { type: 'retry' });
      expect(run.state.playerLives).toBeGreaterThanOrEqual(0);
      expect(run.state.enemyLives).toBeGreaterThanOrEqual(0);
    }
    expect(run.state.score).toBe(side === 'enemy' ? 2875 : 125);
    const capture = JSON.parse(JSON.stringify(run.recorder.export()));
    expect(capture.records.flatMap((r: { events: { type: string }[] }) => r.events).filter((e: { type: string }) => e.type === 'level-complete')).toHaveLength(side === 'enemy' ? 1 : 0);
    expect(replay(capture)).toEqual(run.state);
  });

  test('Retry cannot bypass the enemy-first branch of an injected dual depletion', () => {
    const initial = createState();
    initial.phase = 'MissHold'; initial.missTick = initial.phaseTick = initial.tick;
    initial.playerLives = initial.enemyLives = 0;
    const run = recordFrom(initial);
    for (let i = 0; i < 19; i++) run.step({ type: 'retry' });
    expect(run.state).toMatchObject({ phase: 'LevelIntro', level: 2, score: 3000, playerLives: 0, enemyLives: 3 });
    expect(replay(run.recorder.export())).toEqual(run.state);
  });

  test.each(['player', 'enemy'] as const)('ordinary %s MissHold still accepts immediate Retry and preserves same-level state', side => {
    const run = recordFrom(createState());
    run.step({ type: 'debug-miss', side });
    const pending = structuredClone(run.state);
    const result = run.step({ type: 'retry' });
    expect(result.events).toContainEqual({ type: 'retry' });
    expect(run.state).toMatchObject({ phase: 'ServeWaiting', missTick: null, rally: pending.rally + 1,
      ball: { generation: pending.ball.generation + 1 }, level: pending.level,
      playerLives: pending.playerLives, enemyLives: pending.enemyLives, score: pending.score,
      remainingBonus: pending.remainingBonus, bonusCounter: pending.bonusCounter,
      hitScore: pending.hitScore, curveBonus: pending.curveBonus, superCurveBonus: pending.superCurveBonus, accuracyBonus: pending.accuracyBonus });
    expect(replay(run.recorder.export())).toEqual(run.state);
  });
});

function levelIntro() {
  const initial = createState(); initial.enemyLives = 1;
  const run = recordFrom(initial);
  run.step({ type: 'debug-miss', side: 'enemy' });
  for (let i = 0; i < 19; i++) run.step();
  expect(run.state.phase).toBe('LevelIntro');
  return run.state;
}

describe('F2 LevelIntro checkpoint motion invariants', () => {
  test.each([
    ['ball', 'vx'], ['ball', 'vy'], ['ball', 'vz'], ['ball', 'cx'], ['ball', 'cy'],
    ['publishedBall', 'vx'], ['publishedBall', 'vy'], ['publishedBall', 'vz'],
  ] as const)('rejects nonzero %s.%s before executing any replay tick', (object, field) => {
    const run = recordFrom(levelIntro()); run.step();
    const capture = run.recorder.export();
    const motion = capture.checkpoint[object] as unknown as Record<string, number>;
    motion[field] = 2;
    const spy = vi.spyOn(simulation, 'tick');
    try {
      expect(() => validateState(capture.checkpoint)).toThrow('Invalid LevelIntro motion');
      expect(() => replay(capture)).toThrow('Invalid LevelIntro motion');
      expect(spy).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });

  test('legitimate LevelIntro replays all 45 intervals into stopped serve waiting', () => {
    const run = recordFrom(levelIntro());
    expect(() => validateState(run.state)).not.toThrow();
    for (let i = 0; i < 44; i++) run.step();
    expect(run.state.phase).toBe('LevelIntro');
    run.step();
    expect(run.state).toMatchObject({ phase: 'ServeWaiting', ball: { vx: 0, vy: 0, vz: 0, cx: 0, cy: 0 }, remainingBonus: 3000, bonusCounter: 10 });
    expect(replay(JSON.parse(JSON.stringify(run.recorder.export())))).toEqual(run.state);
  });

  test('synthetic Rally motion remains valid', () => {
    const s = createState(); s.phase = 'Rally';
    Object.assign(s.ball, { z: 22.5, vx: 1.5, vy: -0.75, vz: 2, cx: 0.1, cy: -0.2 });
    Object.assign(s.publishedBall, { vx: 1.25, vy: -0.5, vz: 2 });
    expect(() => validateState(s)).not.toThrow();
    expect(replay(new Recorder(s).export())).toEqual(s);
  });
});
