import { field } from '../compat/profile';
import { project } from '../core/projection';
import type { Box, State } from '../core/types';
import { HZ } from '../runtime/clock';
import { backingSize } from '../runtime/viewport';
import { createFeedback, orbActivity, pulse, type Feedback } from './feedback';

const PLAYER = '63,211,255', ENEMY = '255,64,170';
const TRAIL_TICKS = 0.12 * HZ, BREATH_TICKS = 2.6 * HZ;

export function poses(current: State, previous: State, alpha: number, smooth: boolean, discontinuity: boolean) {
  const pose = (a: Box, b: Box) => !smooth || discontinuity || a.generation !== b.generation ? { ...a } : {
    ...a, x: b.x + (a.x - b.x) * alpha, y: b.y + (a.y - b.y) * alpha,
    width: b.width + (a.width - b.width) * alpha, height: b.height + (a.height - b.height) * alpha,
  };
  return { ball: pose(current.ball.box, previous.ball.box), player: pose(current.player.box, previous.player.box), enemy: pose(current.enemy.box, previous.enemy.box) };
}

function segment(ctx: CanvasRenderingContext2D, x: number, y: number, endX: number, endY: number) {
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(endX, endY); ctx.stroke();
}

/** Neon stroke: two wide, faint passes under the crisp line, added onto the scene. */
function glow(ctx: CanvasRenderingContext2D, path: () => void, rgb: string, alpha: number, width: number) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); path();
  ctx.strokeStyle = `rgba(${rgb},${alpha * 0.14})`; ctx.lineWidth = width * 6; ctx.stroke();
  ctx.strokeStyle = `rgba(${rgb},${alpha * 0.3})`; ctx.lineWidth = width * 2.4; ctx.stroke();
  ctx.strokeStyle = `rgba(${rgb},${Math.min(1, alpha)})`; ctx.lineWidth = width; ctx.stroke();
  ctx.restore();
}

function reducedMotion() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Cosmetic memory per canvas: the drawn ball's recent path and impact sparks. It reads only what was drawn,
 * so it never touches simulation or online state, and it is cleared by any discontinuity in the drawn path.
 */
interface Spark { x: number; y: number; vx: number; vy: number; born: number; life: number; size: number }
interface Fx { trail: { x: number; y: number; r: number; t: number }[]; sparks: Spark[]; last: { x: number; y: number; z: number; t: number } | null;
  velocity: { x: number; y: number; z: number } | null; impactAt: { x: number; y: number; z: number } }
const effects = new WeakMap<HTMLCanvasElement, Fx>();
function fxFor(canvas: HTMLCanvasElement): Fx {
  let fx = effects.get(canvas);
  if (!fx) { fx = { trail: [], sparks: [], last: null, velocity: null, impactAt: { x: -Infinity, y: -Infinity, z: -Infinity } }; effects.set(canvas, fx); }
  return fx;
}
function resetPath(fx: Fx) { fx.trail.length = 0; fx.last = null; fx.velocity = null; }
// Deterministic scatter so a given impact always throws the same sparks.
function scatter(seed: number) { const s = Math.sin(seed * 12.9898) * 43758.5453; return s - Math.floor(s); }
function spawn(fx: Fx, x: number, y: number, r: number, t: number, count: number) {
  const scale = Math.max(0.35, r / 15);
  for (let i = 0; i < count; i++) {
    const a = scatter(t * 7.1 + i) * Math.PI * 2, speed = (0.8 + scatter(t * 3.7 + i * 1.3) * 2.3) * scale;
    fx.sparks.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, born: t, life: (0.3 + scatter(t + i * 2.9) * 0.35) * HZ, size: (0.8 + scatter(t * 1.9 + i) * 1.3) * scale });
  }
}
/** Records the drawn ball and turns sharp reversals of its drawn motion (walls, paddles) into sparks. */
function track(fx: Fx, ball: Box, z: number, t: number, live: boolean) {
  const last = fx.last;
  if (!live || (last && (t < last.t || t - last.t > 5 || Math.hypot(ball.x - last.x, ball.y - last.y) > 60))) { resetPath(fx); if (!live) return; }
  if (fx.last && t > fx.last.t) {
    const dt = t - fx.last.t, v = { x: (ball.x - fx.last.x) / dt, y: (ball.y - fx.last.y) / dt, z: (z - fx.last.z) / dt }, p = fx.velocity, r = ball.width / 2;
    if (p) {
      const flipped = (a: number, b: number, min: number) => Math.sign(a) !== Math.sign(b) && Math.abs(a) > min && Math.abs(b) > min;
      if (flipped(v.z, p.z, 0.3) && t - fx.impactAt.z > 3) { fx.impactAt.z = t; spawn(fx, ball.x, ball.y, r, t, 14); }
      else if (flipped(v.x, p.x, 0.4) && t - fx.impactAt.x > 3) { fx.impactAt.x = t; spawn(fx, ball.x, ball.y, r, t, 9); }
      else if (flipped(v.y, p.y, 0.4) && t - fx.impactAt.y > 3) { fx.impactAt.y = t; spawn(fx, ball.x, ball.y, r, t, 9); }
    }
    fx.velocity = v;
  }
  if (!fx.last || t !== fx.last.t) fx.trail.push({ x: ball.x, y: ball.y, r: ball.width / 2, t });
  while (fx.trail.length && t - fx.trail[0].t > TRAIL_TICKS) fx.trail.shift();
  fx.last = { x: ball.x, y: ball.y, z, t };
}

