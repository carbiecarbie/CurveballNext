import { LEVEL_INTRO_TICKS } from '../core/constants';
import type { State } from '../core/types';

export function screenFor(state: Readonly<State>, title: boolean, paused: boolean, reason: string) {
  if (title) return {
    kind: 'Title', kicker: 'ENTER THE CIRCUIT', heading: 'CURVEBALL',
    copy: 'Meet the ball. Bend the rally.', stats: '',
    note: 'Mouse to move · Click to serve · Esc to pause', action: 'new-game', progress: 0,
  };
  // Terminal results stay visible even if the host subsequently loses focus.
  if (state.phase === 'GameOver') return {
    kind: state.phase, kicker: 'END OF RUN', heading: 'GAME OVER',
    copy: 'The circuit is ready for another run.', stats: `Score ${state.score} · Level ${state.level}`,
    note: 'New Game starts at level 1 with five player lives.', action: 'new-game', progress: 0,
  };
  if (state.phase === 'ContentComplete') return {
    kind: state.phase, kicker: 'ALL TEN DEFINED LEVELS CLEARED', heading: 'CIRCUIT COMPLETE',
    copy: 'You reached the end of the defined original level data.', stats: `Score ${state.score} · Lives ${state.playerLives}`,
    note: 'CurveballNext ends here. The original post-level-10 behavior remains unverified.', action: 'new-game', progress: 0,
  };
  if (paused) return {
    kind: 'Paused', kicker: 'RALLY ON HOLD', heading: 'PAUSED', stats: '', action: 'resume', progress: 0,
    copy: reason === 'manual' || reason === 'keyboard' ? 'Take a breath. Your rally is waiting.' : 'Play paused while the window was away or timing fell behind.',
    note: 'Resume to continue · No serve is triggered by resuming',
  };
  if (state.phase === 'LevelIntro') return {
    kind: state.phase, kicker: 'NEXT CIRCUIT', heading: `LEVEL ${String(state.level).padStart(2, '0')}`,
    copy: 'Meet the ball. Keep the curve.', stats: `${state.playerLives} player lives · 3 enemy lives`,
    note: 'Get ready to serve', action: '',
    progress: Math.min(1, Math.max(0, (state.tick - state.phaseTick) / LEVEL_INTRO_TICKS)),
  };
  return null;
}
