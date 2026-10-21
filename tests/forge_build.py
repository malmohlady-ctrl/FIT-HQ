#!/usr/bin/env python3
"""FIT HQ -> The Forge transformation. Every replacement is asserted."""
import pathlib, re, sys

APP = pathlib.Path.home() / "workspace/your_files/fithq-app"
GAL = pathlib.Path.home() / "workspace/your_files/fithq-design/finalset.html"

def rep(s, old, new, n=1, label=""):
    assert old in s, f"MISSING [{label}]: {old[:80]!r}"
    return s.replace(old, new, n)

# ---------- pull icon symbols + gradients out of the approved gallery ----------
gal = GAL.read_text()
def symbol(sid):
    m = re.search(rf'<symbol id="{sid}" viewBox="0 0 100 100">(.*?)</symbol>', gal, re.S)
    assert m, sid
    return m.group(1).strip()
ICONS = {
    "workouts": symbol("w2f"), "nutrition": symbol("n4f"), "progress": symbol("p2"),
    "plan": symbol("l2"), "body": symbol("b3"), "settings": symbol("s3f"),
}
grads = ""
for gid in ["gGold", "gFire", "gGlow"]:
    m = re.search(rf'<(linearGradient|radialGradient) id="{gid}".*?</\1>', gal, re.S)
    assert m, gid
    grads += m.group(0) + "\n"

icons_js = "const ICONS = {\n" + ",\n".join(
    f'  {k}: `<svg viewBox="0 0 100 100">{v}</svg>`' for k, v in ICONS.items()) + "\n};\n"

# ================= INDEX.HTML =================
p = APP / "index.html"; s = p.read_text()

s = rep(s, '<meta name="theme-color" content="#141519">', '<meta name="theme-color" content="#141b2e">', label="theme-color")
s = rep(s, "<title>FIT HQ</title>", "<title>The Forge</title>", label="title")

s = rep(s, """:root{
  --bg:#141519; --bg2:#1a1b20; --card:#1f2127; --card2:#26282f; --line:#2e3038;
  --ink:#f2f1ec; --mut:#9a9ba4; --dim:#6d6e77;
  --org:#ff7a1a; --org2:#ffa25e; --grn:#43c47c; --grn2:#7ed6a5;
  --blu:#5aa2e0; --red:#e05a5a; --gold:#e8a33d;
  --r:16px; --nav:64px;
}""", """:root{
  --bg:#141b2e; --bg2:#10182b; --card:#1c2742; --card2:#243154; --line:#2c3a5e;
  --ink:#f5eeda; --mut:#a8b4d4; --dim:#7787ab;
  --org:#d4a72c; --org2:#f6d47a; --grn:#43c47c; --grn2:#7ed6a5;
  --blu:#5aa2e0; --red:#e05a5a; --gold:#d4a72c;
  --serif:Georgia,"Times New Roman",serif;
  --r:16px; --nav:0px;
}""", label="vars")

s = rep(s, "padding-bottom:calc(var(--nav) + env(safe-area-inset-bottom));min-height:100vh}",
           "padding-bottom:26px;min-height:100vh}", label="body pad")
s = rep(s, "bottom:calc(var(--nav) + 18px)", "bottom:20px", label="toast pos")
s = rep(s, ".btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:var(--org);color:#16100a;",
           ".btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:var(--org);color:#161203;", label="btn ink")
s = rep(s, ".chip.on{background:var(--org);color:#16100a;border-color:var(--org)}",
           ".chip.on{background:var(--org);color:#161203;border-color:var(--org)}", label="chip ink")
s = rep(s, "h1{font-size:1.45rem;font-weight:800;letter-spacing:-.01em}",
           "h1{font-size:1.5rem;font-weight:400;font-family:var(--serif);letter-spacing:.05em}", label="h1 serif")
s = rep(s, ".kcal-num{font-size:2rem;font-weight:800;line-height:1}",
           ".kcal-num{font-size:2rem;font-weight:400;font-family:var(--serif);line-height:1}", label="kcal serif")
