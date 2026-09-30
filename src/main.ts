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
import { bonusNotice, createFeedback, observe } from './presentation/feedback';
import { screenFor } from './presentation/screens';
import { Sound } from './presentation/audio';

function element<T extends HTMLElement>(id: string) {
  const el = document.getElementById(id); if (!el) throw new Error(`Missing ${id}`); return el as T;
}
function text(id: string, value: string) {
  const el = element(id); if (el.textContent !== value) el.textContent = value;
}
const canvas = element<HTMLCanvasElement>('court'), pauseButton = element<HTMLButtonElement>('pause'), stepButton = element<HTMLButtonElement>('step');
const levelSelect = element<HTMLSelectElement>('difficulty'), smooth = element<HTMLInputElement>('smooth'), debug = element<HTMLInputElement>('debug');
let state = createState(), previous = state, discontinuity = true, lastEvent: Event | null = null;
let latestPointer: { x: number; y: number } | null = null;
let title = true, visibleScreen = '';
const clock = new Clock(performance.now()), input = new InputQueue(clock), recorder = new Recorder(state);
const feedback = createFeedback(), sound = new Sound();
// Title is host presentation, not a new simulation phase. Nothing ticks until New Game.
clock.suspend(performance.now(), 'title-screen');
for (let level = 1; level <= 10; level++) {
  const option = document.createElement('option'); option.value = String(level); option.textContent = `Level ${String(level).padStart(2, '0')}`; levelSelect.append(option);
}
for (const [id, count] of [['player-life-bars', 5], ['enemy-life-bars', 3]] as const) {
  for (let i = 0; i < count; i++) element(id).append(document.createElement('i'));
}
function advance(commands: Command[]) {
  previous = state; const result = tick(state, commands); state = result.state; clock.advance(); recorder.record(commands, result);
  discontinuity = result.events.some(e => e.type !== 'serve-rejected');
  observe(feedback, result.events, state.tick);
  if (!clock.paused) sound.play(result.events);
  const event = result.events.filter(e => !['auto-retry', 'retry', 'reset', 'new-game', 'debug-inject'].includes(e.type)).at(-1);
  if (event) lastEvent = event;
  if (result.events.some(e => e.type === 'reset' || e.type === 'new-game')) lastEvent = null;
  if (debug.checked) text('state', JSON.stringify({ state, lastEvent, audit: result.audit }, null, 2));
}
function terminal() { return state.phase === 'GameOver' || state.phase === 'ContentComplete'; }
function suspend(reason: string) {
  if (title) return;
  clock.suspend(performance.now(), reason); input.clear(); sound.silence(); update();
}
function update() {
  const d = difficulty(state.level); levelSelect.value = String(state.level);
  text('parameters', `Speed ${d.speed} · Curve divisor ${d.curve} · AI divisor ${d.ai}`);
  const phaseText = { ServeWaiting: 'Ready to serve', Rally: 'Rally', MissHold: 'Miss', LevelIntro: `Level ${state.level}`, GameOver: 'Game Over', ContentComplete: 'Circuit complete' };
  text('phase', title ? 'Offline single player' : terminal() ? phaseText[state.phase] : clock.paused ? 'Paused' : phaseText[state.phase]);
  const notice = bonusNotice(feedback, state.tick), noticeElement = element('bonus-notice');
  noticeElement.hidden = !notice || title || clock.paused || state.phase !== 'Rally';
  if (notice) { text('bonus-notice', notice.label); noticeElement.style.opacity = String(notice.opacity); }
  const instruction = {
    ServeWaiting: 'Move over the ball and click to serve.', Rally: 'Track the ball. Sweep the paddle to create curve.',
    MissHold: 'A life lost. Get ready for the next serve.', LevelIntro: `Level ${state.level} begins shortly.`,
    GameOver: `Final score ${state.score} · Start a New Game to try again.`, ContentComplete: 'All ten defined levels cleared. Start a New Game for another run.',
  };
  text('instruction', title ? 'Move to meet the ball. Sweep the paddle to create curve.' : clock.paused && !terminal() ? 'Resume when you’re ready. Your rally is on hold.' : instruction[state.phase]);
  text('score', String(state.score)); text('level', String(state.level).padStart(2, '0'));
  text('player-lives', String(state.playerLives)); text('enemy-lives', String(state.enemyLives)); text('level-bonus', String(state.remainingBonus));
  for (const [id, lives] of [['player-life-bars', state.playerLives], ['enemy-life-bars', state.enemyLives]] as const) {
    [...element(id).children].forEach((bar, i) => bar.classList.toggle('empty', i >= lives));
  }
  text('returns', String(state.diagnostics.rallyReturns)); text('total', String(state.diagnostics.returns));
  text('player-misses', String(state.diagnostics.playerMisses)); text('enemy-misses', String(state.diagnostics.enemyMisses));
  text('last-event', lastEvent ? [lastEvent.type, lastEvent.side, lastEvent.reason, lastEvent.curve, lastEvent.accurate === undefined ? '' : lastEvent.accurate ? 'accurate' : 'off-center'].filter(Boolean).join(' · ') : 'Ready for first serve');
  pauseButton.textContent = clock.paused && !title ? 'Resume' : 'Pause'; pauseButton.disabled = title || terminal();
  stepButton.disabled = !clock.paused || title;
  element<HTMLButtonElement>('restart').disabled = title;
  element<HTMLButtonElement>('retry').disabled = title || clock.paused || !canRetry(state);
  for (const id of ['force-player-miss', 'force-enemy-miss']) element<HTMLButtonElement>(id).disabled = title || clock.paused || !['ServeWaiting', 'Rally'].includes(state.phase);
  levelSelect.disabled = title || clock.paused;
  element('debug-panel').hidden = !debug.checked; element('debug-tools').hidden = !debug.checked;
  text('view-label', smooth.checked ? 'Smooth · delayed interpolation' : 'Reference view · no interpolation');
  text('sound', sound.available ? sound.enabled ? 'Sound on' : 'Sound off' : 'Sound unavailable');
  element('sound').setAttribute('aria-pressed', String(sound.enabled && sound.available));

  const screen = screenFor(state, title, clock.paused, clock.reason), kind = screen?.kind ?? '';
  const overlay = element('screen'); overlay.hidden = !screen;
  if (screen) {
    overlay.dataset.kind = kind;
    text('screen-kicker', screen.kicker); text('screen-copy', screen.copy); text('screen-note', screen.note);
    // Only independently authored, fixed markup is used for the title wordmark.
    if (kind === 'Title') { if (visibleScreen !== kind) element('screen-title').innerHTML = 'CURVEBALL<span>NEXT</span>'; }
    else text('screen-title', screen.heading);
    text('screen-stats', screen.stats); element('screen-stats').hidden = !screen.stats;
    element('new-game').hidden = screen.action !== 'new-game'; element('resume').hidden = screen.action !== 'resume';
    element('intro-progress').hidden = kind !== 'LevelIntro';
    element('intro-progress').style.setProperty('--progress', `${screen.progress * 100}%`);
    if (visibleScreen !== kind && screen.action) element(screen.action).focus({ preventScroll: true });
  }
  visibleScreen = kind;
}
function enqueue(action: Action) { input.enqueue(action, performance.now()); }
function resume() {
  if (title || terminal()) return;
  clock.resume(performance.now()); input.clear();
  if (latestPointer) enqueue({ type: 'pointer', ...latestPointer });
  void sound.unlock(); canvas.focus({ preventScroll: true }); update();
}
function newGame() {
  title = false; sound.silence(); void sound.unlock();
  if (clock.paused) { clock.resume(performance.now()); input.clear(); }
  enqueue({ type: 'new-game' }); canvas.focus({ preventScroll: true }); update();
}
pauseButton.addEventListener('click', () => { if (clock.paused) resume(); else suspend('manual'); });
element('resume').addEventListener('click', resume);
element('new-game').addEventListener('click', newGame); element('restart').addEventListener('click', newGame);
element('sound').addEventListener('click', () => { sound.toggle(); update(); });
stepButton.addEventListener('click', () => { if (clock.paused && !title) { advance([]); discontinuity = true; update(); } });
element('retry').addEventListener('click', () => enqueue({ type: 'retry' }));
element('force-player-miss').addEventListener('click', () => enqueue({ type: 'debug-miss', side: 'player' }));
element('force-enemy-miss').addEventListener('click', () => enqueue({ type: 'debug-miss', side: 'enemy' }));
levelSelect.addEventListener('change', () => enqueue({ type: 'reset', level: Number(levelSelect.value) }));
element<HTMLInputElement>('native').addEventListener('change', e => { document.querySelector('.canvas-wrap')!.classList.toggle('native', (e.target as HTMLInputElement).checked); });
debug.addEventListener('change', () => { text('state', JSON.stringify({ state, lastEvent }, null, 2)); update(); });
smooth.addEventListener('change', update);
function eventTime(event: PointerEvent) { return normalizeTimestamp(event.timeStamp, performance.now(), performance.timeOrigin); }
window.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse' || !event.isPrimary || !document.hasFocus()) return;
  for (const point of mouseSamples(event)) {
    latestPointer = stagePoint(point.clientX, point.clientY, canvas.getBoundingClientRect());
    if (!title && !clock.paused) input.enqueue({ type: 'pointer', ...latestPointer }, eventTime(point));
  }
});
canvas.addEventListener('pointerdown', event => {
  if (title || event.pointerType !== 'mouse' || !event.isPrimary || event.button !== 0) return;
  event.preventDefault(); canvas.focus({ preventScroll: true });
  latestPointer = stagePoint(event.clientX, event.clientY, canvas.getBoundingClientRect());
  if (latestPointer.x >= 0 && latestPointer.x <= 350 && latestPointer.y >= 0 && latestPointer.y <= 250) input.down(latestPointer.x, latestPointer.y, eventTime(event));
});
window.addEventListener('pointerup', event => { if (event.pointerType === 'mouse' && event.button === 0) input.up(); });
window.addEventListener('pointercancel', () => input.up());
window.addEventListener('blur', () => suspend('window-blur'));
document.addEventListener('visibilitychange', () => { if (document.hidden) suspend('document-hidden'); });
window.addEventListener('keydown', event => {
  if (event.repeat) { if (event.target === stepButton) event.preventDefault(); return; }
  if ((event.target as HTMLElement)?.closest('input,select,textarea,button,[contenteditable="true"]')) return;
  if (event.key === 'Escape' && !title && !terminal() && !clock.paused) { event.preventDefault(); suspend('keyboard'); }
  if (event.key.toLowerCase() === 'r' && !title && !clock.paused && debug.checked && canRetry(state)) { event.preventDefault(); enqueue({ type: 'retry' }); }
});
element('export').addEventListener('click', () => {
  const capture = recorder.export({ suspensions: clock.history, userAgent: navigator.userAgent });
  const url = URL.createObjectURL(new Blob([JSON.stringify(capture)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `curveball-m3-${state.tick}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
function frame(now: number) {
  const wasPaused = clock.paused, due = clock.due(now);
  if (!wasPaused && clock.paused) { input.clear(); sound.silence(); }
  for (let i = 0; i < due; i++) advance(input.take(state.tick + 1));
  update(); draw(canvas, state, previous, clock.alpha(now), smooth.checked, discontinuity, debug.checked, feedback, !title && state.phase !== 'LevelIntro' && !terminal());
  requestAnimationFrame(frame);
}
update(); requestAnimationFrame(frame);
