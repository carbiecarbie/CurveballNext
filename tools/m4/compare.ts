import { field } from '../../src/compat/profile';
import { overlaps, walls } from '../../src/core/collisions';
import { serve } from '../../src/core/lifecycle';
import { createState } from '../../src/core/state';
import { tick } from '../../src/core/tick';
import type { Audit, Box, Event, Paddle, State } from '../../src/core/types';

type Special = { special: string; bits?: string };
type Scalar = number | Special;
interface Vector { x: Scalar; y: Scalar; z?: Scalar }
interface NativeDisplay { x: number; y: number; width: number; height: number; worldTwips: number[] }
interface Actor { allocation: number; position: Vector; previous: Vector; displacement: Vector; display: NativeDisplay }
interface Cached { x: Scalar; y: Scalar; dx: Scalar; dy: Scalar }
export interface Observation {
  frame: number; seq: number; target: { x: number; y: number };
  field: { left: number; right: number; top: number; bottom: number; centerX: number; centerY: number };
  level: number; score: number; playerLives: number; enemyLives: number;
  hitScore: number; curveBonus: number; superCurveBonus: number; accuracyBonus: number;
  remainingBonus: number; bonusCounter: number;
  player: Actor; enemy: Actor | null;
  paddlePublication: Cached; enemyPublication: Cached;
  ball: { allocation: number; position: Vector; velocity: Vector; curve: Vector; display: NativeDisplay; cache: { player: Cached; enemy: Cached } } | null;
  publishedBall: { x: number; y: number; z: number; vx: number; vy: number; vz: number };
}
export interface EvidenceCase {
  name: string; evidenceClass: string; points: Record<string, Observation>; completeFrames: number;
  contacts: { frame: number; result: boolean; a: { display: NativeDisplay }; b: { display: NativeDisplay } }[];
  sampleFrames: { callbacks: { cid: number }[] }[];
  cacheReads: { name: string; sourceFrame: number; value: Scalar }[];
  publicationReads: { frame: number; name: string; consumer: { cid: number }; sourceFrame: number; writer: { cid: number } }[];
  lifecycleFrames?: Observation[];
  instructionPhases: { seq: number; frame: number; position: Vector; velocity: Vector; curve: Vector }[];
}
export interface Evidence { oracle: unknown; commonReady?: Observation; results: EvidenceCase[] }
export interface Comparison { case: string; scope: string; evidenceClass: string; status: 'MATCH' | 'DIVERGENCE' | 'INCONCLUSIVE / NOT COMPARABLE' | 'INTENTIONAL CURVEBALLNEXT CONTAINMENT'; detail: string; differences: { field: string; original: unknown; next: unknown }[] }
const num = (v: Scalar | undefined): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v && typeof v === 'object' && v.special === '-0') return -0;
  throw new Error(`Cannot seed finite Next state from ${JSON.stringify(v)}`);
};
const box = (d: NativeDisplay, frame: number, generation: number): Box => ({ x: d.x, y: d.y, width: d.width, height: d.height,
  left: d.worldTwips[0] / 20, top: d.worldTwips[1] / 20, right: d.worldTwips[2] / 20, bottom: d.worldTwips[3] / 20, tick: frame, generation });

