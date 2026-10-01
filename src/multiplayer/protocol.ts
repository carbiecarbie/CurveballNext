import { RULES } from './rules';
import type { OnlineState, Phase } from './types';

export type Frame = Record<string, unknown> & { type: string; protocolVersion: number };
type Validator = (v: unknown) => boolean;
const integer: Validator = v => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const finite: Validator = v => typeof v === 'number' && Number.isFinite(v);
const string: Validator = v => typeof v === 'string' && v.length > 0 && v.length <= 128;
const bool: Validator = v => typeof v === 'boolean';
const phase: Validator = v => ['Waiting', 'Countdown', 'Rally', 'LifeLostHold', 'MatchEnded', 'Aborted'].includes(v as string);
const fields: Record<string, Record<string, Validator>> = {
  create: { requestId: string, probeId: integer, c0: finite },
  join: { requestId: string, roomCode: string, probeId: integer, c0: finite },
  ready: { requestId: string, value: bool }, rematch: { requestId: string, matchId: integer, value: bool },
  leave: { requestId: string }, unavailable: { reason: v => v === 'hidden' },
  controlFence: { generation: integer, requestId: string }, controlSync: { generation: integer, requestId: string },
  controlResume: { generation: integer, stateSerial: integer, matchId: integer, rallyId: integer, requestId: string },
  input: { matchId: integer, rallyId: integer, controlGeneration: integer, resumeStateSerial: integer, seq: integer, x: finite, y: finite, processedSnapshotSerial: integer },
  heartbeat: { runtimeBeatSeq: integer, processedServerSerial: integer, processedSnapshotSerial: integer, processedTick: integer,
    matchId: integer, rallyId: integer, phase, echoNonce: string, probeId: integer, c0: finite, c3: finite },
};
export function parseClient(raw: string, bound: boolean): Frame {
  if (new TextEncoder().encode(raw).length > 1024) throw new Error('oversize');
  const v: unknown = JSON.parse(raw);
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('schema');
  const f = v as Frame, schema = fields[f.type];
  if (!schema || f.protocolVersion !== RULES.protocolVersion) throw new Error('protocol-update');
  const expected: Record<string, Validator> = { type: string, protocolVersion: v => v === 1, ...schema, ...(bound ? { roomEpoch: string } : {}) };
  if (Object.keys(f).length !== Object.keys(expected).length || Object.entries(expected).some(([k, check]) => !check(f[k]))) throw new Error('schema');
  if (bound === (f.type === 'create' || f.type === 'join')) throw new Error('binding');
  return f;
}
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const exact = (v: object, names: string[]) => Object.keys(v).every(k => names.includes(k)) && names.every(k => Object.hasOwn(v, k));
const stateNames = ['matchId', 'rallyId', 'tick', 'phase', 'phaseDeadline', 'servingSide', 'initialServingSide', 'lives', 'localPaddles', 'ball', 'viewBoxes', 'lastEventId', 'result'];
/** Runtime validator: terminal knowledge is established only by a complete coherent state. */
export function validState(v: unknown): v is OnlineState {
  if (!v || typeof v !== 'object') return false;
  const s = v as OnlineState;
  const allowed = [...stateNames, 'type', 'protocolVersion', 'roomEpoch', 'serverSerial', 'serverTime', 'ready', 'occupied', 'rematch', 'controlGeneration', 'enabled', 'ackInputSeq', 'ackInputTick'];
  if (Object.keys(s).some(k => !allowed.includes(k)) || stateNames.some(k => !Object.hasOwn(s, k))) return false;
  if (![s.matchId, s.rallyId, s.tick, s.lastEventId, s.phaseDeadline].every(integer) || !phase(s.phase) ||
    ![0, 1].includes(s.servingSide) || ![0, 1].includes(s.initialServingSide) ||
    !Array.isArray(s.lives) || s.lives.length !== 2 || !s.lives.every(n => integer(n) && n <= 3) ||
    !Array.isArray(s.localPaddles) || s.localPaddles.length !== 2 || !s.localPaddles.every(p =>
      p && exact(p, ['x', 'y', 'px', 'py', 'dx', 'dy', 'tx', 'ty', 'seq', 'generation', 'appliedTick']) && [p.x, p.y, p.px, p.py, p.dx, p.dy, p.tx, p.ty].every(num) && [p.seq, p.generation, p.appliedTick].every(integer)) ||
    !s.ball || ![s.ball.u, s.ball.y, s.ball.z, s.ball.vx, s.ball.vy, s.ball.vz, s.ball.cx, s.ball.cy].every(num) ||
    !exact(s.ball, ['u', 'y', 'z', 'vx', 'vy', 'vz', 'cx', 'cy']) ||
    !Array.isArray(s.viewBoxes) || s.viewBoxes.length !== 2 || !s.viewBoxes.every(v => v && [v.ball, v.own, v.remote].every(b =>
      Array.isArray(b) && b.length === 4 && b.every(n => Number.isSafeInteger(n)) && b[0] <= b[1] && b[2] <= b[3]))) return false;
  if (s.phase === 'MatchEnded') {
    const r = s.result;
    return !!r && exact(r, ['matchId', 'eventId', 'winner', 'loser', 'lives']) && r.matchId === s.matchId && integer(r.eventId) && r.eventId === s.lastEventId &&
      [0, 1].includes(r.loser) && r.winner === 1 - r.loser && s.lives[r.loser] === 0 && s.lives[r.winner] >= 1 &&
      Array.isArray(r.lives) && r.lives.length === 2 && r.lives.every((n, i) => n === s.lives[i]);
  }
  return s.result === null && (s.phase === 'Aborted' || s.lives.every(n => n >= 1));
}
export const sameContext = (a: Pick<OnlineState, 'matchId' | 'rallyId'>, b: Frame) => a.matchId === b.matchId && a.rallyId === b.rallyId;
export function envelope(v: unknown): v is Frame & { serverSerial: number; serverTime: number; roomEpoch: string } {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const f = v as Frame;
  return f.protocolVersion === 1 && integer(f.serverSerial) && finite(f.serverTime) && string(f.type) && string(f.roomEpoch);
}
export type HealthState = { matchId: number; rallyId: number; phase: Phase; tick: number };

