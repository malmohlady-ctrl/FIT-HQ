// appended after app files: checks for the Forge hub/plan/body
let pass=0, fail=0; const ok=(n,c)=>{console.log((c?"PASS":"FAIL")+"  "+n); c?pass++:fail++;};
// seed a little data
DB.entries.push({id:"e1",date:todayKey(),meal:"Breakfast",name:"Oats",qty:1,per:{kcal:300,p:10,c:50,f:6}});
DB.weights.push({id:"w1",date:todayKey(),kg:lbToKg(231)});
DB.sessions.push({id:"s1",date:todayKey(),type:"run",title:"C25K W1 R1",mins:30});
DB.measures.push({id:"m1",date:todayKey(),type:"Waist",cm:97});
saveDB();
renderHome();
let h = document.querySelector("#view-home").innerHTML;
ok("hub renders 6 nodes", (h.match(/class="node"/g)||[]).length===6);
ok("hub shows Plan at a point", h.includes("Plan") && h.includes("Settings"));
ok("centre hero is kcal left", h.includes("1,700") || h.includes("1700"));
ok("centre caption mentions plan/streak", /kcal left/.test(h));
S().centerStat="weight"; let cd=centerData();
ok("weight mode hero", cd.hero.includes("231") && cd.tap==="body");
S().centerStat="next"; cd=centerData();
ok("next mode hero is a run", /W\d · Run \d/.test(cd.hero) && cd.tap==="workouts");
S().centerStat="kcal"; cd=centerData();
ok("kcal mode pct", Math.abs(cd.pct - 300/2000) < 0.001);
renderPlan();
let p = document.querySelector("#view-plan").innerHTML;
ok("plan renders week grid", p.includes("Week at a glance") && (p.match(/daycell/g)||[]).length>=7);
ok("plan shows up next run", p.includes("Couch to 5K"));
renderBody();
let b = document.querySelector("#view-body").innerHTML;
ok("body renders water+weight+measures", b.includes("Water") && b.includes("231") && b.includes("Waist"));
renderSettings();
let st = document.querySelector("#view-settings").innerHTML;
ok("settings has hub centre control", st.includes("Hub centre") && st.includes("setCenterStat"));
show("plan"); ok("router lands on plan", curView==="plan");
show("home"); ok("router returns home", curView==="home");

/* --- Workouts home placement: hub above the built-in player --- */
localStorage.setItem("first5k.v1", JSON.stringify({completed: [], selectedWeek: 0, selectedRun: 0}));
window.renderWorkouts = renderWorkouts; /* browser semantics: declarations attach to window; the node stub needs this for show() dispatch */
show("workouts");
const wkHTML = document.querySelector("#view-workouts").innerHTML;
ok("workouts home shows the hub", wkHTML.includes("whub"));
ok("hub centre shows THIS WEEK", wkHTML.includes("THIS WEEK"));
ok("hub sits ABOVE the built-in player", wkHTML.indexOf("whub") > -1 && wkHTML.indexOf("whub") < wkHTML.indexOf("Dumbbell studio"));
console.log(pass+" passed, "+fail+" failed");
process.exit(fail?1:0);
