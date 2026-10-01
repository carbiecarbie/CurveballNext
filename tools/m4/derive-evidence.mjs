import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const dir = resolve(process.argv[2] ?? 'captures-local/m4-correction/generated');
const output = resolve(process.argv[3] ?? 'docs/evidence/m4-ruffle-observations.json');
const manifest = JSON.parse(readFileSync(resolve(dir, 'execution-manifest.json'), 'utf8'));
const cases = JSON.parse(readFileSync(resolve(dir, 'cases.json'), 'utf8'));
const digest = data => createHash('sha256').update(data).digest('hex');
const undef = { special: 'undefined' };
function state(row, target) {
  const clips = row.state.clips;
  const actor = cid => {
    const c = clips.find(c => c.cid === cid);
    return c ? { allocation: c.allocation, position: c.props.myPos, previous: c.props.oldPos ?? undef,
      displacement: c.props.mySpeed, display: c.display } : null;
  };
  const b = clips.find(c => c.cid === 80), root = clips.find(c => c.cid === 0), w = row.state.world;
  return { frame: row.frame, seq: row.seq, rootFrame: root.timeline, target,
    field: { left: w.left, right: w.right, top: w.top, bottom: w.bottom, centerX: b?.props.wx ?? clips.find(c => c.cid === 59)?.props.wx, centerY: b?.props.wy ?? clips.find(c => c.cid === 59)?.props.wy },
    nativeField: clips.find(c => c.cid === 7)?.display,
    level: w.level, score: w.score, playerLives: w.playerLives, enemyLives: w.enemyLives,
    hitScore: w.hitScore, curveBonus: w.curveBonus, superCurveBonus: w.superCurveBonus, accuracyBonus: w.accuracyBonus,
    remainingBonus: w.bonusDisplay, bonusCounter: w.bonus,
    difficulty: { speed: w.speed, curve: w.curveAmount, ai: w.skillFactor },
    player: actor(59), enemy: actor(75),
    paddlePublication: { x: w.paddlePosX, y: w.paddlePosY, dx: w.paddleSpeedX, dy: w.paddleSpeedY },
    enemyPublication: { x: w.enemyPosX, y: w.enemyPosY, dx: w.enemySpeedX, dy: w.enemySpeedY },
    ball: b ? { allocation: b.allocation, position: b.props.myPos, velocity: b.props.mySpeed, curve: b.props.myCurve,
      stopped: b.props.ballStop ?? undef, display: b.display, visualPosition: b.props.VisPos,
      cache: { player: { x: b.props.pPosX ?? undef, y: b.props.pPosY ?? undef, dx: b.props.pSpeedX ?? undef, dy: b.props.pSpeedY ?? undef },
        enemy: { x: b.props.ePosX ?? undef, y: b.props.ePosY ?? undef, dx: b.props.eSpeedX ?? undef, dy: b.props.eSpeedY ?? undef } } } : null,
    publishedBall: { x: root.props.ballPosX, y: root.props.ballPosY, z: root.props.ballPosZ, vx: root.props.ballDirX, vy: root.props.ballDirY, vz: root.props.ballDirZ },
  };
}
const results = []; let commonReady;
for (const c of cases) {
  const raw = readFileSync(resolve(dir, c.trace));
  const recorded = manifest.results.find(r => r.name === c.name);
  assert(recorded && recorded.traceSha256 === digest(raw), `${c.name}: trace provenance mismatch`);
  const rows = raw.toString('utf8').trim().split('\n').map(JSON.parse);
  rows.forEach((r, i) => assert.equal(r.seq, i + 1, `${c.name}: sequence gap`));
  const begin = rows.filter(r => r.kind === 'frame-begin'), end = rows.filter(r => r.kind === 'frame-end');
  assert.equal(begin.length, end.length, `${c.name}: incomplete frame`);
  begin.forEach((r, i) => { assert.equal(r.frame, i + 1); assert.equal(end[i].frame, r.frame); assert(end[i].seq > r.seq); });
  const driver = JSON.parse(readFileSync(resolve(dir, c.driver), 'utf8'));
  let expectedFrame = 0; const expectedMarks = [], expectedInputs = [], expectedFixtures = [];
  for (const step of driver) {
    if (step.op === 'frames') expectedFrame += step.n;
    else if (step.op === 'mark') expectedMarks.push({ frame:expectedFrame, label:step.label });
    else if (step.op === 'inject') expectedFixtures.push(step.writes);
    else expectedInputs.push({ frame:expectedFrame, type:{move:'MouseMove',down:'MouseDown',up:'MouseUp'}[step.op], x:step.x, y:step.y });
  }
  assert.equal(begin.length,expectedFrame,'Executed frame count differs from driver');
  const actualFixtures = rows.filter(r=>r.kind==='fixture-before').map(r=>r.data), fixtureParserDifferences = [];
  // serde_json's input decimal parser may differ by one binary64 step.
  // Preserve both values, never substitute requested values for actual writes.
  function verifyFixture(actual, requested, path = '') {
    if (typeof actual === 'number' && typeof requested === 'number') {
      if (!Object.is(actual,requested)) {
        assert(Number.isFinite(actual) && Number.isFinite(requested) && Math.abs(actual-requested) <= Number.EPSILON*Math.max(1,Math.abs(requested)), 'Unexpected fixture mutation at '+path);
        fixtureParserDifferences.push({ path, requested, actual });
      }
    } else if (actual && requested && typeof actual === 'object' && typeof requested === 'object') {
      assert.deepEqual(Object.keys(actual).sort(),Object.keys(requested).sort(),'Fixture shape mismatch at '+path);
      for (const key of Object.keys(actual)) verifyFixture(actual[key],requested[key],path+'/'+key);
    } else assert.deepEqual(actual,requested,'Fixture value mismatch at '+path);
  }
  verifyFixture(actualFixtures,expectedFixtures);
  assert.deepEqual(rows.filter(r=>r.kind==='fixture-after').map(r=>r.data),actualFixtures,'Incomplete fixture application');
  assert.deepEqual(rows.filter(r=>r.kind==='mark' && !r.data.label.startsWith('host-') && !r.data.label.startsWith('buffer-')).map(r=>({frame:r.frame,label:r.data.label})),expectedMarks,'Actual checkpoints differ from driver');
  const points = {}, inputs = [], frameStates = []; let target = { x: 0, y: 0 };
  for (const r of rows) {
    if (r.kind === 'host-input') {
      const match = r.data.event.match(/^(MouseMove|MouseDown|MouseUp) \{ x: ([^,]+), y: ([^,]+),?/);
      if (match) { target = { x: Number(match[2]), y: Number(match[3].replace(/ \}$/, '')) }; inputs.push({ seq: r.seq, frame: r.frame, type: match[1], ...target }); }
    }
    if (r.kind === 'frame-end' && r.state.world && r.state.clips.some(c=>c.cid===59)) frameStates.push(state(r, { ...target }));
    if (r.kind === 'mark' && !r.data.label.startsWith('host-') && !r.data.label.startsWith('buffer-')) points[r.data.label] = state(r, { ...target });
  }
  assert.deepEqual(inputs.map(({seq, ...input})=>input),expectedInputs,'Actual host input differs from driver');
  const frames = begin.map((b, i) => ({ frame: b.frame, beginSeq: b.seq, endSeq: end[i].seq,
    callbacks: rows.filter(r => r.frame === b.frame && r.seq > b.seq && r.seq < end[i].seq && r.kind === 'action-enter' && [59,75,77,80].includes(r.data.clip.cid) && [0x8914,0xaa5d,0xb424,0xbcf8].includes(r.data.originalStart)).map(r => ({ seq: r.seq, cid: r.data.clip.cid, start: r.data.originalStart })) }));
  const sampleFrames = frames.filter(f => f.callbacks.length === 4).slice(-(c.evidenceClass === 'ORDINARY_RUNTIME_INPUT' ? 10 : 1));
  const lifecycleFrames = points.resolution ? frameStates.filter(f => [0,1,2,3,...(c.name.startsWith('level-') ? [44,45,46,47,48,50] : [])].includes(f.frame - points.resolution.frame)) : [];
  const transitionFrames = points.resolution ? frames.filter(f => f.frame >= points.resolution.frame - 2 && f.frame <= points.resolution.frame + 3) : [];
  const contacts = rows.filter(r => r.kind === 'native-hit-test').map(r => ({ seq: r.seq, frame: r.frame, result: r.data.result,
    a: { cid: r.data.a.cid, display: r.data.a.display, position: r.data.a.props.myPos }, b: { cid: r.data.b.cid, display: r.data.b.display } }));
  const loads = rows.filter(r => r.kind === 'action-enter' && [0x8636,0xa5b0,0xb933].includes(r.data.originalStart)).map(r => ({ seq: r.seq, frame: r.frame, cid: r.data.clip.cid, allocation: r.data.clip.allocation, start: r.data.originalStart }));
  const rewinds = rows.filter(r => r.kind === 'goto' && r.data.clip.cid === 0).map(r => ({ seq: r.seq, frame: r.frame, from: r.data.from, to: r.data.to }));
  const removals = rows.filter(r => r.kind === 'remove-child' && [59,75,80].includes(r.data.clip.cid)).map(r => ({ seq: r.seq, frame: r.frame, cid: r.data.clip.cid, allocation: r.data.clip.allocation }));
  const serveSeq = points.served?.seq, priorSeq = points['before-moving-serve']?.seq ?? points['waiting-after']?.seq;
  const cacheReads = c.evidenceClass === 'ORDINARY_RUNTIME_INPUT' && serveSeq && priorSeq ? rows.filter(r => r.seq > priorSeq && r.seq < serveSeq && r.kind === 'field-read' && r.data.namespace.startsWith('clip:80:') && r.data.name.startsWith('p')).map(r => {
    const source = rows[r.data.sourceWriteSeq - 1]; assert(source && source.kind === 'field-write');
    assert.equal(source.data.namespace, r.data.namespace); assert.equal(source.data.name, r.data.name); assert.deepEqual(source.data.value, r.data.value);
    return { seq: r.seq, name: r.data.name, value: r.data.value, sourceWriteSeq: source.seq, sourceFrame: source.frame };
  }) : [];
  // Preserve actual source generation for each ordinary publication consumer,
  // without leaking process addresses used only as raw namespace keys.
  const selectedFrames = new Set([...sampleFrames.map(f=>f.frame), points['after-moving-frame']?.frame, points['first-flight']?.frame]);
  const publicationReads = [], stack = [], writers = new Map();
  for (const r of rows) {
    if (r.kind === 'action-enter') stack.push({ cid:r.data.clip.cid, allocation:r.data.clip.allocation, start:r.data.originalStart });
    if (r.kind === 'action-exit') stack.pop();
    if (r.kind === 'field-write') writers.set(r.seq, stack.at(-1));
    if (c.evidenceClass === 'ORDINARY_RUNTIME_INPUT' && selectedFrames.has(r.frame) && r.kind === 'field-read' && r.data.namespace.startsWith('object:') && /^(paddle|enemy|ballPos|ballDir)/.test(r.data.name)) {
      const source = rows[r.data.sourceWriteSeq - 1];
      assert(source && source.kind === 'field-write'); assert.equal(source.data.namespace,r.data.namespace); assert.equal(source.data.name,r.data.name); assert.deepEqual(source.data.value,r.data.value);
      publicationReads.push({ seq:r.seq, frame:r.frame, consumer:stack.at(-1), name:r.data.name, value:r.data.value, sourceWriteSeq:source.seq, sourceFrame:source.frame, writer:writers.get(source.seq) });
    }
  }
  const phases = []; let previous;
  for (const r of rows.filter(r => r.kind === 'instruction-before' && r.data.cid === 80 && r.data.originalOffset >= 0xbcf8 && r.data.originalOffset < 0xd51c)) {
    const b = r.state.clips.find(c => c.cid === 80);
    const ball = { position: b.props.myPos, velocity: b.props.mySpeed, curve: b.props.myCurve };
    const serialized = JSON.stringify(ball);
    if (serialized !== previous) { phases.push({ seq: r.seq, frame: r.frame, originalOffset: r.data.originalOffset, ...ball }); previous = serialized; }
  }
  if (!commonReady) commonReady = points.ready;
  assert.deepEqual(points.ready,commonReady,'Each independent session must share the measured boot checkpoint');
  delete points.ready;
  results.push({ name: c.name, targets: c.target, evidenceClass: c.evidenceClass, traceSha256: recorded.traceSha256,
    completeFrames: begin.length, observations: rows.length, driverSha256: digest(readFileSync(resolve(dir, c.driver))),
    injected: actualFixtures, requestedInjections: expectedFixtures, fixtureParserDifferences, inputs, commonReady: true, points, contacts, sampleFrames, transitionFrames, lifecycleFrames, loads, rewinds, removals, cacheReads, publicationReads,
    instructionPhases: c.name.startsWith('wall-') || c.name === 'old-box' ? phases : [] });
}
const evidence = { schema: 'curveball-m4-ruffle-observations-1', oracle: { tag: 'v0.6.0', commit: 'cac5c99ce4a17e606f4ee3090389bb878f852055', executableSha256: manifest.runtimeSha256,
  instrumentationPatchSha256: digest(readFileSync('tools/m4/ruffle-probes.patch')),
  referenceSha256: manifest.referenceSha256, frameRate: 30, viewport: [350,250,1], originalBufferShift: 20, frontend: 'headless normal PlayerEvent and Player.run_frame; null renderer/audio/network backends',
  nativeFlashEquivalence: 'UNVERIFIED', rustc: '1.98.1 (48a229cea 2026-09-01)', cargo: '1.98.1 (797e8a9bc 2026-08-05)', toolchain: 'stable-x86_64-pc-windows-msvc', java: 'Microsoft OpenJDK 21.0.12.1' }, commonReady, results };
mkdirSync(dirname(output), { recursive: true });
// One independently derived case per line keeps tracked evidence compact.
writeFileSync(output, '{\n"schema":' + JSON.stringify(evidence.schema) + ',\n"oracle":' + JSON.stringify(evidence.oracle) + ',\n"commonReady":' + JSON.stringify(commonReady) + ',\n"results":[\n' + results.map(r => JSON.stringify(r)).join(',\n') + '\n]}\n');
console.log(JSON.stringify({ cases: results.length, completeFrames: results.reduce((n,r) => n+r.completeFrames,0), output, bytes: readFileSync(output).length }));