function court(ctx: CanvasRenderingContext2D, ball: Box, state: { ball: { z: number } }, activity: ReturnType<typeof orbActivity>, wallPulse: number, time: number) {
  const f = field();
  // The red court breathes slowly; reduced-motion viewers get the same neon at rest.
  const breath = reducedMotion() ? 0.5 : 0.5 + 0.5 * Math.sin(time / BREATH_TICKS * Math.PI * 2);
  const background = ctx.createRadialGradient(175.5, 120, 12, 175.5, 125.5, 200);
  background.addColorStop(0, `rgb(${Math.round(25 + breath * 8)},${Math.round(10 + breath * 2)},${Math.round(12 + breath * 2)})`);
  background.addColorStop(0.55, '#0d0608'); background.addColorStop(1, '#030304');
  ctx.fillStyle = background; ctx.fillRect(0, 0, 350, 250);

  // Quiet geometric panels outside the playing volume.
  for (const x of [8, 342]) for (let y = 12; y < 245; y += 15) {
    const proximity = Math.max(0, 1 - Math.hypot(x - ball.x, y - ball.y) / 85);
    glow(ctx, () => {
      for (let i = 0; i <= 6; i++) {
        const angle = i * Math.PI / 3, px = x + Math.cos(angle) * 6, py = y + Math.sin(angle) * 6;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
    }, '219,46,39', 0.13 + proximity * 0.22 + breath * 0.1 + wallPulse * 0.12, 0.35);
  }
  for (const x of [f.left + 60, f.x, f.right - 60]) for (const y of [f.top, f.bottom]) {
    const end = project(x, y, 75, 0, 0);
    glow(ctx, () => { ctx.moveTo(x, y); ctx.lineTo(end.x, end.y); }, '160,40,32', 0.22 + breath * 0.08, 0.4);
  }
  // Light spreads over court geometry around the current ball and its depth slice.
  for (const z of [75, 60, 45, 30, 15, 0]) {
    const p = project(f.x, f.y, z, 301, 201);
    const near = Math.max(0, 1 - Math.abs(z - Math.max(0, state.ball.z)) / 25);
    const alpha = (z === 0 ? 0.5 : 0.16) + near * (0.12 + activity.speed * 0.08) + wallPulse * 0.12 + breath * (z === 0 ? 0.16 : 0.1);
    glow(ctx, () => ctx.rect(p.x - p.width / 2, p.y - p.height / 2, p.width, p.height), '220,57,42', alpha, z === 0 ? 0.7 : 0.45);
  }
  for (const x of [f.left, f.right]) for (const y of [f.top, f.bottom]) {
    const end = project(x, y, 75, 0, 0);
    glow(ctx, () => { ctx.moveTo(x, y); ctx.lineTo(end.x, end.y); }, '220,57,42', 0.4 + breath * 0.14, 0.7);
  }
  const depth = project(f.x, f.y, Math.max(0, state.ball.z), 301, 201);
  glow(ctx, () => ctx.rect(depth.x - depth.width / 2, depth.y - depth.height / 2, depth.width, depth.height), '255,117,49', 0.22 + activity.speed * 0.08, 0.6);

  const radius = 28 + ball.width;
  const light = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, radius);
  light.addColorStop(0, `rgba(255,102,37,${0.08 + activity.speed * 0.035 + activity.impact * 0.035})`);
  light.addColorStop(1, 'rgba(255,102,37,0)');
  ctx.fillStyle = light; ctx.fillRect(ball.x - radius, ball.y - radius, radius * 2, radius * 2);

  // Illuminated portions of the fixed court lines move with the ball's influence.
  ctx.save(); ctx.beginPath(); ctx.rect(f.left, f.top, f.right - f.left, f.bottom - f.top); ctx.clip();
  for (const y of [f.top, f.bottom]) {
    const influence = Math.max(0, 1 - Math.abs(ball.y - y) / 100);
    glow(ctx, () => { ctx.moveTo(ball.x - 15, y); ctx.lineTo(ball.x + 15, y); }, '255,110,51', (influence * 0.45 + wallPulse * 0.1) * 1.3, 0.9);
  }
  for (const x of [f.left, f.right]) {
    const influence = Math.max(0, 1 - Math.abs(ball.x - x) / 100);
    glow(ctx, () => { ctx.moveTo(x, ball.y - 15); ctx.lineTo(x, ball.y + 15); }, '255,91,44', (influence * 0.45 + wallPulse * 0.1) * 1.3, 0.9);
  }
  ctx.restore();
  ctx.font = '4px Segoe UI, sans-serif'; ctx.fillStyle = '#a86c62';
  ctx.fillText('NEAR', 25, 239); ctx.textAlign = 'right'; ctx.fillText('FAR', 326, 239); ctx.textAlign = 'left';
}

