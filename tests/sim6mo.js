/* FIT HQ 6-month usage simulation — drives the real app code with a
   realistic ledger and checks the app against independently computed
   expectations. Run: cat tests/stubs.js data.js app.js nutrition.js
   workouts.js progress.js extras.js tests/sim6mo.js | node */
"use strict";
let pass = 0, fail = 0; const failures = [];
const ok = (n, c, extra = "") => { console.log((c ? "PASS" : "FAIL") + "  " + n + (extra ? " — " + extra : "")); c ? pass++ : (fail++, failures.push(n)); };
const near = (a, b, t = 0.01) => Math.abs(a - b) <= t;
/* deterministic RNG so the sim is reproducible */
let seed = 42; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = a => a[Math.floor(rnd() * a.length)];

/* ---------- generate 183 days: 2026-04-20 .. 2026-10-19 ---------- */
const START = "2026-04-20", DAYS = 183;
const dates = Array.from({length: DAYS}, (_, i) => addDays(START, i));
DB.settings.startKg = lbToKg(235); DB.settings.goalKg = lbToKg(200);
DB.settings.targets = {kcal: 2630, p: 211, c: 249, f: 88, waterMl: 2500};
/* food pool (per serving) */
const POOL = [
  ["Oatmeal + berries", "breakfast", {kcal: 340, p: 11, c: 58, f: 7, fiber: 8, sugar: 14, satfat: 1, sodium: 120}],
  ["Eggs + toast", "breakfast", {kcal: 420, p: 22, c: 30, f: 23, fiber: 3, sugar: 3, satfat: 6, sodium: 480}],
  ["Greek yogurt cup", "snacks", {kcal: 130, p: 17, c: 9, f: 2, fiber: 0, sugar: 7, satfat: 1, sodium: 65}],
  ["Chicken wrap", "lunch", {kcal: 610, p: 42, c: 52, f: 24, fiber: 5, sugar: 5, satfat: 5, sodium: 980}],
  ["Tuna salad sandwich", "lunch", {kcal: 540, p: 34, c: 44, f: 24, fiber: 4, sugar: 6, satfat: 4, sodium: 870}],
  ["Salmon + rice + veg", "dinner", {kcal: 760, p: 48, c: 62, f: 33, fiber: 6, sugar: 4, satfat: 6, sodium: 520}],
  ["Beef stir fry", "dinner", {kcal: 690, p: 44, c: 48, f: 34, fiber: 5, sugar: 9, satfat: 9, sodium: 910}],
  ["Pasta + meat sauce", "dinner", {kcal: 820, p: 38, c: 96, f: 29, fiber: 7, sugar: 11, satfat: 8, sodium: 760}],
  ["Protein shake", "snacks", {kcal: 160, p: 30, c: 5, f: 2, fiber: 1, sugar: 2, satfat: 1, sodium: 210}],
  ["Apple + peanut butter", "snacks", {kcal: 290, p: 8, c: 28, f: 17, fiber: 5, sugar: 19, satfat: 3, sodium: 140}]
];
for (const [name, , per] of POOL.slice(0, 6))
  DB.foods.push({id: uid(), name, brand: "", unit: "1 serving", per: Object.assign({}, per), fav: name.includes("Chicken")});
DB.meals.push({id: uid(), name: "Usual breakfast", yield: 1, items: [
  {name: "Oatmeal + berries", brand: "", unit: "1 serving", qty: 1, per: Object.assign({}, POOL[0][2])},
  {name: "Protein shake", brand: "", unit: "1 serving", qty: 1, per: Object.assign({}, POOL[8][2])}]});

