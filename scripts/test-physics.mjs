// Headless sanity tests for the shared physics + rules.  Run: npm run test:physics
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, '.tmp-test');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'package.json'), '{"type":"commonjs"}');
execSync("npx tsc -p scripts/tsconfig.test.json", { cwd: root, stdio: "inherit" });

const require = createRequire(import.meta.url);
const P = require(resolve(out, 'physics.js'));
const Gm = require(resolve(out, 'game.js'));
const C = require(resolve(out, 'catalog.js'));

let failed = 0;
const ok = (c, m) => { console.log((c ? '  PASS ' : '  FAIL ') + m); if (!c) failed++; };

const table = C.getTable('table-classroom');
const spec = C.buildPenSpec(C.DEFAULT_LOADOUT);
const fresh = () => Gm.buildWorld(table, [spec, spec]);

console.log('Stopping distance vs power (straight flick, no opponent contact):');
for (const pw of [0.3, 0.5, 0.7, 0.9, 1]) {
  const w = fresh(); w.pens[1].y = 1e6; w.pens[1].fallen = true; // remove opponent
  w.table = { ...table, width: 1e5, depth: 1e5 };
  Gm.applyFlick(w, 0, { dx: 0, dy: 1, power: pw, spin: 0 });
  const y0 = w.pens[0].y; const t = P.simulateToRest(w);
  console.log(`   power ${pw}: travels ${(w.pens[0].y - y0).toFixed(1)} cm in ${t.toFixed(2)} s`);
}

console.log('Determinism:');
const run = () => { const w = fresh(); Gm.applyFlick(w, 0, { dx: 0.2, dy: 0.98, power: 0.85, spin: 0.3 }); P.simulateToRest(w); return JSON.stringify(Gm.snapshot(w)); };
ok(run() === run(), 'same flick -> identical snapshot');

console.log('Collision sanity:');
{
  const w = fresh(); w.pens[0].x = 0; w.pens[1].x = 0; w.pens[1].y = w.pens[0].y + 20;
  Gm.applyFlick(w, 0, { dx: 0, dy: 1, power: 0.8, spin: 0 });
  P.simulateToRest(w);
  ok(w.hits > 0, 'direct hit registers a collision');
  ok(w.pens[1].y > -34 + 20, 'opponent got pushed');
}
{
  const w = fresh(); // pens must not pass through each other even at max speed
  w.pens[0].x = 0; w.pens[1].x = 0; w.pens[1].y = w.pens[0].y + 25;
  Gm.applyFlick(w, 0, { dx: 0, dy: 1, power: 1, spin: 0 });
  let tunneled = false;
  for (let i = 0; i < 800 && !P.isAtRest(w); i++) { P.stepWorld(w); if (w.pens[0].y > w.pens[1].y + 1) tunneled = true; }
  ok(!tunneled, 'no tunnelling at full power');
}
{
  const w = fresh();
  Gm.applyFlick(w, 0, { dx: 0, dy: 1, power: 1, spin: 0 });
  P.simulateToRest(w);
  ok(Gm.judgeTurn(w, 0) === 1 || Gm.judgeTurn(w, 0) === null || Gm.judgeTurn(w, 0) === 0, 'judge returns a valid value');
  console.log('   full-power straight flick result -> shooter pen fallen:', w.pens[0].fallen, 'opp fallen:', w.pens[1].fallen, 'hits:', w.hits);
}
{
  const w = fresh(); // weak flick that cannot reach
  Gm.applyFlick(w, 0, { dx: 0, dy: 1, power: 0.2, spin: 0 });
  P.simulateToRest(w);
  ok(Gm.judgeTurn(w, 0) === null, 'weak flick: nobody falls');
}
console.log('Hit-power matrix (aimed at opponent, how often is a knockout?):');
for (const [name, lo] of [['stock', C.DEFAULT_LOADOUT], ['tank', { cover: 'cover-3', weight: 'weight-brass', tip: 'tip-rubber', skin: 'skin-blue' }]]) {
  const s2 = C.buildPenSpec(lo);
  let ko = 0, n = 0;
  for (let k = 0; k < 120; k++) {
    const w = Gm.buildWorld(table, [s2, spec]);
    const ang = Math.atan2(w.pens[1].y - w.pens[0].y, w.pens[1].x - w.pens[0].x) + (Math.random() - 0.5) * 0.1;
    Gm.applyFlick(w, 0, { dx: Math.cos(ang), dy: Math.sin(ang), power: 0.75 + Math.random() * 0.25, spin: 0 });
    P.simulateToRest(w); n++; if (Gm.judgeTurn(w, 0) === 0) ko++;
  }
  console.log(`   ${name} spec (mass ${s2.mass}, maxSpeed ${s2.maxSpeed}): ${ko}/${n} knockouts on first flick`);
}
console.log(failed ? `\n${failed} FAILED` : '\nAll physics checks passed');
process.exit(failed ? 1 : 0);
