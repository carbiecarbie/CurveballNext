import { display, installTwips } from '../compat/display';
import { DECAY, WALL_DIVISOR } from '../core/constants';
import { project, scale } from '../core/projection';
import { RULES } from './rules';
import { ticking, type Ball, type Bounds, type OnlineEvent, type OnlineState, type Paddle, type Side, type ViewBoxes } from './types';

export function paddle(): Paddle { return { x: 175.5, y: 125.5, px: 175.5, py: 125.5, dx: 0, dy: 0, tx: 175.5, ty: 125.5, seq: 0, generation: 0, appliedTick: 0 }; }
export function move(p: Paddle) {
  const y = Math.max(45, Math.min(206, p.y - (p.y - p.ty) / 1.5));
  const x = Math.max(55, Math.min(296, p.x - (p.x - p.tx) / 1.5));
  p.x = x; p.y = y; p.dx = x - p.px; p.dy = y - p.py; p.px = x; p.py = y;
}
export function target(p: Paddle, x: number, y: number) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < -350 || x > 700 || y < -250 || y > 500) throw new Error('Invalid target');
  const read = display.readInput!({ x, y }); p.tx = read.x; p.ty = read.y;
}
export function ownBox(p: Paddle): Bounds { return installTwips(project(p.x, p.y, 0, 60, 40)); }
export function ballBox(b: Ball, side: Side): Bounds {
  const g = scale(side === 0 ? b.z : 75 - b.z), sign = side === 0 ? 1 : -1;
  return installTwips({ x: 175.5 + (sign * b.u) * g, y: 125.5 + (b.y - 125.5) * g, width: 30 * g, height: 30 * g, sourceWidth: 30, sourceHeight: 30 });
}
export function boxes(s: Pick<OnlineState, 'ball' | 'localPaddles'>): [ViewBoxes, ViewBoxes] {
  return ([0, 1] as const).map(side => {
    const p = s.localPaddles[side === 0 ? 1 : 0], g = scale(75);
    return { ball: ballBox(s.ball, side), own: ownBox(s.localPaddles[side]), remote: installTwips({
      x: 175.5 + (-(p.x - 175.5)) * g, y: 125.5 + (p.y - 125.5) * g,
      width: 60 * g, height: 40 * g, sourceWidth: 60, sourceHeight: 40 }) };
  }) as [ViewBoxes, ViewBoxes];
}
export function contact(a: Bounds, b: Bounds) { return a[0] <= b[1] && a[1] >= b[0] && a[2] <= b[3] && a[3] >= b[2]; }
export function createOnline(): OnlineState {
  const s: OnlineState = { matchId: 0, rallyId: 0, tick: 0, phase: 'Waiting', phaseDeadline: 0, servingSide: 0, initialServingSide: 0,
    lives: [3, 3], localPaddles: [paddle(), paddle()], ball: { u: 0, y: 125.5, z: 0, vx: 0, vy: 0, vz: 0, cx: 0, cy: 0 },
    viewBoxes: [] as unknown as [ViewBoxes, ViewBoxes], lastEventId: 0, result: null };
  s.viewBoxes = boxes(s); return s;
}
export function countdown(s: OnlineState, side: Side) {
  s.servingSide = side; s.phase = 'Countdown'; s.phaseDeadline = s.tick + RULES.countdown;
  s.localPaddles = [paddle(), paddle()]; s.ball = { u: 0, y: 125.5, z: side === 0 ? 0 : 75, vx: 0, vy: 0, vz: 0, cx: 0, cy: 0 };
  s.viewBoxes = boxes(s);
}
export function startMatch(s: OnlineState, initialSide: Side) {
  s.matchId++; s.rallyId = 1; s.lives = [3, 3]; s.result = null; s.initialServingSide = initialSide; countdown(s, initialSide);
}
/** One synchronous transaction: prior boxes/sample, then ball, then independent human movement. */
export function step(s: OnlineState): OnlineEvent[] {
  if (!ticking(s.phase)) return [];
  s.tick++;
  const events: OnlineEvent[] = [], incoming = s.viewBoxes;
  const emit = (type: OnlineEvent['type'], side: Side | null = null) => {
    const event: OnlineEvent = { type, side, matchId: s.matchId, rallyId: s.rallyId, tick: s.tick, eventId: ++s.lastEventId,
      incomingBoxTick: s.tick - 1, incomingViewBoxes: incoming, lives: [...s.lives], result: s.result };
    events.push(event); return event;
  };
  if (s.phase === 'LifeLostHold' && s.tick >= s.phaseDeadline) { s.rallyId++; countdown(s, s.servingSide); return []; }
  if (s.phase === 'Countdown') {
    if (s.tick < s.phaseDeadline) return [];
    s.phase = 'Rally'; s.ball.cx = s.servingSide === 0 ? -.01 : .01; s.ball.cy = -.01; s.ball.vz = s.servingSide === 0 ? 2 : -2;
    s.localPaddles.forEach(p => { p.tx = p.x; p.ty = p.y; });
    emit('launch');
  }
  if (s.phase !== 'Rally') return events;
  const b = s.ball;
  b.vx += b.cx; b.vy += b.cy; b.z += b.vz; b.u += b.vx; b.y -= b.vy;
  if (b.cx !== 0) b.cx /= DECAY; if (b.cy !== 0) b.cy /= DECAY;
  if (b.y < 40) { b.y = 40; b.cy /= WALL_DIVISOR; b.vy = -b.vy; emit('wall-top'); }
  else if (b.y > 211) { b.y = 211; b.cy /= WALL_DIVISOR; b.vy = -b.vy; emit('wall-bottom'); }
  if (b.u < -135.5) { b.u = -135.5; b.cx /= WALL_DIVISOR; b.vx = -b.vx; emit('wall-left'); }
  else if (b.u > 135.5) { b.u = 135.5; b.cx /= WALL_DIVISOR; b.vx = -b.vx; emit('wall-right'); }
  const side = b.z < 0 ? 0 : b.z > 75 ? 1 : null;
  if (side !== null) {
    if (contact(incoming[side].ball, incoming[side].own)) {
      const p = s.localPaddles[side], localCx = -p.dx / 25;
      b.cx = side === 0 ? localCx : -localCx; b.cy = p.dy / 25; b.vz = -b.vz; b.z = side === 0 ? 0 : 75; emit('return', side);
    } else {
      b.vx = b.vy = b.vz = b.cx = b.cy = 0; s.lives[side]--; s.servingSide = side;
      s.phase = s.lives[side] === 0 ? 'MatchEnded' : 'LifeLostHold'; s.phaseDeadline = s.tick + 19;
      if (s.phase === 'MatchEnded') s.result = { matchId: s.matchId, eventId: s.lastEventId + 1, loser: side, winner: side === 0 ? 1 : 0, lives: [...s.lives] };
      emit(s.phase === 'MatchEnded' ? 'finish' : 'miss', side);
    }
  }
  if (s.phase === 'Rally') { move(s.localPaddles[0]); move(s.localPaddles[1]); }
  s.viewBoxes = boxes(s); return events;
}
