import { display, type DisplayAdapter } from '../compat/display';
import { field, PROFILE, type Profile } from '../compat/profile';
import { DEPTH, DIAMETER, difficulty, PADDLE } from './constants';
import { project } from './projection';
import type { Ball, Paddle, PublishedBall, Sample, State } from './types';
export function sample(p: Paddle): Sample { return { x: p.x, y: p.y, dx: p.dx, dy: p.dy, tick: p.tick, generation: p.generation }; }
export function publish(b: Ball, tick: number): PublishedBall {
  return { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, tick, generation: b.generation };
}
export function freshBall(tick: number, generation: number, profile: Profile = PROFILE, adapter: DisplayAdapter = display): Ball {
  const { x, y } = field(profile);
  return { x, y, z: 0, vx: 0, vy: 0, vz: 0, cx: 0, cy: 0, generation,
    box: adapter.install(project(x, y, 0, DIAMETER, DIAMETER, profile), { tick, generation }) };
}
export function createState(level = 1, tick = 0, trial = 1, ballGeneration = 1, profile: Profile = PROFILE, adapter: DisplayAdapter = display): State {
  difficulty(level);
  const { x, y } = field(profile);
  const paddle = (z: number): Paddle => ({ x, y, dx: 0, dy: 0, previous: { x, y }, tick, generation: trial,
    box: adapter.install(project(x, y, z, PADDLE.width, PADDLE.height, profile), { tick, generation: trial }) });
  const ball = freshBall(tick, ballGeneration, profile, adapter);
  return { profile: profile.id, tick, trial, rally: 1, level, phase: 'ServeWaiting', missTick: null, target: { x, y },
    player: paddle(0), enemy: paddle(DEPTH), ball, publishedBall: publish(ball, tick), cache: null,
    diagnostics: { rallyReturns: 0, returns: 0, playerMisses: 0, enemyMisses: 0 } };
}
export function assertFinite(value: unknown): void {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Nonfinite simulation data');
  if (value && typeof value === 'object') for (const v of Object.values(value)) assertFinite(v);
}