s = rep(s, ".stat .v{font-size:1.25rem;font-weight:800}",
           ".stat .v{font-size:1.3rem;font-weight:400;font-family:var(--serif)}", label="stat serif")

# drop bottom-nav CSS block, add hub CSS
nav_css_start = s.index("nav.bottom{")
nav_css_end = s.index(".view{display:none}")
s = s[:nav_css_start] + s[nav_css_end:]
hub_css = """.view{display:none}.view.on{display:block;animation:zoomin .34s cubic-bezier(.2,.9,.25,1.1);transform-origin:var(--zox,50%) var(--zoy,50%)}
.view.on.hubview{animation:fadein .3s ease}
@keyframes zoomin{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:scale(1)}}
@keyframes fadein{from{opacity:0}to{opacity:1}}
.brandrow{display:flex;align-items:center;gap:10px}
.brandmark{width:38px;height:38px;border-radius:10px;flex:none}
.brandname{font-family:var(--serif);letter-spacing:.15em;font-size:1.02rem}
.brandname b{color:var(--org);font-weight:400}
.hubback{margin-left:auto;background:var(--card);border:1px solid var(--line);color:var(--org);
  border-radius:999px;padding:8px 14px;font-weight:800;font-size:.8rem}
.hub{position:relative;width:min(94vw,432px);aspect-ratio:1/1;margin:2px auto 0}
.hub .hexsvg{position:absolute;inset:0;width:100%;height:100%}
.node{position:absolute;transform:translate(-50%,-50%);width:88px;text-align:center;z-index:2;background:none;border:none;cursor:pointer;font:inherit}
.node .bub{width:60px;height:60px;margin:0 auto;border-radius:50%;overflow:hidden;border:2px solid var(--org);
  background:var(--card);box-shadow:0 0 0 4px var(--bg),0 0 18px rgba(212,167,44,.35);display:block;transition:transform .12s}
.node:active .bub{transform:scale(.92)}
.node .nl{display:block;margin-top:5px;font-size:.6rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--ink);text-shadow:0 1px 4px rgba(0,0,0,.6)}
.hubcenter{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:178px;height:178px;z-index:2;cursor:pointer}
.hubcenter .ctext{position:absolute;left:0;right:0;bottom:16px;text-align:center;padding:0 14px}
.hubcenter .cnum{font-family:var(--serif);font-size:1.62rem;line-height:1;color:#ffe9a3}
.hubcenter .ccap{font-size:.55rem;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:var(--mut);margin-top:4px;line-height:1.5}
.weekgrid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.daycell{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:8px 4px;text-align:center;min-height:86px}
.daycell.today{border-color:var(--org);box-shadow:0 0 0 1px var(--org)}
.daycell .dl{font-size:.58rem;font-weight:800;letter-spacing:.08em;color:var(--mut);text-transform:uppercase}
.daycell .dn{font-family:var(--serif);font-size:1.05rem;margin:2px 0}
.daycell .di{font-size:.86rem;line-height:1.5}
.daycell .dk{font-size:.58rem;color:var(--mut);line-height:1.35}
.daycell .dk b{color:var(--org2);font-size:.66rem}
.daycell.future{opacity:.75}
"""
s = rep(s, ".view{display:none}.view.on{display:block}", hub_css.strip(), label="hub css")

# header + views + remove nav + svg defs
s = rep(s, '<header class="top"><div class="date" id="topDate"></div><h1 id="topTitle">FIT HQ</h1></header>',
"""<header class="top"><div class="brandrow"><img class="brandmark" src="icon-192.png" alt="">
<div><div class="brandname">THE <b>FORGE</b></div><div class="date" id="topDate"></div></div>
<button class="hubback" id="hubBack" style="display:none">‹ Hub</button></div>
<h1 id="topTitle" style="display:none;margin-top:10px"></h1></header>""", label="header")

s = rep(s, '  <section class="view" id="view-progress"></section>',
"""  <section class="view" id="view-progress"></section>
  <section class="view" id="view-plan"></section>
  <section class="view" id="view-body"></section>""", label="new views")

