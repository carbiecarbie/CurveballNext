import { describe, expect, test } from 'vitest';
import { display } from '../src/compat/display';
import { field, PROFILE } from '../src/compat/profile';
import { playerStep, enemyStep } from '../src/core/actors';
import { accurate, classify, overlaps } from '../src/core/collisions';
import { DECAY, DEPTH, DIAMETER, DIFFICULTIES, difficulty, PADDLE, PROJECTION_A } from '../src/core/constants';
import { installCurve, retry } from '../src/core/lifecycle';
import { project, scale } from '../src/core/projection';
import { createState, publish, sample } from '../src/core/state';
import { tick } from '../src/core/tick';
import type { Action, Ball, Command, State } from '../src/core/types';

export function command(s: State, action: Action, sequence = 1): Command { return { ...action, sequence, tick: s.tick + 1, timestamp: 0, late: false }; }
export function ball(s: State, patch: Partial<Ball>) {
  Object.assign(s.ball, patch);
  s.ball.box = display.install(project(s.ball.x, s.ball.y, s.ball.z, 30, 30), { tick: s.tick, generation: s.ball.generation });
  s.publishedBall = publish(s.ball, s.tick); s.phase = 'Rally'; return s;
}
function close(actual: number, expected: number) { expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1e-9 + Math.abs(expected) * 1e-12); }

