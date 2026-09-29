import { field, PROFILE, type Profile } from '../compat/profile';
import { DIAMETER, WALL_DIVISOR } from './constants';
import type { Ball, Box, Event, Point } from './types';
export function overlaps(a: Box, b: Box) { return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top; }
export function accurate(a: Point, b: Point) { return Math.abs(a.x - b.x) <= 7 && Math.abs(a.y - b.y) <= 5; }
export function classify(cx: number, cy: number): 'SUPER' | 'CURVE' | 'NONE' {
  return Math.abs(cx) > 0.10 && Math.abs(cy) > 0.10 ? 'SUPER' : Math.abs(cx) > 0.05 || Math.abs(cy) > 0.05 ? 'CURVE' : 'NONE';
}
export function walls(b: Ball, events: Event[], profile: Profile = PROFILE) {
  const f = field(profile), r = DIAMETER / 2;
  if (b.y - r < f.top) { b.y = f.top + r; b.vy = -b.vy; b.cy /= WALL_DIVISOR; events.push({ type: 'wall-top' }); }
  else if (b.y + r > f.bottom) { b.y = f.bottom - r; b.vy = -b.vy; b.cy /= WALL_DIVISOR; events.push({ type: 'wall-bottom' }); }
  if (b.x - r < f.left) { b.x = f.left + r; b.vx = -b.vx; b.cx /= WALL_DIVISOR; events.push({ type: 'wall-left' }); }
  else if (b.x + r > f.right) { b.x = f.right - r; b.vx = -b.vx; b.cx /= WALL_DIVISOR; events.push({ type: 'wall-right' }); }
}
