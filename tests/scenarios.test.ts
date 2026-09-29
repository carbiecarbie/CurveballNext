import { expect, test } from 'vitest';
import { display } from '../src/compat/display';
import { project } from '../src/core/projection';
import { createState, publish } from '../src/core/state';
import { tick } from '../src/core/tick';
import type { Command } from '../src/core/types';
import { Recorder } from '../src/debug/trace';
import { replay } from '../src/debug/replay';

test('T14 analytical multi-rally scenario, wall, returns, misses and repeated retries replay',()=>{
  // Synthetic starting flight. Subsequent changes are ordinary canonical commands.
  let s=createState(1);s.phase='Rally';Object.assign(s.ball,{z:20,vz:2,vx:2,vy:0.4});
  s.ball.box=display.install(project(s.ball.x,s.ball.y,s.ball.z,30,30),{tick:0,generation:1});s.publishedBall=publish(s.ball,0);
  const recorder=new Recorder(s),events:string[]=[];
  for(let n=1;n<=450;n++){
    const commands:Command[]=[];
    const target=n<220?{x:s.ball.x,y:s.ball.y}:{x:55,y:45};
    if(s.phase==='ServeWaiting'&&n<220){target.x=175.5;target.y=125.5;}
    commands.push({type:'pointer',...target,tick:n,sequence:n*2,timestamp:n*1000/30,late:false});
    if(s.phase==='ServeWaiting'&&s.cache&&n<220)commands.push({type:'down',...target,tick:n,sequence:n*2+1,timestamp:n*1000/30,late:false});
    if([280,320].includes(n))commands.push({type:'retry',tick:n,sequence:n*2+1,timestamp:n*1000/30,late:false});
    const r=tick(s,commands);s=r.state;events.push(...r.events.map(e=>e.type+(e.side?':'+e.side:'')));recorder.record(commands,r);
  }
  expect(events).toContain('return:player');expect(events).toContain('return:enemy');expect(events.some(e=>e.startsWith('wall-'))).toBe(true);expect(events.filter(e=>e==='retry')).toHaveLength(2);
  expect(replay(JSON.parse(JSON.stringify(recorder.export())))).toEqual(s);
});

test.each(['player','enemy'] as const)('T13/T14 synthetic %s miss and automatic retry capture',side=>{
  let s=createState();s.phase='Rally';Object.assign(s.ball,{x:40,y:40,z:side==='player'?1:74,vz:side==='player'?-2:2});
  s.ball.box=display.install(project(s.ball.x,s.ball.y,s.ball.z,30,30),{tick:0,generation:1});s.publishedBall=publish(s.ball,0);
  const recorder=new Recorder(s),events:string[]=[];
  for(let i=0;i<21;i++){const r=tick(s);s=r.state;recorder.record([],r);events.push(...r.events.map(e=>e.type+(e.side?':'+e.side:'')));}
  expect(events).toEqual(['miss:'+side,'auto-retry']);expect(replay(recorder.export())).toEqual(s);
});