describe('M0 mathematical/control-flow contract', () => {
  test('T01 exact constants and all difficulty tuples', () => {
    expect(DIFFICULTIES.map(d => [d.speed, d.curve, d.ai])).toEqual([[2,25,17],[2.33,22.5,14],[2.66,20,11],[3,17.5,9],[3.33,15,7],[3.66,12.5,5],[4,10,3.5],[4.33,10,2.75],[4.66,10,2],[6,10,1]]);
    expect([DEPTH, DIAMETER, DECAY, PROJECTION_A, PADDLE.width, PADDLE.height]).toEqual([75,30,1.004,31.066017,60,40]);
    for (const invalid of [0,11,1.1,NaN,Infinity]) expect(() => difficulty(invalid)).toThrow();
  });
  test('T02 eased displacement and repeated error reduction', () => {
    let s = createState(); s.target = { x:205.5,y:110.5 }; s = tick(s,[],PROFILE,{...display,readInput:p=>p}).state;
    expect([s.player.x,s.player.y,s.player.dx,s.player.dy]).toEqual([195.5,115.5,20,-10]);
    for (let i=0;i<8;i++) { const old = 205.5-s.player.x; s=tick(s,[],PROFILE,{...display,readInput:p=>p}).state; close(205.5-s.player.x,old/3); }
  });
  test.each([[1e5,1e5,296,206],[-1e5,-1e5,55,45]])('T02 clamps after easing (%s,%s)', (x,y,px,py) => {
    let s=createState(); s.target={x,y}; s=tick(s).state; expect([s.player.x,s.player.y]).toEqual([px,py]);
    s=tick(s).state; expect([s.player.dx,s.player.dy]).toEqual([0,0]);
  });
  test('T02 target is not preclamped',()=>{const s=createState();s.target.x=340;playerStep(s);close(s.player.x,175.5+(340-175.5)/1.5);});
  test('T03 ready stationary serve and first integration', () => {
    let s=tick(createState()).state; const r=tick(s,[command(s,{type:'down',x:175.5,y:125.5})]); s=r.state;
    expect(r.events[0]).toMatchObject({type:'serve',curve:'NONE',accurate:true});
    expect(r.audit.checkpoints[0].ball).toMatchObject({cx:-0.01,cy:-0.01,vz:2});
    close(s.ball.x,175.49);close(s.ball.y,125.51);
  });
  test('T03 player/enemy signs, floors and stationary returns',()=>{
    const s=createState(), p={...sample(s.player),dx:20,dy:-10};
    installCurve(s,p);expect([s.ball.cx,s.ball.cy]).toEqual([-0.8,-0.4]);
    installCurve(s,p,true);expect([s.ball.cx,s.ball.cy]).toEqual([0.8,0.4]);
    installCurve(s,{...p,dx:0,dy:0,x:170,y:130},false,true);expect([s.ball.cx,s.ball.cy]).toEqual([0.01,0.01]);
    installCurve(s,{...p,dx:-0.25,dy:0.25},false,true);expect([s.ball.cx,s.ball.cy]).toEqual([0.01,0.01]);
    installCurve(s,{...p,dx:0,dy:0});expect(Math.abs(s.ball.cx)+Math.abs(s.ball.cy)).toBe(0);
  });
  test('T04 independent three-step oracle',()=>{
    let s=ball(createState(),{x:100,y:100,z:10,vx:1,vy:-0.5,vz:2,cx:0.2,cy:-0.1});
    for(let n=0;n<3;n++)s=tick(s).state;
    const expected=[104.196815923556,102.098407961778,16,1.597612736305775,-0.798806368152887,0.197619072763722,-0.098809536381861];
    [s.ball.x,s.ball.y,s.ball.z,s.ball.vx,s.ball.vy,s.ball.cx,s.ball.cy].forEach((v,i)=>close(v,expected[i]));
  });
  test.each([0,1,3,10,30])('T04 independent closed form n=%s',n=>{
    let s=ball(createState(),{x:100,y:100,z:20,vx:0.1,vy:-0.05,vz:0.1,cx:0.02,cy:-0.01});
    for(let i=0;i<n;i++)s=tick(s).state;
    const q=1/1.004, sum=(1-q**n)/(1-q), pos=(n-q*sum)/(1-q);
    close(s.ball.x,100+n*0.1+0.02*pos);close(s.ball.y,100+n*0.05+0.01*pos);close(s.ball.vx,0.1+0.02*sum);close(s.ball.cx,0.02*q**n);
  });
  test.each([
    [{x:310.5,vx:1,cx:0.2},'wall-right','x',311,'vx',-1.2,'cx'],
    [{x:40.5,vx:-1,cx:-0.2},'wall-left','x',40,'vx',1.2,'cx'],
    [{y:40.5,vy:1,cy:0.2},'wall-top','y',40,'vy',-1.2,'cy'],
    [{y:210.5,vy:-1,cy:-0.2},'wall-bottom','y',211,'vy',1.2,'cy'],
  ] as const)('T05 wall %s', (patch,event,axis,position,velocity,speed,curve)=>{
    const r=tick(ball(createState(),{z:35,...patch}));expect(r.events.map(e=>e.type)).toEqual([event]);expect(r.state.ball[axis]).toBe(position);close(r.state.ball[velocity],speed);close(Math.abs(r.state.ball[curve]),0.166002656042497);
    expect(Math.sign(r.state.ball[curve])).toBe(Math.sign(patch[curve as keyof typeof patch]!));
  });
  test('T05 exact touching and large overshoot discarded',()=>{
    for(const p of [{x:40},{x:311},{y:40},{y:211}])expect(tick(ball(createState(),{z:30,...p})).events).toEqual([]);
    const r=tick(ball(createState(),{x:100,z:30,vx:1000}));expect(r.state.ball.x).toBe(311);expect(r.state.ball.vx).toBe(-1000);
  });
  test('T06 corner event order and response precedence',()=>{
    const s=ball(createState(),{x:310.5,y:40.5,z:1,vx:1,vy:1,vz:-2,cx:0.2,cy:0.2});
    s.ball.box=structuredClone(s.player.box);
    const r=tick(s);expect(r.events.map(e=>e.type)).toEqual(['wall-top','wall-right','return']);
    expect(r.state.ball).toMatchObject({x:311,y:40,z:0,vx:-1.2,vy:-1.2,vz:2});expect(Math.abs(r.state.ball.cx)+Math.abs(r.state.ball.cy)).toBe(0);
    s.ball.box=display.install({x:1000,y:1000,width:30,height:30},{tick:0,generation:1});
    const miss=tick(s);expect(miss.events.map(e=>e.type)).toEqual(['wall-top','wall-right','miss']);expect(miss.state.ball).toMatchObject({z:-1,vx:0,vy:0,vz:0,cx:0,cy:0});
  });
  test('T07 projection values, dimensions and negative depth',()=>{
    expect(scale(0)).toBe(1);close(scale(75),0.2499999987104862);expect(scale(75)).not.toBe(0.25);
    close(scale(15),0.713630721);close(scale(37.5),0.440436356);expect(scale(-1)).toBeGreaterThan(1);
    expect(project(175.5,125.5,75,60,40)).toMatchObject({x:175.5,y:125.5});
    close(project(205.5,110.5,75,60,40).x,175.5+30*0.2499999987104862);close(project(205.5,110.5,75,60,40).width,60*scale(75));
  });
  test.each([1,5,10])('T08 AI level %s uses logical displacement',level=>{
    const s=createState(level);s.publishedBall={...s.publishedBall,x:205.5,y:110.5,vz:2};enemyStep(s);
    close(s.enemy.dx,30/difficulty(level).ai);close(s.enemy.dy,-15/difficulty(level).ai);
    s.enemy={...s.enemy,x:205.5,y:110.5,previous:{x:205.5,y:110.5}};s.publishedBall.vz=0;enemyStep(s);expect([s.enemy.dx,s.enemy.dy]).toEqual([-2,1]);
  });
  test('T08 enemy logical clamp at K=1',()=>{const s=createState(10);s.publishedBall={...s.publishedBall,x:999,y:-999,vz:6};enemyStep(s);expect([s.enemy.x,s.enemy.y]).toEqual([296,45]);expect(s.enemy.box.width).toBe(15);});
  test.each([[1,38],[5,23],[10,13],[4,26]])('T09 crossings level %s at %s', (level,count)=>{
    for(const far of [true,false]) {
      let s=ball(createState(level),{z:far?0:75,vz:(far?1:-1)*difficulty(level).speed});
      for(let i=1;i<=count;i++){const r=tick(s);s=r.state;if(i<count)expect(r.events).toEqual([]);else expect(r.events).toContainEqual(expect.objectContaining({type:'return',side:far?'enemy':'player'}));}
      expect(s.ball.vz).toBe((far?-1:1)*difficulty(level).speed);
    }
  });
  test('T09 no direction guard and no lateral impulse',()=>{
    const s=ball(createState(),{z:78,vz:-2,vx:1,vy:0.5});const r=tick(s);expect(r.events[0].type).toBe('return');expect(r.state.ball).toMatchObject({z:75,vz:2,vx:1,vy:0.5});
  });
  test('T11 inclusive accuracy and strict curve classification',()=>{
    expect(accurate({x:7,y:-5},{x:0,y:0})).toBe(true);expect(accurate({x:7.000001,y:0},{x:0,y:0})).toBe(false);
    expect(classify(0.1,0.1)).toBe('CURVE');expect(classify(0.100001,-0.100001)).toBe('SUPER');expect(classify(0.05,0)).toBe('NONE');expect(classify(9,0)).toBe('CURVE');
  });
});

