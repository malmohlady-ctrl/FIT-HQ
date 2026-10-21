/* Placement regression test — the hub must render in the Workouts HOME,
   above the built-in player, and must NOT appear inside the player view.
   (Forge 2.0/v7 bug: patches landed in renderPlayer, which writes to the
   same #view-workouts element, so the home never showed the cards/hub.) */
const fs = require("fs");
const src = fs.readFileSync(process.argv[2] || "workouts.js", "utf8");
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("PASS  " + n); } else { fail++; console.log("FAIL  " + n); } };

const iPlayer = src.indexOf("function renderPlayer()");
const iHome = src.indexOf("function renderWorkouts()");
ok("both render functions exist", iPlayer > -1 && iHome > iPlayer);
const playerSrc = src.slice(iPlayer, iHome);
const homeSrc = src.slice(iHome);
ok("player source contains NO hub reference", !playerSrc.includes("workoutHubHTML"));
ok("player source contains NO app-cards reference", !playerSrc.includes("appCardsHTML"));
ok("workouts home references the hub", homeSrc.includes("workoutHubHTML"));
ok("exactly one hub call site in the file", (src.match(/workoutHubHTML\(\)/g) || []).length === 1);
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
