"use strict";
/* ============================================================
   adapters.js — Forge 2.0 integration layer.
   Read-only adapters over the standalone apps' localStorage
   stores. All four apps share this origin, so their stores are
   readable here. NOTHING in this file writes to another app's
   store. Unified records are derived fresh on every render —
   no shadow copy, so nothing can drift or duplicate.
   ============================================================ */

function readStore(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
  catch (e) { return null; }
}
function fmtDayShort(k) {
  if (!k) return "—";
  try { return parseKey(k).toLocaleDateString("en-CA", {weekday: "short", month: "short", day: "numeric"}); }
  catch (e) { return k; }
}
function minsOf(e) { return e.durationSec ? Math.round(e.durationSec / 60) : (e.minutes || e.mins || 0); }

/* ---------- Couch to 5K (first5k.v1) ---------- */
/* Planned session totals (sec) per week, summed from the app’s own sessionSteps tables. */
const COUCH_PLANNED = [1800, 1860, 1500, 1890, 1860, 2160, 1800, 2100, 2400];
function couchEntryStatus(e) {
  if (e.status) return e.status;                       // patched app writes this explicitly
  const planned = COUCH_PLANNED[e.week] || 1800;       // legacy inference (Part 7)
  return (e.durationSec || 0) >= 0.85 * planned ? "completed" : "partial";
}
function couchData() {
  const st = readStore("first5k.v1");
  const entries = (st && Array.isArray(st.completed)) ? st.completed : [];
  const doneKeys = new Set(), attempts = entries.length;
  let totalKm = 0, lastDone = null, weekDone = 0;
  const wk = weekDates();
  for (const e of entries) {
    if (couchEntryStatus(e) !== "completed") continue;
    doneKeys.add(e.key);
    totalKm += e.km || 0;
    if (!lastDone || (e.timestamp || 0) > (lastDone.timestamp || 0)) lastDone = e;
    if (wk.includes(e.date)) weekDone++;
  }
  let next = null;
  outer: for (let w = 0; w < 9; w++) for (let r = 0; r < 3; r++)
    if (!doneKeys.has((w + 1) + "-" + (r + 1))) { next = {w, r}; break outer; }
  return {available: !!st, attempts, done: doneKeys.size, total: 27, pct: Math.round(doneKeys.size / 27 * 100),
    totalKm: Math.round(totalKm * 10) / 10, lastDone, next, weekDone, entries};
}

/* ---------- Home Corner (basementbelt.v1) ---------- */
const CORNER_MODULES = {dumbbell: "Dumbbell Circuit", boxing: "Championship Rounds", core: "Core Finisher"};
function cornerData() {
  const st = readStore("basementbelt.v1");
  const entries = (st && Array.isArray(st.completed)) ? st.completed : [];
  const wk = weekDates();
  const byModule = {};
  let mins = 0, weekDone = 0, last = null;
  for (const e of entries) {
    byModule[e.module] = (byModule[e.module] || 0) + 1;
    mins += minsOf(e);
    if (wk.includes(e.date)) weekDone++;
    if (!last || (e.timestamp || 0) > (last.timestamp || 0)) last = e;
  }
  return {available: !!st, total: entries.length, weekDone, mins, byModule, last, entries};
}

/* ---------- Namastay Home (namastayhome.v1) ---------- */
function yogaData() {
  const st = readStore("namastayhome.v1");
  const entries = (st && Array.isArray(st.completed)) ? st.completed : [];
  const wk = weekDates();
  const byRoutine = {};
  let mins = 0, weekDone = 0, last = null;
  for (const e of entries) {
    byRoutine[e.title || e.routine] = (byRoutine[e.title || e.routine] || 0) + 1;
    mins += minsOf(e);
    if (wk.includes(e.date)) weekDone++;
    if (!last || (e.timestamp || 0) > (last.timestamp || 0)) last = e;
  }
  return {available: !!st, total: entries.length, weekDone, mins, byRoutine, last, entries};
}