/** Align a measured checkpoint; preserve native old boxes. This is not an end-to-end parity claim. */
export function seed(o: Observation): State {
  if (!o.ball || !o.enemy) throw new Error('Cannot seed absent actors');
  const s = createState(o.level, o.frame);
  for (const key of ['score', 'playerLives', 'enemyLives', 'hitScore', 'curveBonus', 'superCurveBonus', 'accuracyBonus', 'remainingBonus', 'bonusCounter'] as const) s[key] = o[key];
  const actor = (a: Actor, pub: Cached): Paddle => ({
    // Both original publications use logical myPos; display readback is independent.
    x: num(a.position.x), y: num(a.position.y),
    previous: { x: num(a.previous.x), y: num(a.previous.y) }, dx: num(pub.dx), dy: num(pub.dy),
    tick: o.frame, generation: a.allocation, box: box(a.display, o.frame, a.allocation),
  });
  s.player = actor(o.player, o.paddlePublication); s.enemy = actor(o.enemy, o.enemyPublication);
  const b = o.ball;
  s.ball = { x: num(b.position.x), y: num(b.position.y), z: num(b.position.z), vx: num(b.velocity.x), vy: num(b.velocity.y), vz: num(b.velocity.z),
    cx: num(b.curve.x), cy: num(b.curve.y), generation: b.allocation, box: box(b.display, o.frame, b.allocation) };
  s.phase = s.ball.vz === 0 ? 'ServeWaiting' : 'Rally';
  s.publishedBall = { ...o.publishedBall, tick: o.frame, generation: b.allocation };
  const cached = (c: Cached, generation: number) => ({ x: num(c.x), y: num(c.y), dx: num(c.dx), dy: num(c.dy), tick: o.frame, generation });
  s.cache = { tick: o.frame, player: cached(b.cache.player, s.player.generation), enemy: cached(b.cache.enemy, s.enemy.generation) };
  s.target = { ...o.target }; return s;
}
export const ballValues = (o: Observation) => {
  if (!o.ball) throw new Error('Absent observed ball');
  return [o.ball.position.x, o.ball.position.y, o.ball.position.z, o.ball.velocity.x, o.ball.velocity.y, o.ball.velocity.z, o.ball.curve.x, o.ball.curve.y];
};
const nextBall = (s: State) => [s.ball.x, s.ball.y, s.ball.z, s.ball.vx, s.ball.vy, s.ball.vz, s.ball.cx, s.ball.cy];
const observedDisplay = (o: Observation) => { const d=o.ball!.display; return [d.x,d.y,d.width,d.height,...d.worldTwips.map(t=>t/20)]; };
const nextDisplay = (s: State) => { const b=s.ball.box; return [b.x,b.y,b.width,b.height,b.left,b.top,b.right,b.bottom]; };
const awards = (s: Observation | State) => [s.score, s.hitScore, s.curveBonus, s.superCurveBonus, s.accuracyBonus, s.playerLives, s.enemyLives, s.remainingBonus, s.bonusCounter];
const steps = (s: State, n: number) => { for (let i = 0; i < n; i++) s = tick(s).state; return s; };
export function mathematicalEqual(original: unknown, next: unknown): boolean {
  const a = typeof original === 'object' && original && 'special' in original && original.special === '-0' ? -0 : original;
  return typeof a === 'number' && typeof next === 'number' && Number.isFinite(a) && Number.isFinite(next)
    ? Math.abs(a - next) <= 1e-9 + Math.abs(a) * 1e-12 : a === next;
}
export function observedWallWrites(c: EvidenceCase): string[] {
  const phases = c.instructionPhases;
  const start = phases.findIndex((p,i) => i > 0 && (([40,211].includes(num(p.position.y)) && p.position.y !== phases[i-1].position.y) || ([40,311].includes(num(p.position.x)) && p.position.x !== phases[i-1].position.x)));
  if (start < 1) throw new Error('Missing captured wall clamp');
  return phases.slice(start).flatMap((p,j) => {
    const before = phases[start+j-1];
    return [['y',p.position.y,before.position.y],['x',p.position.x,before.position.x],['cy',p.curve.y,before.curve.y],['cx',p.curve.x,before.curve.x],['vy',p.velocity.y,before.velocity.y],['vx',p.velocity.x,before.velocity.x]]
      .flatMap(([name,a,b]) => a !== b ? [name as string] : []);
  });
}
export function compareEvidence(e: Evidence): Comparison[] {
  const out: Comparison[] = [];
  const check = (c: EvidenceCase, scope: string, original: unknown[], next: unknown[], mathematical = false, detail = '') => {
    if (original.length !== next.length) throw new Error('Comparison arity mismatch');
    const differences = original.flatMap((a, i) => (mathematical ? mathematicalEqual(a, next[i]) : a === next[i]) ? [] : [{ field: `${scope}[${i}]`, original: a, next: next[i] }]);
    out.push({ case: c.name, scope, evidenceClass: c.evidenceClass, status: differences.length ? 'DIVERGENCE' : 'MATCH', differences, detail });
  };
  for (const c of e.results) {
    const p: Record<string, Observation> = { ...c.points };
    if (e.commonReady) p.ready = e.commonReady;
    if (p.ready) {
      const f = field(); check(c, 'field', Object.values(p.ready.field), [f.left, f.right, f.top, f.bottom, f.x, f.y], false, 'Logical dimensions/center; stroke bounds are recorded separately.');
    }
    if (c.sampleFrames.length) check(c, 'callback-order', c.sampleFrames[0].callbacks.map(c => c.cid).filter(cid => cid !== 77), tick(seed(p.ready ?? p.prepared)).audit.callbacks!.map(name => ({ball:80,enemy:75,player:59})[name as 'ball'|'enemy'|'player']), false, 'Ruffle ball/marker/enemy/player; Next production callback audit. Original cosmetic marker is recorded but excluded from the core-order comparison.');
    if (p.prepared && p.result) {
      const r = tick(seed(p.prepared));
      const originalContact = c.contacts.find(h => h.frame === p.result.frame);
      if (originalContact) check(c, 'native-contact', [originalContact.result], [r.audit.contacts[0]?.accepted], false, 'Native old ball box seeded exactly; Next installs its own paddle box through the production tick.');
      check(c, 'ball-numeric', ballValues(p.result), nextBall(r.state), true, 'Aligned measured checkpoint; full production tick, existing math tolerance only.');
      check(c, 'ball-display-installation', observedDisplay(p.result), nextDisplay(r.state), false, 'Native twips/f32 display versus production compatibility adapter; no tolerance widening or collision tolerance.');
      for (const side of ['player','enemy'] as const) {
        const a=p.result[side]!, b=r.state[side];
        check(c, side+'-publication', [a.position.x,a.position.y,a.displacement.x,a.displacement.y], [b.x,b.y,b.dx,b.dy],true);
        check(c,side+'-native-display',[a.display.x,a.display.y,a.display.width,a.display.height,...a.display.worldTwips], [b.box.x,b.box.y,b.box.width,b.box.height,...[b.box.left,b.box.top,b.box.right,b.box.bottom].map(v=>Math.round(v*20))]);
      }
      check(c, 'score-lives-bonus', awards(p.result), awards(r.state));
      if (c.name.startsWith('wall-')) {
        // Extract reversals from actual consecutive instruction observations.
        const responses = c.instructionPhases.flatMap((phase, i, all) => {
          if (!i) return [];
          return (['y','x'] as const).flatMap(axis => num(all[i-1].velocity[axis]) * num(phase.velocity[axis]) < 0
            ? [axis === 'y' ? phase.position.y === 40 ? 'wall-top' : 'wall-bottom' : phase.position.x === 40 ? 'wall-left' : 'wall-right'] : []);
        });
        check(c, 'wall-event-order', responses, r.events.filter(e => e.type.startsWith('wall-')).map(e => e.type), false, 'Original instruction-state transitions establish y response before x.');
        const writes: string[] = [];
        const preWall = structuredClone(r.audit.checkpoints.find(p=>p.phase==='post-decay')!.ball);
        const observed = new Proxy(preWall, { set(target,key,value) { writes.push(String(key)); return Reflect.set(target,key,value); } });
        walls(observed, []);
        check(c, 'wall-assignment-order', observedWallWrites(c), writes, false, 'Actual production walls setter sequence versus changes at selected original AVM1 instructions; clamp, attenuation, reversal.');
      }
      if (c.name === 'old-box') check(c, 'new-box-counterfactual', [false], [overlaps(r.state.ball.box, r.state.player.box)], false, 'After contact the newly installed box no longer overlaps. Original contact was true on its previous installed box.');
    }
    if (p.served && ['ordinary-serve','moving-cache','centered-cache'].includes(c.name)) {
      const before = p['before-moving-serve'] ?? p['center-prepared'] ?? p['waiting-after'];
      const s = seed(before), events: Event[] = [], audit: Audit = { checkpoints: [], contacts: [], aiInput: structuredClone(s.publishedBall) };
      serve(s, events, audit);
      check(c, 'checkpoint-serve-ball', ballValues(p.served), nextBall(s), true, 'Production serve using the same observed prior cache, outside a Next tick; dispatch mechanism comparison only.');
      check(c, 'checkpoint-serve-awards', awards(p.served), awards(s));
      const firstResult = tick(s), first = firstResult.state;
      check(c, 'checkpoint-first-flight', ballValues(p['first-flight']), nextBall(first), true);
      const aiRead = c.publicationReads.find(r=>r.frame===p['first-flight'].frame && r.consumer.cid===75 && r.name==='ballPosX');
      if (aiRead) check(c, 'ai-publication-age', [aiRead.frame-aiRead.sourceFrame], [first.tick-firstResult.audit.aiInput.tick], false, 'Actual source opcode-write frame versus Next publishedBall stamp, from the same aligned serve checkpoint.');
      if (c.name === 'moving-cache') {
        let natural = seed(p.ready); natural.target = { x: 215, y: 150 }; natural = tick(natural).state;
        natural.target = { x: 220, y: 155 }; serve(natural, [], { checkpoints: [], contacts: [], aiInput: natural.publishedBall });
        check(c, 'ordinary-moving-input-serve', [p.served.ball!.curve.x, p.served.ball!.curve.y, p.served.score], [natural.ball.cx, natural.ball.cy, natural.score], false,
          'Same integer host input sequence from measured ready state. Ball consumes the prior paddle publication; MouseDown consumes the cache made by the preceding complete ball callback.');
      }
      if (p['moving-end']) {
        const end=steps(first,p['moving-end'].frame-p['first-flight'].frame), o=p['moving-end'];
        check(c,'moving-paddle-publication',[o.player.position.x,o.player.position.y,o.paddlePublication.dx,o.paddlePublication.dy],[end.player.x,end.player.y,end.player.dx,end.player.dy],true);
      }
      if (c.name === 'ordinary-serve') {
        const waiting = steps(seed(p['waiting-before']), 22);
        check(c, 'waiting-bonus', [p['waiting-after'].remainingBonus, p['waiting-after'].bonusCounter], [waiting.remainingBonus, waiting.bonusCounter]);
        for (const name of ['active-11','active-22']) {
          const n = p[name].frame - p.served.frame, advanced = steps(s, n);
          check(c, name + '-bonus', [p[name].remainingBonus, p[name].bonusCounter], [advanced.remainingBonus, advanced.bonusCounter]);
        }
        const final = steps(s, p['ordinary-end'].frame - p.served.frame);
        check(c, 'ordinary-rally-ball', ballValues(p['ordinary-end']), nextBall(final), true, 'Includes naturally executed near/far contacts; accumulated scheduling/display differences are not isolated by this long run.');
        check(c, 'ordinary-rally-awards', awards(p['ordinary-end']), awards(final));
      }
    }
    if (c.name.startsWith('fractional-input')) {
      const s = seed(p.ready); s.target = p['fractional-settled'].target;
      const final = steps(s, 35);
      check(c, 'fractional-host-readback', [p['fractional-settled'].player.display.x, p['fractional-settled'].player.display.y], [final.player.box.x, final.player.box.y], true, 'Normal PlayerEvent path and device-pixel mouse readback; historical Flash equivalence remains unverified.');
    }
    if (p.miss && p.resolution) {
      const r = tick(seed(p.prepared));
      check(c, 'miss-score-lives-bonus', awards(p.miss), awards(r.state));
      check(c, 'miss-delay', [p.resolution.frame - p.miss.frame], [19]);
      const resolved = steps(r.state, 19);
      if (c.name !== 'level-10-completion') check(c, 'resolution-level-score', [p.resolution.level, p.resolution.score], [resolved.level, resolved.score]);
      if (c.name !== 'level-10-completion') check(c, 'resolution-ball-present', [p.resolution.ball !== null], [resolved.ballAvailable], false, 'Removed actor placeholders are unavailable; fresh ball Load follows at the measured boundary.');
      check(c, 'resolution-player-retention', [p.resolution.player.allocation === p.prepared.player.allocation], [resolved.player.generation === r.state.player.generation]);
      check(c, 'resolution-player-position', [p.resolution.player.display.x, p.resolution.player.display.y], [resolved.player.box.x, resolved.player.box.y], true);
      if (c.name !== 'level-10-completion') for (const o of c.lifecycleFrames ?? []) {
        let n = structuredClone(resolved);
        if (c.name === 'level-intro-input' && o.frame > resolved.tick) n.target = {x:55,y:45};
        n = steps(n,o.frame-resolved.tick);
        const tag = 'lifecycle+'+(o.frame-resolved.tick);
        check(c,tag+'-availability',[!!o.ball,!!o.enemy],[n.ballAvailable,n.enemyAvailable]);
        check(c,tag+'-world',awards(o),awards(n));
        check(c,tag+'-publication',Object.values(o.publishedBall),[n.publishedBall.x,n.publishedBall.y,n.publishedBall.z,n.publishedBall.vx,n.publishedBall.vy,n.publishedBall.vz],true);
        check(c,tag+'-player',[o.player.position.x,o.player.position.y,o.paddlePublication.dx,o.paddlePublication.dy,o.player.display.x,o.player.display.y],[n.player.x,n.player.y,n.player.dx,n.player.dy,n.player.box.x,n.player.box.y],true);
        if (o.ball) {
          check(c,tag+'-ball',ballValues(o),nextBall(n),true);
          check(c,tag+'-native-display',observedDisplay(o),nextDisplay(n));
          const actual = Object.values(o.ball.cache.player).map(v=>typeof v==='object' ? v.special : v);
          const cache = n.cache?.player;
          check(c,tag+'-cache',actual,cache ? [cache.x,cache.y,cache.dx,cache.dy] : ['undefined','undefined','undefined','undefined'],true);
        }
      }
      if (c.name.startsWith('retry-')) {
        const ready = steps(resolved, p['retry-ready'].frame - p.resolution.frame);
        check(c, 'retry-enemy-retention', [p['retry-ready'].enemy!.allocation === p.prepared.enemy!.allocation], [ready.enemy.generation === r.state.enemy.generation]);
        check(c, 'retry-ball-replacement', [p['retry-ready'].ball!.allocation !== p.prepared.ball!.allocation], [ready.ball.generation !== r.state.ball.generation]);
        check(c, 'retry-bonus-retention', [p['retry-ready'].bonusCounter, p['retry-waited'].bonusCounter], [resolved.bonusCounter, resolved.bonusCounter], false, 'Waiting is stopped; resumed result independently simulated below.');
        ready.target = { x: 176, y: 126 }; const waited = steps(ready,20);
        serve(waited, [], { checkpoints: [], contacts: [], aiInput: waited.publishedBall }); const resumed = steps(waited,6);
        check(c, 'resumed-bonus', [p['resumed-six'].remainingBonus, p['resumed-six'].bonusCounter], [resumed.remainingBonus, resumed.bonusCounter]);
      } else if (['level-1-completion','level-intro-input'].includes(c.name)) {
        if (c.name === 'level-intro-input') resolved.target = {x:55,y:45};
        const ready = steps(resolved,50);
        check(c,'next-level-player-position',[p['next-level-ready'].player.display.x,p['next-level-ready'].player.display.y],[ready.player.box.x,ready.player.box.y]);
        check(c, 'next-level-world', [p['next-level-ready'].level, p['next-level-ready'].score, p['next-level-ready'].playerLives, p['next-level-ready'].enemyLives, p['next-level-ready'].remainingBonus, p['next-level-ready'].bonusCounter], [ready.level,ready.score,ready.playerLives,ready.enemyLives,ready.remainingBonus,ready.bonusCounter]);
        check(c, 'next-level-enemy-reconstructed', [p['next-level-ready'].enemy!.allocation !== p.prepared.enemy!.allocation], [ready.enemy.generation !== r.state.enemy.generation]);
      } else {
        out.push({ case: c.name, scope: 'undefined-level-11-difficulty', evidenceClass: c.evidenceClass, status: 'INTENTIONAL CURVEBALLNEXT CONTAINMENT', differences: [{field:'level',original:p.resolution.level,next:resolved.level},{field:'ballAvailable',original:p.resolution.ball!==null,next:resolved.ballAvailable}], detail: 'Injected world.level=10 while cached level-1 difficulty remains; original advances to undefined entry 11. Next intentionally contains completion at level 10. No natural level-10 campaign or undefined-motion execution was tested.' });
      }
    }
  }
  return out;
}
