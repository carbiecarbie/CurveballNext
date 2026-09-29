import { display, type DisplayAdapter } from '../compat/display';
import { field, PROFILE, type Profile } from '../compat/profile';
import { difficulty } from './constants';
import { accurate, classify, overlaps } from './collisions';
import { freshBall, publish } from './state';
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
export function retry(s: State, profile: Profile = PROFILE, adapter: DisplayAdapter = display) {
  s.ball = freshBall(s.tick, s.ball.generation + 1, profile, adapter);
  s.publishedBall = publish(s.ball, s.tick); s.cache = null; s.phase = 'ServeWaiting'; s.missTick = null;
  s.rally++; s.diagnostics.rallyReturns = 0;
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
  installCurve(s, cached, false, true, profile); s.ball.vz = difficulty(s.level).speed; s.phase = 'Rally';
  events.push({ type: 'serve', side: 'player', accurate: accurate(s.ball, cached), curve: classify(s.ball.cx, s.ball.cy), sample: structuredClone(cached) });
}