/* ---------- Unified history (Part 4) ---------- */
function unifiedHistory(limit) {
  const out = [];
  const c = couchData();
  for (const e of c.entries) out.push({id: "couch:" + e.timestamp, source: "couch", app: "Couch to 5K",
    name: `Week ${e.week + 1} · Run ${e.run + 1}`, date: e.date, ts: e.timestamp || Date.parse(e.date) || 0,
    durationSec: e.durationSec || 0, status: couchEntryStatus(e),
    meta: e.km ? `${e.km} km${e.paceSec ? " · " + Math.floor(e.paceSec / 60) + ":" + String(e.paceSec % 60).padStart(2, "0") + "/km" : ""}` : ""});
  const hc = cornerData();
  for (const e of hc.entries) out.push({id: "corner:" + e.timestamp, source: "corner", app: "Home Corner",
    name: e.name || CORNER_MODULES[e.module] || "Workout", date: e.date, ts: e.timestamp || Date.parse(e.date) || 0,
    durationSec: e.durationSec || 0, status: "completed", meta: CORNER_MODULES[e.module] || ""});
  const y = yogaData();
  for (const e of y.entries) out.push({id: "yoga:" + (e.key || e.timestamp), source: "yoga", app: "Namastay Home",
    name: e.title || "Yoga session", date: e.date, ts: e.timestamp || Date.parse(e.date) || 0,
    durationSec: e.durationSec || 0, status: "completed", meta: ""});
  for (const s of DB.sessions) out.push({id: "forge:" + s.id, source: "forge", app: "Forge player",
    name: s.title || "Workout", date: s.date, ts: Date.parse(s.date) || 0,
    durationSec: (s.mins || 0) * 60, status: "completed", meta: "built-in player"});
  out.sort((a, b) => b.ts - a.ts);
  return limit ? out.slice(0, limit) : out;
}
function weekActivity() {
  const wk = weekDates();
  const recs = unifiedHistory().filter(r => wk.includes(r.date) && r.status === "completed");
  return {count: recs.length, days: new Set(recs.map(r => r.date)).size,
    mins: recs.reduce((a, r) => a + Math.round((r.durationSec || 0) / 60), 0), recs};
}

/* ---------- Rule-based “up next” (Part 6 foundation — honest rules, no AI) ---------- */
function upNext() {
  const t = todayKey(), plan = plannedFor(t);
  const hist = unifiedHistory();
  const doneToday = src => hist.some(r => r.date === t && r.source === src && r.status === "completed");
  const c = couchData(), hc = cornerData(), y = yogaData();
  if (plan.type === "yoga" && !doneToday("yoga"))
    return {app: "Namastay Home", text: "Yoga day — " + (y.last ? "last time: " + esc(y.last.title || "a routine") : "start with Back Care Basics"), url: "../Namastay-Home/"};
  if (plan.type === "dumbbell" && !doneToday("corner") && !doneToday("forge"))
    return {app: "Home Corner", text: "Strength day — dumbbells + boxing are on the plan", url: "../Home-Corner/"};
  if (c.next && !doneToday("couch")) {
    const lastRun = c.lastDone ? (Date.parse(t) - Date.parse(c.lastDone.date)) / 864e5 : 99;
    if (lastRun >= 1) return {app: "Couch to 5K", text: `Week ${c.next.w + 1} · Run ${c.next.r + 1} is next${c.lastDone ? " — last run " + fmtDayShort(c.lastDone.date) : ""}`, url: "../Couch-to-5k/"};
  }
  if (doneToday("couch") || doneToday("corner") || doneToday("yoga") || doneToday("forge"))
    return {app: "Done for today", text: "Training's in the book. Recovery is training too.", url: null};
  return {app: "Your call", text: plan.label + " — or pick whichever app you fancy", url: null};
}

