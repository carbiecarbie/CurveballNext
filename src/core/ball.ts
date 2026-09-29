import { display, type DisplayAdapter } from '../compat/display';
import { PROFILE, type Profile } from '../compat/profile';
import { DECAY, DEPTH, DIAMETER } from './constants';
import { accurate, classify, overlaps, walls } from './collisions';
import { installCurve } from './lifecycle';
import { project } from './projection';
import { advanceLevelBonus, awardPlayerContact, resetAwards } from './scoring';
import { publish, sample } from './state';
import type { Audit, Event, State } from './types';
export function ballStep(s: State, events: Event[], audit: Audit, profile: Profile = PROFILE, adapter: DisplayAdapter = display) {
  if (s.phase !== 'ServeWaiting' && s.phase !== 'Rally') return;
  const b = s.ball;
  const checkpoint = (phase: string) => audit.checkpoints.push({ phase, ball: structuredClone(b) });
  s.cache = { tick: s.tick, player: sample(s.player), enemy: sample(s.enemy) };
  checkpoint('pre-integration');
  b.vx += b.cx; b.vy += b.cy; b.z += b.vz; b.x += b.vx; b.y -= b.vy;
  checkpoint('post-movement');
  if (b.cx !== 0) b.cx /= DECAY;
  if (b.cy !== 0) b.cy /= DECAY;
  checkpoint('post-decay');
  walls(b, events, profile); checkpoint('post-walls');
  const side = b.z > DEPTH ? 'enemy' : b.z < 0 ? 'player' : null;
  checkpoint('pre-contact');
  if (side) {
    const cached = s.cache[side], accepted = overlaps(b.box, s[side].box);
    audit.contacts.push({ kind: 'return', side, oldBallBox: structuredClone(b.box), paddleBox: structuredClone(s[side].box),
      before: structuredClone(b), sample: structuredClone(cached), accepted });
    if (accepted) {
      b.z = side === 'enemy' ? DEPTH : 0; b.vz = -b.vz;
      installCurve(s, cached, side === 'enemy', false, profile);
      s.diagnostics.returns++; s.diagnostics.rallyReturns++;
      const isAccurate = side === 'player' ? accurate(b, cached) : false;
      const curve = side === 'player' ? classify(b.cx, b.cy) : undefined;
      if (side === 'player') awardPlayerContact(s, isAccurate, curve, false);
      events.push({ type: 'return', side, ...(side === 'player' ? { accurate: isAccurate, curve } : {}), sample: structuredClone(cached) });
    } else {
      b.vx = b.vy = b.vz = b.cx = b.cy = 0; s.phase = 'MissHold'; s.phaseTick = s.tick; s.missTick = s.tick;
      if (side === 'player') { s.playerLives--; resetAwards(s); }
      else s.enemyLives--;
      s.diagnostics[side === 'player' ? 'playerMisses' : 'enemyMisses']++;
      events.push({ type: 'miss', side });
    }
  }
  checkpoint('post-response');
  b.box = adapter.install(project(b.x, b.y, b.z, DIAMETER, DIAMETER, profile), { tick: s.tick, generation: b.generation });
  s.publishedBall = publish(b, s.tick); checkpoint('final-publication');
  advanceLevelBonus(s);
  for (const contact of audit.contacts) {
    // A dispatch-time contact may precede a retry/reset in the same tick.
    // Leave the optional new box absent when that ball never reached installation.
    if (contact.before.generation === b.generation) contact.newBallBox = structuredClone(b.box);
  }
}
