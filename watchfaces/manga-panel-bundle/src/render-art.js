// Renders every product image: phone (iPhone, Android), watch background, posters (A-series, 8x10)
const { chromium } = require("playwright"); const path = require("path"), fs = require("fs");
const OUT = path.join(__dirname, "..", "files");
const JOBS = [
  // [folder, file prefix, layout, css w, css h, scale, format]
  ["phone", "iphone-1290x2796", "phone", 1290, 2796, 1, "png"],
  ["phone", "android-1440x3200", "phone", 1440, 3200, 1, "png"],
  ["watch", "watch-410x502", "watch", 410, 502, 1, "png"],
  ["watch", "watch-hd-820x1004", "watch", 410, 502, 2, "png"],
  ["poster", "poster-A4-A3-3508x4960", "poster", 1754, 2480, 2, "jpeg"],
  ["poster", "poster-8x10-2400x3000", "poster", 1200, 1500, 2, "jpeg"],
];
(async () => {
  const b = await chromium.launch();
  for (const scale of [1, 2]) {
    const p = await b.newPage({ viewport: { width: 1800, height: 3300 }, deviceScaleFactor: scale });
    await p.goto("file://" + path.join(__dirname, "art.html")); await p.evaluate(() => window.ready);
    for (const [dir, name, v, w, h, s, fmt] of JOBS.filter(j => j[5] === scale))
      for (const c of ["classic-ink", "sakura", "neon-night"]) {
        fs.mkdirSync(path.join(OUT, dir), { recursive: true });
        await p.evaluate(([v, c, w, h]) => render(v, c, w, h), [v, c, w, h]); await p.waitForTimeout(150);
        const file = path.join(OUT, dir, `manga-panel-${c}-${name}.${fmt === "jpeg" ? "jpg" : "png"}`);
        await (await p.$("#art")).screenshot({ path: file, type: fmt, ...(fmt === "jpeg" ? { quality: 92 } : {}) });
      }
    await p.close();
  }
  await b.close(); console.log("ok");
})();