/** Read-only online draw adapter. It never emulates the solo simulation State. */
export function drawOnline(canvas: HTMLCanvasElement, model: import('../multiplayer/view').DrawModel) {
  const rect = canvas.getBoundingClientRect(), size = backingSize(rect.width, rect.height, window.devicePixelRatio || 1);
  if (canvas.width !== size.width || canvas.height !== size.height) { canvas.width = size.width; canvas.height = size.height; }
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  ctx.setTransform(canvas.width / 350, 0, 0, canvas.height / 250, 0, 0);
  const box = (r: import('../multiplayer/view').Rect): Box => ({ ...r, x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2,
    width: r.right - r.left, height: r.bottom - r.top, tick: model.tick, generation: 0 });
  const activity = { speed: .2, spin: 0, bias: 0, impact: 0 }, ball = box(model.ball);
  const time = Number.isFinite(model.ballTime) ? model.ballTime * HZ / 1000 : model.tick, fx = fxFor(canvas);
  track(fx, ball, model.z, time, !model.missed && !model.frozen);
  court(ctx, ball, { ball: { z: model.z } }, activity, 0, time);
  paddle(ctx, box(model.remote), true, 0);
  effectsLayer(ctx, fx, time); orb(ctx, ball, activity, time, model.missed);
  paddle(ctx, box(model.own), false, 0);
}