nav_start = s.index('<nav class="bottom" id="bottomnav">')
nav_end = s.index('</nav>', nav_start) + len('</nav>')
s = s[:nav_start] + s[nav_end:]

defs = ('<svg width="0" height="0" style="position:absolute"><defs>\n' + grads + '</defs></svg>\n')
s = rep(s, '<div class="modal" id="modal">', defs + '<div class="modal" id="modal">', label="svg defs")
p.write_text(s)
print("index.html done")

# ================= APP.JS =================
p = APP / "app.js"; s = p.read_text()

s = rep(s, 'activity: 1.55, goalType: "lose", weekStart: 1,',
           'activity: 1.55, goalType: "lose", weekStart: 1, centerStat: "kcal",', label="centerStat default")

# plannedFor generalization
s = rep(s, """function plannedToday() {
  const dow = parseKey(todayKey()).getDay(); // 0 Sun
  if ([1, 3, 5].includes(dow)) return {type: "dumbbell", label: "Dumbbell circuit + boxing"};
  if ([2, 4, 6].includes(dow)) return {type: "yoga", label: "Yoga — recovery"};
  return {type: "run", label: "Rest day — or a Couch to 5K run"};
}""", """function plannedFor(k) {
  const dow = parseKey(k).getDay(); // 0 Sun
  if ([1, 3, 5].includes(dow)) return {type: "dumbbell", label: "Dumbbell circuit + boxing", short: "Strength"};
  if ([2, 4, 6].includes(dow)) return {type: "yoga", label: "Yoga — recovery", short: "Yoga"};
  return {type: "run", label: "Rest day — or a Couch to 5K run", short: "Rest"};
}
function plannedToday() { return plannedFor(todayKey()); }""", label="plannedFor")

# ---- new router ----
rstart = s.index('let curView = "home";')
rend = s.index('$$("#bottomnav button").forEach(b => b.onclick = () => show(b.dataset.nav));') + len('$$("#bottomnav button").forEach(b => b.onclick = () => show(b.dataset.nav));')
new_router = """let curView = "home";
let zoomOrigin = null;
function show(view, origin) {
  curView = view;
  $$(".view").forEach(v => v.classList.remove("on", "hubview"));
  const el = $("#view-" + view);
  if (origin) { el.style.setProperty("--zox", origin.x + "%"); el.style.setProperty("--zoy", origin.y + "%"); }
  el.classList.add("on");
  if (view === "home") el.classList.add("hubview");
  const titles = {home: "", nutrition: "Nutrition", workouts: "Workouts", progress: "Progress", plan: "Plan", body: "Body", settings: "Settings"};
  const tt = $("#topTitle");
  tt.textContent = titles[view] || "";
  tt.style.display = view === "home" ? "none" : "block";
  $("#hubBack").style.display = view === "home" ? "none" : "block";
  ({home: renderHome, nutrition: window.renderNutrition, workouts: window.renderWorkouts,
    progress: window.renderProgress, plan: renderPlan, body: renderBody, settings: renderSettings}[view] || renderHome)();
  window.scrollTo(0, 0);
}
function hubGo(view, ev) {
  let origin = null;
  const t = ev && ev.currentTarget;
  if (t) {
    const r = t.getBoundingClientRect();
    origin = {x: Math.round((r.left + r.width / 2) / window.innerWidth * 100),
              y: Math.round((r.top + r.height / 2) / window.innerHeight * 100)};
  }
  show(view, origin);
}
$("#hubBack").onclick = () => show("home");
let _tsy = null;
document.addEventListener("touchstart", e => { _tsy = e.touches[0].clientY; }, {passive: true});
document.addEventListener("touchend", e => {
  if (_tsy === null || curView === "home") { _tsy = null; return; }
  if (e.changedTouches[0].clientY - _tsy > 80 && window.scrollY < 40) show("home");
  _tsy = null;
}, {passive: true});"""
s = s[:rstart] + new_router + s[rend:]