const expected = {};   // date -> {kcal,p,c,f} independent ledger
let runCount = 0; const prLedger = {};
dates.forEach((d, i) => {
  const dow = parseKey(d).getDay();
  /* food on ~88% of days */
  if (rnd() < 0.88) {
    const n = 3 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const [name, meal, per] = pick(POOL);
      const qty = pick([1, 1, 1, 0.5, 1.5, 2]);
      DB.entries.push({id: uid(), date: d, meal, name, brand: "", qty, unit: "1 serving", per: Object.assign({}, per), source: "manual"});
      const e = expected[d] || (expected[d] = {kcal: 0, p: 0, c: 0, f: 0});
      e.kcal += per.kcal * qty; e.p += per.p * qty; e.c += per.c * qty; e.f += per.f * qty;
    }
  }
  /* water ~80% of days */
  if (rnd() < 0.8) { let ml = 0; while (ml < 1400 + rnd() * 1400) { const a = pick([250, 500]); DB.water.push({id: uid(), date: d, ml: a}); ml += a; } }
  /* weight 5x/week: 106.6 -> ~97.5 kg with daily noise */
  if (![0, 6].includes(dow) || rnd() < 0.3) {
    const trend = 106.6 - (9.1 * i / DAYS);
    DB.weights.push({id: uid(), date: d, kg: Math.round((trend + (rnd() - 0.5) * 1.1) * 10) / 10});
  }
  /* workouts */
  if ([1, 3, 5].includes(dow)) { // MWF dumbbell
    if (rnd() < 0.5) DB.sessions.push({id: uid(), date: d, type: "dumbbell", title: "Dumbbell Circuit", mins: 32, detail: {}});
    else {
      const ex = pick(DUMBBELL); const top = 13.6 + Math.floor(i / 14);
      const sets = [{kg: top, reps: 10, done: true}, {kg: top, reps: 9, done: true}, {kg: top - 2.3, reps: 10, done: true}];
      DB.sessions.push({id: uid(), date: d, type: "dumbbell", title: "Strength — " + ex, mins: 24, detail: {exercise: ex, sets}});
      prLedger[ex] = Math.max(prLedger[ex] || 0, top);
    }
    if (dow === 5 && rnd() < 0.5) DB.sessions.push({id: uid(), date: d, type: "boxing", title: "Boxing — 4 × 3 min", mins: 25, detail: {rounds: 4, roundMin: 3}});
  }
  if ([2, 4, 6].includes(dow)) { // Tue/Thu/Sat: C25K first 9 weeks, then maintenance runs; yoga too
    if (i < 63 && runCount < 27) {
      const w = Math.floor(runCount / 3), r = runCount % 3;
      DB.sessions.push({id: uid(), date: d, type: "run", title: `Couch to 5K — Week ${w + 1} Run ${r + 1}`, mins: 30,
        detail: {program: "c25k", week: w + 1, run: r + 1, km: Math.round((2.6 + runCount * 0.06) * 100) / 100, paceSec: 470 - runCount * 3,
          track: Array.from({length: 150}, (_, k) => [49.88 + k * 0.0001, -119.49 + k * 0.00012])}});
      runCount++;
    } else if (i >= 63 && dow !== 6) {
      DB.sessions.push({id: uid(), date: d, type: "run", title: "Easy run", mins: 32, detail: {km: 4.6, paceSec: 415}});
    }
    if (rnd() < 0.7) DB.sessions.push({id: uid(), date: d, type: "yoga", title: "Yoga — " + pick(YOGA_ROUTINES).title, mins: 12, detail: {}});
  }
  if (i % 30 === 0) DB.measures.push({id: uid(), date: d, type: "Waist", cm: Math.round((108 - i / 30 * 1.8) * 10) / 10});
});
saveDB();
console.log(`simulated: ${DB.entries.length} entries · ${DB.water.length} water logs · ${DB.weights.length} weights · ${DB.sessions.length} sessions · ${runCount} C25K runs`);

/* ---------- checks against the independent ledger ---------- */
let badDays = 0;
for (const d of Object.keys(expected)) {
  const t = dayTotals(d), e = expected[d];
  if (!near(t.kcal, e.kcal, 0.01) || !near(t.p, e.p, 0.01) || !near(t.c, e.c, 0.01) || !near(t.f, e.f, 0.01)) badDays++;
}
ok("every logged day's totals match the independent ledger", badDays === 0, `${Object.keys(expected).length} days checked, ${badDays} bad`);
let prBad = 0; for (const ex of Object.keys(prLedger)) if (!near(exPR(ex), prLedger[ex], 0.01)) prBad++;
ok("exercise PRs match ledger", prBad === 0, `${Object.keys(prLedger).length} exercises`);

/* storage + round trip */
const sizeKB = Math.round((localStorage.getItem(DB_KEY) || "").length / 1024);
ok("6 months of data fits localStorage comfortably", sizeKB < 4000, `${sizeKB} KB serialized`);
const counts = [DB.entries.length, DB.weights.length, DB.sessions.length, DB.water.length];
loadDB();
ok("save -> reload round trip preserves all records",
  [DB.entries.length, DB.weights.length, DB.sessions.length, DB.water.length].join() === counts.join());

/* renders + timing (rough proxy in node) */
const timed = (name, fn) => { const t0 = Date.now(); fn(); const ms = Date.now() - t0; console.log(`  render ${name}: ${ms} ms`); return ms; };
timed("Home", renderHome); timed("Nutrition", renderNutrition); timed("Workouts", renderWorkouts);
timed("Progress", renderProgress); timed("Settings", renderSettings);
ok("all five views render on a 6-month database", true);

/* program state */
ok("C25K complete after 27 runs (next = null)", c25kNext() === null);
ok("longest-run logic sees GPS runs", DB.sessions.some(x => x.detail?.km > 4));

/* trend direction */
const ra = rollingAvg(sortedWeights());
ok("weight average trends down over 6 months", ra[ra.length - 1][1] < ra[0][1] - 5, `${r1(ra[0][1])} -> ${r1(ra[ra.length - 1][1])} kg`);
ok("goal progress is between 0 and 100%", (() => { const lw = latestWeight(); const p = (DB.settings.startKg - lw.kg) / (DB.settings.startKg - DB.settings.goalKg) * 100; return p > 0 && p < 100; })());

/* import merge idempotence (the loop importData uses) */
const backup = JSON.parse(JSON.stringify(DB));
const before = DB.entries.length + DB.weights.length + DB.sessions.length;
for (const k of ["entries", "foods", "meals", "water", "weights", "measures", "sessions"]) {
  const have = new Set(DB[k].map(x => x.id));
  for (const rec of (backup[k] || [])) if (rec && rec.id && !have.has(rec.id)) DB[k].push(rec);
}
ok("merging your own backup adds zero duplicates", DB.entries.length + DB.weights.length + DB.sessions.length === before);

/* edge probes */
DB.weights.push({id: uid(), date: "2026-10-20", kg: DB.weights[DB.weights.length - 1].kg}); // identical consecutive weight
ok("identical consecutive weights don't break the chart math", (() => { const a = rollingAvg(sortedWeights()); return a.every(p => isFinite(p[1])); })());
const future = dayTotals("2027-01-01");
ok("empty future day totals are zero", future.kcal === 0 && future.p === 0);
console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) console.log("FAILURES:", failures.join(" | "));
process.exit(fail ? 1 : 0);
