// Independent assessment code. No production collision, projection, installer or view helpers.
export const profiles = {
  C0: [[10, 0, 10, 0, 0], [10, 0, 10, 0, 0]], C1: [[20, 5, 20, 5, 0], [20, 5, 20, 5, 0]],
  C2: [[50, 0, 50, 0, 0], [50, 0, 50, 0, 0]], C3: [[40, 10, 40, 10, 1], [40, 10, 40, 10, 1]],
  C4a: [[10, 0, 10, 0, 0], [40, 10, 40, 10, 1]], C4b: [[40, 10, 40, 10, 1], [10, 0, 10, 0, 0]],
  C5a: [[70, 10, 10, 10, 1], [10, 10, 70, 10, 1]], C5b: [[10, 10, 70, 10, 1], [70, 10, 10, 10, 1]],
} as const;
export type Profile = keyof typeof profiles;
export interface Stimulus { id: string; profile: Profile; defender: 0 | 1; initialServingSide: 0 | 1; index: number; group: number; seed: number; marginMs: number; hz: number;
  ball: { u: number; y: number; z: number; vx: number; vy: number; vz: number; cx: number; cy: number }; target: { x: number; y: number }; expectedVisualOverlap: [number, number] }
export function stimulus(profile: Profile, defender: 0 | 1, index: number): Stimulus {
  const group = Math.floor(index / 100), direction = index % 2 ? -1 : 1, kind = index % 3, sign = defender === 0 ? 1 : -1;
  const ball = { u: sign * direction * (kind === 0 ? 0 : group === 0 ? 60 : 100), y: kind === 1 ? 125.5 : 125.5 + direction * 50,
    z: defender === 0 ? 75 : 0, vx: sign * direction * (group === 0 ? 0 : 2), vy: kind === 1 ? direction * 1 : 0,
    vz: defender === 0 ? -2 : 2, cx: group === 1 ? sign * direction * .025 : 0, cy: group === 1 ? -.025 : 0 };
  if (group === 0) { if (kind === 0) ball.y = 125.5; if (kind === 2) ball.u = 0; }
  const b = { ...ball };
  // Written recurrence predicts the C-1 proxy independently, before the experiment begins.
  for (let tick = 0; tick < 37; tick++) {
    b.vx = b.vx + b.cx; b.vy = b.vy + b.cy; b.z = b.z + b.vz; b.u = b.u + b.vx; b.y = b.y - b.vy;
    b.cx = b.cx / 1.004; b.cy = b.cy / 1.004;
    if (b.y < 40) { b.y = 40; b.cy = b.cy / ((1.004 - 1) * 50 + 1); b.vy = -b.vy; }
    else if (b.y > 211) { b.y = 211; b.cy = b.cy / ((1.004 - 1) * 50 + 1); b.vy = -b.vy; }
    if (b.u < -135.5) { b.u = -135.5; b.cx = b.cx / ((1.004 - 1) * 50 + 1); b.vx = -b.vx; }
    else if (b.u > 135.5) { b.u = 135.5; b.cx = b.cx / ((1.004 - 1) * 50 + 1); b.vx = -b.vx; }
  }
  const box = independentBox(sign * b.u, b.y, defender === 0 ? b.z : 75 - b.z, 30, 30);
  return { id: `${profile}/${defender}/${String(index).padStart(3, '0')}`, profile, defender, initialServingSide: (index % 2) as 0 | 1, index, group,
    seed: 51001 + Object.keys(profiles).indexOf(profile) * 1000 + defender * 300 + index, marginMs: [50, 100, 200, 400][index % 4], hz: [60, 120, 144][index % 3],
    ball, target: { x: Math.max(55, Math.min(296, (box[0] + box[1]) / 40)), y: Math.max(45, Math.min(206, (box[2] + box[3]) / 40)) }, expectedVisualOverlap: [15, 15] };
}
export const manifest = (profile: Profile) => ([0, 1] as const).flatMap(side => Array.from({ length: 300 }, (_, i) => stimulus(profile, side, i)));
export function independentBox(u: number, y: number, depth: number, w: number, h: number): [number, number, number, number] {
  const g = (90 - Math.atan(depth / 31.066017) * 180 / 3.141592653589793) / 90;
  const even = (n: number) => { const f = Math.floor(n); return n - f === .5 ? f % 2 === 0 ? f : f + 1 : Math.round(n); };
  const x = Math.trunc((175.5 + u * g) * 20), yy = Math.trunc((125.5 + (y - 125.5) * g) * 20);
  const hx = even(Math.fround(Math.fround(w * g / w) * Math.fround(w * 10))), hy = even(Math.fround(Math.fround(h * g / h) * Math.fround(h * 10)));
  return [x - hx, x + hx, yy - hy, yy + hy];
}
export interface Rect { left: number; right: number; top: number; bottom: number }
export function classify(ball: Rect, paddle: Rect, hit: boolean) {
  const x = Math.min(ball.right, paddle.right) - Math.max(ball.left, paddle.left), y = Math.min(ball.bottom, paddle.bottom) - Math.max(ball.top, paddle.top);
  if (x >= 1 && y >= 1) return hit ? 'apparent-contact-accepted' : 'apparent-contact-rejected';
  // A return the defender's incoming frame clearly showed missing is a false acceptance (contact-claim amendment).
  if (x <= -1 || y <= -1) return hit ? 'apparent-noncontact-accepted' : 'clear-noncontact';
  return 'borderline';
}
/**
 * The stimulus margin the defender was actually shown (capture → presented incoming frame, browser clock) must belong to its
 * declared stratum: nearer to it than to any other stratum. Exact equality is not expected: the presentation clock is still
 * converging to its lead (up to 1.35× real time) hundreds of milliseconds before the crossing, and frames are quantized.
 */
