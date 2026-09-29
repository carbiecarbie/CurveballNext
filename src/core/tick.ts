import { display, type DisplayAdapter } from '../compat/display';
import { PROFILE, type Profile } from '../compat/profile';
import { playerStep, enemyStep } from './actors';
import { ballStep } from './ball';
import { difficulty, LEVEL_INTRO_TICKS } from './constants';
import { debugMiss, resolveMiss, retry, serve } from './lifecycle';
import { assertFinite, createState } from './state';
import type { Audit, Command, Event, Result, State } from './types';
export function validateCommands(commands: readonly Command[], tick: number) {
  let sequence = -1, timestamp = -Infinity;
  const seen = new Set<number>();
  for (const c of commands) {
    assertFinite(c);
    if (c.tick !== tick || !Number.isSafeInteger(c.sequence) || c.sequence < 1 || seen.has(c.sequence) || typeof c.late !== 'boolean' || typeof c.timestamp !== 'number' || c.timestamp < timestamp || (c.timestamp === timestamp && c.sequence <= sequence)) throw new Error('Invalid command ordering');
    sequence = c.sequence; timestamp = c.timestamp; seen.add(c.sequence);
    if (c.type === 'reset') difficulty(c.level);
    else if (c.type === 'debug-miss') { if (c.side !== 'player' && c.side !== 'enemy') throw new Error('Invalid debug miss side'); }
    else if (c.type === 'pointer' || c.type === 'down') {
      if (typeof c.x !== 'number' || typeof c.y !== 'number') throw new Error('Invalid pointer');
    } else if (c.type !== 'retry' && c.type !== 'new-game') throw new Error('Unknown command');
  }
}
export function tick(previous: State, commands: readonly Command[] = [], profile: Profile = PROFILE, adapter: DisplayAdapter = display): Result {
  if (previous.profile !== profile.id) throw new Error('Unknown profile');
  assertFinite(previous); validateCommands(commands, previous.tick + 1);
  let s = structuredClone(previous); s.tick++;
  const events: Event[] = [], audit: Audit = { checkpoints: [], contacts: [], aiInput: structuredClone(s.publishedBall) };
  if (s.phase === 'MissHold' && s.missTick !== null && s.tick >= s.missTick + profile.missHold) s = resolveMiss(s, events, profile, adapter);
  if (s.phase === 'LevelIntro' && s.tick >= s.phaseTick + LEVEL_INTRO_TICKS) {
    s.phase = 'ServeWaiting'; s.phaseTick = s.tick; events.push({ type: 'level-ready' });
  }
  for (const c of commands) {
    if (c.type === 'reset') { s = createState(c.level, s.tick, s.trial + 1, s.ball.generation + 1, profile, adapter); events.push({ type: 'reset' }); }
    else if (c.type === 'new-game') { s = createState(1, s.tick, s.trial + 1, s.ball.generation + 1, profile, adapter); events.push({ type: 'new-game' }); }
    else if (c.type === 'retry') { if (retry(s, profile, adapter)) events.push({ type: 'retry' }); }
    else if (c.type === 'debug-miss') { if (s.phase === 'ServeWaiting' || s.phase === 'Rally') { debugMiss(s, c.side, profile, adapter); events.push({ type: 'debug-inject', side: c.side }); } }
    else { s.target = { x: c.x, y: c.y }; if (c.type === 'down') serve(s, events, audit, profile); }
  }
  if (s.phase === 'LevelIntro' || s.phase === 'GameOver' || s.phase === 'ContentComplete') {
    audit.aiInput = structuredClone(s.publishedBall); assertFinite(s); return { state: s, events, audit };
  }
  playerStep(s, profile, adapter); audit.aiInput = structuredClone(s.publishedBall); enemyStep(s, profile, adapter);
  ballStep(s, events, audit, profile, adapter); assertFinite(s);
  return { state: s, events, audit };
}