# ---- new renderHome (the hub) + BODY + PLAN (inserted by replacing old renderHome) ----
hstart = s.index("function renderHome() {")
hend = s.index("function addWater")
hub_code = '''const ICONS_PLACEHOLDER
function streakDays() {
  let n = 0; let k = todayKey();
  if (!dayEntries(k).length) k = addDays(k, -1);
  while (dayEntries(k).length) { n++; k = addDays(k, -1); }
  return n;
}
function centerData() {
  const s = S(), tg = s.targets, t = todayKey();
  const tot = dayTotals(t), rem = tg.kcal - tot.kcal;
  const mode = s.centerStat || "kcal";
  if (mode === "weight") {
    const lw = latestWeight();
    const pct = (lw && s.startKg !== s.goalKg) ? Math.max(0, Math.min(1, (s.startKg - lw.kg) / (s.startKg - s.goalKg))) : 0;
    return {mode, hero: lw ? dispW(lw.kg) : "—", cap: lw ? `goal ${dispW(s.goalKg)} · ${r0(pct * 100)}% of the way` : "log a weight to start",
      pct, glow: 0.5, tap: "body"};
  }
  if (mode === "next") {
    const nx = (typeof c25kNext === "function") ? c25kNext() : null;
    const wk = weekDates();
    const done = DB.sessions.filter(x => wk.includes(x.date)).length;
    return {mode, hero: nx ? `W${nx.w + 1} · Run ${nx.r + 1}` : "5K done 🏆",
      cap: nx ? "next Couch to 5K run" : "program complete", pct: Math.min(1, done / 5), glow: 0.6, tap: "workouts"};
  }
  const pct = tg.kcal ? Math.min(1, Math.max(0, tot.kcal / tg.kcal)) : 0;
  const doneToday = DB.sessions.filter(x => x.date === t);
  const plan = plannedToday();
  const hr = new Date().getHours();
  let cap;
  if (doneToday.length) cap = `training done ✓ · ${streakDays()} day streak`;
  else if (hr >= 20) cap = `${streakDays()} day streak · day closes at midnight`;
  else cap = `${plan.label} today`;
  return {mode, hero: r0(Math.abs(rem)).toLocaleString(), cap: (rem < 0 ? "kcal over target" : "kcal left") + " · " + cap,
    pct, glow: Math.max(0.15, 0.9 - pct * 0.65), tap: "nutrition",
    sub: `${r0(tot.kcal)} of ${tg.kcal} eaten · P ${r0(tot.p)}/${tg.p}g`};
}
function centerTap() { show(centerData().tap); }
function renderHome() {
  const cd = centerData();
  const firstRun = !DB.entries.length && !DB.weights.length && !DB.sessions.length;
  const circ = 2 * Math.PI * 80;
  const nodes = [
    ["workouts", "Workouts", "50%", "4%"], ["nutrition", "Nutrition", "91%", "27%"],
    ["progress", "Progress", "91%", "73%"], ["plan", "Plan", "50%", "96%"],
    ["body", "Body", "9%", "73%"], ["settings", "Settings", "9%", "27%"]
  ];
  $("#view-home").innerHTML = `
  ${firstRun ? `<div class="card" style="border-color:var(--org)">
    <h3>👋 Welcome to The Forge</h3>
    <p class="small muted" style="margin:6px 0 10px">Everything is stored privately on this device. Your profile starts with the details already on file — check them in Settings, then tap a point on the forge to begin.</p>
    <button class="btn block" onclick="show('settings')">Review my setup</button></div>` : ""}
  <div class="hub">
    <svg class="hexsvg" viewBox="0 0 100 100">
      <polygon points="50,2 91.6,26 91.6,74 50,98 8.4,74 8.4,26" fill="none" stroke="#d4a72c" stroke-width="1.1"/>
      <polygon points="50,7.5 86.8,28.7 86.8,71.3 50,92.5 13.2,71.3 13.2,28.7" fill="none" stroke="#d4a72c" stroke-width=".55" opacity=".5"/>
      <g fill="#f6d47a"><circle cx="50" cy="2" r="1.5"/><circle cx="91.6" cy="26" r="1.5"/><circle cx="91.6" cy="74" r="1.5"/><circle cx="50" cy="98" r="1.5"/><circle cx="8.4" cy="74" r="1.5"/><circle cx="8.4" cy="26" r="1.5"/></g>
    </svg>
    ${nodes.map(([v, label, x, y]) => `<button class="node" style="left:${x};top:${y}" onclick="hubGo('${v}',event)"><span class="bub">${ICONS[v]}</span><span class="nl">${label}</span></button>`).join("")}
    <div class="hubcenter" onclick="centerTap()" role="button" aria-label="Centre stat">
      <svg viewBox="0 0 178 178" style="width:100%;height:100%">
        <circle cx="89" cy="89" r="80" stroke="#2c3a5e" stroke-width="4.5" fill="rgba(16,24,43,.72)"/>
        <circle cx="89" cy="89" r="80" stroke="#d4a72c" stroke-width="4.5" fill="none" stroke-linecap="round"
          stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - cd.pct)}" transform="rotate(-90 89 89)"/>
        <circle cx="89" cy="76" r="46" fill="url(#gGlow)" opacity="${cd.glow}"/>
        <g>
          <path d="M89 42 c8.6 14.4 20 22.2 20 37.4 a20 20 0 1 1 -40 0 C69 64.2 80.4 56.4 89 42z" fill="#43331a"/>
          <clipPath id="flameClip"><rect x="59" y="${(99.4 - 57.4 * cd.pct).toFixed(1)}" width="60" height="${(57.4 * cd.pct).toFixed(1)}"/></clipPath>
          <g clip-path="url(#flameClip)"><path d="M89 42 c8.6 14.4 20 22.2 20 37.4 a20 20 0 1 1 -40 0 C69 64.2 80.4 56.4 89 42z" fill="url(#gFire)"/></g>
          <path d="M89 68 c4.2 6.8 9.4 10.4 9.4 17.6 a9.4 9.4 0 1 1 -18.8 0 C79.6 78.4 84.8 74.8 89 68z" fill="#fff3c4" opacity=".92"/>
        </g>
      </svg>
      <div class="ctext"><div class="cnum">${esc(cd.hero)}</div><div class="ccap">${esc(cd.cap)}</div></div>
    </div>
  </div>
  <p class="small muted" style="text-align:center;margin-top:10px">${cd.mode === "kcal" ? esc(cd.sub || "") : "Tap the centre to open · tap a point to enter"}</p>`;
}

/* ---------- PLAN (week at a glance) ---------- */
const TYPE_ICON = {run: "🏃", dumbbell: "🏋️", boxing: "🥊", core: "🔥", yoga: "🧘"};
function renderPlan() {
  const wk = weekDates(), t = todayKey();
  const nx = (typeof c25kNext === "function") ? c25kNext() : null;
  const wkSessions = DB.sessions.filter(x => wk.includes(x.date));
  const wkFood = wk.filter(d => dayEntries(d).length);
  const avgK = wkFood.length ? wkFood.reduce((a, d) => a + dayTotals(d).kcal, 0) / wkFood.length : 0;
  const cells = wk.map(d => {
    const isT = d === t, future = d > t;
    const sess = DB.sessions.filter(x => x.date === d);
    const tot = dayTotals(d);
    const icons = sess.map(x => TYPE_ICON[x.type] || "🏋️").join(" ");
    const plan = plannedFor(d);
    return `<div class="daycell ${isT ? "today" : ""} ${future ? "future" : ""}">
      <div class="dl">${parseKey(d).toLocaleDateString(undefined, {weekday: "short"})}</div>
      <div class="dn">${parseKey(d).getDate()}</div>
      ${future ? `<div class="dk">${plan.short}</div>`
        : `<div class="di">${icons || "·"}</div><div class="dk">${dayEntries(d).length ? `<b>${r0(tot.kcal)}</b> kcal` : "no food"}</div>`}
    </div>`;
  }).join("");
  $("#view-plan").innerHTML = `
  <div class="card tight"><div class="row between"><h3>Week at a glance</h3><span class="small muted">${fmtDay(wk[0])} – ${fmtDay(wk[6])}</span></div>
    <div class="weekgrid" style="margin-top:10px">${cells}</div>
    <p class="small muted" style="margin-top:10px">Future days show your training rhythm — Mon/Wed/Fri strength, Tue/Thu/Sat yoga, Sunday rest.</p>
  </div>
  <div class="card"><h3>Up next</h3>
    ${nx ? `<div class="item"><div class="grow"><div class="t">🏃 Couch to 5K — Week ${nx.w + 1}, Run ${nx.r + 1}</div><div class="s">Your next scheduled run</div></div></div>`
         : `<div class="item"><div class="grow"><div class="t">🏆 Couch to 5K complete</div><div class="s">All 27 runs done — time to pick the next mountain</div></div></div>`}
    <div class="item"><div class="grow"><div class="t">${esc(plannedToday().label)}</div><div class="s">Today's rhythm</div></div></div>
    <button class="btn block" style="margin-top:10px" onclick="show('workouts')">Open Workouts</button>
  </div>
  <div class="grid2">
    <div class="card tight"><div class="stat"><div class="v">${wkSessions.length}</div><div class="k">Workouts this week</div></div></div>
    <div class="card tight"><div class="stat"><div class="v">${wkFood.length ? r0(avgK) : "—"}</div><div class="k">Avg kcal / logged day</div></div></div>
  </div>`;
}

/* ---------- BODY (water · weight · measurements) ---------- */
function renderBody() {
  const t = todayKey(), tg = S().targets;
  const wml = waterFor(t), lw = latestWeight();
  const sw = sortedWeights();
  const trend = sw.length > 1 ? `${dispW(sw[0].kg)} → ${dispW(sw[sw.length - 1].kg)} across ${sw.length} weigh-ins` : "Log a weight to start your trend";
  const byType = {};
  for (const m of DB.measures) if (!byType[m.type] || byType[m.type].date < m.date) byType[m.type] = m;
  const latest = Object.values(byType).sort((a, b) => a.type < b.type ? -1 : 1);
  $("#view-body").innerHTML = `
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
    <div class="row between"><h3>⚖️ Weight</h3><span class="small muted">goal ${dispW(S().goalKg)}</span></div>
    <div class="stat" style="margin:8px 0"><div class="v" style="font-size:1.9rem">${lw ? dispW(lw.kg) : "—"}</div><div class="k">Current</div></div>
    <p class="small muted" style="text-align:center">${esc(trend)}</p>
    <button class="btn block" style="margin-top:10px" onclick="quickWeight()">Log weight</button>
    <button class="btn ghost block" style="margin-top:8px" onclick="show('progress')">Weight history & chart</button>
  </div>
  <div class="card">
    <div class="row between"><h3>📏 Measurements</h3><span class="small muted">${DB.measures.length} logged</span></div>
    ${latest.length ? `<div class="list">${latest.map(m => `<div class="item"><div class="grow"><div class="t">${esc(m.type)}</div><div class="s">${fmtDay(m.date)}</div></div><span class="kc">${m.cm} cm</span></div>`).join("")}</div>`
      : `<p class="small muted" style="margin:8px 0">No measurements yet — waist is a great first one; it moves even when the scale stalls.</p>`}
    <button class="btn block" style="margin-top:8px" onclick="addMeasure()">Add measurement</button>
  </div>`;
}

'''
s = s[:hstart] + hub_code + s[hend:]
s = rep(s, "const ICONS_PLACEHOLDER", icons_js.rstrip(), label="icons js")

