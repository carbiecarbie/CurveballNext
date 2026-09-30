import type { Event } from '../core/types';

type Cue = 'serve' | 'player' | 'enemy' | 'wall' | 'miss' | 'level' | 'over' | 'complete';
interface Strike { frequency: number; duration: number; delay: number; bend: number; gain: number }
const strike = (frequency: number, duration = 0.065, delay = 0, bend = 0.92, gain = 0.034): Strike => ({ frequency, duration, delay, bend, gain });
// Independently authored, short inharmonic resonances. These approximate an arcade material,
// not the original waveform or its unverified audiovisual timing.
const strikes: Record<Cue, Strike[]> = {
  serve: [strike(780, 0.075, 0, 1.12)],
  player: [strike(980)], enemy: [strike(730)], wall: [strike(460, 0.045, 0, 0.88, 0.023)],
  miss: [strike(260, 0.12, 0, 0.52, 0.03)],
  level: [strike(660, 0.08), strike(990, 0.09, 0.075)],
  over: [strike(330, 0.09, 0, 0.7), strike(165, 0.13, 0.09, 0.6)],
  complete: [strike(660, 0.08), strike(990, 0.08, 0.075), strike(1320, 0.12, 0.15)],
};
const partials = [{ ratio: 1, gain: 1 }, { ratio: 2.41, gain: 0.46 }, { ratio: 4.13, gain: 0.22 }];
export function soundCues(events: readonly Event[]): Cue[] {
  return events.flatMap(event => {
    if (event.type === 'serve') return ['serve'];
    if (event.type === 'return') return [event.side === 'enemy' ? 'enemy' : 'player'];
    if (event.type.startsWith('wall-')) return ['wall'];
    if (event.type === 'miss') return ['miss'];
    if (event.type === 'level-intro') return ['level'];
    if (event.type === 'game-over') return ['over'];
    if (event.type === 'content-complete') return ['complete'];
    return [];
  });
}

/** Independent oscillator sounds; no assets, requests, gameplay clocks or callbacks. */
export class Sound {
  enabled = true;
  available = true;
  private context: AudioContext | null = null;
  private voices = new Set<OscillatorNode>();

  async unlock(): Promise<void> {
    if (!this.enabled || !this.available) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') await this.context.resume();
    } catch { this.available = false; }
  }
  silence(): void {
    for (const voice of this.voices) {
      try { voice.stop(); } catch { /* A failed audio node must never interrupt the game host. */ }
    }
    this.voices.clear();
  }
  toggle(): void {
    this.enabled = !this.enabled;
    if (!this.enabled) this.silence();
    else void this.unlock();
  }
  play(events: readonly Event[]): void {
    const ctx = this.context;
    if (!this.enabled || !this.available || !ctx || ctx.state !== 'running') return;
    try {
      for (const cue of soundCues(events)) {
        for (const note of strikes[cue]) for (const partial of partials) {
          // Bound all active and scheduled partials across simultaneous wall contacts/catch-up.
          if (this.voices.size >= 24) return;
          const oscillator = ctx.createOscillator(), gain = ctx.createGain();
          const start = ctx.currentTime + note.delay, end = start + note.duration / Math.sqrt(partial.ratio);
          const frequency = note.frequency * partial.ratio;
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(frequency, start);
          oscillator.frequency.exponentialRampToValueAtTime(frequency * note.bend, end);
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(note.gain * partial.gain, start + 0.0015);
          gain.gain.exponentialRampToValueAtTime(0.0001, end);
          oscillator.connect(gain); gain.connect(ctx.destination);
          this.voices.add(oscillator);
          oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
          oscillator.start(start); oscillator.stop(end);
        }
      }
    } catch { this.available = false; this.silence(); }
  }
}
