/* FIT HQ core: store, utils, router, Home, Settings, backup.
   Local-first: all data lives in localStorage under a versioned key.
   Nothing is sent anywhere. */
"use strict";
const DB_KEY = "fithq.db.v1";
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad2 = n => String(n).padStart(2, "0");
const dateKey = (d = new Date()) => d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
const parseKey = k => { const [y, m, dd] = k.split("-").map(Number); return new Date(y, m - 1, dd); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); };
const todayKey = () => dateKey();
const fmtDay = k => parseKey(k).toLocaleDateString(undefined, {weekday: "short", month: "short", day: "numeric"});
const r0 = n => Math.round(n || 0);
const r1 = n => Math.round((n || 0) * 10) / 10;
const KG_PER_LB = 0.45359237;
const lbToKg = lb => lb * KG_PER_LB;
const kgToLb = kg => kg / KG_PER_LB;

function defaultDB() {
  return {
    v: 1,
    settings: {
      name: "", age: 31, sex: "male", heightCm: 178,
      startKg: lbToKg(235), goalKg: lbToKg(200), units: "lb",
      activity: 1.55, goalType: "lose", weekStart: 1,
      targets: {kcal: 2000, p: 150, c: 200, f: 67, waterMl: 2500},
      targetsCustom: false, exerciseBack: false
    },
    entries: [],   // food diary entries (nutrition snapshot per entry)
    foods: [],     // custom food library
    meals: [],     // saved meals & recipes
    water: [],     // {id,date,ml}
    weights: [],   // {id,date,kg}
    measures: [],  // {id,date,type,cm}
    sessions: []   // workout sessions {id,date,type,title,mins,detail}
  };
}
let DB;
function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) { DB = defaultDB(); saveDB(); return; }
    const d = JSON.parse(raw);
    if (!d || typeof d !== "object" || !d.settings) throw new Error("bad db");
    const def = defaultDB();
    DB = Object.assign(def, d);
    DB.settings = Object.assign(def.settings, d.settings || {});
    DB.settings.targets = Object.assign(def.settings.targets, (d.settings || {}).targets || {});
    for (const k of ["entries","foods","meals","water","weights","measures","sessions"])
      if (!Array.isArray(DB[k])) DB[k] = [];
  } catch (e) { DB = defaultDB(); }
}
function saveDB() { try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch (e) {} }
const S = () => DB.settings;
const dispW = kg => S().units === "lb" ? r1(kgToLb(kg)) + " lb" : r1(kg) + " kg";
const inputW = v => S().units === "lb" ? lbToKg(Number(v) || 0) : (Number(v) || 0);

/* ---------- nutrition math (shared) ---------- */
const NUT_KEYS = ["kcal","p","c","f","fiber","sugar","satfat","sodium"];
function zeroNut() { const o = {}; NUT_KEYS.forEach(k => o[k] = 0); return o; }
function scaleNut(per, qty) { const o = {}; NUT_KEYS.forEach(k => o[k] = (Number(per?.[k]) || 0) * (Number(qty) || 0)); return o; }
function addNut(a, b) { const o = {}; NUT_KEYS.forEach(k => o[k] = (a[k] || 0) + (b[k] || 0)); return o; }
function dayEntries(date) { return DB.entries.filter(e => e.date === date); }
function dayTotals(date) {
  let t = zeroNut();
  for (const e of dayEntries(date)) t = addNut(t, scaleNut(e.per, e.qty));
  return t;
}
function waterFor(date) { return DB.water.filter(w => w.date === date).reduce((a, w) => a + (w.ml || 0), 0); }
function latestWeight() {
  if (!DB.weights.length) return null;
  return DB.weights.slice().sort((a, b) => a.date < b.date ? -1 : 1).slice(-1)[0];
}
function sortedWeights() { return DB.weights.slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0); }