/** The original glass body and metal side rails, with a neon outline and bright corners on top. */
function paddle(ctx: CanvasRenderingContext2D, box: Box, enemy: boolean, hit: number) {
  const x = box.x - box.width / 2, y = box.y - box.height / 2;
  const unit = box.width / 60, color = enemy ? ENEMY : PLAYER;
  ctx.save();
  const glass = ctx.createLinearGradient(x, y, x + box.width, y + box.height);
  glass.addColorStop(0, `rgba(${color},${0.2 + hit * 0.1})`); glass.addColorStop(0.35, 'rgba(190,243,255,0.04)');
  glass.addColorStop(0.65, `rgba(${color},0.04)`); glass.addColorStop(1, `rgba(${color},${0.16 + hit * 0.1})`);
  ctx.fillStyle = glass; ctx.fillRect(x, y, box.width, box.height);
  const sheen = ctx.createLinearGradient(x, y, x + box.width * 0.6, y + box.height);
  sheen.addColorStop(0, 'rgba(255,255,255,0)'); sheen.addColorStop(0.45, 'rgba(255,255,255,0.07)'); sheen.addColorStop(0.55, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen; ctx.fillRect(x, y, box.width, box.height);
  const metal = ctx.createLinearGradient(x, y, x, y + box.height);
  metal.addColorStop(0, '#c5d5d9'); metal.addColorStop(0.25, '#3b535c'); metal.addColorStop(0.8, '#283c44'); metal.addColorStop(1, '#8299a0');
  ctx.fillStyle = metal;
  const rail = 1.4 * unit;
  for (const edge of [x + 0.6 * unit, x + box.width - 0.6 * unit - rail]) ctx.fillRect(edge, y + 3 * unit, rail, box.height - 6 * unit);
  glow(ctx, () => ctx.rect(x, y, box.width, box.height), color, 0.7 + hit * 0.3, Math.max(0.3, unit * 0.55));
  const corners = () => {
    for (const edge of [x, x + box.width]) for (const top of [y, y + box.height]) {
      const inwardX = edge === x ? 8 * unit : -8 * unit, inwardY = top === y ? 6 * unit : -6 * unit;
      ctx.moveTo(edge + inwardX, top); ctx.lineTo(edge, top); ctx.lineTo(edge, top + inwardY);
    }
  };
  glow(ctx, corners, color, 1, unit * 1.3);
  ctx.beginPath(); corners(); ctx.strokeStyle = `rgba(255,255,255,${0.6 + hit * 0.4})`; ctx.lineWidth = Math.max(0.2, unit * 0.45); ctx.lineJoin = 'round'; ctx.stroke();
  ctx.strokeStyle = `rgba(${color},0.35)`; ctx.lineWidth = 0.45;
  segment(ctx, box.x - 2 * unit, box.y, box.x + 2 * unit, box.y);
  segment(ctx, box.x, box.y - 2 * unit, box.x, box.y + 2 * unit);
  ctx.restore();
}

/** Short trail and impact sparks, drawn under the ball so neither can cover it. */
function effectsLayer(ctx: CanvasRenderingContext2D, fx: Fx, time: number) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (let i = 1; i < fx.trail.length; i++) {
    const a = fx.trail[i - 1], b = fx.trail[i], k = Math.max(0, 1 - (time - b.t) / TRAIL_TICKS);
    if (k <= 0 || Math.hypot(b.x - a.x, b.y - a.y) > 40) continue;
    ctx.strokeStyle = `rgba(255,140,50,${0.32 * k * k})`; ctx.lineWidth = b.r * 1.15 * k; segment(ctx, a.x, a.y, b.x, b.y);
    ctx.strokeStyle = `rgba(255,220,160,${0.45 * k * k})`; ctx.lineWidth = b.r * 0.3 * k; segment(ctx, a.x, a.y, b.x, b.y);
  }
  fx.sparks = fx.sparks.filter(s => time >= s.born && time - s.born < s.life);
  for (const s of fx.sparks) {
    const age = time - s.born, travel = (1 - Math.pow(0.92, age)) / 0.08, fade = 1 - age / s.life;
    ctx.fillStyle = `rgba(255,${Math.round(130 + fade * 60)},60,${fade})`;
    ctx.fillRect(s.x + s.vx * travel - s.size / 2, s.y + s.vy * travel - s.size / 2, s.size, s.size);
  }
  ctx.restore();
}

