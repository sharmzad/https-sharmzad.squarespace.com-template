const { chromium } = require("playwright"); const path = require("path"), fs = require("fs");
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 3400, height: 900 }, deviceScaleFactor: 1 });
  await p.goto("file://" + path.join(__dirname, "art.html")); await p.evaluate(() => window.ready);
  const out = path.join(__dirname, "..", "shop-branding"); fs.mkdirSync(out, { recursive: true });
  for (const [v, w, h, n] of [["banner", 3360, 840, "shop-banner-3360x840.png"], ["icon", 500, 500, "shop-icon-500x500.png"]]) {
    await p.evaluate(([v, w, h]) => render(v, "classic-ink", w, h), [v, w, h]); await p.waitForTimeout(200);
    await (await p.$("#art")).screenshot({ path: path.join(out, n) }); }
  await b.close(); console.log("ok"); })();