export const marginStrata = [50, 100, 200, 400] as const;
export function realizedMarginOk(declaredMs: number, realizedMs: number) {
  if (!Number.isFinite(realizedMs) || realizedMs <= 0) return false;
  const nearest = marginStrata.reduce((best, m) => Math.abs(realizedMs - m) < Math.abs(realizedMs - best) ? m : best, marginStrata[0] as number);
  return nearest === declaredMs;
}
export function offsetInterval(c0: number, s1: number, s2: number, c3: number): [number, number] {
  const interval: [number, number] = [s2 - c3, s1 - c0]; if (interval[0] > interval[1]) throw new Error('Inconsistent clock evidence'); return interval;
}
export interface Observation { id: string; classification: ReturnType<typeof classify> | 'ambiguous'; completed: boolean; imagesCorroborated: boolean; investigated: boolean; marginMs: number; hz: number;
  attempt?: number; instrumentationInvalid?: boolean }
/**
 * Plan §9: an instrumentation-invalid attempt (shown margin outside its declared stratum) may be repeated with the same seed;
 * every attempt is retained. The last attempt decides only when every earlier one was instrumentation-invalid; a rejection is
 * never replaced (it stays counted), and a repeat that changes the outcome blocks the observation for investigation.
 */
export function resolveAttempts(attempts: Observation[]) {
  const errors: string[] = [], repeated: { id: string; attempts: number }[] = [], observations: Observation[] = [];
  const byId = new Map<string, Observation[]>();
  for (const a of attempts) byId.set(a.id, [...byId.get(a.id) ?? [], a]);
  for (const [id, list] of byId) {
    const last = list.at(-1)!, earlier = list.slice(0, -1), blocked = (why: string) => { errors.push(`${id}: ${why}`); observations.push({ ...last, classification: 'ambiguous' }); };
    if (list.length > 1) repeated.push({ id, attempts: list.length });
    if (earlier.some(a => !a.instrumentationInvalid)) { blocked('repeated without an instrumentation fault'); continue; }
    const rejected = earlier.find(a => a.classification === 'apparent-contact-rejected');
    if (rejected) { observations.push({ ...rejected, instrumentationInvalid: false }); continue; }
    if (earlier.some(a => a.completed && last.completed && a.classification !== 'ambiguous' && a.classification !== last.classification)) { blocked('a repeat changed the outcome; investigate'); continue; }
    if (last.instrumentationInvalid) { blocked('shown margin outside its declared stratum in every attempt'); continue; }
    observations.push(last);
  }
  return { observations, errors, repeated };
}
export function cell(observations: Observation[], scheduled: Stimulus[]) {
  const seen = new Set<string>(), errors: string[] = [], strata: Record<string, { n: number; rejected: number; noncontact: number }> = {};
  let n = 0, rejected = 0, apparent = 0, noncontact = 0, falseAccepted = 0, borderline = 0, ambiguous = 0;
  for (const s of scheduled) {
    const candidates = observations.filter(o => o.id === s.id);
    if (candidates.length !== 1) { errors.push(`${s.id}: missing or repeated attempt needs independent resolution`); continue; }
    const o = candidates[0]; seen.add(o.id);
    if (!o.completed || !o.imagesCorroborated) { errors.push(`${s.id}: incomplete frame/image evidence`); continue; }
    if (o.marginMs !== s.marginMs || o.hz !== s.hz) { errors.push(`${s.id}: sampling strata changed`); continue; }
    if (o.classification === 'borderline') { borderline++; continue; }
    if (o.classification === 'ambiguous') { ambiguous++; continue; }
    n++; const key = `${o.marginMs}ms/${o.hz}Hz`; strata[key] ??= { n: 0, rejected: 0, noncontact: 0 }; strata[key].n++;
    if (o.classification.startsWith('apparent-contact')) apparent++;
    if (o.classification === 'apparent-contact-rejected') { rejected++; strata[key].rejected++; if (!o.investigated) errors.push(`${s.id}: uninvestigated rejection`); }
    if (o.classification === 'clear-noncontact') { noncontact++; strata[key].noncontact++; }
    if (o.classification === 'apparent-noncontact-accepted') { falseAccepted++; errors.push(`${s.id}: authority returned a clearly shown noncontact`); }
  }
  if (observations.some(o => !seen.has(o.id))) errors.push('Unscheduled or unresolved attempts retained');
  return { n, rejected, apparent, noncontact, falseAccepted, borderline, ambiguous, strata, fraction: n ? rejected / n : null,
    conditionalFraction: apparent ? rejected / apparent : null, errors,
    numericalGate: n >= 300 && rejected / n <= .01 && !falseAccepted && !borderline && !ambiguous && !errors.length };
}