/** Validate before applying any state; network handlers only enqueue. */
export function validServer(v: unknown): v is Frame & { serverSerial: number; serverTime: number; roomEpoch: string } {
  if (!envelope(v)) return false;
  const common = ['type', 'protocolVersion', 'roomEpoch', 'serverSerial', 'serverTime'], f = v;
  const two = (a: unknown, check: Validator) => Array.isArray(a) && a.length === 2 && a.every(check);
  if (f.type === 'snapshot') return exact(f, [...common, ...stateNames, 'ready', 'occupied', 'rematch', 'controlGeneration', 'enabled', 'ackInputSeq', 'ackInputTick']) && validState(f) &&
    [f.ready, f.occupied, f.rematch, f.enabled].every(a => two(a, bool)) && [f.controlGeneration, f.ackInputSeq, f.ackInputTick].every(a => two(a, integer)) &&
    (f.ackInputSeq as number[]).every((n, i) => n === (f as unknown as OnlineState).localPaddles[i].seq) &&
    (f.ackInputTick as number[]).every((n, i) => n === (f as unknown as OnlineState).localPaddles[i].appliedTick);
  if (f.type === 'joined') return exact(f, [...common, 'requestId', 'roomId', 'slot', 'playerSessionCredential', 'rulesVersion', 'probeId', 'echoC0', 's1', 's2', 'controlGeneration', 'enabled', 'initialStateSerial', 'freshSnapshot']) &&
    validState(f.freshSnapshot) && [f.probeId, f.controlGeneration, f.initialStateSerial].every(integer) && [f.echoC0, f.s1, f.s2].every(finite) && bool(f.enabled) && string(f.requestId);
  if (f.type === 'heartbeat') {
    const hasProbe = Object.hasOwn(f, 'echoProbeId');
    return exact(f, [...common, 'nonce', ...(hasProbe ? ['echoProbeId', 'echoC0', 's1', 's2'] : [])]) && string(f.nonce) &&
      (!hasProbe || integer(f.echoProbeId) && [f.echoC0, f.s1, f.s2].every(finite));
  }
  if (f.type === 'controlAck') return exact(f, [...common, 'requestId', 'kind', 'generation', 'enabled', 'stateSerial', 'freshSnapshot']) &&
    string(f.requestId) && ['fence', 'sync', 'resume', 'resync'].includes(f.kind as string) && integer(f.generation) && integer(f.stateSerial) && bool(f.enabled) && validState(f.freshSnapshot);
  if (f.type === 'error') return exact(f, [...common, 'requestId', 'code']) && typeof f.requestId === 'string' && string(f.code);
  if (f.type === 'interrupted') return exact(f, [...common, 'reason', 'freshSnapshot']) && string(f.reason) && validState(f.freshSnapshot);
  if (f.type === 'event') {
    if (!exact(f, [...common, 'matchId', 'rallyId', 'tick', 'eventId', 'eventType', 'side', 'incomingBoxTick', 'incomingViewBoxes', 'lives', 'result', 'freshSnapshot']) ||
      !validState(f.freshSnapshot) || ![f.matchId, f.rallyId, f.tick, f.eventId, f.incomingBoxTick].every(integer) || !['launch', 'return', 'miss', 'finish', 'wall-top', 'wall-bottom', 'wall-left', 'wall-right'].includes(f.eventType as string)) return false;
    const s = f.freshSnapshot;
    const incoming = { ...s, viewBoxes: f.incomingViewBoxes };
    return validState(incoming) && f.matchId === s.matchId && f.rallyId === s.rallyId && f.tick === s.tick && (f.eventId as number) <= s.lastEventId &&
      f.incomingBoxTick === (f.tick as number) - 1 && two(f.lives, integer) && (f.lives as number[]).every((n, i) => n === s.lives[i]) &&
      (f.side === null || f.side === 0 || f.side === 1) && (f.eventType !== 'finish' || s.phase === 'MatchEnded' && s.result?.eventId === f.eventId && JSON.stringify(s.result) === JSON.stringify(f.result));
  }
  return false;
}
