/** Run-wide nearest-rank percentile: sorted[ceil(q*N)-1], null for N=0. */
export function percentile(values: readonly number[], q: number): number | null {
  if (!(q > 0 && q <= 1)) throw new Error('Invalid percentile');
  return values.length ? [...values].sort((a, b) => a - b)[Math.ceil(q * values.length) - 1] : null;
}

/** Retain only executed-batch / scheduled-wake samples, never idle populations.
 * Payload storage is constant. At 30 Hz a 7200 s run retains ~216000 pairs;
 * idle 5 ms polls add counters only. Raw arrays support independent recalculation.
 */
export class CapacityMeasurements {
  private batches: number[] = []; private roomTicks: number[] = []; private lateness: number[] = [];
  private maximumPayload: number | null = null;
  private polls = 0; private idle = 0;
  observePoll(durationMs: number, executedRoomTicks: number, latenessMs: number | null, maximumPayload: number) {
    this.polls++; if (!executedRoomTicks) this.idle++;
    if (executedRoomTicks > 0) { this.batches.push(durationMs); this.roomTicks.push(executedRoomTicks); }
    this.maximumPayload = Math.max(this.maximumPayload ?? 0, maximumPayload);
    if (latenessMs !== null) this.lateness.push(latenessMs);
  }
  report() {
    return { pollCount: this.polls, idlePollCount: this.idle, executedBatchCount: this.batches.length,
      payloadObservationCount: this.polls, scheduledWakeCount: this.lateness.length,
      executedBatchP99Ms: percentile(this.batches, .99), latenessP99Ms: percentile(this.lateness, .99), maxSnapshotBytes: this.maximumPayload,
      raw: { executedBatchMs: this.batches, executedRoomTicks: this.roomTicks, schedulerLatenessMs: this.lateness } };
  }
}
