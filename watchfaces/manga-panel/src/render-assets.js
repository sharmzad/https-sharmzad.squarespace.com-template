// Exports the EasyFace asset kit for every colorway: background, preview, digit sets, weekday, bars, layout.json
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const SRC = "file://" + path.join(__dirname, "face.html");
const OUT = path.join(__dirname, "..", "assets");
const SETS = { T: "time", S: "seconds", B: "date", L: "battery_temp", H: "heart", M: "small" };
const RIGHT = new Set(["temperature", "steps"]);
const WD = ["日", "月", "火", "水", "木", "金", "土"], WDN = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 600, height: 700 }, deviceScaleFactor: 1 });
  await p.goto(SRC); await p.evaluate(() => window.ready);
  for (const way of ["classic-ink", "sakura", "neon-night"]) {
    const dir = path.join(OUT, way); fs.mkdirSync(path.join(dir, "parts"), { recursive: true });
    await p.evaluate(w => { setWay(w); document.body.className = ""; fill(); }, way);
    const face = await p.$("#face");
    await face.screenshot({ path: path.join(dir, "preview.png") });
    await p.evaluate(() => document.body.className = "mode-bg");
    await face.screenshot({ path: path.join(dir, "background.png") });

    // layout from the background render
    const layout = await p.evaluate(([R]) => {
      const f = document.getElementById("face").getBoundingClientRect(); const out = {};
      document.querySelectorAll("[data-w]").forEach(el => {
        const r = el.getBoundingClientRect(), d = el.querySelector(".d");
        const o = { x: Math.round(r.left - f.left), y: Math.round(r.top - f.top), w: Math.round(r.width), h: Math.round(r.height) };
        if (el.dataset.set) Object.assign(o, { digit_set: el.dataset.set, digit_w: Math.round(d.getBoundingClientRect().width), digit_h: Math.round(d.getBoundingClientRect().height), max_digits: +el.dataset.digits, align: R.includes(el.dataset.w) ? "right" : "left" });
        if (o.align === "right") o.right_edge_x = o.x + o.w;
        out[el.dataset.w] = o;
      });
      return out;
    }, [[...RIGHT]]);

    // sprite stage: transparent box outside the face
    await p.evaluate(() => { document.body.className = ""; const s = document.createElement("div"); s.id = "stage"; s.style.cssText = "position:absolute;left:0;top:520px;width:410px;container-type:inline-size;background:transparent;color:var(--ink);font-family:\"M PLUS Rounded 1c\",sans-serif"; document.body.appendChild(s); document.getElementById("face").style.visibility = "hidden"; });
    const shot = async (html, file) => {
      await p.evaluate(h => document.getElementById("stage").innerHTML = h, html);
      await (await p.$("#stage > *")).screenshot({ path: path.join(dir, "parts", file), omitBackground: true });
    };
    for (const [set, name] of Object.entries(SETS))
      for (let i = 0; i < 10; i++) await shot(`<span class="num set${set}">${await p.evaluate(([s, c]) => digitBox(s, c), [set, String(i)])}</span>`, `${name}_${i}.png`);
    for (let i = 0; i < 7; i++) await shot(`<span class="sprite setW" style="font-family:'M PLUS Rounded 1c'">${WD[i]}</span>`, `weekday_${i}_${WDN[i]}.png`);
    for (let k = 0; k <= 5; k++) await shot(`<div class="batt" style="margin:0">${[0,1,2,3,4].map(i => `<i class="${i < k ? "on" : ""}"></i>`).join("")}</div>`, `battery_bar_${k}.png`);
    for (let k = 0; k <= 10; k++) await shot(`<div class="meter" style="margin:0"><span style="width:${k * 10}%"></span></div>`, `steps_bar_${String(k * 10).padStart(3, "0")}.png`);
    for (const [ch, nm] of [["-", "minus"]]) await shot(`<span class="num setL"><span class="d" style="width:${await p.evaluate(() => W.L)}px">${ch}</span></span>`, `battery_temp_${nm}.png`);

    await p.evaluate(() => { document.getElementById("stage").remove(); document.getElementById("face").style.visibility = ""; });
    fs.writeFileSync(path.join(dir, "layout.json"), JSON.stringify({ face: "Manga Panel", colorway: way, screen: [410, 502], digit_sets: SETS, widgets: layout }, null, 2));
    console.log(way, "done");
  }
  await b.close();
})();