/* ---------- Shared markup ---------- */
function fbar(pct, color) {
  return `<div style="height:7px;border-radius:99px;background:#232f4d;overflow:hidden;margin-top:6px"><div style="height:100%;width:${Math.max(0, Math.min(100, pct))}%;background:${color || "var(--org)"};border-radius:99px"></div></div>`;
}
const APP_META = {
  couch: {name: "Couch to 5K", icon: "🏃", color: "#ff7a1a", url: "../Couch-to-5k/", blurb: "The 9-week running programme — intervals, coach cues, GPS routes."},
  corner: {name: "Home Corner", icon: "🥊", color: "#d4a72c", url: "../Home-Corner/", blurb: "Dumbbell circuits, championship boxing rounds, core finishers."},
  yoga: {name: "Namastay Home", icon: "🧘", color: "#9db98a", url: "../Namastay-Home/", blurb: "Guided yoga for back care, foundations, and a full reset."}
};
function appStatLines(k) {
  if (k === "couch") { const c = couchData();
    return {head: `${c.done}/27 runs · ${c.pct}%`, sub: c.next ? `Next: Week ${c.next.w + 1} · Run ${c.next.r + 1}` : "Programme complete 🎉",
      foot: c.lastDone ? `Last run ${fmtDayShort(c.lastDone.date)}${c.lastDone.km ? " · " + c.lastDone.km + " km" : ""} · ${c.totalKm} km all-time` : "No runs logged yet", pct: c.pct}; }
  if (k === "corner") { const h = cornerData();
    return {head: `${h.total} workouts · ${h.mins} min`, sub: `${h.weekDone} this week`,
      foot: h.last ? `Last: ${esc(h.last.name || "Workout")} · ${fmtDayShort(h.last.date)}` : "No workouts logged yet", pct: null}; }
  const y = yogaData();
  return {head: `${y.total} sessions · ${y.mins} min`, sub: `${y.weekDone} this week`,
    foot: y.last ? `Last: ${esc(y.last.title || "Yoga")} · ${fmtDayShort(y.last.date)}` : "No sessions logged yet", pct: null};
}
function fitnessStripHTML() {
  const w = weekActivity(), nx = upNext();
  const rows = ["couch", "corner", "yoga"].map(k => { const s = appStatLines(k), m = APP_META[k];
    return `<div class="row between" style="padding:5px 0;border-top:1px solid #232f4d">
      <span class="small">${m.icon} <b>${m.name}</b></span><span class="small muted">${s.head}</span></div>
      ${s.pct !== null && s.pct !== undefined ? fbar(s.pct, m.color) : ""}`; }).join("");
  return `<div class="card"><div class="row between"><h3>🔥 This week at the Forge</h3>
    <span class="small muted">${w.count} workout${w.count === 1 ? "" : "s"} · ${w.days} active day${w.days === 1 ? "" : "s"} · ${w.mins} min</span></div>
    ${rows}
    <p class="small" style="margin-top:8px">Up next: <b>${esc(nx.app)}</b> <span class="muted">— ${nx.text}</span></p></div>`;
}
function fitnessPanelsHTML() {
  const c = couchData(), h = cornerData(), y = yogaData(), w = weekActivity();
  const hist = unifiedHistory(12);
  const panel = (k, inner) => `<div class="card"><div class="row between"><h3>${APP_META[k].icon} ${APP_META[k].name}</h3>
    <button class="btn sm" onclick="location.href='${APP_META[k].url}'">Open app →</button></div>${inner}</div>`;
  const couchInner = `${fbar(c.pct, APP_META.couch.color)}
    <p class="small muted" style="margin-top:8px">${c.done} of 27 programme runs · ${c.attempts} total attempts · ${c.totalKm} km recorded</p>
    <p class="small">${c.next ? `Next up: <b>Week ${c.next.w + 1} · Run ${c.next.r + 1}</b>` : "🎉 Programme complete"}${c.lastDone ? ` · Last run ${fmtDayShort(c.lastDone.date)}` : ""}</p>`;
  const cornerInner = `<p class="small muted" style="margin-top:6px">${h.total} workouts all-time · ${h.weekDone} this week · ${h.mins} minutes total</p>
    <p class="small">${Object.entries(h.byModule).map(([m, n]) => `${esc(CORNER_MODULES[m] || m)}: <b>${n}</b>`).join(" · ") || "No workouts yet"}${h.last ? `<br>Most recent: <b>${esc(h.last.name || "")}</b> · ${fmtDayShort(h.last.date)}` : ""}</p>`;
  const yogaInner = `<p class="small muted" style="margin-top:6px">${y.total} sessions all-time · ${y.weekDone} this week · ${y.mins} minutes on the mat</p>
    <p class="small">${Object.entries(y.byRoutine).map(([r, n]) => `${esc(r)}: <b>${n}</b>`).join(" · ") || "No sessions yet"}${y.last ? `<br>Most recent: <b>${esc(y.last.title || "")}</b> · ${fmtDayShort(y.last.date)}` : ""}</p>`;
  const histHTML = hist.length ? `<div class="card"><h3>🕘 Recent activity — all apps</h3><div class="list">${hist.map(r => `
    <div class="item"><div class="grow"><div class="t">${esc(r.name)} ${r.status === "partial" ? `<span class="dim">· partial</span>` : ""}</div>
    <div class="s">${esc(r.app)} · ${fmtDayShort(r.date)}${r.durationSec ? " · " + Math.round(r.durationSec / 60) + " min" : ""}${r.meta ? " · " + esc(r.meta) : ""}</div></div></div>`).join("")}</div></div>` : "";
  return `<div class="card" style="border-color:var(--org)"><div class="row between"><h3>🏆 Fitness progress — all programmes</h3></div>
    <p class="small muted" style="margin-top:4px">${w.count} workouts this week across ${w.days} active day${w.days === 1 ? "" : "s"} · ${w.mins} minutes. Live from each app's own records — nothing copied, nothing double-counted.</p></div>
    ${panel("couch", couchInner)}${panel("corner", cornerInner)}${panel("yoga", yogaInner)}${histHTML}`;
}
function appCardsHTML() {
  return ["couch", "corner", "yoga"].map(k => { const m = APP_META[k], s = appStatLines(k);
    return `<div class="card" style="border-top:3px solid ${m.color}">
    <div class="row between"><h3>${m.icon} ${m.name}</h3><span class="small" style="color:${m.color}"><b>${s.head}</b></span></div>
    <p class="small muted" style="margin:6px 0">${m.blurb}</p>
    ${s.pct !== null && s.pct !== undefined ? fbar(s.pct, m.color) : ""}
    <p class="small" style="margin-top:8px">${s.sub}<br><span class="muted">${s.foot}</span></p>
    <button class="btn block" style="margin-top:10px" onclick="location.href='${m.url}'">▶ Open ${m.name}</button></div>`; }).join("");
}


