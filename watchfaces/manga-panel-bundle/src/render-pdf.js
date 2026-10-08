const { chromium } = require("playwright"); const path = require("path");
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto("file://" + path.join(__dirname, "start-here.html")); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  await p.pdf({ path: path.join(__dirname, "..", "files", "Manga-Panel-START-HERE.pdf"), format: "A4", printBackground: true, preferCSSPageSize: true });
  await b.close(); console.log("ok"); })();
