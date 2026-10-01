import { field } from '../compat/profile';
import { project } from '../core/projection';
import type { Box, State } from '../core/types';
import { backingSize } from '../runtime/viewport';
import { createFeedback, orbActivity, pulse, type Feedback } from './feedback';

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

function court(ctx: CanvasRenderingContext2D, ball: Box, state: State, activity: ReturnType<typeof orbActivity>, wallPulse: number) {
  const f = field();
  const background = ctx.createRadialGradient(175.5, 120, 12, 175.5, 125.5, 200);
  background.addColorStop(0, '#190a0c'); background.addColorStop(0.55, '#0d0608'); background.addColorStop(1, '#030304');
  ctx.fillStyle = background; ctx.fillRect(0, 0, 350, 250);

  // Quiet geometric panels outside the playing volume; never a moving particle trail.
  ctx.lineWidth = 0.35;
  for (const x of [8, 342]) for (let y = 12; y < 245; y += 15) {
    const proximity = Math.max(0, 1 - Math.hypot(x - ball.x, y - ball.y) / 85);
    ctx.strokeStyle = `rgba(219,46,39,${0.12 + proximity * 0.18})`;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const angle = i * Math.PI / 3, px = x + Math.cos(angle) * 6, py = y + Math.sin(angle) * 6;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Light spreads over court geometry around the current ball and its depth slice.
  for (const z of [75, 60, 45, 30, 15, 0]) {
    const p = project(f.x, f.y, z, 301, 201);
    const near = Math.max(0, 1 - Math.abs(z - Math.max(0, state.ball.z)) / 25);
    ctx.strokeStyle = `rgba(220,57,42,${(z === 0 ? 0.54 : 0.17) + near * (0.12 + activity.speed * 0.08) + wallPulse * 0.08})`;
    ctx.lineWidth = z === 0 ? 0.7 : 0.45;
    ctx.strokeRect(p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
  }
  for (const x of [f.left, f.right]) for (const y of [f.top, f.bottom]) {
    const end = project(x, y, 75, 0, 0);
    ctx.strokeStyle = '#79322b'; ctx.lineWidth = 0.7; segment(ctx, x, y, end.x, end.y);
  }
  for (const x of [f.left + 60, f.x, f.right - 60]) {
    for (const y of [f.top, f.bottom]) {
      const end = project(x, y, 75, 0, 0);
      ctx.strokeStyle = '#42201d'; ctx.lineWidth = 0.4; segment(ctx, x, y, end.x, end.y);
    }
  }
  const depth = project(f.x, f.y, Math.max(0, state.ball.z), 301, 201);
  ctx.strokeStyle = `rgba(255,117,49,${0.14 + activity.speed * 0.08})`; ctx.lineWidth = 0.6;
  ctx.strokeRect(depth.x - depth.width / 2, depth.y - depth.height / 2, depth.width, depth.height);

  const radius = 28 + ball.width;
  const light = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, radius);
  light.addColorStop(0, `rgba(255,102,37,${0.08 + activity.speed * 0.035 + activity.impact * 0.035})`);
  light.addColorStop(1, 'rgba(255,102,37,0)');
  ctx.fillStyle = light; ctx.fillRect(ball.x - radius, ball.y - radius, radius * 2, radius * 2);

  // Illuminated portions of the fixed court lines move with the ball's influence.
  ctx.save(); ctx.beginPath(); ctx.rect(f.left, f.top, f.right - f.left, f.bottom - f.top); ctx.clip();
  for (const y of [f.top, f.bottom]) {
    const influence = Math.max(0, 1 - Math.abs(ball.y - y) / 100);
    ctx.strokeStyle = `rgba(255,110,51,${influence * 0.45 + wallPulse * 0.1})`; ctx.lineWidth = 1;
    segment(ctx, ball.x - 15, y, ball.x + 15, y);
  }
  for (const x of [f.left, f.right]) {
    const influence = Math.max(0, 1 - Math.abs(ball.x - x) / 100);
    ctx.strokeStyle = `rgba(255,91,44,${influence * 0.45 + wallPulse * 0.1})`; ctx.lineWidth = 1;
    segment(ctx, x, ball.y - 15, x, ball.y + 15);
  }
  ctx.restore();
  ctx.font = '4px Segoe UI, sans-serif'; ctx.fillStyle = '#a86c62';
  ctx.fillText('NEAR', 25, 239); ctx.textAlign = 'right'; ctx.fillText('FAR', 326, 239); ctx.textAlign = 'left';
}

function paddle(ctx: CanvasRenderingContext2D, box: Box, enemy: boolean, hit: number) {
  const x = box.x - box.width / 2, y = box.y - box.height / 2;
  const unit = box.width / 60, color = enemy ? '111,244,105' : '63,211,255';
  ctx.save();
  const glass = ctx.createLinearGradient(x, y, x + box.width, y + box.height);
  glass.addColorStop(0, `rgba(${color},0.22)`); glass.addColorStop(0.35, 'rgba(190,243,255,0.04)');
  glass.addColorStop(0.65, `rgba(${color},0.04)`); glass.addColorStop(1, `rgba(${color},0.18)`);
  ctx.fillStyle = glass; ctx.fillRect(x, y, box.width, box.height);
  ctx.strokeStyle = `rgba(${color},${0.8 + hit * 0.2})`; ctx.lineWidth = Math.max(0.4, unit * 0.7);
  ctx.strokeRect(x, y, box.width, box.height);
  // Metal frame accents preserve the full rectangular silhouette and clear glass center.
  const metal = ctx.createLinearGradient(x, y, x, y + box.height);
  metal.addColorStop(0, '#c5d5d9'); metal.addColorStop(0.25, '#3b535c'); metal.addColorStop(0.8, '#283c44'); metal.addColorStop(1, '#8299a0');
  ctx.fillStyle = metal;
  for (const edge of [x, x + box.width - 1.8 * unit]) ctx.fillRect(edge, y, 1.8 * unit, box.height);
  ctx.strokeStyle = `rgba(${color},${0.55 + hit * 0.45})`; ctx.lineWidth = unit * 1.4;
  for (const edge of [x, x + box.width]) for (const top of [y, y + box.height]) {
    const inwardX = edge === x ? 7 * unit : -7 * unit, inwardY = top === y ? 5 * unit : -5 * unit;
    ctx.beginPath(); ctx.moveTo(edge + inwardX, top); ctx.lineTo(edge, top); ctx.lineTo(edge, top + inwardY); ctx.stroke();
  }
  ctx.strokeStyle = `rgba(${color},0.3)`; ctx.lineWidth = 0.45;
  segment(ctx, box.x - 2 * unit, box.y, box.x + 2 * unit, box.y);
  segment(ctx, box.x, box.y - 2 * unit, box.x, box.y + 2 * unit);
  if (hit > 0) { ctx.fillStyle = `rgba(${color},${hit * 0.08})`; ctx.fillRect(x, y, box.width, box.height); }
  ctx.restore();
}

function orb(ctx: CanvasRenderingContext2D, box: Box, activity: ReturnType<typeof orbActivity>, time: number, missed: boolean) {
  const r = box.width / 2, energy = activity.speed * 0.5 + activity.spin * 0.3 + activity.impact * 0.2;
  const color = missed ? '169,123,87' : '255,177,67';
  ctx.save(); ctx.translate(box.x, box.y);
  const halo = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.5);
  halo.addColorStop(0, `rgba(${color},${0.14 + energy * 0.12})`); halo.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2); ctx.fill();
  const shell = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 0, 0, 0, r);
  shell.addColorStop(0, 'rgba(255,240,211,0.24)'); shell.addColorStop(0.55, 'rgba(202,91,25,0.13)');
  shell.addColorStop(0.85, `rgba(${color},0.22)`); shell.addColorStop(1, `rgba(${color},0.5)`);
  ctx.fillStyle = shell; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

  // All plasma paths are clipped inside the shell. No rays or trail extend outward.
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2); ctx.clip();
  const rays = r < 5 ? 4 : 7;
  for (let i = 0; i < rays; i++) {
    const angle = i * Math.PI * 2 / rays + time * (0.008 + energy * 0.025);
    const bias = activity.bias + Math.sin(time * 0.06 + i) * 0.5;
    const x = Math.cos(angle) * r * 0.87, y = Math.sin(angle) * r * 0.87;
    ctx.strokeStyle = `rgba(255,201,113,${0.3 + energy * 0.6})`; ctx.lineWidth = Math.max(0.25, r * 0.023);
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle + 0.4) * r * 0.35 + Math.cos(bias) * r * activity.spin * 0.15, Math.sin(angle + 0.4) * r * 0.35 + Math.sin(bias) * r * activity.spin * 0.15);
    ctx.lineTo(x * 0.67 + Math.sin(time * 0.2 + i) * r * energy * 0.13, y * 0.67);
    ctx.lineTo(x, y); ctx.stroke();
  }
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.6);
  core.addColorStop(0, '#fffaf1'); core.addColorStop(0.2, '#fff0cc'); core.addColorStop(0.4, `rgba(${color},0.9)`); core.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.lineWidth = Math.max(0.45, r * 0.04); ctx.strokeStyle = missed ? '#c49976' : '#ffda9a';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.96, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,246,224,0.72)'; ctx.lineWidth = Math.max(0.3, r * 0.045);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.8, Math.PI * 1.05, Math.PI * 1.5); ctx.stroke();
  ctx.restore();
}

