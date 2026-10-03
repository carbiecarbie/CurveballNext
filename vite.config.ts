import { defineConfig } from 'vite';

export default defineConfig({
  // `public/` holds only the link-preview image, which must sit at a fixed absolute URL.
  publicDir: 'public',
  server: {
    host: '127.0.0.1',
    fs: { strict: true, deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/reference-local/**', '**/*.swf'] },
  },
  preview: { host: '127.0.0.1' },
});
