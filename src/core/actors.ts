import { display, type DisplayAdapter } from '../compat/display';
import { field, PROFILE, type Profile } from '../compat/profile';
import { DEPTH, difficulty, PADDLE } from './constants';
import { project } from './projection';
import type { Paddle, Point, State } from './types';
function move(p: Paddle, target: Point, divisor: number, z: number, tick: number, profile: Profile, adapter: DisplayAdapter, readback: boolean) {
  const f = field(profile);
  const y = Math.max(f.top + PADDLE.height / 2, Math.min(f.bottom - PADDLE.height / 2, p.y - (p.y - target.y) / divisor));
  const x = Math.max(f.left + PADDLE.width / 2, Math.min(f.right - PADDLE.width / 2, p.x - (p.x - target.x) / divisor));
  p.box = adapter.install(project(x, y, z, PADDLE.width, PADDLE.height, profile), { tick, generation: p.generation });
  const committed = readback ? adapter.readPlayer(p.box) : { x, y };
  p.x = committed.x; p.y = committed.y;
  p.dx = p.x - p.previous.x; p.dy = p.y - p.previous.y;
  p.previous = { x: p.x, y: p.y }; p.tick = tick;
}
export function playerStep(s: State, profile: Profile = PROFILE, adapter: DisplayAdapter = display) {
  move(s.player, s.target, 1.5, 0, s.tick, profile, adapter, true);
}
export function enemyStep(s: State, profile: Profile = PROFILE, adapter: DisplayAdapter = display) {
  const toward = s.publishedBall.vz > 0;
  move(s.enemy, toward ? s.publishedBall : field(profile), toward ? difficulty(s.level).ai : 15, DEPTH, s.tick, profile, adapter, false);
}
