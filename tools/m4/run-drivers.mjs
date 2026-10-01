import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [executable, reference, directory = 'captures-local/m4-correction/generated', selected] = process.argv.slice(2);
if (!executable || !reference) throw new Error('Usage: node tools/m4/run-drivers.mjs <m4_capture.exe> <private.swf> [driver-directory]');
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
if (hash(reference) !== '4c837f4960ac661a40b0b7cad4323f5410df1905693fa3ecb810f9740c325977') throw new Error('Wrong private reference identity');
const cases = JSON.parse(readFileSync(resolve(directory, 'cases.json'), 'utf8'));
const manifestPath = resolve(directory, 'execution-manifest.json');
let results = [];
if (selected) results = JSON.parse(readFileSync(manifestPath, 'utf8')).results;
let executed = 0;
for (const c of cases.filter(c => !selected || selected.split(',').includes(c.name))) {
  const result = spawnSync(resolve(executable), [resolve(reference), resolve(directory, c.driver), resolve(directory, c.trace)], { encoding: 'utf8', timeout: 60000 });
  if (result.status !== 0) throw new Error(`${c.name}: runtime failed: ${result.error?.message ?? result.stderr}`);
  results = results.filter(r => r.name !== c.name);
  results.push({ ...c, result: 'EXECUTED', traceSha256: hash(resolve(directory, c.trace)) });
  console.log(`${++executed}: ${c.name} executed`);
}
writeFileSync(manifestPath, JSON.stringify({ runtimeSha256: hash(executable), referenceSha256: hash(reference), results }, null, 2) + '\n');
