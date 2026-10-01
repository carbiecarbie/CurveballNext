export interface Point { x: number; y: number }
export interface Stamp { tick: number; generation: number }
export interface Box extends Point, Stamp { width: number; height: number; left: number; right: number; top: number; bottom: number }
export interface Sample extends Point, Stamp { dx: number; dy: number }
export interface Paddle extends Sample { previous: Point; box: Box }
export interface Ball extends Point { z: number; vx: number; vy: number; vz: number; cx: number; cy: number; generation: number; box: Box }
export interface PublishedBall extends Point, Stamp { z: number; vx: number; vy: number; vz: number }
export interface Cache { tick: number; player: Sample; enemy: Sample }
export type Phase = 'ServeWaiting' | 'Rally' | 'MissHold' | 'LevelIntro' | 'GameOver' | 'ContentComplete';
export interface State {
  profile: string; tick: number; trial: number; rally: number; level: number; phase: Phase; phaseTick: number; missTick: number | null;
  score: number; playerLives: number; enemyLives: number;
  hitScore: number; curveBonus: number; superCurveBonus: number; accuracyBonus: number;
  remainingBonus: number; bonusCounter: number;
  ballAvailable: boolean; enemyAvailable: boolean; ballLoadTick: number | null; enemyLoadTick: number | null;
  target: Point; player: Paddle; enemy: Paddle; ball: Ball; publishedBall: PublishedBall; cache: Cache | null;
  diagnostics: { rallyReturns: number; returns: number; playerMisses: number; enemyMisses: number };
}
export type Action = { type: 'pointer' | 'down'; x: number; y: number } | { type: 'retry' } | { type: 'new-game' } | { type: 'reset'; level: number } | { type: 'debug-miss'; side: 'player' | 'enemy' };
export type Command = Action & { tick: number; sequence: number; timestamp: number; late: boolean };
export interface Event { type: string; side?: 'player' | 'enemy'; reason?: string; accurate?: boolean; curve?: 'SUPER' | 'CURVE' | 'NONE'; sample?: Sample }
export interface ContactAudit { kind: 'serve' | 'return'; side: 'player' | 'enemy'; oldBallBox: Box; paddleBox: Box; before: Ball; sample: Sample | null; accepted: boolean; newBallBox?: Box }
export interface Audit { callbacks?: string[]; checkpoints: { phase: string; ball: Ball }[]; contacts: ContactAudit[]; aiInput: PublishedBall }
export interface Result { state: State; events: Event[]; audit: Audit }
