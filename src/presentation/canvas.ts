import { field } from '../compat/profile';
import { project } from '../core/projection';
import type { Box, State } from '../core/types';
import { backingSize } from '../runtime/viewport';
export function poses(current: State, previous: State, alpha: number, smooth: boolean, discontinuity: boolean) {
  const pose = (a: Box, b: Box) => !smooth || discontinuity || a.generation !== b.generation ? { ...a } : {
    ...a, x: b.x+(a.x-b.x)*alpha, y:b.y+(a.y-b.y)*alpha,
    width:b.width+(a.width-b.width)*alpha,height:b.height+(a.height-b.height)*alpha,
  };
  return { ball:pose(current.ball.box,previous.ball.box),player:pose(current.player.box,previous.player.box),enemy:pose(current.enemy.box,previous.enemy.box) };
}
export function draw(canvas: HTMLCanvasElement, current: State, previous: State, alpha: number, smooth: boolean, discontinuity: boolean, debug: boolean) {
  const rect=canvas.getBoundingClientRect(),size=backingSize(rect.width,rect.height,window.devicePixelRatio || 1);
  if(canvas.width!==size.width || canvas.height!==size.height){canvas.width=size.width;canvas.height=size.height;}
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.setTransform(canvas.width/350,0,0,canvas.height/250,0,0);
  ctx.clearRect(0,0,350,250);ctx.fillStyle='#07131b';ctx.fillRect(0,0,350,250);
  const f=field();ctx.lineWidth=0.65;
  for(const z of [75,50,25,0]) {
    const p=project(f.x,f.y,z,301,201);ctx.strokeStyle=z===0?'#36858a':'#21464d';ctx.strokeRect(p.x-p.width/2,p.y-p.height/2,p.width,p.height);
  }
  for(const x of [f.left,f.right])for(const y of [f.top,f.bottom]){
    const end=project(x,y,75,0,0);ctx.strokeStyle='#28444a';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(end.x,end.y);ctx.stroke();
  }
  const z=Math.max(0,current.ball.z),depth=project(f.x,f.y,z,301,201);
  ctx.strokeStyle='#426770';ctx.setLineDash([2,3]);ctx.strokeRect(depth.x-depth.width/2,depth.y-depth.height/2,depth.width,depth.height);ctx.setLineDash([]);
  const p=poses(current,previous,alpha,smooth,discontinuity);
  const paddle=(box:Box,color:string)=>{ctx.fillStyle=color+'20';ctx.strokeStyle=color;ctx.lineWidth=0.8;ctx.fillRect(box.x-box.width/2,box.y-box.height/2,box.width,box.height);ctx.strokeRect(box.x-box.width/2,box.y-box.height/2,box.width,box.height);ctx.beginPath();ctx.moveTo(box.x-2,box.y);ctx.lineTo(box.x+2,box.y);ctx.moveTo(box.x,box.y-2);ctx.lineTo(box.x,box.y+2);ctx.stroke();};
  paddle(p.enemy,'#f5bd79');
  ctx.fillStyle=current.phase==='MissHold'?'#ff827c':'#e4fff5';ctx.shadowColor='#80e9cc';ctx.shadowBlur=5;
  ctx.beginPath();ctx.arc(p.ball.x,p.ball.y,p.ball.width/2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle='#598d86';ctx.lineWidth=0.5;ctx.beginPath();ctx.ellipse(p.ball.x,p.ball.y,p.ball.width/5,p.ball.height/2,0,0,Math.PI*2);ctx.stroke();
  paddle(p.player,'#79eacb');
  if(debug){ctx.strokeStyle='#f791cb';ctx.lineWidth=0.4;for(const box of [current.ball.box,current.player.box,current.enemy.box])ctx.strokeRect(box.left,box.top,box.width,box.height);}
  ctx.font='5px monospace';ctx.fillStyle='#719199';ctx.fillText('NEAR / 0',25,237);ctx.textAlign='right';ctx.fillText('FAR / 75',326,237);ctx.textAlign='left';
}
