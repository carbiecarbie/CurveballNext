import { INITIAL_AWARDS, INITIAL_BONUS } from './constants';
import type { Event, State } from './types';

type Award = keyof typeof INITIAL_AWARDS;
const DECREMENT: Record<Award, number> = { hitScore: 10, curveBonus: 5, superCurveBonus: 15, accuracyBonus: 10 };

export function resetAwards(s: State) { Object.assign(s, INITIAL_AWARDS); }
export function resetLevelBonus(s: State) { s.remainingBonus = INITIAL_BONUS; s.bonusCounter = 10; }

function award(s: State, bucket: Award) {
  s.score += s[bucket];
  s[bucket] = Math.max(0, s[bucket] - DECREMENT[bucket]);
}

/** Award order follows the recovered player-contact action order. */
export function awardPlayerContact(s: State, accurate: boolean, curve: Event['curve'], isServe: boolean) {
  if (accurate) award(s, 'accuracyBonus');
  if (!isServe) award(s, 'hitScore');
  if (curve === 'SUPER') award(s, 'superCurveBonus');
  else if (curve === 'CURVE') award(s, 'curveBonus');
}

/** Called after response, so a miss has already stopped depth velocity. */
export function advanceLevelBonus(s: State) {
  if (s.ball.vz !== 0 && s.remainingBonus > 0) s.bonusCounter--;
  if (s.bonusCounter < 0) {
    s.bonusCounter = 10;
    s.remainingBonus = Math.max(0, s.remainingBonus - 25);
  }
}
