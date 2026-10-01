import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const [beforePath='captures-local/m4-correction/prior-derived.json',afterPath='docs/evidence/m4-ruffle-observations.json',output='docs/evidence/m4-correction-pass.json']=process.argv.slice(2);
const before=JSON.parse(readFileSync(beforePath)), afterBytes=readFileSync(afterPath), after=JSON.parse(afterBytes);
assert.deepEqual(before.oracle,after.oracle,'Runtime/reference/probe identity changed');
assert.deepEqual(before.commonReady,after.commonReady,'Boot state changed');
const repeated=[];
for (const c of before.results) {
  const current=after.results.find(r=>r.name===c.name); assert(current,'Missing repeated session');
  // Raw namespaces contain process pointers; derived state/order/provenance excludes them.
  const {traceSha256:priorHash,...prior}=c, {traceSha256:repeatHash,...repeat}=current;
  assert.deepEqual(prior,repeat,'Original runtime repeat differs: '+c.name);
  repeated.push({case:c.name,status:'EXACT_DERIVED_REPEAT',priorTraceSha256:priorHash,repeatTraceSha256:repeatHash,driverSha256:c.driverSha256});
}
const report={schema:'curveball-m4-correction-pass-1',oracle:after.oracle,
  observationsSha256:createHash('sha256').update(afterBytes).digest('hex'),
  sessions:after.results.length,ordinarySessions:after.results.filter(c=>c.evidenceClass==='ORDINARY_RUNTIME_INPUT').length,
  completeFrames:after.results.reduce((n,r)=>n+r.completeFrames,0),observations:after.results.reduce((n,r)=>n+r.observations,0),
  repeated,added:after.results.filter(c=>!before.results.some(b=>b.name===c.name)).map(c=>c.name),
  rootCauses:[
    {targets:['R02','R14'],before:'Player/enemy/ball; AI prior ball; moving serve score150 and curves(-1.04,+.64)',observation:'Ball/marker/enemy/player; ball prior paddle, AI current ball; synchronous MouseDown prior cache; score100 and curves(-.01,+.01)',correction:'Ball before enemy/player, with actual callback audit and prior sample stamps',after:'MATCH'},
    {targets:['R05'],before:'Identity binary64 display and host target; player display readback fed logical movement',observation:'Logical myPos/oldPos/publication separate from truncated twip display; f32 transformed bounds round ties to even; root mouse device-pixel readback',correction:'General axis-aligned twip/f32 adapter, normal-input pixel readback, independent logical paddle state',after:'MATCH',farTouch:'Original native closed edges accepted; prior enemy-first update installed nominal undersized enemy before testing. Ordering correction fixes this; native quantization preserves it in later frames.'},
    {targets:['R11','R10'],before:'Immediate retry ball/publication; recentered reconstructed player; frozen intro; immediate bonus setup',observation:'Retry removal, Load+1/cache+2; level player retained/updating, setup+45/enemy Load+46/ball Load+47/cache+48; root publication retained through Load',correction:'Actor availability/Load boundaries, retained player/target/logical previous state, deferred setup and publication',after:'MATCH'},
    {targets:['R06'],before:'Clamp/reversal/attenuation (accepted M3)',observation:'Clamp/attenuation/reversal; y before x',correction:'Prior M4 correction preserved; see m4-wall-order-correction.json',after:'MATCH'},
    {targets:['R12'],observation:'Injected level10 completion increments11 and later requests undefined difficulty; natural path unproven',correction:'None: existing ContentComplete containment10 retained',after:'INTENTIONAL CURVEBALLNEXT CONTAINMENT'}
  ],limits:['Checkpoint comparisons and disclosed prepared states, not an exhaustive naturally reachable campaign proof','Pinned Ruffle provisional oracle; historical Adobe Flash Player equivalence unproven','Only axis-aligned original actor shapes and recorded between-frame normal input are covered','U06 natural post10, U07 stopped-miss/early-Load clicks, U08 service and U09 exact audiovisual timing remain open'],
  numericalPolicy:'Discrete/bounds/order exact; logical math abs1e-9+rel1e-12 unchanged; no collision tolerance; signed zero as existing replay',
  deterministicProfile:'m4-ruffle-06-01; old m1-provisional-01 captures rejected; schema curveball-m2-trace-2 retained'};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,repeated:repeated.length,sessions:report.sessions,completeFrames:report.completeFrames,observations:report.observations}));
