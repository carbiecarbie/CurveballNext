export const HZ = 30;
export interface Suspension { at: number; tick: number; reason: string }
/** Boundaries are computed from the epoch, never by accumulating rounded periods. */
export class Clock {
  paused = false;
  reason = '';
  readonly history: Suspension[] = [];
  private epoch: number;
  private baseTick: number;
  completed: number;
  constructor(now: number, completed = 0) { this.epoch = now; this.completed = this.baseTick = completed; }
  boundary(tick: number) { return this.epoch + (tick - this.baseTick) * 1000 / HZ; }
  assign(timestamp: number) {
    if (!Number.isFinite(timestamp)) throw new Error('Invalid timestamp');
    let nominal = this.baseTick + Math.max(1, Math.ceil((timestamp - this.epoch) * HZ / 1000));
    // Correct floating-point quotient rounding by comparing actual boundaries.
    while (this.boundary(nominal) < timestamp) nominal++;
    while (nominal > this.baseTick + 1 && this.boundary(nominal - 1) >= timestamp) nominal--;
    return { tick: Math.max(this.completed + 1, nominal), late: nominal <= this.completed };
  }
  due(now: number): number {
    if (this.paused) return 0;
    let due = 0;
    while (due <= 5 && this.boundary(this.completed + due + 1) <= now) due++;
    if (due > 5) { this.suspend(now, 'timing-overrun'); return 0; }
    return due;
  }
  advance() { this.completed++; }
  suspend(now: number, reason: string) {
    if (!this.paused) this.history.push({ at: now, tick: this.completed, reason });
    this.paused = true; this.reason = reason;
  }
  resume(now: number) { this.epoch = now; this.baseTick = this.completed; this.paused = false; this.reason = ''; this.history.push({ at: now, tick: this.completed, reason: 'resume' }); }
  alpha(now: number) { return this.paused ? 1 : Math.max(0, Math.min(1, (now - this.boundary(this.completed)) * HZ / 1000)); }
}
