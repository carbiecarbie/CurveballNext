import type { Command, Result, State } from '../core/types';
import type { Suspension } from '../runtime/clock';
export interface TickRecord { tick: number; commands: Command[]; events: Result['events']; audit: Result['audit'] }
export interface Capture {
  schema: 'curveball-m1-trace-1'; profile: string; label: string; version: string; level: number;
  checkpoint: State; records: TickRecord[]; range: [number, number]; final: State;
  host: { suspensions: Suspension[]; userAgent: string };
}
export class Recorder {
  private checkpoint: State;
  private records: { record: TickRecord; after: State }[] = [];
  constructor(initial: State, private capacity = 600) { this.checkpoint = structuredClone(initial); }
  record(commands: readonly Command[], result: Result) {
    this.records.push({ record: structuredClone({ tick: result.state.tick, commands: [...commands], events: result.events, audit: result.audit }), after: structuredClone(result.state) });
    while (this.records.length > this.capacity) this.checkpoint = this.records.shift()!.after;
  }
  export(host: Capture['host'] = { suspensions: [], userAgent: 'headless' }): Capture {
    const final = this.records.at(-1)?.after ?? this.checkpoint;
    return structuredClone({ schema: 'curveball-m1-trace-1', profile: this.checkpoint.profile, label: 'M1 prototype trace; not Flash/Ruffle evidence', version: '0.1.0', level: this.checkpoint.level,
      checkpoint: this.checkpoint, records: this.records.map(r=>r.record), range: [this.checkpoint.tick+1, final.tick], final, host });
  }
}
