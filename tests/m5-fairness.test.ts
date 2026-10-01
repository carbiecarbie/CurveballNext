import { expect, it } from 'vitest';
import { cell, classify, independentBox, manifest, offsetInterval, profiles, type Observation } from '../tools/m5/fairness';

it('fixed manifest contains 300 per defender/profile, exact groups and balanced timing strata', () => {
  for (const profile of Object.keys(profiles) as (keyof typeof profiles)[]) {
    const all = manifest(profile); expect(all).toHaveLength(600);
    for (const side of [0, 1]) {
      const samples = all.filter(s => s.defender === side); expect(samples).toHaveLength(300);
      for (const group of [0, 1, 2]) expect(samples.filter(s => s.group === group)).toHaveLength(100);
      for (const margin of [50, 100, 200, 400]) expect(samples.filter(s => s.marginMs === margin)).toHaveLength(75);
      for (const hz of [60, 120, 144]) expect(samples.filter(s => s.hz === hz)).toHaveLength(100);
    }
  }
});
it('independent authority equations match literal twip/corner fixtures', () => {
  expect(independentBox(-120.35, 125.5, 0, 30, 30)).toEqual([803, 1403, 2210, 2810]);
  expect(independentBox(100.15 - 175.5, 160.5, 0, 60, 40)).toEqual([1403, 2603, 2810, 3610]);
  expect(independentBox(55.15 - 175.5, 125.5, 0, 60, 40).slice(0, 2)).toEqual([503, 1703]);
});
it('clear apparent rejection uses emitted geometry, excludes true subpixel contact from denominator', () => {
  const b = { left: 0, right: 30, top: 0, bottom: 30 };
  expect(classify(b, { left: 29, right: 89, top: 29, bottom: 69 }, false)).toBe('apparent-contact-rejected');
  expect(classify(b, { left: 29.01, right: 89, top: 0, bottom: 40 }, false)).toBe('borderline');
  expect(classify(b, { left: 31, right: 91, top: 0, bottom: 40 }, false)).toBe('clear-noncontact');
});
it('300 denominator permits only three investigated rejections, with separate conditional fraction', () => {
  const scheduled = manifest('C2').filter(s => s.defender === 0);
  const records: Observation[] = scheduled.map(s => ({ id: s.id, marginMs: s.marginMs, hz: s.hz, classification: 'apparent-contact-accepted', completed: true, imagesCorroborated: true, investigated: true }));
  for (let i = 0; i < 3; i++) records[i].classification = 'apparent-contact-rejected';
  expect(cell(records, scheduled).numericalGate).toBe(true); records[3].classification = 'apparent-contact-rejected'; expect(cell(records, scheduled).numericalGate).toBe(false);
  records[3].classification = 'borderline'; const result = cell(records, scheduled); expect(result.n).toBe(299); expect(result.borderline).toBe(1); expect(result.numericalGate).toBe(false);
});
it('missing screenshots, repeated attempts and capture ambiguity cannot become a pass', () => {
  const scheduled = manifest('C0').filter(s => s.defender === 0), records: Observation[] = scheduled.map(s => ({ ...s, classification: 'apparent-contact-accepted', completed: true, imagesCorroborated: false, investigated: true }));
  expect(cell(records, scheduled).n).toBe(0); records.forEach(r => r.imagesCorroborated = true); records[0].classification = 'ambiguous'; expect(cell(records, scheduled).numericalGate).toBe(false);
  records.push(records[1]); expect(cell(records, scheduled).errors.length).toBeGreaterThan(0);
});
it('offset intervals preserve directional uncertainty and reject inconsistent clocks', () => {
  expect(offsetInterval(100, 180, 181, 200)).toEqual([-19, 80]); expect(() => offsetInterval(100, 80, 81, 100)).toThrow();
});
