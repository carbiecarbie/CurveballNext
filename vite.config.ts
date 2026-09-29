import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  server: {
    host: '127.0.0.1',
    fs: { strict: true, deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/reference-local/**', '**/*.swf'] },
  },
  preview: { host: '127.0.0.1' },
});
