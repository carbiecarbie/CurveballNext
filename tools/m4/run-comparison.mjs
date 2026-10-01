import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
const input = process.argv[2] ?? 'docs/evidence/m4-ruffle-observations.json';
const output = process.argv[3] ?? 'docs/evidence/m4-comparison.json';
const bytes = readFileSync(input);
// Vite is an existing pinned project dependency and loads the production TS modules.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { compareEvidence } = await server.ssrLoadModule('/tools/m4/compare.ts');
  const comparisons = compareEvidence(JSON.parse(bytes));
  const summary = {};
  for (const c of comparisons) summary[c.status] = (summary[c.status] ?? 0) + 1;
  writeFileSync(output, JSON.stringify({ schema: 'curveball-m4-comparison-1', observationsSha256: createHash('sha256').update(bytes).digest('hex'),
    numericalPolicy: 'Discrete exact; math abs 1e-9 + rel 1e-12; no collision tolerance. Signed zero alike as existing replay policy.', summary, comparisons }, null, 2) + '\n');
  console.log(JSON.stringify({ output, summary }));
} finally { await server.close(); }
