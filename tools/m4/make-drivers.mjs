import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// These are disclosed fixture inputs, not replacements for original callbacks.
// The driver opens the private unchanged movie, clicks its real Start button,
// and advances complete Ruffle frames. Generated files remain local/ignored.
const out = resolve(process.argv[2] ?? 'captures-local/m4-correction/generated');
mkdirSync(out, { recursive: true });
const frames = (n, detail = false) => ({ op: 'frames', n, detail });
const mark = label => ({ op: 'mark', label });
const input = (op, x = 176, y = 126, detail = false) => ({ op, x, y, detail });
const write = (cid, fields, object) => ({ cid, ...(object ? { object } : {}), fields });
const world = fields => ({ cid: 0, world: true, fields });
const inject = writes => ({ op: 'inject', writes });
const boot = [frames(6), input('move', 175, 115), input('down', 175, 115), input('up', 175, 115), input('move'), frames(70), mark('ready')];
const launch = [input('down', 176, 126, true), mark('served'), input('up'), frames(1, true), mark('first-flight')];
const cases = [];
function save(name, target, evidenceClass, steps) {
  const driver = [...boot, ...steps];
  writeFileSync(resolve(out, `${name}.driver.json`), JSON.stringify(driver, null, 2) + '\n');
  cases.push({ name, target, evidenceClass, driver: `${name}.driver.json`, trace: `${name}.trace.jsonl` });
}
function pose(x, y, z) {
  const g = (90 - Math.atan(z / 31.066017) * 180 / 3.141592653589793) / 90;
  return { x: 175.5 + (x - 175.5) * g, y: 125.5 + (y - 125.5) * g, width: 30 * g, height: 30 * g };
}
function ball(x, y, z, vx, vy, vz, cx = 0, cy = 0, display = pose(x, y, z)) {
  return [write(80, { x, y, z }, 'myPos'), write(80, { x: vx, y: vy, z: vz }, 'mySpeed'),
    write(80, { x: cx, y: cy }, 'myCurve'), { cid: 80, display }];
}
const prepared = writes => [inject(writes), mark('prepared'), frames(1, true), mark('result')];

save('ordinary-serve', ['R01', 'R02', 'R14', 'R10'], 'ORDINARY_RUNTIME_INPUT', [mark('waiting-before'), frames(22), mark('waiting-after'), ...launch, frames(10), mark('active-11'), frames(11), mark('active-22'), frames(79), mark('ordinary-end')]);
save('moving-cache', ['R02', 'R14'], 'ORDINARY_RUNTIME_INPUT', [input('move', 215, 150), frames(1, true), mark('after-moving-frame'), input('move', 220, 155), mark('before-moving-serve'), input('down', 220, 155, true), mark('served'), input('up', 220, 155), frames(1, true), mark('first-flight'), frames(10), mark('moving-end')]);
save('fractional-input', ['R14'], 'ORDINARY_RUNTIME_INPUT', [input('move', 175.5, 125.5), frames(35), mark('fractional-settled')]);
save('centered-cache', ['R02'], 'CONTROLLED_RUNTIME_FIXTURE', [inject([
  write(59, { x: 175.5, y: 125.5, z: 0 }, 'myPos'), write(59, { x: 175.5, y: 125.5 }, 'oldPos'), write(59, { x: 0, y: 0 }, 'mySpeed'),
  { cid: 59, display: { x: 175.5, y: 125.5 } }, world({ paddlePosX: 175.5, paddlePosY: 125.5, paddleSpeedX: 0, paddleSpeedY: 0 }),
  write(80, { pPosX: 175.5, pPosY: 125.5, pSpeedX: 0, pSpeedY: 0 }),
]), mark('center-prepared'), ...launch]);
save('wall-right', ['R06'], 'CONTROLLED_RUNTIME_FIXTURE', prepared(ball(310.75, 125.5, 35, 1, 0, 2, 0.5, 0)));
save('wall-corner', ['R06'], 'CONTROLLED_RUNTIME_FIXTURE', prepared(ball(310.75, 40.25, 35, 1, 1, 2, 0.5, 0.25)));
save('wall-left', ['R06'], 'CONTROLLED_RUNTIME_FIXTURE', prepared(ball(40.25, 125.5, 35, -1, 0, 2, -0.5, 0)));
save('wall-bottom', ['R06'], 'CONTROLLED_RUNTIME_FIXTURE', prepared(ball(175.5, 210.75, 35, 0, -1, 2, 0, -0.5)));
save('old-box', ['R08'], 'CONTROLLED_RUNTIME_FIXTURE', prepared(ball(217.5, 125.5, 1, 20, 0, -2)));