export function draw(canvas: HTMLCanvasElement, current: State, previous: State, alpha: number, smooth: boolean, discontinuity: boolean, debug: boolean, feedback: Readonly<Feedback> = createFeedback(), showActors = true) {
  const rect = canvas.getBoundingClientRect(), size = backingSize(rect.width, rect.height, window.devicePixelRatio || 1);
  if (canvas.width !== size.width || canvas.height !== size.height) { canvas.width = size.width; canvas.height = size.height; }
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  ctx.setTransform(canvas.width / 350, 0, 0, canvas.height / 250, 0, 0);
  ctx.clearRect(0, 0, 350, 250);
  const p = poses(current, previous, alpha, smooth, discontinuity), time = current.tick + alpha;
  const activity = orbActivity(current, feedback, time);
  court(ctx, p.ball, current, activity, pulse(time, feedback.wallTick));
  if (showActors) {
    if (current.enemyAvailable) paddle(ctx, p.enemy, true, pulse(time, feedback.enemyTick));
    if (current.ballAvailable) orb(ctx, p.ball, activity, time, current.phase === 'MissHold');
    paddle(ctx, p.player, false, pulse(time, feedback.playerTick));
  }
  if (debug && showActors) {
    ctx.strokeStyle = '#f791cb'; ctx.lineWidth = 0.4;
    for (const box of [current.player.box, ...(current.ballAvailable ? [current.ball.box] : []), ...(current.enemyAvailable ? [current.enemy.box] : [])]) ctx.strokeRect(box.left, box.top, box.width, box.height);
  }
}
