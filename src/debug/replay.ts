import { PROFILE } from '../compat/profile';
import { difficulty } from '../core/constants';
import { assertFinite, createState } from '../core/state';
import { tick } from '../core/tick';
import type { Stamp, State } from '../core/types';
import type { Capture } from './trace';

function shape(value: unknown, template: unknown): void {
  if (template === null) return;
  if (typeof template !== typeof value || value === null) throw new Error('Invalid checkpoint shape');
  if (typeof template === 'object') for (const [key, v] of Object.entries(template as object)) shape((value as Record<string,unknown>)[key], v);
}
function index(value: unknown, name: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER): void {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`Invalid ${name}`);
}
function stamp(value: Stamp, name: string, latestTick: number, generation: number): void {
  index(value.tick, `${name}.tick`, 0, latestTick);
  index(value.generation, `${name}.generation`, 1);
  if (value.generation !== generation) throw new Error(`Invalid ${name} generation provenance`);
}
export function validateState(s: State) {
  shape(s, createState()); assertFinite(s); difficulty(s.level);
  if (s.profile !== PROFILE.id || !['ServeWaiting','Rally','MissHold','LevelIntro','GameOver','ContentComplete'].includes(s.phase)) throw new Error('Invalid checkpoint');
  index(s.tick, 'tick', 0);
  index(s.trial, 'trial', 1);
  index(s.rally, 'rally', 1);
  index(s.phaseTick, 'phaseTick', 0, s.tick);
  index(s.score, 'score', 0);
  index(s.playerLives, 'playerLives', 0, 5);
  index(s.enemyLives, 'enemyLives', 0, 3);
  for (const [name, maximum, decrement] of [['hitScore',100,10],['curveBonus',50,5],['superCurveBonus',150,15],['accuracyBonus',100,10]] as const) {
    index(s[name], name, 0, maximum);
    if (s[name] % decrement !== 0) throw new Error(`Invalid ${name}`);
  }
  index(s.remainingBonus, 'remainingBonus', 0, 3000);
  if (s.remainingBonus % 25 !== 0) throw new Error('Invalid remainingBonus');
  index(s.bonusCounter, 'bonusCounter', 0, 10);
  index(s.ball.generation, 'ball.generation', 1);
  for (const [name, value] of Object.entries(s.diagnostics)) index(value, `diagnostics.${name}`, 0);
  // Null is the only lifecycle sentinel; elapsed ticks are nonnegative integers.
  if (s.phase === 'MissHold') index(s.missTick, 'missTick', 0, s.tick);
  else if (s.missTick !== null) throw new Error('Invalid missTick outside MissHold');
  if (s.phase === 'GameOver' && s.playerLives !== 0) throw new Error('Invalid game-over lives');
  if (s.phase === 'ContentComplete' && (s.level !== 10 || s.enemyLives !== 0)) throw new Error('Invalid content-complete state');
  // Level setup constructs a fresh stopped ball and stopped AI publication.
  // Neither is advanced while LevelIntro holds; curves would also start motion.
  if (s.phase === 'LevelIntro' && [s.ball.vx, s.ball.vy, s.ball.vz, s.ball.cx, s.ball.cy,
    s.publishedBall.vx, s.publishedBall.vy, s.publishedBall.vz].some(value => value !== 0)) throw new Error('Invalid LevelIntro motion');
  stamp(s.publishedBall, 'publishedBall', s.tick, s.ball.generation);
  stamp(s.ball.box, 'ball.box', s.tick, s.ball.generation);
  for (const side of ['player', 'enemy'] as const) {
    const paddle = s[side];
    stamp(paddle, side, s.tick, paddle.generation);
    stamp(paddle.box, `${side}.box`, paddle.tick, paddle.generation);
  }
  if (s.cache !== null) {
    shape(s.cache, { tick: 0, player: { x:0,y:0,dx:0,dy:0,tick:0,generation:1 }, enemy: { x:0,y:0,dx:0,dy:0,tick:0,generation:1 } });
    index(s.cache.tick, 'cache.tick', 0, s.tick);
    for (const side of ['player', 'enemy'] as const) stamp(s.cache[side], `cache.${side}`, s.cache.tick, s[side].generation);
  }
}
// JSON canonicalization intentionally treats -0 and +0 alike.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (value && typeof value === 'object') return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  return JSON.stringify(value);
}
export function replay(raw: unknown): State {
  const capture = raw as Capture;
  if (!capture || capture.schema !== 'curveball-m2-trace-2' || capture.profile !== PROFILE.id) throw new Error('Unknown trace schema/profile');
  assertFinite(capture); validateState(capture.checkpoint); validateState(capture.final); difficulty(capture.level);
  if (!Array.isArray(capture.records) || capture.records.length > 600 || capture.level !== capture.checkpoint.level) throw new Error('Invalid trace records');
  let state = structuredClone(capture.checkpoint);
  const sequences = new Set<number>();
  if (canonical(capture.range) !== canonical([state.tick+1,capture.final.tick])) throw new Error('Invalid range');
  for (const record of capture.records) {
    if (record.tick !== state.tick+1 || !Array.isArray(record.commands)) throw new Error('Noncontiguous trace');
    for (const c of record.commands) { if (sequences.has(c.sequence)) throw new Error('Duplicate command sequence'); sequences.add(c.sequence); }
    const result=tick(state,record.commands);state=result.state;
    if (canonical(result.events)!==canonical(record.events) || canonical(result.audit)!==canonical(record.audit)) throw new Error(`Trace observation mismatch at tick ${record.tick}`);
  }
  if (canonical(state)!==canonical(capture.final)) throw new Error('Replay final state mismatch');
  return state;
}