describe('M4 pinned runtime compatibility',()=>{
  test('T01 U01 registration geometry',()=>{expect(field()).toEqual({left:25,right:326,top:25,bottom:226,x:175.5,y:125.5});expect(PROFILE.id).toBe('m4-ruffle-06-01');});
  test('T10 closed AABB edges/corners; just outside',()=>{
    const box=(x:number,y:number)=>display.install({x,y,width:30,height:30},{tick:0,generation:1});
    expect(overlaps(box(0,0),box(30,30))).toBe(true);expect(overlaps(box(0,0),box(30-1e-8,30))).toBe(true);expect(overlaps(box(0,0),box(30+1e-8,30))).toBe(true);expect(overlaps(box(0,0),box(30+.05,30))).toBe(false);
  });
  test.each([false,true])('T10 R08 separating fixture inverse=%s',inverse=>{
    const s=ball(tick(createState()).state,{x:175.5+(inverse?62:42),y:125.5,z:1,vx:inverse?-20:20,vz:-2});
    const r=tick(s), contact=r.audit.contacts[0];expect(contact.accepted).toBe(!inverse);
    expect(overlaps(display.install(project(contact.before.x,contact.before.y,contact.before.z,30,30),{tick:2,generation:1}),contact.paddleBox)).toBe(inverse);
    if(!inverse){expect(r.state.ball).toMatchObject({x:237.5,z:0,vx:20,vz:2});expect(r.events[0].accurate).toBe(false);}
    else expect(r.state.phase).toBe('MissHold');
  });
  test.each([false,true])('T10 far-plane old-box separating fixture inverse=%s',inverse=>{
    const s=ball(tick(createState()).state,{x:175.5+(inverse?62:42),y:125.5,z:74,vx:inverse?-20:20,vz:2});
    const r=tick(s),contact=r.audit.contacts[0];expect(contact.side).toBe('enemy');expect(contact.accepted).toBe(!inverse);
    const current=display.install(project(contact.before.x,contact.before.y,contact.before.z,30,30),{tick:2,generation:1});
    expect(overlaps(current,contact.paddleBox)).toBe(inverse);
  });
  test('T12 serve uses previous ball cache; return uses prior paddle publication; AI uses current ball',()=>{
    let s=tick(createState(),[command(createState(),{type:'pointer',x:215,y:150})]).state;
    const r=tick(s,[command(s,{type:'down',x:220,y:155})]);
    expect(r.events[0].sample).toMatchObject({dx:0,dy:0,tick:0});
    expect(r.audit.checkpoints[0].ball).toMatchObject({cx:-.01,cy:-.01});
    expect(r.audit.aiInput.vz).toBe(2);expect(r.audit.aiInput.tick).toBe(2);
    s=ball(s,{z:1,vz:-2}); const prior=sample(s.player);
    const ret=tick(s,[command(s,{type:'pointer',x:165,y:130})]);
    expect(ret.events[0].sample).toEqual(prior);
    close(ret.state.ball.cx,-(215-175.5)/1.5/25);
    expect(ret.events[0].sample!.tick).toBe(ret.state.tick-1);
  });
  test('T12 invalid cache, reset+down, and repeated down',()=>{
    let s=createState();expect(tick(s,[command(s,{type:'down',x:175.5,y:125.5})]).events[0].reason).toBe('cache-not-ready');
    s=tick(s).state;const down={type:'down',x:175.5,y:125.5} as const;
    expect(tick(s,[command(s,{type:'reset',level:5}),command(s,down,2)]).events[1].reason).toBe('cache-not-ready');
    expect(tick(s,[command(s,down),command(s,down,2)]).events.map(e=>e.type)).toEqual(['serve','serve-rejected']);
  });
  test('T02/U02 native display readback does not feed logical paddle publication or ball position',()=>{
    const s=createState();s.target.x=205.7;const before=structuredClone(s);
    const r=tick(s);
    close(r.state.player.x,175.5+(206-175.5)/1.5);
    expect(r.state.player.box.x).toBe(195.8);
    expect(r.state.player.x).not.toBe(r.state.player.box.x);
    expect(r.state.ball.x).toBe(175.5);expect(s).toEqual(before);
  });
  test.each(['player','enemy'] as const)('T13 %s miss holds exactly 19 intervals',side=>{
    let s=ball(createState(),{x:40,y:40,z:side==='player'?1:74,vz:side==='player'?-2:2});
    let r=tick(s);s=r.state;expect(s.phase).toBe('MissHold');const box=structuredClone(s.ball.box),m=s.tick;
    for(let n=1;n<19;n++){r=tick(s,[command(s,{type:'down',x:296,y:206})]);s=r.state;expect(s.phase).toBe('MissHold');expect(s.ball.box).toEqual(box);expect(r.events.some(e=>e.type==='miss')).toBe(false);}
    expect(s.player.x).toBeGreaterThan(290);s=tick(s).state;expect(s.tick).toBe(m+19);expect(s.phase).toBe('ServeWaiting');expect(s.ballAvailable).toBe(false);s=tick(s).state;expect(s.ball.generation).toBe(2);expect(s.cache).toBeNull();s=tick(s).state;expect(s.cache).not.toBeNull();expect(s.diagnostics[side==='player'?'playerMisses':'enemyMisses']).toBe(1);
  });
  test('T13 retry matrix and hard reset',()=>{
    let s=tick(createState(),[command(createState(),{type:'pointer',x:220,y:160})]).state;
    s.diagnostics.returns=8;s.diagnostics.playerMisses=2;const p=structuredClone(s.player),e=structuredClone(s.enemy),target={...s.target};
    retry(s);expect(s.player).toEqual(p);expect(s.enemy).toEqual(e);expect(s.target).toEqual(target);expect(s.cache).toBeNull();expect(s.publishedBall.vz).toBe(0);expect(s.diagnostics.returns).toBe(8);
    const prior=s.player.x;s=tick(s).state;close(s.player.dx,(target.x-prior)/1.5);
    const oldTick=s.tick;s=tick(s,[command(s,{type:'reset',level:10})]).state;expect(s.tick).toBe(oldTick+1);expect(s.level).toBe(10);expect(s.trial).toBe(2);expect(s.player.generation).toBe(2);expect(s.diagnostics.returns).toBe(0);close(s.player.dx,1/3);
  });
});
