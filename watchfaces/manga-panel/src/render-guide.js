const { chromium } = require("playwright"); const path = require("path");
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto("file://" + path.join(__dirname, "install-guide.html")); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  await p.pdf({ path: path.join(__dirname, "..", "Manga-Panel-Install-Guide.pdf"), format: "A4", printBackground: true, preferCSSPageSize: true });
  await b.close(); console.log("ok"); })();
