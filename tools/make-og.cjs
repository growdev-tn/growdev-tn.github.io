// Regenerates the three social share images (site/assets/img/og-fr.jpg, og-ar.jpg, og-en.jpg) from tools/og.html.
// The address printed on the images is the host of "url" in src/site.json, and each JPEG is tagged with it (see tagJpeg), so that
// tools/check.mjs can tell when the images were made for another address. Run this again whenever "url" changes.
// Needs: npm i playwright && npx playwright install chromium     Run: node tools/make-og.cjs   (or: npm run og)
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "site.json"), "utf8"));
const host = new URL(cfg.url).hostname;
const TAG = `GrowDev share image for ${host}`;   // tools/check.mjs looks for exactly this text

// Adds a JPEG comment (COM) segment right after the JFIF header. It does not change a single pixel; viewers and chat apps ignore it.
function tagJpeg(file, text) {
  const b = fs.readFileSync(file);
  if (b[0] !== 0xff || b[1] !== 0xd8) throw new Error(`${file} is not a JPEG`);
  let at = 2;
  if (b[2] === 0xff && b[3] === 0xe0) at = 4 + b.readUInt16BE(4);   // keep the APP0 (JFIF) segment first, as the format asks
  const body = Buffer.from(text, "latin1");
  const seg = Buffer.concat([Buffer.from([0xff, 0xfe, 0, 0]), body]);
  seg.writeUInt16BE(body.length + 2, 2);
  fs.writeFileSync(file, Buffer.concat([b.subarray(0, at), seg, b.subarray(at)]));
}

(async () => {
  const out = path.join(__dirname, "..", "site", "assets", "img");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  for (const lang of ["fr", "ar", "en"]) {
    await page.goto("file://" + path.join(__dirname, "og.html") + "?lang=" + lang + "&host=" + encodeURIComponent(host));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const file = path.join(out, `og-${lang}.jpg`);
    await page.screenshot({ path: file, type: "jpeg", quality: 92 }); // JPEG: ~120 KB instead of ~470 KB, so WhatsApp and LinkedIn previews load reliably
    tagJpeg(file, TAG);
    console.log(`og-${lang}.jpg written for ${host} (${Math.round(fs.statSync(file).size / 1024)} KB)`);
  }
  await browser.close();
})();
