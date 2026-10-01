import { build } from 'esbuild';
await build({ entryPoints: ['server/index.ts'], outfile: 'dist-server/server.mjs', bundle: true, platform: 'node', target: 'node24', format: 'esm', packages: 'external' });