/* ---------- target calculator (Mifflin-St Jeor) ---------- */
function calcTargets(s) {
  const kg = latestWeight()?.kg ?? s.startKg;
  let bmr = 10 * kg + 6.25 * s.heightCm - 5 * s.age + (s.sex === "female" ? -161 : 5);
  const tdee = bmr * (Number(s.activity) || 1.55);
  let kcal = tdee;
  if (s.goalType === "lose") kcal = tdee - 500;
  if (s.goalType === "gain") kcal = tdee + 300;
  const floor = s.sex === "female" ? 1200 : 1500;
  kcal = Math.max(floor, Math.round(kcal / 10) * 10);
  const p = Math.round(kg * 2.0);                    // 2.0 g/kg — supports muscle retention
  const f = Math.round(kcal * 0.30 / 9);
  const c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
  return {kcal, p, c, f, waterMl: s.targets.waterMl || 2500, bmr: Math.round(bmr), tdee: Math.round(tdee)};
}

/* ---------- UI helpers ---------- */
let toastTimer = null;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("on");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 2400);
}
function openSheet(html) { $("#sheet").innerHTML = html; $("#modal").classList.add("on"); }
function closeSheet() { $("#modal").classList.remove("on"); if (window._scanStop) { window._scanStop(); window._scanStop = null; } }
$("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeSheet(); });
function confirmSheet(title, body, okLabel, onOk) {
  openSheet(`<h3>${esc(title)}</h3><p class="small muted" style="margin:6px 0 14px">${esc(body)}</p>
    <div class="row"><button class="btn ghost grow" onclick="closeSheet()">Cancel</button>
    <button class="btn danger grow" id="cfOk">${esc(okLabel)}</button></div>`);
  $("#cfOk").onclick = () => { closeSheet(); onOk(); };
}
function bar(pct, cls = "") {
  return `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
}
function greet() { const h = new Date().getHours(); return h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; }

/* ---------- router ---------- */
let curView = "home";
function show(view) {
  curView = view;
  $$(".view").forEach(v => v.classList.remove("on"));
  $("#view-" + view).classList.add("on");
  $$("#bottomnav button").forEach(b => b.classList.toggle("on", b.dataset.nav === view));
  const titles = {home: "FIT HQ", nutrition: "Nutrition", workouts: "Workouts", progress: "Progress", settings: "Settings"};
  $("#topTitle").textContent = view === "home" ? "FIT HQ" : titles[view];
  ({home: renderHome, nutrition: window.renderNutrition, workouts: window.renderWorkouts,
    progress: window.renderProgress, settings: renderSettings}[view] || renderHome)();
  window.scrollTo(0, 0);
}
$$("#bottomnav button").forEach(b => b.onclick = () => show(b.dataset.nav));

/* ---------- HOME ---------- */
function weekDates() {
  const t = todayKey(); const dow = parseKey(t).getDay();
  const startOffset = (dow - S().weekStart + 7) % 7;
  const start = addDays(t, -startOffset);
  return Array.from({length: 7}, (_, i) => addDays(start, i));
}
function plannedToday() {
  const dow = parseKey(todayKey()).getDay(); // 0 Sun
  if ([1, 3, 5].includes(dow)) return {type: "dumbbell", label: "Dumbbell circuit + boxing"};
  if ([2, 4, 6].includes(dow)) return {type: "yoga", label: "Yoga — recovery"};
  return {type: "run", label: "Rest day — or a Couch to 5K run"};
}
function renderHome() {
  const t = todayKey(), s = S(), tg = s.targets;
  const tot = dayTotals(t), wml = waterFor(t);
  const rem = tg.kcal - tot.kcal;
  const pct = tg.kcal ? tot.kcal / tg.kcal * 100 : 0;
  const circ = 2 * Math.PI * 56;
  const wk = weekDates();
  const wkSessions = DB.sessions.filter(x => wk.includes(x.date));
  const plan = plannedToday();
  const doneToday = DB.sessions.filter(x => x.date === t);
  const lw = latestWeight();
  const sw7 = sortedWeights().slice(-7);
  const wkWithFood = wk.filter(d => dayEntries(d).length);
  const avgK = wkWithFood.length ? wkWithFood.reduce((a, d) => a + dayTotals(d).kcal, 0) / wkWithFood.length : 0;
  const goalPct = (lw && s.startKg !== s.goalKg)
    ? Math.max(0, Math.min(100, (s.startKg - lw.kg) / (s.startKg - s.goalKg) * 100)) : 0;
  const firstRun = !DB.entries.length && !DB.weights.length && !DB.sessions.length;
  $("#view-home").innerHTML = `
  ${firstRun ? `<div class="card" style="border-color:var(--org)">
    <h3>👋 Welcome to FIT HQ</h3>
    <p class="small muted" style="margin:6px 0 10px">Everything is stored privately on this device. Your profile starts with the details already on file — check them in Settings, then log your first meal or weigh-in.</p>
    <button class="btn block" onclick="show('settings')">Review my setup</button></div>` : ""}
  <div class="card">
    <div class="row">
      <div class="ringwrap"><svg width="132" height="132">
        <circle cx="66" cy="66" r="56" stroke="#2a2c33" stroke-width="11" fill="none"/>
        <circle cx="66" cy="66" r="56" stroke="${rem < 0 ? "var(--red)" : "var(--org)"}" stroke-width="11" fill="none"
          stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - Math.min(1, pct / 100))}"
          transform="rotate(-90 66 66)"/></svg>
        <div class="ctr"><div class="kcal-num">${r0(Math.abs(rem))}</div>
        <div class="small muted">${rem < 0 ? "kcal over" : "kcal left"}</div></div></div>
      <div class="grow">
        <div class="macroline"><span>Protein</span><b>${r0(tot.p)} / ${tg.p}g</b></div>${bar(tg.p ? tot.p / tg.p * 100 : 0, "g")}
        <div class="macroline"><span>Carbs</span><b>${r0(tot.c)} / ${tg.c}g</b></div>${bar(tg.c ? tot.c / tg.c * 100 : 0, "b")}
        <div class="macroline"><span>Fat</span><b>${r0(tot.f)} / ${tg.f}g</b></div>${bar(tg.f ? tot.f / tg.f * 100 : 0, "gold")}
        <p class="small muted" style="margin-top:8px">${r0(tot.kcal)} of ${tg.kcal} kcal eaten</p>
      </div>
    </div>
    <div class="row" style="margin-top:12px">
      <button class="btn grow" onclick="show('nutrition')">＋ Add food</button>
      <button class="btn ghost grow" onclick="quickWeight()">⚖️ Log weight</button>
    </div>
  </div>
  <div class="card tight">
    <div class="row between"><h3>💧 Water</h3><span class="small muted">${wml} / ${tg.waterMl} ml</span></div>
    ${bar(tg.waterMl ? wml / tg.waterMl * 100 : 0, "b")}
    <div class="row" style="margin-top:10px">
      <button class="chip grow" style="justify-content:center" onclick="addWater(250)">+250 ml</button>
      <button class="chip grow" style="justify-content:center" onclick="addWater(500)">+500 ml</button>
      <button class="chip grow" style="justify-content:center" onclick="customWater()">Custom</button>
    </div>
  </div>
  <div class="card">
    <div class="row between"><h3>Today's training</h3><span class="small muted">${esc(plan.label)}</span></div>
    ${doneToday.length ? doneToday.map(x => `<div class="item"><div class="grow"><div class="t">✅ ${esc(x.title)}</div><div class="s">${x.mins} min</div></div></div>`).join("")
      : `<p class="small muted" style="margin:8px 0">Nothing logged yet today.</p>`}
    <button class="btn grn block" style="margin-top:8px" onclick="show('workouts')">▶ Start workout</button>
    <p class="small muted" style="margin-top:10px">This week: <b style="color:var(--ink)">${wkSessions.length} workout${wkSessions.length === 1 ? "" : "s"}</b> completed</p>
  </div>
  <div class="grid2">
    <div class="card tight"><div class="stat"><div class="v">${lw ? dispW(lw.kg) : "—"}</div><div class="k">Current weight</div></div>
      ${sw7.length > 1 ? `<p class="small muted" style="text-align:center;margin-top:4px">${dispW(sw7[0].kg)} → ${dispW(sw7[sw7.length-1].kg)} (last ${sw7.length})</p>` : `<p class="small muted" style="text-align:center;margin-top:4px">Log a weight to see your trend</p>`}</div>
    <div class="card tight"><div class="stat"><div class="v">${wkWithFood.length ? r0(avgK) : "—"}</div><div class="k">Avg kcal / day this week</div></div>
      <p class="small muted" style="text-align:center;margin-top:4px">${wkWithFood.length} day${wkWithFood.length === 1 ? "" : "s"} logged · target ${tg.kcal}</p></div>
  </div>
  ${lw ? `<div class="card tight"><div class="row between"><h3>Goal progress</h3><span class="small muted">${dispW(s.startKg)} → ${dispW(s.goalKg)}</span></div>
    ${bar(goalPct)}<p class="small muted" style="margin-top:6px">${r0(goalPct)}% of the way there. Daily weigh-ins bounce around — the trend is what counts.</p></div>` : ""}
  `;
}
function addWater(ml, date = todayKey()) {
  DB.water.push({id: uid(), date, ml}); saveDB();
  if (curView === "home") renderHome(); if (curView === "nutrition" && window.renderNutrition) renderNutrition();
  toast(`+${ml} ml water`);
}
function customWater() {
  openSheet(`<h3>Add water</h3><label>Amount (ml)</label><input id="cwMl" type="number" inputmode="numeric" min="1" placeholder="e.g. 350">
  <button class="btn block" style="margin-top:14px" id="cwGo">Add</button>`);
  $("#cwGo").onclick = () => { const v = Number($("#cwMl").value); if (v > 0) { closeSheet(); addWater(v); } };
}
function quickWeight(date = todayKey()) {
  openSheet(`<h3>Log weight</h3>
  <label>Weight (${S().units})</label><input id="qwV" type="number" inputmode="decimal" step="0.1" placeholder="${S().units === "lb" ? "e.g. 232.5" : "e.g. 105.2"}">
  <label>Date</label><input id="qwD" type="date" value="${date}">
  <button class="btn block" style="margin-top:14px" id="qwGo">Save</button>`);
  $("#qwGo").onclick = () => {
    const v = Number($("#qwV").value); if (!(v > 0)) return;
    const d = $("#qwD").value || todayKey();
    const ex = DB.weights.find(w => w.date === d);
    if (ex) ex.kg = inputW(v); else DB.weights.push({id: uid(), date: d, kg: inputW(v)});
    saveDB(); closeSheet(); toast("Weight saved");
    if (curView === "home") renderHome(); if (curView === "progress" && window.renderProgress) renderProgress();
  };
}

/* ---------- SETTINGS ---------- */
function renderSettings() {
  const s = S(), u = s.units;
  const wNow = latestWeight()?.kg ?? s.startKg;
  $("#view-settings").innerHTML = `
  <div class="card"><h3>Profile</h3>
    <label>Display name (optional)</label><input id="pfName" value="${esc(s.name)}" placeholder="Your name">
    <div class="two"><div><label>Age</label><input id="pfAge" type="number" inputmode="numeric" value="${s.age}"></div>
    <div><label>Sex (for calorie equation)</label><select id="pfSex"><option value="male" ${s.sex === "male" ? "selected" : ""}>Male</option><option value="female" ${s.sex === "female" ? "selected" : ""}>Female</option></select></div></div>
    <div class="two"><div><label>Height (cm)</label><input id="pfH" type="number" inputmode="decimal" value="${s.heightCm}"></div>
    <div><label>Units</label><select id="pfUnits"><option value="lb" ${u === "lb" ? "selected" : ""}>Pounds (lb)</option><option value="kg" ${u === "kg" ? "selected" : ""}>Kilograms (kg)</option></select></div></div>
    <div class="two"><div><label>Start weight (${u})</label><input id="pfStart" type="number" inputmode="decimal" step="0.1" value="${u === "lb" ? r1(kgToLb(s.startKg)) : r1(s.startKg)}"></div>
    <div><label>Goal weight (${u})</label><input id="pfGoal" type="number" inputmode="decimal" step="0.1" value="${u === "lb" ? r1(kgToLb(s.goalKg)) : r1(s.goalKg)}"></div></div>
    <p class="small muted" style="margin-top:6px">Current weight: <b style="color:var(--ink)">${dispW(wNow)}</b> (from your weight log)</p>
    <label>Activity level</label><select id="pfAct">
      ${[[1.2,"Sedentary — desk job, little exercise"],[1.375,"Light — exercise 1–3 days/week"],[1.55,"Moderate — exercise 3–5 days/week"],[1.725,"Active — exercise 6–7 days/week"],[1.9,"Athlete — hard daily training"]].map(([v, l]) => `<option value="${v}" ${Number(s.activity) === v ? "selected" : ""}>${l}</option>`).join("")}
    </select>
    <label>Goal</label><select id="pfGoalT"><option value="lose" ${s.goalType === "lose" ? "selected" : ""}>Lose weight</option><option value="maintain" ${s.goalType === "maintain" ? "selected" : ""}>Maintain</option><option value="gain" ${s.goalType === "gain" ? "selected" : ""}>Gain muscle</option></select>
    <label>Week starts on</label><select id="pfWeek"><option value="1" ${s.weekStart === 1 ? "selected" : ""}>Monday</option><option value="0" ${s.weekStart === 0 ? "selected" : ""}>Sunday</option></select>
    <button class="btn block" style="margin-top:14px" id="pfSave">Save profile</button>
  </div>
  <div class="card"><h3>Daily targets</h3>
    <div class="two"><div><label>Calories (kcal)</label><input id="tgK" type="number" inputmode="numeric" value="${s.targets.kcal}"></div>
    <div><label>Water (ml)</label><input id="tgW" type="number" inputmode="numeric" value="${s.targets.waterMl}"></div></div>
    <div class="three"><div><label>Protein (g)</label><input id="tgP" type="number" inputmode="numeric" value="${s.targets.p}"></div>
    <div><label>Carbs (g)</label><input id="tgC" type="number" inputmode="numeric" value="${s.targets.c}"></div>
    <div><label>Fat (g)</label><input id="tgF" type="number" inputmode="numeric" value="${s.targets.f}"></div></div>
    <button class="btn block" style="margin-top:12px" id="tgSave">Save targets</button>
    <button class="btn ghost block" style="margin-top:8px" id="tgCalc">Calculate for me instead</button>
    <div id="calcOut"></div>
    <p class="small muted" style="margin-top:10px">Calculated targets use the Mifflin-St Jeor equation with a moderate 500 kcal deficit for weight loss — a starting point, not medical advice. Adjust any time based on your actual trend.</p>
    <label style="margin-top:12px"><span style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="tgExBack" style="width:auto;margin-top:2px" ${s.exerciseBack ? "checked" : ""}> <span>Add exercise calories back to my food budget <span class="dim">(off by default — workout and wearable calorie estimates are often inflated, which can stall weight loss)</span></span></span></label>
  </div>
  <div class="card"><h3>Your data</h3>
    <p class="small muted">Everything lives only in this browser on this device. Export a backup regularly — clearing browser data or switching phones erases it otherwise.</p>
    <div class="row" style="margin-top:10px"><button class="btn ghost grow" id="dtExp">⬇ Export backup</button>
    <button class="btn ghost grow" id="dtImp">⬆ Import backup</button></div>
    <input type="file" id="dtFile" accept="application/json" style="display:none">
    <button class="btn danger block" style="margin-top:10px" id="dtReset">Reset everything</button>
    <p class="small muted" style="margin-top:10px">${DB.entries.length} food entries · ${DB.foods.length} custom foods · ${DB.meals.length} saved meals · ${DB.weights.length} weigh-ins · ${DB.sessions.length} workouts logged</p>
  </div>
  <div class="card"><h3>About</h3>
    <p class="small muted">FIT HQ v1 · Free forever, no account, no tracking. Food search (optional, in Nutrition) uses Open Food Facts — only the words you search are sent. Core features work fully offline.</p>
  </div>`;
  $("#pfSave").onclick = () => {
    s.name = $("#pfName").value.trim(); s.age = Number($("#pfAge").value) || s.age;
    s.sex = $("#pfSex").value; s.heightCm = Number($("#pfH").value) || s.heightCm;
    s.units = $("#pfUnits").value; s.startKg = inputW($("#pfStart").value); s.goalKg = inputW($("#pfGoal").value);
    s.activity = Number($("#pfAct").value); s.goalType = $("#pfGoalT").value; s.weekStart = Number($("#pfWeek").value);
    saveDB(); toast("Profile saved"); renderSettings();
  };
  $("#tgSave").onclick = () => {
    s.targets = {kcal: Number($("#tgK").value) || 2000, p: Number($("#tgP").value) || 0,
      c: Number($("#tgC").value) || 0, f: Number($("#tgF").value) || 0, waterMl: Number($("#tgW").value) || 2500};
    s.targetsCustom = true; s.exerciseBack = $("#tgExBack").checked;
    saveDB(); toast("Targets saved");
  };
  $("#tgCalc").onclick = () => {
    const c = calcTargets(s);
    $("#calcOut").innerHTML = `<div class="okn">Estimated maintenance: <b>${c.tdee} kcal/day</b> (BMR ${c.bmr}). Suggested target: <b>${c.kcal} kcal</b> · Protein ${c.p}g · Carbs ${c.c}g · Fat ${c.f}g.
    <button class="btn sm grn" style="margin-top:8px" id="calcApply">Use these targets</button></div>`;
    $("#calcApply").onclick = () => {
      s.targets = {kcal: c.kcal, p: c.p, c: c.c, f: c.f, waterMl: c.waterMl};
      s.targetsCustom = false; saveDB(); toast("Targets updated"); renderSettings();
    };
  };
  $("#dtExp").onclick = exportData;
  $("#dtImp").onclick = () => $("#dtFile").click();
  $("#dtFile").onchange = e => importData(e.target.files[0]);
  $("#dtReset").onclick = () => confirmSheet("Reset FIT HQ?", "This deletes ALL data on this device — diary, weights, workouts, settings. Export a backup first if you might want it back.", "Delete everything", () => {
    localStorage.removeItem(DB_KEY); loadDB(); saveDB(); toast("Fresh start"); show("home");
  });
}
function exportData() {
  const blob = new Blob([JSON.stringify(DB, null, 1)], {type: "application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "fithq-backup-" + todayKey() + ".json";
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("Backup downloaded");
}
function importData(file) {
  if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    let d; try { d = JSON.parse(rd.result); } catch (e) { toast("That file isn't valid JSON"); return; }
    if (!d || typeof d !== "object" || !d.settings || ![ "entries","foods","weights"].every(k => Array.isArray(d[k]))) {
      toast("That doesn't look like a FIT HQ backup"); return;
    }
    openSheet(`<h3>Import backup</h3>
      <p class="small muted" style="margin:6px 0">Backup contains ${d.entries.length} food entries, ${d.weights.length} weigh-ins, ${(d.sessions || []).length} workouts.</p>
      <p class="small" style="margin-bottom:12px"><b>Merge</b> adds records you don't already have (matched by ID) and keeps your current data. <b>Replace</b> wipes this device's data and uses the backup.</p>
      <div class="row"><button class="btn grow" id="impMerge">Merge</button>
      <button class="btn danger grow" id="impRep">Replace all</button></div>
      <button class="btn ghost block" style="margin-top:8px" onclick="closeSheet()">Cancel</button>`);
    $("#impMerge").onclick = () => {
      for (const k of ["entries","foods","meals","water","weights","measures","sessions"]) {
        const have = new Set(DB[k].map(x => x.id));
        for (const rec of (d[k] || [])) if (rec && rec.id && !have.has(rec.id)) DB[k].push(rec);
      }
      saveDB(); closeSheet(); toast("Backup merged"); show("home");
    };
    $("#impRep").onclick = () => { DB = Object.assign(defaultDB(), d); saveDB(); closeSheet(); toast("Backup restored"); show("home"); };
  };
  rd.readAsText(file);
}

/* ---------- boot ---------- */
loadDB();
$("#topDate").textContent = new Date().toLocaleDateString(undefined, {weekday: "long", month: "long", day: "numeric"});
show("home");
