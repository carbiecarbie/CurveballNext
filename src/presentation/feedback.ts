import type { Event, State } from '../core/types';

/** Cosmetic event memory only. Never stored in a core snapshot or replay. */
export interface Feedback {
  impactTick: number;
  wallTick: number;
  playerTick: number;
  enemyTick: number;
  bonus: { label: 'ACCURACY BONUS' | 'CURVE BONUS' | 'SUPER CURVE BONUS'; tick: number } | null;
}
export function createFeedback(): Feedback {
  return { impactTick: -100, wallTick: -100, playerTick: -100, enemyTick: -100, bonus: null };
}
export function observe(feedback: Feedback, events: readonly Event[], tick: number): void {
  for (const event of events) {
    if (event.type === 'new-game' || event.type === 'reset') Object.assign(feedback, createFeedback());
    if (['retry', 'auto-retry', 'miss', 'level-intro', 'game-over', 'content-complete'].includes(event.type)) feedback.bonus = null;
    if (event.type.startsWith('wall-')) feedback.wallTick = feedback.impactTick = tick;
    if (event.type === 'serve' || event.type === 'return') {
      feedback.impactTick = tick;
      if (event.side === 'enemy') feedback.enemyTick = tick;
      else feedback.playerTick = tick;
      // Accepted player contacts already report qualification, even when an award bucket is zero.
      // Curve follows accuracy in the recovered scoring order and occupies the single notice slot.
      if (event.side === 'player') {
        const label = event.curve === 'SUPER' ? 'SUPER CURVE BONUS' : event.curve === 'CURVE' ? 'CURVE BONUS'
          : event.accurate ? 'ACCURACY BONUS' : null;
        if (label) feedback.bonus = { label, tick };
      }
    }
  }
}
/** New fixed HUD treatment: 1.2 active seconds, with a short fade; host pause freezes ticks. */
export function bonusNotice(feedback: Readonly<Feedback>, now: number) {
  const bonus = feedback.bonus;
  if (!bonus || now - bonus.tick >= 36) return null;
  return { label: bonus.label, opacity: Math.min(1, pulse(now, bonus.tick + 28, 8)) };
}
export function pulse(now: number, at: number, duration = 8): number {
  return Math.max(0, 1 - Math.max(0, now - at) / duration);
}
export function orbActivity(state: Readonly<State>, feedback: Readonly<Feedback>, time: number) {
  return {
    speed: Math.min(1, Math.hypot(state.ball.vx, state.ball.vy, state.ball.vz) / 12),
    spin: Math.min(1, Math.hypot(state.ball.cx, state.ball.cy) / 0.6),
    bias: Math.atan2(-state.ball.cy, state.ball.cx),
    impact: pulse(time, feedback.impactTick),
  };
}