# addWater / quickWeight refresh body too
s = rep(s, 'if (curView === "home") renderHome(); if (curView === "nutrition" && window.renderNutrition) renderNutrition();',
           'if (curView === "home") renderHome(); if (curView === "body") renderBody(); if (curView === "nutrition" && window.renderNutrition) renderNutrition();', label="addWater refresh")
s = rep(s, 'if (curView === "home") renderHome(); if (curView === "progress" && window.renderProgress) renderProgress();',
           'if (curView === "home") renderHome(); if (curView === "body") renderBody(); if (curView === "progress" && window.renderProgress) renderProgress();', label="quickWeight refresh")

# Settings: centre card + wiring + renames
s = rep(s, '  <div class="card"><h3>Your data</h3>',
'''  <div class="card"><h3>Hub centre</h3>
    <p class="small muted">What the flame at the heart of the hub shows. The flame fills as the day's calories are eaten, and its glow dims as you near your target.</p>
    <div class="seg" style="margin-top:10px">
      <button class="${(s.centerStat || "kcal") === "kcal" ? "on" : ""}" onclick="setCenterStat('kcal')">Calories left</button>
      <button class="${s.centerStat === "weight" ? "on" : ""}" onclick="setCenterStat('weight')">Weight</button>
      <button class="${s.centerStat === "next" ? "on" : ""}" onclick="setCenterStat('next')">Next workout</button>
    </div>
  </div>
  <div class="card"><h3>Your data</h3>''', label="centre card")