/* Hub point artwork — his picks 2026-10-21: Couch C8 Stopwatch, Home Corner H2 The Belt, Namastay N4 Morning Sun */
const APP_LOGOS = {
  couch: `<svg viewBox="0 0 100 100"> <rect width="100" height="100" fill="#171310"/> <g fill="#ff7a1a"><circle cx="16" cy="72" r="3"/><circle cx="26" cy="66" r="3"/><circle cx="36" cy="60" r="3"/><circle cx="46" cy="54" r="3"/><circle cx="56" cy="48" r="3"/><circle cx="66" cy="42" r="3"/><circle cx="76" cy="36" r="3"/><circle cx="85" cy="30" r="3"/></g> <circle cx="93" cy="24" r="4.5" fill="#d7fd44"/> <text x="50" y="88" text-anchor="middle" font-family="Arial Black,Arial" font-size="12" font-weight="900" fill="#fff">9 WEEKS · 5K</text> </svg></div><div class="code">C6</div><div class="nm">Nine Steps</div></div>  <div class="opt"><div class="bub ringE"><svg viewBox="0 0 100 100"> <rect width="100" height="100" fill="#171310"/> <path d="M38 12 C50 12 56 22 55 36 C54 50 58 62 52 74 C48 82 38 84 33 76 C27 67 30 54 29 42 C28 26 29 12 38 12 Z" fill="none" stroke="#fff" stroke-width="4"/> <g fill="#d7fd44"><circle cx="42" cy="26" r="3.4"/><circle cx="41" cy="40" r="3.4"/><circle cx="42" cy="54" r="3.4"/><circle cx="40" cy="67" r="3.4"/></g> <g fill="#ff7a1a"><circle cx="60" cy="80" r="2.6"/><circle cx="70" cy="74" r="2.6"/><circle cx="79" cy="66" r="2.6"/><circle cx="86" cy="57" r="3.2"/></g> </svg></div><div class="code">C7</div><div class="nm">Sole &amp; Trail</div></div>  <div class="opt"><div class="bub ringE"><svg viewBox="0 0 100 100"> <rect width="100" height="100" fill="#171310"/> <rect x="44" y="8" width="12" height="7" rx="2" fill="#ff7a1a"/> <rect x="48.5" y="13" width="3" height="6" fill="#ff7a1a"/> <circle cx="50" cy="55" r="34" fill="none" stroke="#ff7a1a" stroke-width="5"/> <path d="M50 55 L50 36" stroke="#d7fd44" stroke-width="4.5" stroke-linecap="round"/> <path d="M50 55 L63 62" stroke="#d7fd44" stroke-width="4.5" stroke-linecap="round"/> <circle cx="50" cy="55" r="4" fill="#fff"/> <text x="50" y="84" text-anchor="middle" font-family="Arial Black,Arial" font-size="11" font-weight="900" fill="#fff">5K</text> </svg>`,
  corner: `<svg viewBox="0 0 100 100"> <rect width="100" height="100" fill="#171310"/> <path d="M0 0 L50 0 L50 100 L0 100 Z" fill="#201914"/> <g fill="#fff"><rect x="9" y="46" width="34" height="10" rx="4.5"/><rect x="7" y="53" width="8" height="14" rx="3.5"/><rect x="36" y="53" width="8" height="14" rx="3.5"/><rect x="10" y="60" width="32" height="8" rx="4"/></g> <g stroke="#ff7a1a" stroke-width="5.5" stroke-linecap="round" fill="none"><circle cx="72" cy="22" r="6" fill="#ff7a1a" stroke="none"/><path d="M68 30 L58 46"/><path d="M67 34 L79 42"/><path d="M67 34 L55 39"/><path d="M58 46 L72 54 L69 67"/><path d="M58 46 L46 56 L51 69"/></g> </svg></div><div class="code">C9</div><div class="nm">Half &amp; Half</div></div>  <div class="opt"><div class="bub ringE"><svg viewBox="0 0 100 100"> <rect width="100" height="100" fill="#171310"/> <path d="M22 58 A28 28 0 0 1 78 58 Z" fill="#ff7a1a"/> <path d="M14 100 L38 58 L62 58 L86 100 Z" fill="#262019"/> <g stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M50 66 L50 71"/><path d="M50 78 L50 85"/><path d="M50 91 L50 97"/></g> <g stroke="#fff" stroke-width="3.6" stroke-linecap="round" fill="none"><circle cx="70" cy="66" r="3.4" fill="#fff" stroke="none"/><path d="M68 71 L63 79"/><path d="M67 73 L74 77"/><path d="M63 79 L70 83"/></g> </svg></div><div class="code">C10</div><div class="nm">Road at Dawn</div></div> </div>  <h2>🥊 Home Corner — takes on H2 <span class="th">· Title Belt</span></h2> <div class="grid">  <div class="opt"><div class="bub ringG pick"><svg viewBox="0 0 100 100"> <rect width="100" height="100" fill="#141b2e"/> <path d="M8 42 L92 42 L92 58 L8 58 Z" fill="#232f52"/> <path d="M8 42 L92 42 L92 58 L8 58 Z" fill="none" stroke="#d4a72c" stroke-width="2"/> <ellipse cx="50" cy="50" rx="19" ry="15" fill="#d4a72c"/> <ellipse cx="50" cy="50" rx="14.5" ry="11" fill="#f5eeda"/> <path d="M50 42 L52.2 47.6 L58.2 47.8 L53.5 51.4 L55.1 57.2 L50 54 L44.9 57.2 L46.5 51.4 L41.8 47.8 L47.8 47.6 Z" fill="#d4a72c"/> <circle cx="24" cy="50" r="3" fill="#d4a72c"/><circle cx="76" cy="50" r="3" fill="#d4a72c"/> </svg>`,
  yoga: `<svg viewBox="0 0 100 100"> <rect width="100" height="100" fill="#141b2e"/> <path d="M8 42 L92 42 L92 58 L8 58 Z" fill="#232f52"/> <path d="M8 42 L92 42 L92 58 L8 58 Z" fill="none" stroke="#d4a72c" stroke-width="2"/> <ellipse cx="50" cy="50" rx="19" ry="15" fill="#d4a72c"/> <ellipse cx="50" cy="50" rx="14.5" ry="11" fill="#141b2e"/> <g transform="translate(39 38) scale(0.23)"><path d="M32 84 L32 44 C32 29 39 20 50 20 C61 20 68 29 68 44 L68 84 Z" fill="#c11f2c"/><rect x="28" y="82" width="44" height="12" rx="3" fill="#d4a72c"/></g> <circle cx="24" cy="50" r="3" fill="#d4a72c"/><circle cx="76" cy="50" r="3" fill="#d4a72c"/> </svg></div><div class="code">H6</div><div class="nm">Belt · Glove Plate</div></div>  <div class="opt"><div class="bub ringG"><svg viewBox="0 0 100 100"> <rect width="100" height="100" fill="#141b2e"/> <path d="M6 40 L94 40 L94 60 L6 60 Z" fill="#232f52"/> <path d="M6 40 L94 40 L94 60 L6 60 Z" fill="none" stroke="#d4a72c" stroke-width="2"/> <ellipse cx="50" cy="50" rx="21" ry="16.5" fill="#d4a72c"/> <ellipse cx="50" cy="50" rx="16.5" ry="12.5" fill="#f5eeda"/> <g fill="#141b2e"><rect x="40" y="47.5" width="20" height="4" rx="1.6"/><rect x="37.5" y="43.5" width="3.4" height="12" rx="1.4"/><rect x="34.8" y="45.5" width="2.8" height="8" rx="1.2"/><rect x="59.1" y="43.5" width="3.4" height="12" rx="1.4"/><rect x="62.4" y="45.5" width="2.8" height="8" rx="1.2"/></g> <circle cx="20" cy="50" r="5.5" fill="#d4a72c"/><circle cx="80" cy="50" r="5.5" fill="#d4a72c"/> <path d="M20 46.8 L20.9 49 L23.2 49.1 L21.4 50.4 L22 52.6 L20 51.4 L18 52.6 L18.6 50.4 L16.8 49.1 L19.1 49 Z" fill="#141b2e"/> <path d="M80 46.8 L80.9 49 L83.2 49.1 L81.4 50.4 L82 52.6 L80 51.4 L78 52.6 L78.6 50.4 L76.8 49.1 L79.1 49 Z" fill="#141b2e"/> </svg></div><div class="code">H7</div><div class="nm">Belt · Iron Plate</div></div>  <div class="opt"><div class="bub ringG"><svg viewBox="0 0 100 100"> <rect width="100" height="100" fill="#141b2e"/> <path d="M8 42 L92 42 L92 58 L8 58 Z" fill="#f5eeda"/> <path d="M8 42 L92 42 L92 58 L8 58 Z" fill="none" stroke="#d4a72c" stroke-width="2"/> <ellipse cx="50" cy="50" rx="19" ry="15" fill="#141b2e"/> <ellipse cx="50" cy="50" rx="15.5" ry="11.5" fill="none" stroke="#d4a72c" stroke-width="1.6"/> <path d="M50 42 L52.2 47.6 L58.2 47.8 L53.5 51.4 L55.1 57.2 L50 54 L44.9 57.2 L46.5 51.4 L41.8 47.8 L47.8 47.6 Z" fill="#d4a72c"/> <circle cx="24" cy="50" r="3" fill="#141b2e"/><circle cx="76" cy="50" r="3" fill="#141b2e"/> </svg></div><div class="code">H8</div><div class="nm">Belt · Cream Strap</div></div> </div>  <h2>🧘 Namastay Home — takes on N4 <span class="th">· Morning</span></h2> <div class="grid">  <div class="opt"><div class="bub ringS pick"><svg viewBox="0 0 100 100"> <rect width="100" height="100" fill="#f7f5ef"/> <g stroke="#e3c878" stroke-width="3" stroke-linecap="round"><path d="M50 10 L50 17"/><path d="M28 19 L33 25"/><path d="M72 19 L67 25"/><path d="M17 36 L24 39"/><path d="M83 36 L76 39"/></g> <path d="M28 52 A22 22 0 0 1 72 52 Z" fill="#e9d391"/> <path d="M50 42 C56 51 56 59 50 65 C44 59 44 51 50 42 Z" fill="#8fae8b"/> <path d="M50 65 C43 63 37 57 35 49 C45 51 49 57 50 65 Z" fill="#a8c3d9"/> <path d="M50 65 C57 63 63 57 65 49 C55 51 51 57 50 65 Z" fill="#a8c3d9"/> <path d="M24 72 L76 72" stroke="#8fae8b" stroke-width="2.6" stroke-linecap="round"/> </svg>`,
};

