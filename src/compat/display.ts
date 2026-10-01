import type { Box, Point, Stamp } from '../core/types';
interface Pose extends Point { width: number; height: number; sourceWidth?: number; sourceHeight?: number }
export interface DisplayAdapter {
  install(pose: Pose, stamp: Stamp): Box;
  readInput?(point: Point): Point;
}
// Pinned Ruffle's axis-aligned matrix path uses f32 and ties-to-even twip bounds.
// This is a provisional runtime policy, not proof of historical Flash equivalence.
export function roundEven(value: number): number {
  const floor = Math.floor(value), remainder = value - floor;
  return remainder === .5 ? floor % 2 === 0 ? floor : floor + 1 : Math.round(value);
}
const twips = (pixels: number) => Math.max(-2147483648, Math.min(2147483647, Math.trunc(pixels * 20)));
/** Raw bounds before pixel division; online contact must retain these integers. */
export function installTwips(pose: Pose): [number, number, number, number] {
  const tx = twips(pose.x), ty = twips(pose.y);
  const half = (size: number, source: number) => roundEven(Math.fround(Math.fround(size / source) * Math.fround(source * 10)));
  const hx = half(pose.width, pose.sourceWidth ?? pose.width), hy = half(pose.height, pose.sourceHeight ?? pose.height);
  return [tx - hx, tx + hx, ty - hy, ty + hy];
}
export const display: DisplayAdapter = Object.freeze({
  install(pose: Pose, stamp: Stamp) {
    const tx = twips(pose.x), ty = twips(pose.y);
    const half = (size: number, source: number) => roundEven(Math.fround(Math.fround(size / source) * Math.fround(source * 10)));
    const hx = half(pose.width, pose.sourceWidth ?? pose.width), hy = half(pose.height, pose.sourceHeight ?? pose.height);
    return { x: tx / 20, y: ty / 20, width: hx / 10, height: hy / 10, ...stamp,
      left: (tx - hx) / 20, right: (tx + hx) / 20, top: (ty - hy) / 20, bottom: (ty + hy) / 20 };
  },
  readInput(point: Point) {
    const pixel = (v: number) => roundEven(Math.fround(Math.fround(1 / 20) * Math.fround(twips(v))));
    return { x: pixel(point.x), y: pixel(point.y) };
  },
});
