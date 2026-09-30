import { describe, expect, test, vi } from 'vitest';
import { createState } from '../src/core/state';
import { tick } from '../src/core/tick';
import type { Command, Event, Phase } from '../src/core/types';
import { Recorder } from '../src/debug/trace';
import { replay } from '../src/debug/replay';
import { draw } from '../src/presentation/canvas';
import { Sound, soundCues } from '../src/presentation/audio';
import { bonusNotice, createFeedback, observe, orbActivity, pulse } from '../src/presentation/feedback';
import { screenFor } from '../src/presentation/screens';

describe('M3 presentation isolation', () => {
  test('title and pause stay outside campaign state; terminal results survive host suspension', () => {
    const state = createState(), before = structuredClone(state);
    expect(screenFor(state, true, true, 'title-screen')?.action).toBe('new-game');
    expect(screenFor(state, false, true, 'window-blur')?.action).toBe('resume');
    expect(screenFor(state, false, false, '')).toBeNull();
    expect(state).toEqual(before);
    for (const phase of ['GameOver', 'ContentComplete'] as const) {
      expect(screenFor({ ...state, phase }, false, true, 'window-blur')?.kind).toBe(phase);
      expect(screenFor({ ...state, phase }, false, true, 'window-blur')?.action).toBe('new-game');
    }
  });
  test('level-intro progress follows the accepted 45 ticks and freezes on host pause', () => {
    const state = { ...createState(2), phase: 'LevelIntro' as const, tick: 122, phaseTick: 100 };
    expect(screenFor(state, false, false, '')?.progress).toBe(22 / 45);
    expect(screenFor(state, false, true, 'manual')?.kind).toBe('Paused');
    expect(screenFor({ ...state, tick: 145 }, false, false, '')?.progress).toBe(1);
  });
  test('actual wall and paddle events drive bounded visual pulses; reset clears them', () => {
    const feedback = createFeedback();
    const events: Event[] = [{ type: 'wall-top' }, { type: 'wall-right' }, { type: 'return', side: 'enemy' }];
    const before = structuredClone(events);
    observe(feedback, events, 30);
    expect(feedback).toMatchObject({ impactTick: 30, wallTick: 30, enemyTick: 30, playerTick: -100 });
    expect([pulse(30, 30), pulse(34, 30), pulse(38, 30), pulse(80, 30)]).toEqual([1, 0.5, 0, 0]);
    expect(events).toEqual(before);
    observe(feedback, [{ type: 'new-game' }], 31); expect(feedback).toEqual(createFeedback());
  });
  test('orb activity reads speed/curve/impact without changing ball data', () => {
    const state = createState(), feedback = createFeedback(), before = structuredClone(state);
    const calm = orbActivity(state, feedback, 0);
    const fast = orbActivity({ ...state, ball: { ...state.ball, vx: 12, cx: 0.6 } }, feedback, 0);
    expect(calm).toMatchObject({ speed: 0, spin: 0, impact: 0 });
    expect(fast).toMatchObject({ speed: 1, spin: 1 });
    observe(feedback, [{ type: 'serve', side: 'player' }], 10);
    expect(orbActivity(state, feedback, 10).impact).toBe(1);
    expect(state).toEqual(before);
  });
  test.each([
    ['serve', true, 'NONE', 'ACCURACY BONUS'], ['return', false, 'CURVE', 'CURVE BONUS'],
    ['serve', true, 'CURVE', 'CURVE BONUS'], ['return', true, 'SUPER', 'SUPER CURVE BONUS'],
  ] as const)('accepted %s: accuracy %s / curve %s displays %s in one slot', (type, accurate, curve, label) => {
    const feedback = createFeedback(), events: Event[] = [{ type, side: 'player', accurate, curve }];
    const before = structuredClone(events);
    observe(feedback, events, 10);
    expect(bonusNotice(feedback, 10)).toEqual({ label, opacity: 1 });
    expect(events).toEqual(before);
  });
  test('notice expires on active ticks, replaces the prior notice, and ignores unrelated contacts', () => {
    const feedback = createFeedback();
    observe(feedback, [{ type: 'serve', side: 'player', accurate: true, curve: 'NONE' }], 10);
    expect(bonusNotice(feedback, 38)?.opacity).toBe(1);
    expect(bonusNotice(feedback, 42)?.opacity).toBe(0.5);
    expect(bonusNotice(feedback, 46)).toBeNull();
    observe(feedback, [{ type: 'return', side: 'player', curve: 'SUPER' }], 43);
    const notice = bonusNotice(feedback, 43);
    observe(feedback, [{ type: 'return', side: 'enemy', curve: 'CURVE', accurate: true },
      { type: 'serve-rejected', curve: 'SUPER' }, { type: 'wall-left' }, { type: 'return', side: 'player', curve: 'NONE', accurate: false }], 44);
    expect(bonusNotice(feedback, 44)).toEqual(notice);
  });
  test.each(['new-game', 'reset', 'retry', 'auto-retry', 'miss', 'level-intro', 'game-over', 'content-complete'])(
    '%s clears stale bonus feedback', type => {
      const feedback = createFeedback();
      observe(feedback, [{ type: 'serve', side: 'player', curve: 'SUPER' }], 10);
      observe(feedback, [{ type }], 11);
      expect(bonusNotice(feedback, 11)).toBeNull();
    },
  );
  test('actual accepted contact qualification still shows a notice when award buckets are exhausted', () => {
    const state = tick(createState()).state;
    state.accuracyBonus = state.curveBonus = state.superCurveBonus = 0;
    state.cache!.player.dx = -3; state.cache!.player.dy = 3;
    const result = tick(state, [{ type: 'down', x: 175.5, y: 125.5, tick: 2, sequence: 1, timestamp: 67, late: false }]);
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'serve', accurate: true, curve: 'SUPER' }));
    expect(result.state.score).toBe(0);
    const before = structuredClone(result), feedback = createFeedback();
    observe(feedback, result.events, result.state.tick);
    expect(bonusNotice(feedback, result.state.tick)?.label).toBe('SUPER CURVE BONUS');
    expect(result).toEqual(before);
  });
  test.each(['ServeWaiting', 'Rally', 'MissHold', 'LevelIntro', 'GameOver', 'ContentComplete'] as Phase[])(
    'full renderer leaves frozen %s snapshots untouched across view/DPR/debug modes', phase => {
      const state = { ...createState(), phase }, previous = tick(createState()).state;
      const freeze = (value: object) => { Object.freeze(value); for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child); };
      freeze(state); freeze(previous);
      const feedback = Object.freeze(createFeedback());
      const ctx = new Proxy({}, { get: (_target, key) => key === 'createRadialGradient' || key === 'createLinearGradient'
        ? () => ({ addColorStop: () => undefined }) : () => undefined, set: () => true });
      const canvas = { width: 0, height: 0, getContext: () => ctx, getBoundingClientRect: () => ({ width: 700, height: 500 }) } as unknown as HTMLCanvasElement;
      try {
        for (const dpr of [1, 2]) {
          vi.stubGlobal('window', { devicePixelRatio: dpr });
          for (const smooth of [false, true]) for (const debug of [false, true]) for (const alpha of [0, 0.5, 1]) {
            expect(() => draw(canvas, state, previous, alpha, smooth, false, debug, feedback)).not.toThrow();
          }
        }
      } finally { vi.unstubAllGlobals(); }
    },
  );
  test('feedback/screens/audio observation leave the canonical replay exactly unchanged', () => {
    let observed = createState(), plain = createState();
    const recorder = new Recorder(observed), feedback = createFeedback();
    for (let n = 1; n <= 220; n++) {
      const commands: Command[] = n === 2 ? [{ type: 'down', x: 175.5, y: 125.5, tick: n, sequence: n, timestamp: n * 34, late: false }]
        : n === 100 ? [{ type: 'debug-miss', side: 'player', tick: n, sequence: n, timestamp: n * 34, late: false }] : [];
      const result = tick(observed, commands); observed = result.state;
      recorder.record(commands, result); observe(feedback, result.events, n);
      for (const alpha of [0, 0.3, 0.8, 1]) { orbActivity(observed, feedback, n + alpha); bonusNotice(feedback, n + alpha); screenFor(observed, false, false, ''); soundCues(result.events); }
      plain = tick(plain, commands).state;
    }
    expect(observed).toEqual(plain); expect(replay(recorder.export())).toEqual(plain);
  });
  test('sound observes actual event order, with no rejected-serve or duplicate transition cue', () => {
    expect(soundCues([{ type: 'serve-rejected' }, { type: 'debug-inject' }, { type: 'wall-top' }, { type: 'wall-left' },
      { type: 'return', side: 'player' }, { type: 'miss' }, { type: 'level-complete' }, { type: 'level-intro' }]))
      .toEqual(['wall', 'wall', 'player', 'miss', 'level']);
    expect(soundCues([{ type: 'serve' }, { type: 'return', side: 'enemy' }, { type: 'game-over' }, { type: 'content-complete' }]))
      .toEqual(['serve', 'enemy', 'over', 'complete']);
  });
  test('unsupported audio is contained and muted audio never initializes a context', async () => {
    const sound = new Sound();
    sound.toggle(); await sound.unlock(); expect(sound.available).toBe(true);
    // Node has no AudioContext. Failure must resolve without leaking into the host tick.
    sound.toggle(); await sound.unlock(); expect(sound.available).toBe(false);
    expect(() => sound.play([{ type: 'serve' }])).not.toThrow();
  });
  test('metallic partials stay short and bounded; mute cancels every active/scheduled voice', async () => {
    const voices: { pitch: number; end: number; stopped: number; onended?: () => void }[] = [];
    const parameter = { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} };
    class MockAudio {
      state = 'running'; currentTime = 0; destination = {};
      createOscillator() {
        const voice = { pitch: 0, end: 0, stopped: 0, onended: undefined as (() => void) | undefined };
        voices.push(voice);
        return Object.assign(voice, { frequency: { ...parameter, setValueAtTime(value: number) { voice.pitch = value; } },
          connect() {}, disconnect() {}, start() {}, stop(end = 0) { voice.end = end; voice.stopped++; } });
      }
      createGain() { return { gain: parameter, connect() {}, disconnect() {} }; }
    }
    vi.stubGlobal('AudioContext', MockAudio);
    try {
      const sound = new Sound(); await sound.unlock();
      sound.play([{ type: 'return', side: 'player' }]);
      expect(voices).toHaveLength(3);
      expect(voices.every(v => v.end > 0 && v.end <= 0.065)).toBe(true);
      sound.play(Array.from({ length: 20 }, () => ({ type: 'wall-top' })));
      expect(voices).toHaveLength(24);
      sound.toggle(); expect(voices.every(v => v.stopped === 2)).toBe(true);
      sound.play([{ type: 'content-complete' }]); expect(voices).toHaveLength(24);
      for (const voice of voices) voice.onended?.();
    } finally { vi.unstubAllGlobals(); }
  });
  test('a failed oscillator and cancellation cannot escape into gameplay', async () => {
    const parameter = { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} };
    class BrokenAudio {
      state = 'running'; currentTime = 0; destination = {};
      createOscillator() { return { frequency: parameter, connect() {}, start() { throw new Error('Audio failed'); }, stop() { throw new Error('Never started'); } }; }
      createGain() { return { gain: parameter, connect() {} }; }
    }
    vi.stubGlobal('AudioContext', BrokenAudio);
    try {
      const sound = new Sound(); await sound.unlock();
      expect(() => sound.play([{ type: 'serve' }])).not.toThrow();
      expect(sound.available).toBe(false); expect(() => sound.silence()).not.toThrow();
    } finally { vi.unstubAllGlobals(); }
  });
});