for (const side of ['player', 'enemy']) for (const axis of ['x', 'y']) for (const sign of [-1, 1]) for (const delta of [-0.05, 0, 0.05]) {
  const near = side === 'player', px = near ? 176 : 175.5, py = near ? 126 : 125.5;
  const distance = axis === 'x' ? near ? 45 : 11.25 : near ? 35 : 8.75;
  const display = { x: px, y: py, width: near ? 30 : 7.5, height: near ? 30 : 7.5 };
  display[axis] += sign * (distance + delta);
  save(`edge-${side}-${axis}-${sign}-${delta}`, ['R05'], 'CONTROLLED_RUNTIME_FIXTURE', prepared(ball(px, py, near ? 1 : 74, 0, 0, near ? -2 : 2, 0, 0, display)));
}
const accuracy = [[0, 0], ...[-7.05, -7, -6.95, 6.95, 7, 7.05].map(x => [x, 0]), ...[-5.05, -5, -4.95, 4.95, 5, 5.05].map(y => [0, y]), ...[-7, 7].flatMap(x => [-5, 5].map(y => [x, y]))];
for (const [dx, dy] of accuracy) save(`accuracy-${dx}-${dy}`, ['R05'], 'CONTROLLED_RUNTIME_FIXTURE', prepared(ball(176 + dx, 126 + dy, 1, 0, 0, -2)));
save('accuracy-velocity', ['R05'], 'CONTROLLED_RUNTIME_FIXTURE', prepared(ball(176 - 1.25, 126 + 0.75, 1, 1.25, 0.75, -2)));

for (const side of ['player', 'enemy']) {
  save(`retry-${side}`, ['R10', 'R11'], 'CONTROLLED_RUNTIME_FIXTURE', [
    ...launch, frames(3), input('move', 1000, 1000), frames(1), mark('before-miss'),
    inject([...ball(1000, 125.5, side === 'player' ? 0 : 75, 0, 0, side === 'player' ? -2 : 2, 0, 0, { x: 1000, y: 125.5, width: 30, height: 30 }), world({ hitScore: 70, curveBonus: 35, superCurveBonus: 105, accuracyBonus: 60 })]),
    mark('prepared'), frames(1, true), mark('miss'), frames(18), mark('before-resolution'), frames(1, true), mark('resolution'), frames(3), mark('retry-ready'),
    input('move'), frames(20), mark('retry-waited'), ...launch, frames(5), mark('resumed-six'),
  ]);
}
for (const level of [1, 10]) save(`level-${level}-completion`, level === 1 ? ['R10', 'R11'] : ['R12'], 'CONTROLLED_RUNTIME_FIXTURE', [
  ...launch, input('move', 1000, 1000), frames(1),
  inject([...ball(1000, 125.5, 75, 0, 0, 2, 0, 0, { x: 1000, y: 125.5, width: 30, height: 30 }), world({ level, enemyLives: 1 })]),
  mark('prepared'), frames(1, true), mark('miss'), frames(19, true), mark('resolution'), frames(50), mark('next-level-ready'),
]);
// Correction pass: independently repeat the original corpus and add general-policy probes.
for (const z of [0, 1, 15, 37.5, 74, 75]) save(`display-depth-${z}`, ['R05'], 'CONTROLLED_RUNTIME_FIXTURE', prepared(ball(210.037, 98.013, z, 0, 0, 0)));
save('fractional-input-odd', ['R05','R14'], 'ORDINARY_RUNTIME_INPUT', [input('move',177.5,127.5), frames(35), mark('fractional-settled')]);
save('level-intro-input', ['R11','R14'], 'CONTROLLED_RUNTIME_FIXTURE', [
  ...launch, input('move',1000,1000), frames(1),
  inject([...ball(1000,125.5,75,0,0,2,0,0,{x:1000,y:125.5,width:30,height:30}),world({enemyLives:1})]),
  mark('prepared'), frames(1,true), mark('miss'), frames(19,true), mark('resolution'),
  input('move',55,45), frames(1,true), mark('intro-moving'), frames(49), mark('next-level-ready'),
]);
writeFileSync(resolve(out, 'cases.json'), JSON.stringify(cases, null, 2) + '\n');
console.log(JSON.stringify({ directory: out, cases: cases.length, note: 'Each fixture writes list is preserved in its driver and runtime trace.' }));
