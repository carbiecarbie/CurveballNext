import { build } from 'esbuild';
for (const name of ['fairness-server', 'qualify-local', 'verify-fairness']) {
  await build({ entryPoints: [`tools/m5/${name}.ts`], outfile: `dist-server/${name}.mjs`, bundle: true, platform: 'node', target: 'node24', format: 'esm', packages: 'external' });
}
