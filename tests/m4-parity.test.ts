import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { compareEvidence, mathematicalEqual, seed, type Evidence } from '../tools/m4/compare';
import { Recorder } from '../src/debug/trace';
import { replay } from '../src/debug/replay';
import { tick } from '../src/core/tick';

const evidence: Evidence = JSON.parse(readFileSync('docs/evidence/m4-ruffle-observations.json', 'utf8'));
const comparisons = compareEvidence(evidence);
for (const c of evidence.results) if (evidence.commonReady) c.points.ready = evidence.commonReady;
const observed = (name: string) => evidence.results.find(c => c.name === name)!;
const result = (name: string, scope: string) => comparisons.find(c => c.case === name && c.scope === scope)!;

describe('M4 actual pinned Ruffle observations against production CurveballNext', () => {
  test('all 63 executed sessions receive comparisons; injected evidence stays separate', () => {
    expect(evidence.results).toHaveLength(63);
    expect(new Set(comparisons.map(c => c.case)).size).toBe(63);
    expect(observed('moving-cache').evidenceClass).toBe('ORDINARY_RUNTIME_INPUT');
    expect(observed('old-box').evidenceClass).toBe('CONTROLLED_RUNTIME_FIXTURE');
  });
  test.each(['ordinary-serve','moving-cache','centered-cache'])('%s measured cache serve and first movement agree', name => {
    for (const scope of ['checkpoint-serve-ball','checkpoint-serve-awards','checkpoint-first-flight']) expect(result(name,scope).status).toBe('MATCH');
  });
  test.each(['wall-right','wall-corner','old-box'])('%s ball and score response agree', name => {
    for (const scope of ['ball-numeric','score-lives-bonus']) expect(result(name,scope).status).toBe('MATCH');
  });
  test.each(['wall-right','wall-corner','wall-left','wall-bottom'])('%s exact assignment and event order matches original instructions', name => {
    for (const scope of ['wall-assignment-order','wall-event-order','ball-numeric','score-lives-bonus']) expect(result(name,scope).status).toBe('MATCH');
  });
  test('wall instruction observations independently establish decay and y-before-x reversal', () => {
    const phases = observed('wall-corner').instructionPhases;
    const y = phases.find(p => typeof p.velocity.y === 'number' && p.velocity.y < 0)!;
    const x = phases.find(p => typeof p.velocity.x === 'number' && p.velocity.x < 0)!;
    expect(y.seq).toBeLessThan(x.seq);
    expect(mathematicalEqual(y.curve.x, .5 / 1.004)).toBe(true);
    expect(mathematicalEqual(observed('wall-corner').points.result.ball!.curve.x, .5 / 1.004 / ((1.004 - 1) * 50 + 1))).toBe(true);
    expect(result('wall-corner','wall-event-order').status).toBe('MATCH');
    expect(result('wall-corner','wall-assignment-order').status).toBe('MATCH');
    expect(result('wall-right','wall-assignment-order').status).toBe('MATCH');
  });
  test('R08 actual old native box hits while the newly installed logical projection misses', () => {
    expect(result('old-box','native-contact').status).toBe('MATCH');
    expect(result('old-box','new-box-counterfactual').status).toBe('MATCH');
    expect(observed('old-box').contacts.at(-1)!.result).toBe(true);
    expect(observed('old-box').points.result.ball!.position.x).toBe(237.5);
  });
  test('24 native edge fixtures include touch and one-twip separating cases', () => {
    const edges = evidence.results.filter(c => c.name.startsWith('edge-'));
    expect(edges).toHaveLength(24);
    for (const c of edges) expect(c.contacts.at(-1)!.result).toBe(c.name.endsWith('--0.05') || c.name.endsWith('-0'));
    for (const c of edges) expect(result(c.name,'native-contact').status).toBe('MATCH');
  });
  test('all 18 accuracy/velocity cases agree independently of native acceptance boundaries', () => {
    const cases = evidence.results.filter(c => c.name.startsWith('accuracy-'));
    expect(cases).toHaveLength(18);
    for (const c of cases) for (const scope of ['native-contact','ball-numeric','score-lives-bonus']) expect(result(c.name,scope).status).toBe('MATCH');
    expect(observed('accuracy-7-0').points.result.score).toBe(200);
    expect(observed('accuracy-7.05-0').points.result.score).toBe(100);
    expect(observed('accuracy-0-5').points.result.score).toBe(200);
    expect(observed('accuracy-0-5.05').points.result.score).toBe(100);
  });
  test('consecutive callbacks and ordinary moving-cache provenance establish prior-paddle/current-ball cache ages', () => {
    const c = observed('moving-cache');
    for (const f of c.sampleFrames) expect(f.callbacks.map(c => c.cid)).toEqual([80,77,75,59]);
    expect(c.cacheReads.length).toBeGreaterThan(0);
    for (const read of c.cacheReads) expect(read.sourceFrame).toBe(c.points['before-moving-serve'].frame);
    expect(c.points['before-moving-serve'].ball!.cache.player).toEqual({ x:176,y:126,dx:0,dy:0 });
    expect(c.points['before-moving-serve'].paddlePublication).toEqual({ x:202,y:142,dx:26,dy:16 });
    const reads = c.publicationReads.filter(r=>r.frame===c.points['after-moving-frame'].frame);
    expect(reads.some(r=>r.consumer.cid===80 && r.name==='paddleSpeedX' && r.sourceFrame===r.frame-1 && r.writer.cid===59)).toBe(true);
    expect(reads.some(r=>r.consumer.cid===75 && r.name==='ballPosX' && r.sourceFrame===r.frame && r.writer.cid===80)).toBe(true);
    const difference = result(c.name,'ordinary-moving-input-serve');
    expect(difference.status).toBe('MATCH');
    let next = seed(c.points.ready); next.target = {x:215,y:150};
    const moved = tick(next); next = moved.state;
    expect(moved.audit.callbacks).toEqual(['ball','enemy','player']);
    expect(next.cache!.player.tick).toBe(next.tick-1);
    expect(next.cache!.player.dx).toBe(0);
    const served = tick(next, [{type:'down',x:220,y:155,tick:next.tick+1,sequence:1,timestamp:1,late:false}]);
    expect(served.state.score).toBe(100);
    expect(served.events.find(e=>e.type==='serve')!.sample!.dx).toBe(0);
    expect(result(c.name,'ai-publication-age').status).toBe('MATCH');
  });
  test.each(['retry-player','retry-enemy'])('%s awards, bonus cadence and same-level retention and replacement readiness agree', name => {
    for (const scope of ['miss-score-lives-bonus','miss-delay','resolution-level-score','resolution-player-retention','retry-enemy-retention','retry-ball-replacement','retry-bonus-retention','resumed-bonus']) expect(result(name,scope).status).toBe('MATCH');
    expect(result(name,'resolution-ball-present').status).toBe('MATCH');
  });
  test('level transition and level-10 containment differences remain explicit', () => {
    expect(result('level-1-completion','resolution-player-retention').status).toBe('MATCH');
    expect(result('level-1-completion','next-level-world').status).toBe('MATCH');
    expect(result('level-10-completion','undefined-level-11-difficulty').status).toBe('INTENTIONAL CURVEBALLNEXT CONTAINMENT');
  });
  test('R05 general display policy agrees at six depths, including f32 far bounds and both pixel ties', () => {
    const cases=evidence.results.filter(c=>c.name.startsWith('display-depth-'));
    expect(cases).toHaveLength(6);
    for (const c of cases) for (const scope of ['ball-display-installation','player-native-display','enemy-native-display','player-publication','enemy-publication']) expect(result(c.name,scope).status).toBe('MATCH');
    for (const name of ['fractional-input','fractional-input-odd']) expect(result(name,'fractional-host-readback').status).toBe('MATCH');
    expect(observed('fractional-input-odd').points['fractional-settled'].player.display.x).toBe(178);
  });
  test.each(['retry-player','retry-enemy'])('%s removed ball, Load, first cache and root publication ages follow captured frames',name=>{
    const c=observed(name); let s=tick(seed(c.points.prepared)).state;
    for(let i=0;i<19;i++) s=tick(s).state;
    const oldPublication=structuredClone(s.publishedBall), generation=s.ball.generation;
    expect(s.ballAvailable).toBe(false);expect(s.cache).toBeNull();
    const loaded=tick(s);s=loaded.state;
    expect(s.ballAvailable).toBe(true);expect(s.ball.generation).toBe(generation+1);
    expect(s.cache).toBeNull();expect(s.publishedBall).toEqual(oldPublication);
    expect(loaded.audit.callbacks).toEqual(['enemy','player']);
    const recorder=new Recorder(s), first=tick(s);recorder.record([],first);
    expect(first.state.cache!.player.tick).toBe(s.tick);
    expect(first.state.publishedBall.tick).toBe(first.state.tick);
    expect(first.audit.callbacks).toEqual(['ball','enemy','player']);
    expect(replay(recorder.export())).toEqual(first.state);
    for(const r of comparisons.filter(r=>r.case===name&&r.scope.startsWith('lifecycle+'))) expect(r.status).toBe('MATCH');
  });
  test('R11 retained player moves during intro; setup, enemy Load, ball Load and first callback are distinct',()=>{
    const c=observed('level-intro-input');let s=tick(seed(c.points.prepared)).state;
    for(let i=0;i<19;i++) s=tick(s).state;
    const generation=s.player.generation;s.target={x:55,y:45};
    s=tick(s).state;
    expect(s.player.generation).toBe(generation);
    expect(mathematicalEqual(s.player.x,c.points['intro-moving'].player.position.x)).toBe(true);
    expect(s.player.x).not.toBe(s.player.box.x);
    for(let i=1;i<45;i++) s=tick(s).state;
    expect([s.remainingBonus,s.bonusCounter,s.accuracyBonus]).toEqual([3000,10,100]);
    expect([s.enemyAvailable,s.ballAvailable]).toEqual([false,false]);
    s=tick(s).state;expect([s.enemyAvailable,s.ballAvailable]).toEqual([true,false]);
    s=tick(s).state;expect([s.phase,s.ballAvailable,s.cache]).toEqual(['ServeWaiting',true,null]);
    s=tick(s).state;expect(s.cache).not.toBeNull();expect(s.player.generation).toBe(generation);
    for(const r of comparisons.filter(r=>r.case===c.name&&r.scope.startsWith('lifecycle+'))) expect(r.status).toBe('MATCH');
  });
  test('changed deterministic profile rejects old provisional replay captures',()=>{
    const capture=new Recorder(seed(observed('moving-cache').points.ready)).export();
    capture.profile='m1-provisional-01';expect(()=>replay(capture)).toThrow('Unknown trace schema/profile');
  });
  test('every comparable observation passes without widening the numerical policy',()=>{
    expect(comparisons.filter(c=>c.status==='DIVERGENCE')).toEqual([]);
    expect(comparisons.filter(c=>c.status==='INTENTIONAL CURVEBALLNEXT CONTAINMENT')).toHaveLength(1);
  });
  test('measured wall checkpoint still replays exactly under the accepted Next replay contract', () => {
    let s = seed(observed('wall-corner').points.prepared);
    const recorder = new Recorder(s);
    for (let i=0;i<30;i++) { const r=tick(s); recorder.record([],r); s=r.state; }
    expect(replay(JSON.parse(JSON.stringify(recorder.export())))).toEqual(s);
  });
});
