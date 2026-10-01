export type Side = 0 | 1;
export type Phase = 'Waiting' | 'Countdown' | 'Rally' | 'LifeLostHold' | 'MatchEnded' | 'Aborted';
export type Bounds = [number, number, number, number];
export interface Paddle { x: number; y: number; px: number; py: number; dx: number; dy: number; tx: number; ty: number; seq: number; generation: number; appliedTick: number }
export interface Ball { u: number; y: number; z: number; vx: number; vy: number; vz: number; cx: number; cy: number }
export interface ViewBoxes { ball: Bounds; own: Bounds; remote: Bounds }
export interface Result { matchId: number; eventId: number; winner: Side; loser: Side; lives: [number, number] }
export interface OnlineState {
  matchId: number; rallyId: number; tick: number; phase: Phase; phaseDeadline: number;
  servingSide: Side; initialServingSide: Side; lives: [number, number]; localPaddles: [Paddle, Paddle];
  ball: Ball; viewBoxes: [ViewBoxes, ViewBoxes]; lastEventId: number; result: Result | null;
}
export interface OnlineEvent {
  matchId: number; rallyId: number; tick: number; eventId: number;
  type: 'launch' | 'return' | 'miss' | 'finish' | 'wall-top' | 'wall-bottom' | 'wall-left' | 'wall-right';
  side: Side | null; incomingBoxTick: number; incomingViewBoxes: [ViewBoxes, ViewBoxes];
  lives: [number, number]; result: Result | null;
}
export const ticking = (phase: Phase) => phase === 'Countdown' || phase === 'Rally' || phase === 'LifeLostHold';
