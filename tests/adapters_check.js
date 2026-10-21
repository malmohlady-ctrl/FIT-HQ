/* Forge 2.0 adapter tests — run via tests/run_adapters.sh */
let passA = 0, failA = 0;
function okA(name, cond) { if (cond) { passA++; console.log("PASS  " + name); } else { failA++; console.log("FAIL  " + name); } }
const TD = todayKey();
/* seed the three standalone stores the way the real apps write them */
localStorage.setItem("first5k.v1", JSON.stringify({selectedWeek: 0, selectedRun: 1, completed: [
  {key: "1-1", week: 0, run: 0, date: TD, timestamp: 1001, minutes: 30, durationSec: 1800, km: 2.1, paceSec: 857},        // legacy full -> completed
  {key: "1-2", week: 0, run: 1, date: TD, timestamp: 1002, minutes: 5, durationSec: 300},                                   // legacy short -> partial
  {key: "2-1", week: 1, run: 0, date: TD, timestamp: 1003, minutes: 2, durationSec: 100, status: "completed"}               // explicit status wins
]}));
localStorage.setItem("basementbelt.v1", JSON.stringify({selectedModule: "dumbbell", completed: [
  {module: "dumbbell", name: "Dumbbell Circuit", date: TD, timestamp: 2001, minutes: 31, durationSec: 1860},
  {module: "boxing", name: "Championship Rounds", date: "2026-01-05", timestamp: 2000, minutes: 20, durationSec: 1200}
]}));
localStorage.setItem("namastayhome.v1", JSON.stringify({selectedRoutine: "back", completed: [
  {key: "back-1", routine: "back", title: "Back Care Basics", date: TD, timestamp: 3001, minutes: 10, durationSec: 600}
]}));
DB.sessions = [{id: "s1", date: TD, type: "yoga", title: "Forge yoga", mins: 12, detail: {}}];
DB.foods = [{id: "f1", name: "Greek Yogurt", brand: "", unit: "1 cup", per: {kcal: 100, p: 17, c: 6, f: 0}, fav: false}];

const c = couchData();
okA("couch: legacy full + explicit count as done (2)", c.done === 2);
okA("couch: attempts counted separately (3)", c.attempts === 3);
okA("couch: next is first un-done slot 1-2", c.next && c.next.w === 0 && c.next.r === 1);
okA("couch: pct from real programme (2/27=7)", c.pct === 7);
okA("couch: km summed from completed only", c.totalKm === 2.1);
okA("couch: status inference partial", couchEntryStatus({week: 0, durationSec: 300}) === "partial");
okA("couch: status inference completed at 90%", couchEntryStatus({week: 8, durationSec: 2200}) === "completed");

const h = cornerData();
okA("corner: total 2", h.total === 2);
okA("corner: this-week counts only this week (1)", h.weekDone === 1);
okA("corner: minutes summed (51)", h.mins === 51);
okA("corner: module split", h.byModule.dumbbell === 1 && h.byModule.boxing === 1);

const y = yogaData();
okA("yoga: total 1, minutes 10", y.total === 1 && y.mins === 10);

const hist = unifiedHistory();
okA("unified: 3+2+1+1 = 7 records", hist.length === 7);
okA("unified: ids unique (no double count)", new Set(hist.map(r => r.id)).size === 7);
okA("unified: partial preserved as partial", hist.filter(r => r.status === "partial").length === 1);
okA("unified: sorted newest first", hist[0].ts >= hist[hist.length - 1].ts);

const w = weekActivity();
okA("week: completed-this-week count (5)", w.count === 5);
okA("week: active days = 1 (all today)", w.days === 1);

okA("strip renders with all three apps", ["Couch to 5K", "Home Corner", "Namastay Home"].every(n => fitnessStripHTML().includes(n)));
okA("panels render unified history", fitnessPanelsHTML().includes("Recent activity"));
okA("workout hub renders three app points", ["Couch to 5K", "Home Corner", "Namastay Home"].every(n => workoutHubHTML().includes(n)));
okA("each hub logo is exactly one SVG", ["couch", "corner", "yoga"].every(k => (APP_LOGOS[k].match(/<svg/g) || []).length === 1));
okA("hub renders 4 SVGs total (triangle + 3 logos)", (workoutHubHTML().match(/<svg/g) || []).length === 4);
okA("workout hub centre carries the week", workoutHubHTML().includes("THIS WEEK") && workoutHubHTML().includes("active day"));
okA("workout hub contains NO calorie content", !/kcal|calorie/i.test(workoutHubHTML()));
okA("upNext returns something sane", !!upNext().app);
okA("photo food match: library hit", (phMatchFood("greek yogurt bowl") || {}).id === "f1");
okA("photo food match: no false positive", phMatchFood("sushi platter deluxe") === null);
console.log(`\n${passA} passed, ${failA} failed`);
if (failA) process.exit(1);
