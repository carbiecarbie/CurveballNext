import './styles.css';
import { difficulty } from './core/constants';
import { canRetry } from './core/lifecycle';
import { createState } from './core/state';
import { tick } from './core/tick';
import type { Action, Command, Event } from './core/types';
import { Recorder } from './debug/trace';
import { Clock } from './runtime/clock';
import { InputQueue, mouseSamples, normalizeTimestamp } from './runtime/input';
import { stagePoint } from './runtime/viewport';
import { draw } from './presentation/canvas';

function element<T extends HTMLElement>(id: string) { const el=document.getElementById(id);if(!el)throw new Error(`Missing ${id}`);return el as T; }
const canvas=element<HTMLCanvasElement>('court'), pauseButton=element<HTMLButtonElement>('pause'), stepButton=element<HTMLButtonElement>('step');
const levelSelect=element<HTMLSelectElement>('difficulty'), smooth=element<HTMLInputElement>('smooth'), debug=element<HTMLInputElement>('debug');
let state=createState(),previous=state,discontinuity=true,lastEvent:Event|null=null,latestPointer:{x:number;y:number}|null=null;
const clock=new Clock(performance.now()),input=new InputQueue(clock),recorder=new Recorder(state);
for(let level=1;level<=10;level++){const option=document.createElement('option');option.value=String(level);option.textContent=`Level ${String(level).padStart(2,'0')}`;levelSelect.append(option);}
function advance(commands:Command[]) {
  previous=state;const result=tick(state,commands);state=result.state;clock.advance();recorder.record(commands,result);
  discontinuity=result.events.some(e=>e.type!=='serve-rejected');
  const event=result.events.filter(e=>!['auto-retry','retry','reset','new-game','debug-inject'].includes(e.type)).at(-1);if(event)lastEvent=event;
  if(result.events.some(e=>e.type==='reset'||e.type==='new-game'))lastEvent=null;
  if(debug.checked)element('state').textContent=JSON.stringify({state,lastEvent,audit:result.audit},null,2);
}
function suspend(reason:string){clock.suspend(performance.now(),reason);input.clear();update();}
function update(){
  const d=difficulty(state.level);levelSelect.value=String(state.level);
  element('parameters').textContent=`Speed ${d.speed} · Curve divisor ${d.curve} · AI divisor ${d.ai}`;
  const phaseText={ServeWaiting:'Waiting for serve',Rally:'Rally in progress',MissHold:'Miss · resolving shortly',LevelIntro:`LEVEL ${state.level}`,GameOver:'GAME OVER',ContentComplete:'DEFINED ORIGINAL LEVEL DATA COMPLETE'};
  element('phase').textContent=clock.paused?`Paused · ${clock.reason}`:phaseText[state.phase];
  const instruction={ServeWaiting:'Move over the ball and press the primary mouse button to serve.',Rally:'Track the ball as it approaches. Paddle motion creates curve.',MissHold:'Ball stopped at the miss. The result follows after the hold.',LevelIntro:`Level ${state.level} begins shortly.`,GameOver:`GAME OVER · Final score ${state.score} · Level ${state.level}. Select New Game to restart.`,ContentComplete:`Defined original level data complete · Score ${state.score} · Player lives ${state.playerLives}. Select New Game to restart.`};
  element('instruction').textContent=clock.paused?'Press Resume to continue. Step advances one ordinary tick.':instruction[state.phase];
  element('score').textContent=String(state.score);element('level').textContent=String(state.level);
  element('player-lives').textContent=String(state.playerLives);element('enemy-lives').textContent=String(state.enemyLives);
  element('level-bonus').textContent=String(state.remainingBonus);
  element('returns').textContent=String(state.diagnostics.rallyReturns);element('total').textContent=String(state.diagnostics.returns);
  element('player-misses').textContent=String(state.diagnostics.playerMisses);element('enemy-misses').textContent=String(state.diagnostics.enemyMisses);
  element('last-event').textContent=lastEvent?[lastEvent.type,lastEvent.side,lastEvent.reason,lastEvent.curve,lastEvent.accurate===undefined?'':lastEvent.accurate?'accurate':'off-center'].filter(Boolean).join(' · '):'Ready for first serve';
  pauseButton.textContent=clock.paused?'Resume':'Pause';stepButton.disabled=!clock.paused;
  element<HTMLButtonElement>('retry').disabled=clock.paused||!canRetry(state);
  for(const id of ['force-player-miss','force-enemy-miss'])element<HTMLButtonElement>(id).disabled=clock.paused||state.phase==='LevelIntro'||state.phase==='GameOver'||state.phase==='ContentComplete';
  levelSelect.disabled=clock.paused;document.body.classList.toggle('paused',clock.paused);
  element('debug-panel').hidden=!debug.checked;
  element('debug-tools').hidden=!debug.checked;
  element('view-label').textContent=smooth.checked?'Smooth · delayed interpolation':'Reference view · no interpolation';
}
function enqueue(action:Action){input.enqueue(action,performance.now());}
pauseButton.addEventListener('click',()=>{
  if(clock.paused){clock.resume(performance.now());input.clear();if(latestPointer)enqueue({type:'pointer',...latestPointer});canvas.focus({preventScroll:true});}
  else suspend('manual');update();
});
stepButton.addEventListener('click',()=>{if(clock.paused){advance([]);discontinuity=true;update();}});
element('retry').addEventListener('click',()=>enqueue({type:'retry'}));
element('new-game').addEventListener('click',()=>{if(clock.paused){clock.resume(performance.now());input.clear();}enqueue({type:'new-game'});update();});
element('force-player-miss').addEventListener('click',()=>enqueue({type:'debug-miss',side:'player'}));
element('force-enemy-miss').addEventListener('click',()=>enqueue({type:'debug-miss',side:'enemy'}));
levelSelect.addEventListener('change',()=>enqueue({type:'reset',level:Number(levelSelect.value)}));
element<HTMLInputElement>('native').addEventListener('change',e=>{document.querySelector('.canvas-wrap')!.classList.toggle('native',(e.target as HTMLInputElement).checked);});
debug.addEventListener('change',()=>{element('state').textContent=JSON.stringify({state,lastEvent},null,2);update();});smooth.addEventListener('change',update);
function eventTime(event:PointerEvent){return normalizeTimestamp(event.timeStamp,performance.now(),performance.timeOrigin);}
window.addEventListener('pointermove',event=>{
  if(event.pointerType!=='mouse'||!event.isPrimary||!document.hasFocus())return;
  for(const point of mouseSamples(event)){
    latestPointer=stagePoint(point.clientX,point.clientY,canvas.getBoundingClientRect());
    if(!clock.paused)input.enqueue({type:'pointer',...latestPointer},eventTime(point));
  }
});
canvas.addEventListener('pointerdown',event=>{
  if(event.pointerType!=='mouse'||!event.isPrimary||event.button!==0)return;
  event.preventDefault();canvas.focus({preventScroll:true});
  latestPointer=stagePoint(event.clientX,event.clientY,canvas.getBoundingClientRect());
  if(latestPointer.x>=0&&latestPointer.x<=350&&latestPointer.y>=0&&latestPointer.y<=250)input.down(latestPointer.x,latestPointer.y,eventTime(event));
});
window.addEventListener('pointerup',event=>{if(event.pointerType==='mouse'&&event.button===0)input.up();});
window.addEventListener('pointercancel',()=>input.up());
window.addEventListener('blur',()=>suspend('window-blur'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend('document-hidden');});
window.addEventListener('keydown',event=>{
  if(event.repeat){if(event.target===stepButton)event.preventDefault();return;}
  if((event.target as HTMLElement)?.closest('input,select,textarea,button,[contenteditable="true"]'))return;
  if(event.key==='Escape'&&!clock.paused){event.preventDefault();suspend('keyboard');}
  if(event.key.toLowerCase()==='r'&&!clock.paused&&debug.checked&&canRetry(state)){event.preventDefault();enqueue({type:'retry'});}
});
element('export').addEventListener('click',()=>{
  const capture=recorder.export({suspensions:clock.history,userAgent:navigator.userAgent});
  const url=URL.createObjectURL(new Blob([JSON.stringify(capture)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=`curveball-m2-${state.tick}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
function frame(now:number){
  const wasPaused=clock.paused,due=clock.due(now);if(!wasPaused&&clock.paused)input.clear();
  for(let i=0;i<due;i++)advance(input.take(state.tick+1));
  update();draw(canvas,state,previous,clock.alpha(now),smooth.checked,discontinuity,debug.checked);requestAnimationFrame(frame);
}
update();requestAnimationFrame(frame);