s = rep(s, "/* ---------- SETTINGS ---------- */",
"""/* ---------- SETTINGS ---------- */
function setCenterStat(v) { S().centerStat = v; saveDB(); renderSettings(); toast("Centre updated"); }""", label="setCenterStat")
s = rep(s, "<h3>👋 Welcome to FIT HQ</h3>", "<h3>👋 Welcome to The Forge</h3>", n=0, label="welcome") if "Welcome to FIT HQ" in s else s
s = s.replace("Welcome to FIT HQ", "Welcome to The Forge")
s = rep(s, "FIT HQ v1 · Free forever", "The Forge · Free forever", label="about")
s = rep(s, 'confirmSheet("Reset FIT HQ?"', 'confirmSheet("Reset The Forge?"', label="reset title")
s = rep(s, "That doesn't look like a FIT HQ backup", "That doesn't look like a Forge backup", label="import msg")
s = rep(s, '"fithq-backup-" + todayKey()', '"theforge-backup-" + todayKey()', label="backup name")
p.write_text(s)
print("app.js done")

# ================= PROGRESS.JS: refresh Body after measure changes =================
p = APP / "progress.js"; s = p.read_text()
s = rep(s, 'saveDB(); closeSheet(); renderProgress(); toast("Measurement saved");',
           'saveDB(); closeSheet(); renderProgress(); if (curView === "body" && window.renderBody) renderBody(); toast("Measurement saved");', label="measure save")
