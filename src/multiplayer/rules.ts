export const RULES = Object.freeze({ version: 'online-v1', protocolVersion: 1, hz: 30, speed: 2, curve: 25, easing: 1.5, countdown: 90, hold: 19 });
export const LIMITS = Object.freeze({ rooms: 10, players: 20, sockets: 64, frame: 1024, snapshot: 2048, events: 32, diagnostics: 600, history: 60,
  softBuffer: 65536, hardBuffer: 262144, congestionMs: 2000, healthMs: 5000, cleanupMs: 1000, waitingMs: 600000, endedMs: 60000, ttlMs: 3600000 });
