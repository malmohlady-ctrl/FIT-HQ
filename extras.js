/* FIT HQ extras: Open Food Facts search + barcode (optional, online-only,
   manual logging never depends on it) and the Insights panel.
   Only the search text / barcode number is sent to Open Food Facts —
   never diary, weight, or profile data. */
"use strict";
/* ---------- Open Food Facts ---------- */
const OFF_FIELDS = "product_name,brands,nutriments,serving_size,serving_quantity,code";
function offPer(nut) {
  const kj = Number(nut["energy_100g"]);
  const kcal100 = Number(nut["energy-kcal_100g"]) || (kj ? kj / 4.184 : 0);
  const g = k => Number(nut[k]) || 0;
  return {kcal: Math.round(kcal100), p: r1(g("proteins_100g")), c: r1(g("carbohydrates_100g")),
    f: r1(g("fat_100g")), fiber: r1(g("fiber_100g")), sugar: r1(g("sugars_100g")),
    satfat: r1(g("saturated-fat_100g")), sodium: Math.round(g("sodium_100g") * 1000)};
}
function offServingPer(p) {
  const nut = p.nutriments || {};
  const sk = Number(nut["energy-kcal_serving"]);
  if (sk && p.serving_size) {
    const ratio = sk / (Number(nut["energy-kcal_100g"]) || sk);
    const base = offPer(nut), o = {};
    NUT_KEYS.forEach(k => o[k] = Math.round(base[k] * ratio * 10) / 10);
    o.kcal = Math.round(sk);
    return {per: o, unit: p.serving_size};
  }
  return {per: offPer(nut), unit: "100 g"};
}
function renderOffSlot() {
  const slot = document.getElementById("offSlot"); if (!slot) return;
  slot.innerHTML = `<div class="card tight">
    <div class="row"><input id="offQ" placeholder="Search packaged foods (Open Food Facts)…" class="grow">
    <button class="btn sm" id="offGo">Search</button>
    <button class="btn sm ghost" id="offScan">📷 Scan</button></div>
    <div id="offOut"><p class="small dim" style="margin-top:6px">Free community database — great for packaged foods, thinner for Canadian store brands. Manual entry always works.</p></div>
  </div>`;
  const mealNow = () => { const h = new Date().getHours(); return h < 11 ? "breakfast" : h < 15 ? "lunch" : h < 21 ? "dinner" : "snacks"; };
  const go = () => offSearch($("#offQ").value.trim(), mealNow());
  $("#offGo").onclick = go;
  $("#offQ").addEventListener("keydown", e => { if (e.key === "Enter") go(); });
  $("#offScan").onclick = () => openScanner(mealNow());
}
function offRow(p, meal) {
  const {per, unit} = offServingPer(p);
  const name = (p.product_name || "Unnamed product").trim();
  const brand = (p.brands || "").split(",")[0].trim();
  return `<div class="item"><div class="grow" style="cursor:pointer" onclick='offPick(${JSON.stringify(p.code || "")}, "${meal}")'>
    <div class="t">${esc(name)}${brand ? ` <span class="dim">· ${esc(brand)}</span>` : ""}</div>
    <div class="s">per ${esc(unit)} · P ${r0(per.p)} C ${r0(per.c)} F ${r0(per.f)} · Open Food Facts</div></div>
    <div class="kc">${r0(per.kcal)}</div></div>`;
}
const _offCache = {};
async function offSearch(q, meal) {
  const out = $("#offOut"); if (!out) return;
  if (!q) { out.innerHTML = `<p class="small muted" style="margin-top:6px">Type a product name first.</p>`; return; }
  if (!navigator.onLine) { out.innerHTML = `<div class="err">You're offline — food search needs internet. Manual entry below works fine.</div>`; return; }
  out.innerHTML = `<p class="small muted" style="margin-top:8px">Searching Open Food Facts…</p>`;
  try {
    const url = "https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=12&fields=" +
      encodeURIComponent(OFF_FIELDS) + "&search_terms=" + encodeURIComponent(q);
    const r = await fetch(url, {headers: {"Accept": "application/json"}});
    if (!r.ok) throw new Error("http " + r.status);
    const j = await r.json();
    const prods = (j.products || []).filter(p => p.product_name && (((p.nutriments || {})["energy-kcal_100g"] != null) || ((p.nutriments || {})["energy_100g"] != null)));
    if (!prods.length) { out.innerHTML = `<p class="small muted" style="margin-top:8px">No matches with nutrition data. Try a shorter name, or add it manually — it'll be in your library for next time.</p>`; return; }
    prods.forEach(p => { if (p.code) _offCache[p.code] = p; });
    out.innerHTML = `<div class="list">${prods.map(p => offRow(p, meal)).join("")}</div>
      <p class="small dim">Values are per serving as listed by Open Food Facts contributors — sanity-check against the label.</p>`;
  } catch (e) {
    out.innerHTML = `<div class="err">Search failed (network or database unavailable). Your diary is unaffected — manual entry works as always.</div>`;
  }
}
async function offPick(code, meal) {
  let p = _offCache[code];
  if (!p && code) {
    try {
      const r = await fetch("https://world.openfoodfacts.org/api/v2/product/" + encodeURIComponent(code) + ".json?fields=" + encodeURIComponent(OFF_FIELDS));
      const j = await r.json();
      if (j.status === 1) p = j.product;
    } catch (e) {}
  }
  if (!p) { toast("Couldn't load that product — try again or enter manually"); return; }
  const {per, unit} = offServingPer(p);
  openEntryEditor({preset: {name: (p.product_name || "").trim(), brand: (p.brands || "").split(",")[0].trim(),
    unit, per, qty: 1, source: "off"}, meal});
}
/* barcode: camera via BarcodeDetector where supported; manual code entry everywhere */
function openScanner(meal) {
  openSheet(`<h3>Scan barcode</h3>
  <div id="scanBox"><video id="scanvid" playsinline muted></video>
  <p class="small muted" style="margin:6px 0" id="scanMsg">Starting camera…</p></div>
  <label>Or type the barcode number</label>
  <div class="row"><input id="scanCode" inputmode="numeric" placeholder="e.g. 3017620422003" class="grow">
  <button class="btn sm" id="scanLook">Look up</button></div>
  <button class="btn ghost block" style="margin-top:10px" onclick="closeSheet()">Cancel</button>`);
  $("#scanLook").onclick = async () => {
    const code = $("#scanCode").value.trim(); if (!code) return;
    closeSheet(); offPick(code, meal);
  };
  (async () => {
    const msg = $("#scanMsg");
    if (!("BarcodeDetector" in window)) { if (msg) msg.textContent = "This browser can't scan barcodes — type the number below instead."; return; }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: "environment"}});
    } catch (e) { if (msg) msg.textContent = "Camera permission denied — type the barcode number below instead."; return; }
    const vid = $("#scanvid"); if (!vid) { stream.getTracks().forEach(t => t.stop()); return; }
    vid.srcObject = stream; await vid.play().catch(() => {});
    if (msg) msg.textContent = "Point at the barcode…";
    const det = new BarcodeDetector({formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"]});
    let stopped = false;
    window._scanStop = () => { stopped = true; stream.getTracks().forEach(t => t.stop()); };
    (async function loop() {
      while (!stopped) {
        try {
          const codes = await det.detect(vid);
          if (codes && codes.length) { window._scanStop && window._scanStop(); closeSheet(); offPick(codes[0].rawValue, meal); return; }
        } catch (e) {}
        await new Promise(r => setTimeout(r, 350));
      }
    })();
  })();
}
/* ---------- Insights ---------- */
function renderInsights() {
  const slot = document.getElementById("insightsSlot"); if (!slot) return;
  const s = S(), tg = s.targets;
  const last = n => Array.from({length: n}, (_, i) => addDays(todayKey(), -i));
  const d14 = last(14), d28 = last(28);
  const food14 = d14.filter(d => dayEntries(d).length);
  const avg = (arr, k) => arr.length ? arr.reduce((a, d) => a + dayTotals(d)[k], 0) / arr.length : 0;
  const cards = [];
  if (food14.length >= 4) {
    const a = avg(food14, "kcal"), p = avg(food14, "p");
    cards.push(`<div class="item"><div class="grow"><div class="t">🍽️ Calories: ${r0(a)}/day vs ${tg.kcal} target</div>
      <div class="s">${a <= tg.kcal ? "On the right side of your target on average — that's the pattern that moves the trend." : "A bit above target on average. One smaller swap a day closes most of that gap."}</div></div></div>`);
    cards.push(`<div class="item"><div class="grow"><div class="t">🥩 Protein: ${r0(p)}g/day vs ${tg.p}g target</div>
      <div class="s">${p >= tg.p * 0.9 ? "Strong — protein at this level helps protect muscle while you lose." : "Protein is the macro most worth nudging up while cutting; it protects muscle and keeps you full."}</div></div></div>`);
  } else cards.push(`<div class="item"><div class="grow"><div class="t">🍽️ Food insights unlock soon</div><div class="s">Log food on at least 4 of the last 14 days and this panel starts reading your patterns. (${food14.length}/4 so far)</div></div></div>`);
  const ws = sortedWeights();
  if (ws.length >= 3) {
    const firstW = rollingAvg(ws)[0]?.[1], lastW = rollingAvg(ws).slice(-1)[0]?.[1];
    const diff = lastW - firstW;
    cards.push(`<div class="item"><div class="grow"><div class="t">⚖️ Weight trend: ${diff <= 0 ? "▼" : "▲"} ${dispW(Math.abs(diff))} on the weekly average</div>
      <div class="s">${diff < -0.2 ? "Trending down steadily — exactly what the averages are for." : diff > 0.2 ? "The average is drifting up. Worth a look at the calorie pattern above — small leaks, not single days, drive this." : "Holding steady. Maintenance is a skill too — and the base for the next push."}</div></div></div>`);
  }
  const sess28 = DB.sessions.filter(x => d28.includes(x.date));
  const runs28 = sess28.filter(x => x.type === "run").length;
  cards.push(`<div class="item"><div class="grow"><div class="t">🏋️ ${sess28.length} workouts in 28 days${runs28 ? ` · ${runs28} runs` : ""}</div>
    <div class="s">${sess28.length >= 12 ? "Serious consistency — that's an athlete's calendar." : sess28.length >= 6 ? "A solid rhythm. One more session a week is the next level, if life allows." : "Every session counts, including short ones. The calendar builds one checkmark at a time."}</div></div></div>`);
  const waterDays = d14.filter(d => waterFor(d) >= tg.waterMl).length;
  cards.push(`<div class="item"><div class="grow"><div class="t">💧 Water goal hit on ${waterDays} of the last 14 days</div>
    <div class="s">${waterDays >= 10 ? "Hydration is basically a habit now." : "The +250 button on Home is the fastest log in the app — one tap with each meal does it."}</div></div></div>`);
  const diaryDays = d28.filter(d => dayEntries(d).length).length;
  cards.push(`<div class="item"><div class="grow"><div class="t">📓 Diary completed on ${diaryDays} of the last 28 days</div>
    <div class="s">Logged days are the data everything else here stands on. An honest rough day beats a skipped one.</div></div></div>`);
  slot.innerHTML = `<div class="card"><h3>🧭 Insights</h3>
    <p class="small muted">Patterns from your own records — correlations, not verdicts. Bodies are complicated; trends over weeks beat any single day.</p>
    <div class="list">${cards.join("")}</div></div>`;
}
