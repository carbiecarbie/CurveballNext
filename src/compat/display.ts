import type { Box, Point, Stamp } from '../core/types';
export interface DisplayAdapter {
  install(pose: Point & { width: number; height: number }, stamp: Stamp): Box;
  readPlayer(box: Box): Point;
}
export const display: DisplayAdapter = Object.freeze({
  install(pose: Point & { width: number; height: number }, stamp: Stamp) {
    return { ...pose, ...stamp, left: pose.x - pose.width / 2, right: pose.x + pose.width / 2,
      top: pose.y - pose.height / 2, bottom: pose.y + pose.height / 2 };
  },
  readPlayer(box: Box) { return { x: box.x, y: box.y }; },
});
