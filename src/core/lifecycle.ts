import { display, type DisplayAdapter } from '../compat/display';
import { field, PROFILE, type Profile } from '../compat/profile';
import { DEPTH, DIAMETER, difficulty } from './constants';
import { accurate, classify, overlaps } from './collisions';
import { project } from './projection';
import { awardPlayerContact } from './scoring';
import { createState, freshBall, publish } from './state';
import type { Audit, Event, Sample, State } from './types';
export function installCurve(s: State, sample: Sample, enemy = false, serve = false, profile: Profile = PROFILE) {
  const b = s.ball, c = difficulty(s.level).curve, center = field(profile);
  b.cx = (enemy ? sample.dx : -sample.dx) / c;
  b.cy = (enemy ? -sample.dy : sample.dy) / c;
  if (serve) {
    if (Math.abs(b.cx) < 0.01) b.cx = sample.x < center.x ? 0.01 : -0.01;
    if (Math.abs(b.cy) < 0.01) b.cy = sample.y > center.y ? 0.01 : -0.01;
  }
}
export function canRetry(s: State): boolean {
  return s.phase === 'ServeWaiting' || s.phase === 'Rally'
    || (s.phase === 'MissHold' && s.playerLives > 0 && s.enemyLives > 0);
}
export function retry(s: State, profile: Profile = PROFILE, adapter: DisplayAdapter = display): boolean {
  // A depleted-side miss must reach resolveMiss, including for direct callers.
  if (!canRetry(s)) return false;
  s.ball = freshBall(s.tick, s.ball.generation + 1, profile, adapter);
  s.publishedBall = publish(s.ball, s.tick); s.cache = null; s.phase = 'ServeWaiting'; s.phaseTick = s.tick; s.missTick = null;
  s.rally++; s.diagnostics.rallyReturns = 0;
  return true;
}
export function resolveMiss(s: State, events: Event[], profile: Profile = PROFILE, adapter: DisplayAdapter = display): State {
  // The original ball-frame action checks enemy depletion before player depletion.
  if (s.enemyLives < 1) {
    s.score += s.remainingBonus;
    events.push({ type: 'level-complete' });
    if (s.level === 10) {
      s.phase = 'ContentComplete'; s.phaseTick = s.tick; s.missTick = null;
      events.push({ type: 'content-complete' });
      return s;
    }
    const next = createState(s.level + 1, s.tick, s.trial + 1, s.ball.generation + 1, profile, adapter);
    next.score = s.score; next.playerLives = s.playerLives;
    next.phase = 'LevelIntro'; next.phaseTick = s.tick;
    events.push({ type: 'level-intro' });
    return next;
  }
  if (s.playerLives < 1) {
    s.phase = 'GameOver'; s.phaseTick = s.tick; s.missTick = null;
    events.push({ type: 'game-over' });
    return s;
  }
  retry(s, profile, adapter); events.push({ type: 'auto-retry' });
  return s;
}
/** Explicit developer fixture: force an out-of-bounds old-box plane crossing. */
export function debugMiss(s: State, side: 'player' | 'enemy', profile: Profile = PROFILE, adapter: DisplayAdapter = display) {
  if (s.phase !== 'ServeWaiting' && s.phase !== 'Rally') return;
  const b = s.ball;
  b.x = 1000; b.y = field(profile).y; b.z = side === 'enemy' ? DEPTH : 0;
  b.vx = b.vy = b.cx = b.cy = 0; b.vz = (side === 'enemy' ? 1 : -1) * difficulty(s.level).speed;
  b.box = adapter.install(project(b.x, b.y, b.z, DIAMETER, DIAMETER, profile), { tick: s.tick, generation: b.generation });
  s.publishedBall = publish(b, s.tick); s.phase = 'Rally'; s.phaseTick = s.tick;
}
export function serve(s: State, events: Event[], audit: Audit, profile: Profile = PROFILE) {
  let reason: string | undefined;
  if (s.phase !== 'ServeWaiting' || s.ball.vz !== 0) reason = 'not-waiting';
  else if (!s.cache) reason = 'cache-not-ready';
  else if (!overlaps(s.ball.box, s.player.box)) reason = 'not-overlapping';
  audit.contacts.push({ kind: 'serve', side: 'player', oldBallBox: structuredClone(s.ball.box), paddleBox: structuredClone(s.player.box),
    before: structuredClone(s.ball), sample: s.cache ? structuredClone(s.cache.player) : null, accepted: !reason });
  if (reason) { events.push({ type: 'serve-rejected', reason }); return; }
  const cached = s.cache!.player;
  installCurve(s, cached, false, true, profile); s.ball.vz = difficulty(s.level).speed; s.phase = 'Rally'; s.phaseTick = s.tick;
  const isAccurate = accurate(s.ball, cached), curve = classify(s.ball.cx, s.ball.cy);
  awardPlayerContact(s, isAccurate, curve, true);
  events.push({ type: 'serve', side: 'player', accurate: isAccurate, curve, sample: structuredClone(cached) });
}
