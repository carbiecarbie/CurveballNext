// Production entry point. Kept separate so bundling startServer elsewhere never starts a second authority.
import { startServer } from './index';

const app = startServer();
console.log(JSON.stringify({ event: 'started', port: process.env.PORT ?? 8787, protocol: 1, rules: 'online-v1' }));
process.on('SIGTERM', app.close); process.on('SIGINT', app.close);
process.on('SIGUSR2', () => { app.authority.draining = true; });