s = rep(s, "function delMeasure(id) { DB.measures = DB.measures.filter(x => x.id !== id); saveDB(); renderProgress(); }",
           "function delMeasure(id) { DB.measures = DB.measures.filter(x => x.id !== id); saveDB(); renderProgress(); if (curView === \"body\" && window.renderBody) renderBody(); }", label="measure del")
p.write_text(s)
print("progress.js done")

# ================= SW.JS =================
p = APP / "sw.js"; s = p.read_text()
s = rep(s, 'const CACHE = "fithq-v2";', 'const CACHE = "forge-v1";', label="sw cache")
s = rep(s, 'keys.filter(k => k.startsWith("fithq-") && k !== CACHE)',
           'keys.filter(k => (k.startsWith("fithq-") || k.startsWith("forge-")) && k !== CACHE)', label="sw cleanup")
s = s.replace("/* FIT HQ service worker", "/* The Forge service worker")
p.write_text(s)
print("sw.js done")

# ================= MANIFEST =================
p = APP / "manifest.json"
p.write_text('{"background_color":"#141b2e","description":"The Forge — personal fitness & nutrition hub","display":"standalone","icons":[{"sizes":"192x192","src":"icon-192.png","type":"image/png"},{"sizes":"512x512","src":"icon-512.png","type":"image/png"},{"purpose":"maskable","sizes":"512x512","src":"icon-maskable-512.png","type":"image/png"}],"name":"The Forge","scope":"./","short_name":"The Forge","start_url":"./","theme_color":"#141b2e"}')
print("manifest done")
print("ALL PATCHES OK")
