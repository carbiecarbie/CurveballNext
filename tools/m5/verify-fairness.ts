// Independent offline evidence verifier; no production geometry helpers imported.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { cell, classify, independentBox, manifest, offsetInterval, realizedMarginOk, type Observation, type Profile } from './fairness';

const directory = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('usage: verify-fairness RUN_DIRECTORY [INDEPENDENT_REVIEW_JSON]');
const read = (name: string) => JSON.parse(readFileSync(resolve(directory, name), 'utf8'));
const lines = (name: string): any[] => readFileSync(resolve(directory, name), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
const declared = read('manifest.json'), scheduled = manifest(declared.profile as Profile), hash = createHash('sha256').update(JSON.stringify(scheduled)).digest('hex');
if (hash !== declared.hash || JSON.stringify(scheduled) !== JSON.stringify(declared.scheduled)) throw new Error('Manifest changed after predeclaration');
const review = process.argv[3] ? JSON.parse(readFileSync(process.argv[3], 'utf8')) : { observations: {}, tcpShapeVerified: false, stimulusApproved: false, physicalApproved: false };
const authority = lines('authority.jsonl'), presentation = lines('presentation.jsonl'), records: Observation[] = [], timing: unknown[] = [], failures: string[] = [];
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
for (const captured of presentation) {
  const s = scheduled.find(s => s.id === captured.id); if (!s) { failures.push('Unscheduled observation'); continue; }
  const entry: Observation = { id: s.id, classification: 'ambiguous', completed: false, imagesCorroborated: false, investigated: false, marginMs: s.marginMs, hz: s.hz };
  try {
    const ticks = authority.filter(r => r.id === s.id && r.attempt === captured.attempt && r.kind === 'tick');
    const contact = ticks.find(r => r.events.some((e: any) => ['return', 'miss', 'finish'].includes(e.type)));
    if (!contact) throw new Error('No authoritative end-plane contact');
    const event = contact.events.find((e: any) => ['return', 'miss', 'finish'].includes(e.type));
    if (captured.matchId !== event.matchId || captured.incoming.incomingEventId !== event.eventId || captured.incoming.tick !== event.incomingBoxTick ||
      !captured.preceding || captured.preceding.renderedAt >= captured.incoming.renderedAt || !captured.metadata.visible || captured.incoming.frozen) throw new Error('Missing/occluded/uncertain incoming boundary');
    const old = contact.before, b = old.ball, p = old.localPaddles[s.defender];
    const ball = independentBox((s.defender === 0 ? 1 : -1) * b.u, b.y, s.defender === 0 ? b.z : 75 - b.z, 30, 30);
    const paddle = independentBox(p.x - 175.5, p.y, 0, 60, 40);
    if (!equal(ball, event.incomingViewBoxes[s.defender].ball) || !equal(paddle, event.incomingViewBoxes[s.defender].own)) throw new Error('Independent twip bounds disagree');
    const expectedHit = ball[0] <= paddle[1] && ball[1] >= paddle[0] && ball[2] <= paddle[3] && ball[3] >= paddle[2];
    if (expectedHit !== (event.type === 'return')) throw new Error('Discrete authority result disagrees with independent closed inequalities');
    const raw = captured.incoming.ball;
    if (!equal([raw.left, raw.right, raw.top, raw.bottom], ball.map(n => n / 20))) throw new Error('Incoming ball pose substituted');
    for (const key of ['precedingImage', 'incomingImage']) {
      const image = captured[key], path = resolve(directory, image.path);
      if (!path.startsWith(directory + sep)) throw new Error('Image path escapes evidence directory');
      if (createHash('sha256').update(readFileSync(path)).digest('hex') !== image.sha256) throw new Error('PNG missing or changed');
    }
    const probes = captured.probes.slice(-20);
    if (!probes.length) throw new Error('No clock offset evidence');
    probes.forEach((p: any) => { if (!equal(offsetInterval(p.c0, p.s1, p.s2, p.c3), [p.lo, p.hi])) throw new Error('Clock interval mismatch'); });
    const lo = probes.reduce((n: number, p: any) => Math.min(n, p.lo), Infinity), hi = probes.reduce((n: number, p: any) => Math.max(n, p.hi), -Infinity);
    const centers = probes.map((p: any) => (p.lo + p.hi) / 2), residual = centers.reduce((n: number, c: number) => Math.max(n, c), -Infinity) - centers.reduce((n: number, c: number) => Math.min(n, c), Infinity);
    const elapsed = probes.at(-1).at - probes[0].at, observedDrift = elapsed > 0 ? residual / elapsed : 0;
    const frameError = captured.actualFrames.reduce((max: number, n: number) => n > 0 ? Math.max(max, n) : max, -Infinity);
    if (!Number.isFinite(frameError)) throw new Error('No measured frame timing');
    const driftError = observedDrift * Math.max(0, captured.captureTime - probes.at(-1).at), uncertainty = residual + driftError + frameError;
    const input = captured.inputRecords.find((r: any) => r.kind === 'captured-input'), sent = captured.inputRecords.find((r: any) => r.kind === 'sent-input' && r.seq === input?.seq);
    if (!input || !sent) throw new Error('Missing actual capture/wire-send record');
    // The declared stratum must be what the defender was shown: capture to the presented incoming frame, same clock.
    const realizedMarginMs = captured.incoming.renderedAt - input.at;
    if (!realizedMarginOk(s.marginMs, realizedMarginMs)) throw new Error(`Realized margin ${realizedMarginMs.toFixed(1)} ms outside the declared ${s.marginMs} ms stratum`);
    const trace = authority.filter(r => r.id === s.id && r.attempt === captured.attempt && r.seq === input.seq && r.generation === input.generation && r.side === s.defender);
    const receipt = trace.find(r => r.kind === 'received'), consumed = trace.find(r => r.kind === 'consumed'), used = trace.find(r => r.kind === 'first-use');
    timing.push({ id: s.id, realizedMarginMs, captureToContact: [contact.committed - (input.at + hi + uncertainty), contact.committed - (input.at + lo - uncertainty)],
      receiptToContact: receipt ? contact.committed - receipt.received : null, consumedToContact: consumed ? contact.committed - consumed.consumed : null,
      firstUseToContact: used ? contact.committed - used.used : null, serverNominal: contact.nominal, serverCommitted: contact.committed, frameError, observedDrift, residual, offset: [lo, hi], trace });
    const checked = review.observations[s.id];
    entry.classification = classify(captured.incoming.ball, captured.incoming.own, expectedHit);
    entry.completed = true; entry.imagesCorroborated = checked?.imagesCorroborated === true && checked?.cadenceCorroborated === true;
    entry.investigated = entry.classification !== 'apparent-contact-rejected' || checked?.investigated === true;
  } catch (e) { failures.push(`${s.id}: ${e instanceof Error ? e.message : String(e)}`); }
  records.push(entry);
}
const cells = [0, 1].map(side => cell(records.filter(r => r.id.startsWith(`${declared.profile}/${side}/`)), scheduled.filter(s => s.defender === side)));
const report = { hash, profile: declared.profile, cells, failures, observations: records, timing, tcpShapeVerified: review.tcpShapeVerified === true,
  stimulusApproved: review.stimulusApproved === true, physicalApproved: review.physicalApproved === true,
  completeGate: cells.every(c => c.numericalGate) && !failures.length && review.tcpShapeVerified === true && review.stimulusApproved === true && review.physicalApproved === true };
writeFileSync(resolve(directory, 'independent-assessment.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ profile: report.profile, cells, failures, completeGate: report.completeGate }, null, 2));
if (!report.completeGate) process.exitCode = 1;
