import { PI, PROJECTION_A } from './constants';
import { field, PROFILE, type Profile } from '../compat/profile';
export function scale(z: number) { return (90 - Math.atan(z / PROJECTION_A) * 180 / PI) / 90; }
export function project(x: number, y: number, z: number, width: number, height: number, profile: Profile = PROFILE) {
  const c = field(profile), g = scale(z);
  return { x: c.x + (x - c.x) * g, y: c.y + (y - c.y) * g, width: width * g, height: height * g, sourceWidth: width, sourceHeight: height };
}