/* ---------- Workouts hub (twin of the main hub: 3 points + week centre) ---------- */
function workoutHubHTML() {
  const w = weekActivity(), nx = upNext();
  const pos = {couch: ["50%", "5%"], corner: ["13%", "76%"], yoga: ["87%", "76%"]};
  const node = k => { const m = APP_META[k];
    return `<button class="node wnode" style="left:${pos[k][0]};top:${pos[k][1]}" onclick="location.href='${m.url}'">
      <span class="bub wbub">${APP_LOGOS[k] || `<span class="wemoji">${m.icon}</span>`}</span>
      <span class="nl">${m.name}</span></button>`; };
  return `<div class="hub whub">
    <svg class="hexsvg" viewBox="0 0 100 100">
      <circle cx="50" cy="52" r="34" fill="none" stroke="#d4a72c" stroke-width=".55" opacity=".45"/>
      <polygon points="50,5 87,76 13,76" fill="none" stroke="#d4a72c" stroke-width="1" opacity=".8"/>
      <g fill="#f6d47a"><circle cx="50" cy="5" r="1.5"/><circle cx="87" cy="76" r="1.5"/><circle cx="13" cy="76" r="1.5"/></g>
    </svg>
    ${node("couch")}${node("corner")}${node("yoga")}
    <div class="wcenter">
      <div class="wck">THIS WEEK</div>
      <div class="wcnum">${w.count}</div>
      <div class="wccap">workout${w.count === 1 ? "" : "s"} · ${w.days} active day${w.days === 1 ? "" : "s"}<br>${w.mins} minutes trained</div>
      <div class="wcnext">Up next · <b>${esc(nx.app)}</b></div>
    </div>
  </div>`;
}
