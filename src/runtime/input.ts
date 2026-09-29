import type { Action, Command } from '../core/types';
import { Clock } from './clock';
export class InputQueue {
  private sequence = 0;
  private queue: Command[] = [];
  private held = false;
  constructor(readonly clock: Clock) {}
  enqueue(action: Action, timestamp: number): Command | null {
    if (this.clock.paused) return null;
    const c: Command = { ...action, timestamp, sequence: ++this.sequence, ...this.clock.assign(timestamp) };
    this.queue.push(c); return c;
  }
  down(x: number, y: number, timestamp: number): Command | null {
    if (this.held || this.clock.paused) return null;
    this.held = true; return this.enqueue({ type: 'down', x, y }, timestamp);
  }
  up() { this.held = false; }
  take(tick: number): Command[] {
    const commands = this.queue.filter(c => c.tick === tick).sort((a,b) => a.timestamp - b.timestamp || a.sequence - b.sequence);
    this.queue = this.queue.filter(c => c.tick > tick); return commands;
  }
  clear() { this.queue = []; this.held = false; }
}
export function normalizeTimestamp(timestamp: number, now: number, timeOrigin: number) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return now;
  return timestamp > 1e12 ? timestamp - timeOrigin : timestamp;
}
export function mouseSamples<T extends { getCoalescedEvents?: () => T[] }>(event: T): T[] {
  const samples = event.getCoalescedEvents?.(); return samples?.length ? samples : [event];
}
