/* Photo-logging flow tests — manual path + mocked OpenRouter analysis */
let passP = 0, failP = 0;
function okP(name, cond) { if (cond) { passP++; console.log("PASS  " + name); } else { failP++; console.log("FAIL  " + name); } }
(async () => {
  DB.foods = [{id: "f1", name: "Greek Yogurt", brand: "", unit: "1 cup", per: {kcal: 100, p: 17, c: 6, f: 0}, fav: false}];
  DB.entries = [];
  nutDate = todayKey();

  /* --- manual flow: review -> confirm -> diary --- */
  PH = {dataUrl: "data:image/jpeg;base64,x", meal: "lunch", busy: false, note: "",
    items: [{name: "Toast", portion: "2 slices", per: {kcal: 160, p: 5, c: 30, f: 2}, conf: 0, source: "entered by you"}]};
  const before = DB.entries.length;
  phConfirm();
  okP("confirm writes exactly 1 entry", DB.entries.length === before + 1);
  const e = DB.entries[DB.entries.length - 1];
  okP("entry tagged source=photo", e.source === "photo");
  okP("entry lands in chosen meal + today", e.meal === "lunch" && e.date === nutDate);
  okP("entry snapshot carries edited values", e.per.kcal === 160 && e.per.p === 5);
  const tot = dayEntries(nutDate).reduce((a, x) => a + x.per.kcal * x.qty, 0);
  okP("diary day total includes photo entry", tot === 160);
  okP("overlay closed after confirm", PH === null);

  /* --- AI flow with a mocked OpenRouter --- */
  S().orKey = "test-key";
  let sentBody = null;
  global.fetch = async (url, opts) => { sentBody = JSON.parse(opts.body); return {ok: true, json: async () => ({choices: [{message: {content:
    "```json\n{\"items\":[{\"name\":\"Greek Yogurt\",\"portion\":\"1 cup\",\"kcal\":999,\"p\":1,\"c\":1,\"f\":1,\"confidence\":0.9},{\"name\":\"Granola\",\"portion\":\"~40 g\",\"kcal\":180,\"p\":4,\"c\":24,\"f\":7,\"confidence\":0.55}],\"notes\":\"portion sizes uncertain\"}\n```"}}]})}; };
  PH = {dataUrl: "data:image/jpeg;base64,AAA", items: [], meal: "breakfast", busy: false, note: ""};
  await phAnalyse();
  okP("analyse populated 2 items", PH.items.length === 2);
  okP("request sent the photo as image_url", JSON.stringify(sentBody.messages[0].content).includes("image_url"));
  okP("request used a free model", /:free|openrouter\/free/.test(sentBody.model));
  okP("library match overrides AI numbers", PH.items[0].per.kcal === 100 && PH.items[0].foodId === "f1");
  okP("unmatched item keeps AI estimate, labelled", PH.items[1].per.kcal === 180 && /estimate/.test(PH.items[1].source));
  okP("confidence preserved for chips", PH.items[0].conf === 0.9 && PH.items[1].conf === 0.55);
  okP("nothing auto-saved by analysis", DB.entries.length === before + 1);

  /* --- failure path: API down -> graceful, manual still works --- */
  global.fetch = async () => ({ok: false, status: 429});
  PH = {dataUrl: "data:image/jpeg;base64,AAA", items: [], meal: "breakfast", busy: false, note: ""};
  await phAnalyse();
  okP("API failure leaves busy=false and explains itself", PH.busy === false && /failed/.test(PH.note));
  console.log(`\n${passP} passed, ${failP} failed`);
  if (failP) process.exit(1);
})();
