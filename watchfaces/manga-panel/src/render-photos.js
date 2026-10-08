const { chromium } = require("playwright"); const path = require("path"), fs = require("fs");
(async () => {
  const out = path.join(__dirname, "..", "etsy-photos"); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 1200 }, deviceScaleFactor: 2 });
  await p.goto("file://" + path.join(__dirname, "listing-photos.html")); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
  const names = ["01-hero", "02-colorways", "03-features", "04-neon-night", "05-whats-included", "06-how-it-works"];
  for (let i = 0; i < 6; i++) await (await p.$("#p" + (i + 1))).screenshot({ path: path.join(out, names[i] + ".jpg"), type: "jpeg", quality: 90 });
  await b.close(); console.log("ok");
})();
