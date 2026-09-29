export const DEPTH = 75;
export const DIAMETER = 30;
export const PADDLE = Object.freeze({ width: 60, height: 40 });
export const DECAY = 1.004;
export const WALL_DIVISOR = (DECAY - 1) * 50 + 1;
export const PROJECTION_A = 31.066017;
export const PI = 3.141592653589793;
export const LEVEL_INTRO_TICKS = 45;
export const INITIAL_AWARDS = Object.freeze({ hitScore: 100, curveBonus: 50, superCurveBonus: 150, accuracyBonus: 100 });
export const INITIAL_BONUS = 3000;
export const DIFFICULTIES = Object.freeze([
  [2, 25, 17], [2.33, 22.5, 14], [2.66, 20, 11], [3, 17.5, 9], [3.33, 15, 7],
  [3.66, 12.5, 5], [4, 10, 3.5], [4.33, 10, 2.75], [4.66, 10, 2], [6, 10, 1],
].map(([speed, curve, ai]) => Object.freeze({ speed, curve, ai })));
export function difficulty(level: number) {
  if (!Number.isInteger(level) || level < 1 || level > 10) throw new Error('Invalid difficulty');
  return DIFFICULTIES[level - 1];
}
