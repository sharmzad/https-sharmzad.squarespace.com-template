// Print-on-demand master files at 300 dpi. Transparent backgrounds where the product needs them.
const { chromium } = require("playwright"); const path = require("path"), fs = require("fs");
const OUT = path.join(__dirname, "..", "pod");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 2400, height: 2800 }, deviceScaleFactor: 3 });
  await p.goto("file://" + path.join(__dirname, "art.html")); await p.evaluate(() => window.ready);
  // [name, layout, css w, css h, transparent]
  const jobs = [
    ["tshirt-front-4500x5400", "tee", 1500, 1800, true],
    ["mug-11oz-wrap-2700x1050", "mug", 900, 350, false],
    ["phone-case-master-1800x3600", "case", 600, 1200, false],
    ["poster-print-A2-4960x7016", "poster", 1654, 2339, false],
  ];
  for (const c of ["classic-ink", "neon-night"]) for (const [n, v, w, h, t] of jobs) {
    await p.evaluate(([v, c, w, h, t]) => { render(v, c, w, h); const a = document.getElementById("art"); if (t) { a.style.background = "transparent"; document.body.style.background = "transparent"; document.documentElement.style.background = "transparent"; } else document.body.style.background = "#000"; }, [v, c, w, h, t]);
    await p.waitForTimeout(200); fs.mkdirSync(OUT, { recursive: true });
    await (await p.$("#art")).screenshot({ path: path.join(OUT, `manga-panel-${c}-${n}.png`), omitBackground: t });
  }
  // stickers: each element alone on transparent, 3x scale of 700px = 2100px
  const stickers = { "sticker-dododo": `<div class="sfx" style="left:50%;top:50%;transform:translate(-50%,-50%) rotate(-8deg);font-size:30cqw;-webkit-text-stroke:2.4cqw #fff;text-shadow:2cqw 2cqw 0 var(--accent)">ドドド</div>`,
    "sticker-ikuzo": `<div class="bubble" style="left:8cqw;top:18cqw;width:84cqw;height:52cqw;font-size:17cqw;border-width:2.4cqw;box-shadow:0 0 0 3cqw #fff">いくぞ!</div>`,
    "sticker-interrobang": `<div class="sfx" style="left:50%;top:50%;transform:translate(-50%,-50%);font-size:70cqw;-webkit-text-stroke:2.6cqw #fff;text-shadow:3cqw 3cqw 0 var(--accent)">!?</div>` };
  for (const [n, html] of Object.entries(stickers)) {
    await p.evaluate(([html]) => { render("icon", "classic-ink", 700, 700); const a = document.getElementById("art"); a.style.background = "transparent"; document.body.style.background = "transparent"; document.documentElement.style.background = "transparent"; a.innerHTML = html; }, [html]);
    await p.waitForTimeout(150);
    await (await p.$("#art")).screenshot({ path: path.join(OUT, `manga-panel-${n}-2100x2100.png`), omitBackground: true });
  }
  await b.close(); console.log("ok");
})();