/** Solid hot core with bloom; the bright rim sits exactly on the ball's box, and one arc shows spin. */
function orb(ctx: CanvasRenderingContext2D, box: Box, activity: ReturnType<typeof orbActivity>, time: number, missed: boolean) {
  const r = box.width / 2, energy = activity.speed * 0.5 + activity.spin * 0.3 + activity.impact * 0.3;
  ctx.save(); ctx.translate(box.x, box.y);
  ctx.globalCompositeOperation = 'lighter';
  const bloom = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.3);
  bloom.addColorStop(0, `rgba(${missed ? '170,120,90' : '255,150,55'},${0.22 + energy * 0.2})`); bloom.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = bloom; ctx.beginPath(); ctx.arc(0, 0, r * 2.3, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  const body = ctx.createRadialGradient(-r * 0.22, -r * 0.28, 0, 0, 0, r);
  if (missed) { body.addColorStop(0, '#e8d6c6'); body.addColorStop(0.5, '#a98060'); body.addColorStop(1, '#6d4c38'); }
  else { body.addColorStop(0, '#fffbf2'); body.addColorStop(0.3, '#ffe6b0'); body.addColorStop(0.68, '#ffad48'); body.addColorStop(1, '#e8641f'); }
  ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  const rim = Math.max(0.5, r * 0.07);
  ctx.lineWidth = rim; ctx.strokeStyle = missed ? '#c9a585' : '#fff1d2';
  ctx.beginPath(); ctx.arc(0, 0, Math.max(0, r - rim / 2), 0, Math.PI * 2); ctx.stroke();
  if (!missed && r > 2.5) {
    const direction = Math.cos(activity.bias) >= 0 ? 1 : -1, start = time / HZ * (1.6 + activity.spin * 11) * direction, length = (0.3 + activity.spin * 0.9) * Math.PI;
    ctx.strokeStyle = `rgba(255,255,255,${0.35 + activity.spin * 0.55})`; ctx.lineWidth = Math.max(0.35, r * 0.1); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.66, start, start + length); ctx.stroke();
  }
  ctx.restore();
}

export function draw(canvas: HTMLCanvasElement, current: State, previous: State, alpha: number, smooth: boolean, discontinuity: boolean, debug: boolean, feedback: Readonly<Feedback> = createFeedback(), showActors = true) {
  const rect = canvas.getBoundingClientRect(), size = backingSize(rect.width, rect.height, window.devicePixelRatio || 1);
  if (canvas.width !== size.width || canvas.height !== size.height) { canvas.width = size.width; canvas.height = size.height; }
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  ctx.setTransform(canvas.width / 350, 0, 0, canvas.height / 250, 0, 0);
  ctx.clearRect(0, 0, 350, 250);
  const p = poses(current, previous, alpha, smooth, discontinuity), time = current.tick + alpha;
  const activity = orbActivity(current, feedback, time), fx = fxFor(canvas);
  const z = discontinuity || current.ball.box.generation !== previous.ball.box.generation ? current.ball.z : previous.ball.z + (current.ball.z - previous.ball.z) * alpha;
  if (discontinuity || current.ball.box.generation !== previous.ball.box.generation) resetPath(fx);
  track(fx, p.ball, z, time, showActors && current.ballAvailable && current.phase === 'Rally');
  court(ctx, p.ball, current, activity, pulse(time, feedback.wallTick), time);
  if (showActors) {
    if (current.enemyAvailable) paddle(ctx, p.enemy, true, pulse(time, feedback.enemyTick));
    if (current.ballAvailable) { effectsLayer(ctx, fx, time); orb(ctx, p.ball, activity, time, current.phase === 'MissHold'); }
    paddle(ctx, p.player, false, pulse(time, feedback.playerTick));
  }
  if (debug && showActors) {
    ctx.strokeStyle = '#fff27a'; ctx.lineWidth = 0.4;
    for (const box of [current.player.box, ...(current.ballAvailable ? [current.ball.box] : []), ...(current.enemyAvailable ? [current.enemy.box] : [])]) ctx.strokeRect(box.left, box.top, box.width, box.height);
  }
}
