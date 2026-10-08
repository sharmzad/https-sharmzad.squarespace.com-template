const { chromium } = require("playwright"); const path = require("path"), fs = require("fs");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 1200 }, deviceScaleFactor: 2 });
  await p.goto("file://" + path.join(__dirname, "photos.html")); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1500);
  for (const n of await p.evaluate(() => NAMES)) {
    const dir = path.join(__dirname, "..", "etsy-photos", { A: "1-bundle", B: "2-phone-wallpaper", C: "3-poster" }[n[0]]);
    fs.mkdirSync(dir, { recursive: true });
    await (await p.$("#" + n)).screenshot({ path: path.join(dir, n.slice(1) + ".jpg"), type: "jpeg", quality: 90 });
  }
  await b.close(); console.log("ok");
})();
