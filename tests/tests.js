let pass = 0, fail = 0;
const ok = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + "  " + name); cond ? pass++ : fail++; };
const near = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;

/* --- TEST 1: log a full day, totals must be right --- */
const D = "2026-10-19";
const add = (name, meal, per, qty) => DB.entries.push({id: uid(), date: D, meal, name, brand: "", qty, unit: "1 serving", per, source: "manual"});
add("Oats", "breakfast", {kcal: 300, p: 10, c: 54, f: 6, fiber: 8, sugar: 1, satfat: 1, sodium: 5}, 1);
add("Chicken sandwich", "lunch", {kcal: 550, p: 38, c: 45, f: 18, fiber: 4, sugar: 6, satfat: 4, sodium: 890}, 1);
add("Salmon + rice", "dinner", {kcal: 720, p: 46, c: 58, f: 28, fiber: 3, sugar: 2, satfat: 6, sodium: 420}, 1);
add("Greek yogurt", "snacks", {kcal: 100, p: 17, c: 6, f: 0, fiber: 0, sugar: 5, satfat: 0, sodium: 60}, 2); // qty 2 = key recalc check
let t = dayTotals(D);
ok("T1 total kcal = 300+550+720+200 = 1770", near(t.kcal, 1770, 0.01));
ok("T1 protein = 10+38+46+34 = 128", near(t.p, 128, 0.01));
ok("T1 carbs = 54+45+58+12 = 169", near(t.c, 169, 0.01));
ok("T1 fat = 6+18+28+0 = 52", near(t.f, 52, 0.01));
// change qty -> totals move immediately (same math path the editor uses)
DB.entries.find(e => e.name === "Greek yogurt").qty = 0.5;
t = dayTotals(D);
ok("T1 qty edit 2 -> 0.5: kcal drops to 1620", near(t.kcal, 1620, 0.01));

/* --- TEST 2: custom food + saved meal persist across 'close', snapshots frozen --- */
saveToLibrary({name: "Test Bar", brand: "TB", unit: "1 bar", per: {kcal: 210, p: 20, c: 22, f: 7, fiber: 3, sugar: 2, satfat: 3, sodium: 180}}, null);
ok("T2 custom food saved to library", DB.foods.some(f => f.name === "Test Bar"));
const barFood = DB.foods.find(f => f.name === "Test Bar");
DB.entries.push({id: uid(), date: D, meal: "snacks", name: barFood.name, brand: barFood.brand, qty: 1, unit: barFood.unit, per: Object.assign({}, barFood.per), source: "custom", foodId: barFood.id});
DB.meals.push({id: uid(), name: "Test Meal", yield: 2, items: [
  {name: "Oats", brand: "", unit: "40 g", qty: 2, per: {kcal: 300, p: 10, c: 54, f: 6, fiber: 8, sugar: 1, satfat: 1, sodium: 5}},
  {name: "Milk", brand: "", unit: "250 ml", qty: 1, per: {kcal: 120, p: 8, c: 12, f: 3, fiber: 0, sugar: 12, satfat: 2, sodium: 100}}]});
const ps = mealPerServing(DB.meals.find(m => m.name === "Test Meal"));
ok("T2 recipe per-serving kcal = (600+120)/2 = 360", near(ps.kcal, 360, 0.01));
ok("T2 recipe per-serving protein = (20+8)/2 = 14", near(ps.p, 14, 0.01));
saveDB();
// simulate closing + reopening the app: fresh parse from storage
const raw = store.get(DB_KEY); store.clear(); store.set(DB_KEY, raw); loadDB();
ok("T2 data survives reload: foods", DB.foods.some(f => f.name === "Test Bar"));
ok("T2 data survives reload: meal + entries", DB.meals.some(m => m.name === "Test Meal") && dayEntries(D).length === 5);
// edit the library food -> history must NOT change
const before = dayTotals(D).kcal;
barFood.per = {kcal: 999, p: 99, c: 99, f: 99, fiber: 0, sugar: 0, satfat: 0, sodium: 0};
DB.foods.find(f => f.name === "Test Bar").per = barFood.per; saveDB();
ok("T2 editing saved food does not rewrite diary history", near(dayTotals(D).kcal, before, 0.01));

/* --- TEST 3: multi-date weights -> chart trend + unit conversion --- */
DB.weights = [];
[["2026-09-21", 108.0], ["2026-09-28", 107.2], ["2026-10-05", 106.8], ["2026-10-12", 105.9], ["2026-10-19", 105.4]]
  .forEach(([d, kg]) => DB.weights.push({id: uid(), date: d, kg}));
const ws = sortedWeights();
ok("T3 weights sorted chronologically", ws[0].date === "2026-09-21" && ws[4].date === "2026-10-19");
const avg = rollingAvg(ws);
ok("T3 sparse weekly weigh-ins: average tracks the downward trend", avg[0][1] === 108 && avg[4][1] === 105.4 && avg[4][1] < avg[0][1]);
const daily = [["2026-10-13",106.9],["2026-10-14",106.4],["2026-10-15",106.6],["2026-10-16",105.8],["2026-10-17",106.1],["2026-10-18",105.6],["2026-10-19",105.4]].map(([d, kg]) => ({id: uid(), date: d, kg}));
const davg = rollingAvg(daily);
ok("T3 daily weigh-ins: 7-day average smooths bounce (last ~106.1, below first raw 106.9)", near(davg[6][1], 106.11, 0.05) && davg[6][1] < daily[0].kg);
ok("T3 current = last weigh-in 105.4 kg", latestWeight().kg === 105.4);
ok("T3 lb->kg->lb round trip (235 lb)", near(kgToLb(lbToKg(235)), 235, 0.01));
ok("T3 105.4 kg displays as 232.4 lb", near(kgToLb(105.4), 232.4, 0.1));

/* --- extras: targets calculator + water --- */
const ct = calcTargets(DB.settings);
ok("X1 calculator: TDEE 3126, target = TDEE-500 = 2630", ct.tdee === 3126 && ct.kcal === 2630);
const small = calcTargets({age: 45, sex: "female", heightCm: 155, startKg: 55, activity: 1.2, goalType: "lose", targets: {waterMl: 2000}});
ok("X1 calculator floor: small sedentary profile never below 1200 kcal", small.kcal >= 1200);
ok("X1 calculator protein ~2g/kg of current weight", near(ct.p, 211, 6));
DB.water.push({id: uid(), date: D, ml: 250}, {id: uid(), date: D, ml: 500});
ok("X2 water sums to 750 ml", waterFor(D) === 750);
const exportOk = (() => { try { const j = JSON.parse(JSON.stringify(DB)); return j.settings && Array.isArray(j.entries) && Array.isArray(j.weights); } catch (e) { return false; } })();
ok("X3 export JSON is valid + complete", exportOk);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
