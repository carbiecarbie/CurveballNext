import { describe, expect, test, vi } from 'vitest';
import { createState } from '../src/core/state';
import { tick } from '../src/core/tick';
import type { Command } from '../src/core/types';
import { Recorder } from '../src/debug/trace';
import { replay } from '../src/debug/replay';
import { draw, poses } from '../src/presentation/canvas';
import { Clock } from '../src/runtime/clock';
import { InputQueue, mouseSamples, normalizeTimestamp } from '../src/runtime/input';
import { backingSize, stagePoint } from '../src/runtime/viewport';

function log():Command[]{return [
  {type:'down',x:175.5,y:125.5,tick:2,sequence:1,timestamp:50,late:false},
  {type:'pointer',x:215,y:155,tick:6,sequence:2,timestamp:200,late:false},
  {type:'pointer',x:80,y:65,tick:12,sequence:3,timestamp:400,late:false},
  {type:'retry',tick:80,sequence:4,timestamp:2650,late:false},
  {type:'reset',level:10,tick:90,sequence:5,timestamp:3000,late:false},
  {type:'down',x:175.5,y:125.5,tick:92,sequence:6,timestamp:3050,late:false},
];}
function run(rate:number,jitter=false){
  const clock=new Clock(0),events:unknown[]=[];let state=createState();
  for(let frame=1;frame<=rate*10;frame++){
    const now=frame===rate*10?10000:frame*1000/rate+(jitter&&frame%2===0?2:0);
    const due=clock.due(now);for(let i=0;i<due;i++){const result=tick(state,log().filter(c=>c.tick===state.tick+1));state=result.state;events.push(result.events);clock.advance();}
  }
  expect(clock.paused).toBe(false);expect(state.tick).toBe(300);return{state,events};
}
describe('M1 host/integration policy',()=>{
  test.each([15,30,60,120,144])('T14 identical core states/events at %s Hz with jitter',rate=>{expect(run(rate)).toEqual(run(30));expect(run(rate,true)).toEqual(run(30));});
  test('T12 exact, before, after boundaries and late reassignment',()=>{
    const clock=new Clock(123),q=new InputQueue(clock),b=clock.boundary(1);
    expect(clock.assign(b-1e-8)).toEqual({tick:1,late:false});expect(clock.assign(b)).toEqual({tick:1,late:false});expect(clock.assign(b+1e-8)).toEqual({tick:2,late:false});
    clock.advance();expect(q.enqueue({type:'pointer',x:1,y:2},b)).toMatchObject({tick:2,late:true});
  });
  test('T12 tied commands retain sequence, held/released down suppressed',()=>{
    const q=new InputQueue(new Clock(0));q.enqueue({type:'pointer',x:1,y:2},1);q.down(3,4,1);expect(q.down(3,4,2)).toBeNull();q.up();q.down(5,6,2);
    expect(q.take(1).map(c=>[c.type,c.sequence])).toEqual([['pointer',1],['down',2],['down',3]]);expect(q.take(1)).toEqual([]);
  });
  test('T12 catch-up consumes no future target',()=>{
    const clock=new Clock(0),q=new InputQueue(clock);q.enqueue({type:'pointer',x:220,y:150},50);
    expect(clock.due(100)).toBe(3);let s=createState();s=tick(s,q.take(1)).state;clock.advance();expect(s.player.x).toBe(175.5);
    s=tick(s,q.take(2)).state;clock.advance();expect(s.player.x).toBeGreaterThan(175.5);
  });
  test('T12 out-of-order delivery is consumed by timestamp, ties by sequence',()=>{
    const q=new InputQueue(new Clock(0));q.enqueue({type:'pointer',x:200,y:120},20);q.enqueue({type:'pointer',x:210,y:130},10);
    const commands=q.take(1);expect(commands.map(c=>c.sequence)).toEqual([2,1]);expect(tick(createState(),commands).state.target).toEqual({x:200,y:120});
  });
  test('T14 overload suspends before any overdue batch; clears input, resumes at new epoch',()=>{
    const clock=new Clock(0),q=new InputQueue(clock);q.down(175,125,1);expect(clock.due(200)).toBe(0);expect(clock.reason).toBe('timing-overrun');expect(clock.completed).toBe(0);q.clear();
    expect(q.down(175,125,200)).toBeNull();clock.resume(1000);expect(clock.due(1001)).toBe(0);expect(q.take(1)).toEqual([]);expect(clock.boundary(1)).toBe(1000+1000/30);
    expect(clock.due(1166)).toBe(4);
  });
  test('T14 five due ticks allowed; focus suspension, no hidden-time burst; step then resume',()=>{
    const clock=new Clock(0);expect(clock.due(clock.boundary(5))).toBe(5);clock.suspend(10,'window-blur');expect(clock.due(100000)).toBe(0);
    let state=createState();state=tick(state).state;clock.advance();expect(state.tick).toBe(1);expect(clock.paused).toBe(true);clock.resume(100000);expect(clock.due(100000)).toBe(0);expect(clock.assign(100000).tick).toBe(2);
  });
  test('T12 coalesced samples replace parent; timestamp domains',()=>{
    type E={id:number;getCoalescedEvents?:()=>E[]};const children:E[]=[{id:1},{id:2}];expect(mouseSamples<E>({id:3,getCoalescedEvents:()=>children})).toEqual(children);
    expect(mouseSamples<E>({id:3,getCoalescedEvents:()=>[]})).toHaveLength(1);expect(normalizeTimestamp(1700000000050,60,1700000000000)).toBe(50);expect(normalizeTimestamp(0,60,1)).toBe(60);
  });
  test('T14 viewport uniform scaling/zoom and DPR independence',()=>{
    expect(stagePoint(450,350,{left:100,top:100,width:700,height:500})).toEqual({x:175,y:125});
    expect(stagePoint(275,225,{left:100,top:100,width:350,height:250})).toEqual({x:175,y:125});expect(stagePoint(0,0,{left:100,top:100,width:350,height:250})).toEqual({x:-100,y:-100});
    expect(backingSize(700,500,2)).toEqual({width:1400,height:1000});
  });
  test('T14 presentation cannot mutate snapshots; discontinuities snap',()=>{
    const old=createState(),result=tick(old,[{type:'pointer',x:200,y:120,tick:1,sequence:1,timestamp:0,late:false}]);
    const before=structuredClone(result.state),oldBefore=structuredClone(old);
    for(const smooth of [false,true])for(const alpha of [0,0.5,1])poses(result.state,old,alpha,smooth,false);
    expect(result.state).toEqual(before);expect(old).toEqual(oldBefore);
    expect(poses(result.state,old,0,true,true).player.x).toBe(result.state.player.x);
    expect(poses(result.state,old,0,true,false).player.x).toBe(old.player.x);
  });
  test('T14 ring checkpoint survives truncation and JSON round-trip',()=>{
    let state=createState();const recorder=new Recorder(state,10);
    for(let n=1;n<=100;n++){const commands=log().filter(c=>c.tick===n);const r=tick(state,commands);recorder.record(commands,r);state=r.state;}
    const capture=JSON.parse(JSON.stringify(recorder.export()));expect(capture.records).toHaveLength(10);expect(capture.checkpoint.tick).toBe(90);expect(replay(capture)).toEqual(state);
  });
  test('T14 default ring retains exactly 600 records; renderer/DPR/debug cannot mutate state',()=>{
    let state=createState();const recorder=new Recorder(state);
    for(let n=0;n<620;n++){const r=tick(state);state=r.state;recorder.record([],r);}
    const capture=recorder.export();expect(capture.records).toHaveLength(600);expect(capture.checkpoint.tick).toBe(20);expect(replay(capture)).toEqual(state);
    const before=structuredClone(state),previous=tick(state).state,previousBefore=structuredClone(previous);
    const ctx=new Proxy({}, {get:(_target,key)=>key==='createRadialGradient'||key==='createLinearGradient'?()=>({addColorStop:()=>undefined}):()=>undefined,set:()=>true});
    const canvas={width:0,height:0,getContext:()=>ctx,getBoundingClientRect:()=>({width:700,height:500})} as unknown as HTMLCanvasElement;
    try {for(const dpr of [1,2]){vi.stubGlobal('window',{devicePixelRatio:dpr});for(const smooth of [false,true])for(const debug of [false,true])draw(canvas,state,previous,0.5,smooth,false,debug);}}
    finally{vi.unstubAllGlobals();}
    expect(state).toEqual(before);expect(previous).toEqual(previousBefore);
  });
  test('T14 reject schema/profile/indices/nonfinite/order/tampered observations',()=>{
    const s=createState(),recorder=new Recorder(s);const commands:Command[]=[{type:'pointer',x:200,y:125,tick:1,sequence:1,timestamp:0,late:false}];recorder.record(commands,tick(s,commands));
    for(const mutate of [
      (c:ReturnType<Recorder['export']>)=>{c.schema='bad' as typeof c.schema;},
      (c:ReturnType<Recorder['export']>)=>{c.profile='unknown';},
      (c:ReturnType<Recorder['export']>)=>{c.checkpoint.level=11;},
      (c:ReturnType<Recorder['export']>)=>{c.checkpoint.ball.x=Infinity;},
      (c:ReturnType<Recorder['export']>)=>{c.records[0].commands[0].sequence=-1;},
      (c:ReturnType<Recorder['export']>)=>{c.records[0].commands[0].tick=2;},
      (c:ReturnType<Recorder['export']>)=>{c.final.ball.x=0;},
      (c:ReturnType<Recorder['export']>)=>{c.records[0].events.push({type:'fake'});},
    ]){const c=recorder.export();mutate(c);expect(()=>replay(c)).toThrow();}
  });
});
