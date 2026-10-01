import { expect, it } from 'vitest';
import { CapacityMeasurements } from '../tools/m5/capacity-report';

it('980 executed 1 ms batches + 20 executed 25 ms batches have p99 25 ms independently of 5000 idle polls', () => {
  const m = new CapacityMeasurements();
  for (let i = 0; i < 1000; i++) m.observePoll(i < 980 ? 1 : 25, 10, 7, 1234);
  for (let i = 0; i < 5000; i++) m.observePoll(.01, 0, null, 1234);
  const report = m.report();
  expect(report.executedBatchP99Ms).toBe(25); expect(report.latenessP99Ms).toBe(7);
  expect(report.executedBatchCount).toBe(1000); expect(report.idlePollCount).toBe(5000); expect(report.pollCount).toBe(6000);
  expect(report.raw.executedBatchMs).toHaveLength(1000); expect(report.raw.schedulerLatenessMs).toHaveLength(1000);
});

it.each([225000, 720000])('reports %s samples without argument expansion; retains exact counts, maximum and nearest-rank percentiles', count => {
  const m = new CapacityMeasurements();
  for (let i = 0; i < count; i++) m.observePoll(i < count * .98 ? 1 : 25, 10, i < count * .98 ? 2 : 30, i === 17 ? 2048 : 1266);
  const output = JSON.stringify(m.report()), report = JSON.parse(output);
  expect(report.executedBatchCount).toBe(count); expect(report.payloadObservationCount).toBe(count);
  expect(report.maxSnapshotBytes).toBe(2048); expect(report.executedBatchP99Ms).toBe(25); expect(report.latenessP99Ms).toBe(30);
  expect(report.raw.executedBatchMs).toHaveLength(count); expect(report.raw.schedulerLatenessMs).toHaveLength(count);
});

it('empty and small populations have explicit empty values and nearest-rank p99', () => {
  const m = new CapacityMeasurements();
  expect(m.report()).toMatchObject({ pollCount: 0, executedBatchCount: 0, maxSnapshotBytes: null, executedBatchP99Ms: null, latenessP99Ms: null });
  m.observePoll(.01, 0, null, 0);
  expect(m.report()).toMatchObject({ pollCount: 1, executedBatchCount: 0, maxSnapshotBytes: 0 });
  m.observePoll(3, 10, 4, 1200); m.observePoll(1, 10, 2, 1100);
  expect(m.report()).toMatchObject({ executedBatchP99Ms: 3, latenessP99Ms: 4, maxSnapshotBytes: 1200 });
});
