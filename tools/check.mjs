#!/usr/bin/env node
// GrowDev site checker — zero dependencies (Node 18+). Run after `node tools/build.mjs`; CI runs both before every deploy.
// It checks what search engines, AI assistants and visitors depend on: metadata, hreflang, structured data, FAQ parity,
// links and assets, CSP, sitemap / robots / llms.txt, the Tunisia-first signals, the client logo wall and size budgets.
// Usage: node tools/check.mjs [--site DIR]. Exit code 1 when anything fails; warnings do not fail the run.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { FAQ_COUNT, SERVICES, SITUATIONS, DEV_AREAS, pageUrl, AI_SEARCH, AI_TRAINING } from "./seo.mjs";
import { imageSize } from "./imgsize.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteArg = process.argv.indexOf("--site");
const SITE = siteArg > -1 ? path.resolve(process.argv[siteArg + 1]) : path.join(ROOT, "site"); // --site DIR: check another build (used to test the checker itself)
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "src/site.json"), "utf8"));
const origin = cfg.url;
const hostname = new URL(origin).hostname;
const PROFILES = cfg.profiles && typeof cfg.profiles === "object" ? cfg.profiles : {};   // the developer's public profiles (src/site.json); an empty one is left out of the page
const CLIENTS = Array.isArray(cfg.clients) ? cfg.clients : [];   // the logo wall (src/site.json); the build ignores anything that is not a list, so does the checker
const DICT = Object.fromEntries(cfg.langs.map((L) => [L.code, JSON.parse(fs.readFileSync(path.join(ROOT, "src/i18n", `${L.code}.json`), "utf8"))]));   // the three source dictionaries: the texts the pages are built from

// Budgets (gzip, per page). Generous on purpose: they exist to catch accidents, not to police every byte.
const BUDGET = { htmlKB: 45, cssKB: 22, jsKB: 30, ogKB: 200, logoKB: 40, logoMinPx: 200, titleMax: 65, titleMin: 20, descMax: 165, descMin: 70 };

const fails = [], warns = [];
let passed = 0;
function check(cond, msg, level = "fail") {
  if (cond) passed++;
  else (level === "warn" ? warns : fails).push(msg);
  return !!cond;
}
const read = (rel) => fs.readFileSync(path.join(SITE, rel), "utf8");
const has = (rel) => fs.existsSync(path.join(SITE, rel));
const gzKB = (buf) => zlib.gzipSync(buf, { level: 9 }).length / 1024;
const kb = (n) => n.toFixed(1) + " KB";

// ---------- small HTML helpers (the pages are generated, so their markup is predictable) ----------
const ENT = { "&amp;": "&", "&quot;": '"', "&lt;": "<", "&gt;": ">", "&#39;": "'", "&#x27;": "'", "&nbsp;": " " };
const decode = (s) => s.replace(/&(amp|quot|lt|gt|#39|#x27|nbsp);/g, (m) => ENT[m]);
const flat = (s) => s.replace(/[  \s]+/g, " ").trim();
const textOf = (s) => flat(decode(s.replace(/<[^>]+>/g, " ")));
const parseAttrs = (tag) => {
  const o = {}, body = tag.replace(/^<\w+/, "").replace(/\/?>$/, "");
  for (const m of body.matchAll(/\s([^\s=]+)(?:="([^"]*)")?/g)) o[m[1]] = m[2] === undefined ? "" : decode(m[2]);
  return o;
};
const idsOf = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
// Money. The price of a project depends on the client and on how complex the project is, so the site never states an amount: no hourly cost, no
// "from 500 DT", no price in the structured data. An amount is a number written next to a currency (30 DT, 1 200 TND, €20, 20 $, 15 د.ت, 10 euros).
// A currency named without an amount stays fine ("quote in DT, € or $"). The unit must be a whole word, so "5 days" or "10 DAYS" is not "10 DA".
const CURRENCY = "DT|TND|DH|MAD|DA|DZD|EGP|XOF|EUR|USD|F\\s?CFA|[Dd]inars?|[Dd]irhams?|[Ee]uros?|[Dd]ollars?|[Pp]ounds?|€|\\$|د\\.ت|د\\.م|د\\.ج|ج\\.م|دينار|دينارًا|دولار|يورو|درهم|جنيه";
const AMOUNT = new RegExp(`(?<![\\p{L}\\p{N}])\\d[\\d\\s.,\\u00a0\\u202f]*\\s?(?:${CURRENCY})(?![\\p{L}\\p{N}])|[€$]\\s?\\d`, "u");
const amountIn = (s) => (AMOUNT.exec(s) || [])[0];
const withoutCode = (html) => html.replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/gi, " ");   // what a visitor reads and what attributes say; not scripts, styles or drawings
const PRICE_KEYS = /^(?:price\w*|lowPrice|highPrice|minPrice|maxPrice)$/;   // schema.org keys that would put a price into the structured data (price, priceRange, priceCurrency, priceSpecification, ...)
const idCache = new Map();
const pageIds = (rel) => { if (!idCache.has(rel)) idCache.set(rel, idsOf(read(rel))); return idCache.get(rel); };

// Resolve a reference found in `pageRel` to a file inside site/. Returns { external } or { file, hash }.
function resolveRef(pageRel, ref) {
  if (/^(mailto:|tel:|data:)/i.test(ref)) return { skip: true };
  let u;
  try { u = new URL(ref, origin + "/" + pageRel); } catch (e) { return { bad: true }; }
  if (u.origin !== origin) return { external: true, url: u.href };
  let p = decodeURIComponent(u.pathname);
  if (p.endsWith("/")) p += "index.html";
  return { file: p.slice(1), hash: u.hash.slice(1) };
}

// Asset versions (see tools/build.mjs): every stylesheet, script and client logo is requested as "file?v=<first 8 hex digits of its SHA-256>", so a
// browser that cached the old file can never be paired with a new page. A missing or stale version is a failure: it means the build was not run.
const sha8 = (file) => crypto.createHash("sha256").update(fs.readFileSync(path.join(SITE, file))).digest("hex").slice(0, 8);
const VERSIONED = /^assets\/(?:css\/[\w.-]+\.css|js\/[\w.-]+\.js|img\/clients\/[\w.-]+|img\/tech\/[\w.-]+)$/;
function checkVersion(where, ref, r) {
  if (!r || !r.file || !VERSIONED.test(r.file) || !has(r.file)) return;
  const v = (/(?:^|&)v=([0-9a-f]+)(?:&|$)/.exec(ref.split("#")[0].split("?")[1] || "") || [])[1], now = sha8(r.file);
  check(v === now, `${where}: ${ref} ${v ? `carries the version ?v=${v} but the file now hashes to ${now}` : "has no ?v= version"}. Run node tools/build.mjs (it writes the versions that stop a browser from mixing a new page with an old cached file)`);
}

function jpegSize(file) {
  const b = fs.readFileSync(file);
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

// The text of every JPEG comment (COM) segment before the image data. tools/make-og.cjs writes "GrowDev share image for <host>" there.
function jpegComments(b) {
  const out = [];
  if (b[0] !== 0xff || b[1] !== 0xd8) return out;
  let i = 2;
  while (i + 4 <= b.length && b[i] === 0xff && b[i + 1] !== 0xda) {
    const len = b.readUInt16BE(i + 2);
    if (b[i + 1] === 0xfe) out.push(b.subarray(i + 4, i + 2 + len).toString("latin1"));
    i += 2 + len;
  }
  return out;
}

// ---------- per-page checks ----------
const pages = [];
const techUsed = new Set();   // ids of the technology logos the pages really show (checked against the files below)
const TECH_FILES = has("assets/img/tech") ? fs.readdirSync(path.join(SITE, "assets/img/tech")).filter((f) => f.endsWith(".svg")).sort() : [];
const seen = { title: new Map(), desc: new Map(), cx: { role: new Map(), pause: new Map(), play: new Map(), prev: new Map(), next: new Map() } };   // cx: the carousel's spoken labels, per language

function checkPage(L) {
  const rel = L.path === "/" ? "index.html" : L.path.slice(1) + "index.html";
  const tag = `[${L.code}]`;
  if (!check(has(rel), `${tag} ${rel} is missing`)) return;
  const html = read(rel);
  const head = html.slice(html.indexOf("<head"), html.indexOf("</head>"));
  const body = html.slice(html.indexOf("<body"));
  const metas = [...head.matchAll(/<meta\b[^>]*>/g)].map((m) => parseAttrs(m[0]));
  const links = [...head.matchAll(/<link\b[^>]*>/g)].map((m) => parseAttrs(m[0]));
  const meta = (k) => (metas.find((a) => a.name === k || a.property === k) || {}).content;
  const url = pageUrl(cfg, L.code);

  // document basics
  check(/^<!doctype html>/i.test(html), `${tag} missing <!doctype html>`);
  const htmlTag = parseAttrs(html.match(/<html\b[^>]*>/)[0]);
  check(htmlTag.lang === L.code, `${tag} <html lang> is "${htmlTag.lang}", expected "${L.code}"`);
  check(htmlTag.dir === L.dir, `${tag} <html dir> is "${htmlTag.dir}", expected "${L.dir}"`);
  check(metas.some((a) => a.charset), `${tag} missing <meta charset>`);
  check((meta("viewport") || "").includes("width=device-width"), `${tag} missing responsive viewport meta`);
  check(!!meta("theme-color"), `${tag} missing theme-color`, "warn");
  check(meta("robots") === undefined || !/noindex/i.test(meta("robots")), `${tag} page is set to noindex`);

  // title + description
  const title = textOf((head.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
  const desc = meta("description") || "";
  check(title.length >= BUDGET.titleMin && title.length <= BUDGET.titleMax, `${tag} title is ${title.length} characters (want ${BUDGET.titleMin}-${BUDGET.titleMax}): "${title}"`);
  check(desc.length >= BUDGET.descMin && desc.length <= BUDGET.descMax, `${tag} description is ${desc.length} characters (want ${BUDGET.descMin}-${BUDGET.descMax})`);
  check(/GrowDev/.test(title), `${tag} title does not contain the brand name`);
  seen.title.set(title, [...(seen.title.get(title) || []), L.code]);
  seen.desc.set(desc, [...(seen.desc.get(desc) || []), L.code]);
  check(/(Tunisie|Tunisia|تونس)/.test(title + " " + desc), `${tag} title/description do not mention Tunisia (Tunisia-first positioning)`);

  // canonical + hreflang
  const canon = links.filter((a) => a.rel === "canonical");
  check(canon.length === 1 && canon[0].href === url, `${tag} canonical should be exactly ${url} (found: ${canon.map((c) => c.href).join(", ") || "none"})`);
  const alts = links.filter((a) => a.rel === "alternate" && a.hreflang);
  const want = { ...Object.fromEntries(cfg.langs.map((l) => [l.code, pageUrl(cfg, l.code)])), "x-default": pageUrl(cfg, cfg.xDefault) };
  for (const [code, href] of Object.entries(want)) {
    const found = alts.filter((a) => a.hreflang === code);
    check(found.length === 1 && found[0].href === href, `${tag} hreflang="${code}" should point to ${href} (found: ${found.map((f) => f.href).join(", ") || "none"})`);
  }
  check(alts.length === Object.keys(want).length, `${tag} unexpected number of hreflang links (${alts.length})`);

  // Open Graph / Twitter
  check(meta("og:url") === url, `${tag} og:url should be ${url}`);
  check(meta("og:locale") === L.ogLocale, `${tag} og:locale should be ${L.ogLocale}`);
  check(flat(meta("og:title") || "") === title, `${tag} og:title differs from <title>`);
  check(flat(meta("og:description") || "") === flat(desc), `${tag} og:description differs from the meta description`);
  const alternates = metas.filter((a) => a.property === "og:locale:alternate").map((a) => a.content).sort().join(",");
  const wantAlt = cfg.langs.filter((o) => o.code !== L.code).map((o) => o.ogLocale).sort().join(",");
  check(alternates === wantAlt, `${tag} og:locale:alternate should be ${wantAlt} (found ${alternates})`);
  const og = meta("og:image") || "";
  check(og.startsWith(origin + "/"), `${tag} og:image must be an absolute URL on ${origin}`);
  check(meta("twitter:image") === og && meta("twitter:card") === "summary_large_image", `${tag} twitter card should reuse og:image with summary_large_image`);
  check(!!meta("og:image:alt") && meta("twitter:image:alt") === meta("og:image:alt"), `${tag} og/twitter image alt text missing`);
  const ogRel = og.replace(origin + "/", "");
  if (check(has(ogRel), `${tag} og:image file is missing: ${ogRel}`)) {
    const dim = jpegSize(path.join(SITE, ogRel));
    check(dim && dim.w === 1200 && dim.h === 630, `${tag} ${ogRel} should be a 1200x630 JPEG (found ${dim ? dim.w + "x" + dim.h : "not a JPEG"})`);
    const size = fs.statSync(path.join(SITE, ogRel)).size / 1024;
    check(size <= BUDGET.ogKB, `${tag} ${ogRel} is ${kb(size)} (budget ${BUDGET.ogKB} KB: heavier images are skipped by some chat apps)`, "warn");
    // The image prints the site's address. tools/make-og.cjs tags each JPEG with the host it was made for, so a stale image is caught here.
    check(jpegComments(fs.readFileSync(path.join(SITE, ogRel))).includes(`GrowDev share image for ${hostname}`), `${tag} ${ogRel} was not made for ${hostname}, so it prints another address. Run npm run og (it needs Playwright) after changing "url" in src/site.json, then run the build`);
  }
  check(meta("geo.region") === "TN", `${tag} geo.region should be TN`);

  // headings: one h1, no skipped levels
  const heads = [...body.matchAll(/<h([1-6])\b/g)].map((m) => +m[1]);
  check(heads.filter((h) => h === 1).length === 1, `${tag} expected exactly one <h1>, found ${heads.filter((h) => h === 1).length}`);
  let prev = 0, skipped = false;
  for (const h of heads) { if (h > prev + 1) skipped = true; prev = h; }
  check(!skipped, `${tag} heading levels skip a level (outline: ${heads.join(" ")})`);

  // structured data
  const ldRaw = (html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1];
  let ld = null;
  try { ld = JSON.parse(ldRaw); } catch (e) { /* reported below */ }
  if (check(ld && Array.isArray(ld["@graph"]), `${tag} JSON-LD is missing or invalid`)) {
    const graph = ld["@graph"], ids = new Set(graph.map((n) => n["@id"]));
    const types = (n) => [].concat(n["@type"]);
    const byType = (t) => graph.filter((n) => types(n).includes(t));
    check(byType("Organization").length === 1 && types(byType("Organization")[0]).includes("ProfessionalService"), `${tag} JSON-LD needs one Organization + ProfessionalService node`);
    check(byType("WebSite").length === 1 && byType("WebPage").length === 1 && byType("Person").length === 1, `${tag} JSON-LD needs WebSite, WebPage and Person (founder) nodes`);
    check(byType("Service").length === SERVICES.length, `${tag} JSON-LD should describe ${SERVICES.length} services (found ${byType("Service").length})`);
    // every {"@id": ...} reference must point at a node of the graph
    const dangling = [];
    (function walk(v) {
      if (Array.isArray(v)) return v.forEach(walk);
      if (v && typeof v === "object") {
        const k = Object.keys(v);
        if (k.length === 1 && k[0] === "@id") { if (!ids.has(v["@id"])) dangling.push(v["@id"]); } else Object.values(v).forEach(walk);
      }
    })(graph.map((n) => { const c = { ...n }; delete c["@id"]; return c; }));
    check(dangling.length === 0, `${tag} JSON-LD references unknown @id: ${[...new Set(dangling)].join(", ")}`);
    const org = byType("Organization")[0] || {};
    const area = JSON.stringify(org.areaServed || []);
    check(/Tunisia/.test(area) && /Africa/.test(area) && /Worldwide/.test(area), `${tag} areaServed should list Tunisia, Africa and Worldwide`);
    check(JSON.stringify(org.knowsLanguage) === JSON.stringify(cfg.langs.map((l) => l.code)), `${tag} knowsLanguage should list ${cfg.langs.map((l) => l.code).join(", ")}`);
    check((byType("WebPage")[0] || {}).inLanguage === L.code, `${tag} WebPage.inLanguage should be ${L.code}`);
    // each service points at an anchor that exists on this page
    const idsHere = idsOf(html);
    for (const s of byType("Service")) {
      const hash = (s.url || "").split("#")[1];
      check(s.url && s.url.startsWith(url) && idsHere.has(hash), `${tag} service "${s.name}" links to a missing anchor (${s.url})`);
    }
    // FAQ: the structured data must say exactly what the page says
    const faq = byType("FAQPage")[0];
    const visible = [...body.matchAll(/<details class="qa"[^>]*>\s*<summary>\s*<h3[^>]*>([\s\S]*?)<\/h3>\s*<\/summary>\s*<div class="qa__a">([\s\S]*?)<\/div>\s*<\/details>/g)]
      .map((m) => ({ q: textOf(m[1]), a: textOf(m[2]) }));
    check(visible.length === FAQ_COUNT, `${tag} expected ${FAQ_COUNT} visible FAQ items, found ${visible.length}`);
    if (check(faq && faq.mainEntity && faq.mainEntity.length === visible.length, `${tag} FAQPage should list the same ${visible.length} questions as the page`)) {
      faq.mainEntity.forEach((q, i) => {
        check(flat(q.name) === visible[i].q, `${tag} FAQ question ${i + 1} differs between page and JSON-LD`);
        check(flat(q.acceptedAnswer.text) === visible[i].a, `${tag} FAQ answer ${i + 1} differs between page and JSON-LD`);
        check(!/<[a-z]/i.test(q.acceptedAnswer.text), `${tag} FAQ answer ${i + 1} contains HTML in JSON-LD`);
      });
    }
    check(visible.every((v) => /[?؟]$/.test(v.q)), `${tag} every FAQ heading should be phrased as a question (ends with ? or ؟)`, "warn");
    // answer-first: the first sentence says the answer in full, so a search snippet, a voice assistant or llms.txt can quote it on its own ("Yes." alone says nothing)
    visible.forEach((v, i) => {
      const lead = (v.a.match(/^.+?[.!?؟](\s|$)/) || [v.a])[0].trim();
      check(lead.split(/\s+/).length >= 5, `${tag} FAQ answer ${i + 1} should open with a sentence that answers on its own, not "${lead}": a snippet or an assistant may quote only that sentence`);
    });
    // no price in the structured data: the price depends on the client and on the complexity of the project
    const priced = [], amounts = [];
    (function walk(v) {
      if (Array.isArray(v)) return v.forEach(walk);
      if (v && typeof v === "object") { for (const [k, x] of Object.entries(v)) { if (PRICE_KEYS.test(k)) priced.push(k); walk(x); } return; }
      if (typeof v === "string" && amountIn(v)) amounts.push(amountIn(v));
    })(graph);
    check(priced.length === 0, `${tag} JSON-LD states a price (${[...new Set(priced)].join(", ")}): the price depends on the client and on the complexity of the project, so none is published`);
    check(amounts.length === 0, `${tag} JSON-LD contains an amount of money ("${amounts[0]}")`);
  }

  // no price anywhere on the page: not in the text, not in an attribute, not in a meta tag
  const money = amountIn(decode(withoutCode(html)));
  check(!money, `${tag} the page states an amount ("${money}"): the price of a project depends on the client and on the complexity of the project, so no figure is published`);
  check(!/\sid="(?:s-rate|s-cur|r-value|r-rate)"|\b(?:sim__cost|res__money|res__value|res__rate)\b/.test(html), `${tag} the simulator still carries its hourly-cost / currency controls (#s-rate, #s-cur, #r-value, #r-rate): it turns hours into hours only`);

  // answer-engine structure: facts block + FAQ section
  check(/class="facts"[\s\S]*?<dl\b/.test(body) && (body.match(/<dt\b/g) || []).length >= 5, `${tag} the "GrowDev at a glance" facts block (<dl> with at least 5 <dt>) is missing`);
  check(/<section[^>]*id="faq"/.test(body), `${tag} FAQ section #faq is missing`);

  // language switcher
  const sw = [...body.matchAll(/<a\b[^>]*data-lang="(\w+)"[^>]*>/g)].map((m) => parseAttrs(m[0]));
  check(sw.length === cfg.langs.length, `${tag} language switcher should have ${cfg.langs.length} links`);
  check(sw.filter((a) => a["aria-current"] === "page").map((a) => a["data-lang"]).join() === L.code, `${tag} language switcher should mark ${L.code} as the current page`);
  check(sw.every((a) => a.hreflang === a["data-lang"] && a.lang === a["data-lang"]), `${tag} language links need matching hreflang and lang attributes`);

  // links, images, scripts: everything local must exist; nothing may come from another host
  const refs = [];
  for (const m of html.matchAll(/<(a|link|script|img|source|iframe)\b[^>]*>/g)) {
    const a = parseAttrs(m[0]);
    const r = m[1] === "a" || m[1] === "link" ? a.href : a.src;
    if (r) refs.push({ el: m[1], ref: r, a });
  }
  for (const m of body.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
    const a = parseAttrs(`<${m[1]}${m[2]}>`);
    const named = textOf(m[3]) || a["aria-label"] || a.title || /<img[^>]*\salt="[^"]+"/.test(m[3]);
    check(named, `${tag} <${m[1]}> without an accessible name: ${m[0].slice(0, 90).replace(/\s+/g, " ")}`);
  }
  for (const { el, ref, a } of refs) {
    if (el === "link" && ["canonical", "alternate"].includes(a.rel)) continue; // metadata URLs are checked above
    const r = resolveRef(rel, ref);
    if (r.skip) continue;
    if (!check(!r.bad, `${tag} unparsable reference "${ref}"`)) continue;
    if (r.external) {
      const resource = el !== "a" && !(el === "link" && a.rel === "preconnect");
      check(!resource, `${tag} <${el}> loads a resource from another host (${ref}); the CSP only allows this site`);
      continue;
    }
    if (!check(has(r.file), `${tag} <${el}> points to a missing file: ${ref}`)) continue;
    if (el === "link" || el === "script") checkVersion(tag, ref, r);
    if (r.hash && r.file.endsWith(".html")) check(pageIds(r.file).has(r.hash), `${tag} anchor #${r.hash} does not exist in ${r.file} (from ${ref})`);
  }
  for (const m of body.matchAll(/<img\b[^>]*>/g)) {
    const a = parseAttrs(m[0]);
    check("alt" in a, `${tag} <img> without alt: ${m[0].slice(0, 80)}`);
    check(a.width && a.height, `${tag} <img> without width/height (layout shift): ${a.src}`, "warn");
    // the attributes give the picture its shape before it loads; with a wrong ratio the picture is drawn stretched
    const ir = a.src ? resolveRef(rel, a.src) : {}, real = ir.file && has(ir.file) ? imageSize(path.join(SITE, ir.file)) : null;
    if (real && a.width && a.height) check(Math.abs(a.width / a.height / (real.w / real.h) - 1) <= 0.02, `${tag} <img src="${a.src}"> says ${a.width}x${a.height} but the file is ${real.w}x${real.h}: the picture would be stretched`);
  }

  // clients: the logo wall shows exactly the clients listed in src/site.json, in the same order, each logo with the client's name as alt text and the true size of its file
  {
    const CL = CLIENTS;
    const open = (body.match(/<section\b[^>]*\sid="clients"[^>]*>/) || [])[0];
    if (!CL.length) check(!open, `${tag} the page has a #clients section but src/site.json lists no clients`);
    else if (check(!!open, `${tag} the #clients section is missing (src/site.json lists ${CL.length} client${CL.length > 1 ? "s" : ""})`)) {
      const sec = body.slice(body.indexOf(open)).split("</section>")[0];
      const h2id = (sec.match(/<h2\b[^>]*\sid="([^"]+)"/) || [])[1];
      check(!!h2id && parseAttrs(open)["aria-labelledby"] === h2id, `${tag} #clients must be labelled by its own <h2> (aria-labelledby = the id of the heading)`);
      check((sec.match(/<li\b/g) || []).length === CL.length, `${tag} #clients has ${(sec.match(/<li\b/g) || []).length} list item(s) but src/site.json lists ${CL.length} client(s)`);
      const logos = [...sec.matchAll(/<li\b[^>]*class="client"[^>]*>\s*(<img\b[^>]*>)\s*<\/li>/g)].map((m) => parseAttrs(m[1]));
      if (check(logos.length === CL.length, `${tag} #clients shows ${logos.length} logo(s) but src/site.json lists ${CL.length}`)) CL.forEach((c, i) => {
        const a = logos[i], n = `${tag} client "${c.name}"`, cr = resolveRef(rel, a.src || "");
        check(a.alt === c.name, `${n}: the logo's alt text is "${a.alt}"; it should be the client's name (position ${i + 1} must match src/site.json)`);
        if (check(!!cr.file && cr.file.startsWith("assets/img/clients/") && has(cr.file), `${n}: the logo file is missing or is not in assets/img/clients/ (${a.src})`)) {
          const real = imageSize(path.join(SITE, cr.file));
          if (check(!!real, `${n}: the size of ${cr.file} cannot be read (PNG, JPEG, WebP, GIF or SVG expected)`)) {
            check(+a.width === real.w && +a.height === real.h, `${n}: width/height are ${a.width}x${a.height} but ${cr.file} is ${real.w}x${real.h}: the logo would be stretched. Run node tools/build.mjs`);
            check(Math.max(real.w, real.h) >= BUDGET.logoMinPx, `${n}: ${cr.file} is only ${real.w}x${real.h} px; under ${BUDGET.logoMinPx} px on its longest side it looks soft on a retina screen. Ask for a larger file or an SVG`, "warn");
          }
          checkVersion(n, a.src, cr);
          const size = fs.statSync(path.join(SITE, cr.file)).size / 1024;
          check(size <= BUDGET.logoKB, `${n}: ${cr.file} is ${kb(size)} (budget ${BUDGET.logoKB} KB per logo). Export it again as WebP`);
        }
        check(a.loading === "lazy" && a.decoding === "async", `${n}: the logo needs loading="lazy" decoding="async" (the wall is far below the first screen)`);
        const wantLang = c.lang && c.lang !== L.code ? c.lang : undefined;
        check(a.lang === wantLang, `${n}: lang is ${a.lang ? `"${a.lang}"` : "not set"} but ${wantLang ? `"${wantLang}"` : "no lang attribute"} is expected (a name written in another language than the page needs lang, so a screen reader pronounces it correctly)`);
      });
      // the carousel around the logos (assets/js/carousel.js makes it move; without JavaScript the same markup is the plain wall)
      const noteCx = (k, v) => seen.cx[k].set(v, [...(seen.cx[k].get(v) || []), L.code]);
      const car = (sec.match(/<div\b[^>]*\sdata-carousel(?=[\s>])[^>]*>/) || [])[0];
      if (check(!!car, `${tag} #clients has no carousel (<div data-carousel>) around the logos`)) {
        const ca = parseAttrs(car);
        check(ca.role === "group" && ca["aria-labelledby"] === h2id, `${tag} the carousel needs role="group" and aria-labelledby pointing at the section heading: that is its name`);
        check(!!ca["aria-roledescription"] && ca["aria-roledescription"].trim().length >= 3, `${tag} the carousel needs an aria-roledescription written in the page's language (a screen reader says it instead of "group")`);
        noteCx("role", (ca["aria-roledescription"] || "").trim());
        check(!/<li\b[^>]*class="client"[^>]*\sdata-reveal/.test(sec), `${tag} a logo plate carries data-reveal: the reveal moves it with a transform, and the carousel owns the plates' transform`);
        const iView = sec.indexOf('class="carousel__viewport"'), iUl = sec.indexOf('<ul class="clients">'), iBar = sec.indexOf('class="carousel__bar"');
        check(iView > -1 && iUl > iView && iBar > iUl, `${tag} the carousel must hold, in this order: .carousel__viewport (with <ul class="clients"> inside it), then .carousel__bar`);
        check(/<div\b[^>]*class="carousel__dots"[^>]*\saria-hidden="true"/.test(sec), `${tag} the dots (.carousel__dots) must be aria-hidden="true": they only show where the belt is; a screen reader gets the list of logos instead`);
        const btns = ["play", "prev", "next"].map((k) => { const m = sec.match(new RegExp(`<button\\b[^>]*class="carousel__btn carousel__btn--${k}"[^>]*>[\\s\\S]*?</button>`)); return { k, html: m ? m[0] : "", at: m ? m.index : -1 }; });
        if (check(btns.every((b) => b.at > -1), `${tag} the carousel bar needs three buttons: .carousel__btn--play, .carousel__btn--prev and .carousel__btn--next`)) {
          check(btns[0].at < btns[1].at && btns[1].at < btns[2].at, `${tag} the carousel buttons must come in the order Pause/Play, Previous, Next (Pause first: a keyboard user reaches it before anything moves under them)`);
          for (const b of btns) {
            const a = parseAttrs((b.html.match(/^<button\b[^>]*>/) || [""])[0]);
            check(a.type === "button", `${tag} carousel button "${b.k}" needs type="button"`);
            check(!!a["aria-label"] && a["aria-label"].trim().length >= 3, `${tag} carousel button "${b.k}" has no accessible name (aria-label)`);
            noteCx(b.k === "play" ? "pause" : b.k, (a["aria-label"] || "").trim());
            const svgs = b.html.match(/<svg\b[^>]*>/g) || [];
            check(svgs.length > 0 && svgs.every((x) => /\saria-hidden="true"/.test(x)), `${tag} the icons inside carousel button "${b.k}" must be aria-hidden="true" (the button's own label is its name)`);
            if (b.k === "play") {
              check(!!a["data-pause"] && !!a["data-play"] && a["data-pause"] !== a["data-play"], `${tag} the Pause/Play button needs two different labels in data-pause and data-play (the script swaps its aria-label between them)`);
              check(a["aria-label"] === a["data-pause"], `${tag} the Pause/Play button starts as Pause: its aria-label must equal data-pause`);
              noteCx("play", (a["data-play"] || "").trim());
            }
          }
        }
        for (const id of ["i-arrow", "i-pause", "i-play"]) check(new RegExp(`<symbol\\b[^>]*\\sid="${id}"`).test(html), `${tag} the carousel buttons use #${id}, which is missing from the SVG sprite`);
      }
    }
  }
  // who the page speaks to: situations, technology logos, developer profile, contact doors, footer credits ----------------------------------
  // A visitor with no IT knowledge must find their own problem in the first screens (#situations); a recruiter must find the technical profile (#developpeur).
  {
    const idsHere = idsOf(html);
    const section = (id) => {
      const open = (body.match(new RegExp(`<section\\b[^>]*\\sid="${id}"[^>]*>`)) || [])[0];
      return open ? { open, html: body.slice(body.indexOf(open)).split("</section>")[0] } : null;
    };
    const ownHeading = (sec, name) => {
      const h2id = (sec.html.match(/<h2\b[^>]*\sid="([^"]+)"/) || [])[1];
      check(!!h2id && parseAttrs(sec.open)["aria-labelledby"] === h2id, `${tag} #${name} must be labelled by its own <h2> (aria-labelledby = the id of the heading)`);
    };
    const at = (id) => body.indexOf(`id="${id}"`);

    // the first screen leads to both audiences
    const hero = (body.match(/<section\b[^>]*class="hero"[^>]*>[\s\S]*?<\/section>/) || [])[0] || "";
    check(/<a\b[^>]*\shref="#situations"/.test(hero), `${tag} the hero must lead to #situations ("Find my solution"): that is where a visitor with no IT knowledge recognises their problem`);
    check(/<a\b[^>]*\shref="#developpeur"/.test(hero), `${tag} the hero must offer the technical profile (#developpeur) to recruiters and technical teams`);

    // situations
    const sit = section("situations");
    if (check(!!sit, `${tag} the #situations section is missing: it is where a visitor who does not know IT recognises their own problem`)) {
      ownHeading(sit, "situations");
      const rows = [...sit.html.matchAll(/<a\b([^>]*)class="pick"([^>]*)>([\s\S]*?)<\/a>/g)];
      check(rows.length === SITUATIONS.length, `${tag} #situations has ${rows.length} row(s); SITUATIONS in tools/seo.mjs lists ${SITUATIONS.length}`);
      SITUATIONS.forEach(({ n, anchor }, i) => {
        const r = rows[i]; if (!r) return;
        const a = parseAttrs(`<a${r[1]}${r[2]}>`), inner = r[3];
        const q = textOf((inner.match(/class="pick__q"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || "");
        const t = textOf((inner.match(/<b\b[^>]*>([\s\S]*?)<\/b>/) || [])[1] || "");
        const p = textOf((inner.match(/class="pick__a"[^>]*>([\s\S]*?)<\/span><svg/) || [])[1] || "").replace(t, "").trim();
        check(a.href === `#${anchor}` && idsHere.has(anchor), `${tag} situation ${n} should lead to #${anchor}, which must exist on the page (found href="${a.href}")`);
        check(q.length >= 25 && t.length >= 5 && p.length >= 25, `${tag} situation ${n}: the visitor's sentence, the answer's title and its explanation must all be written (found ${q.length}, ${t.length} and ${p.length} characters)`);
        check(/<svg\b[^>]*\saria-hidden="true"/.test(inner), `${tag} situation ${n}: the arrow icon must be aria-hidden="true"`);
      });
      check(at("clients") < at("situations") && at("situations") < at("services"), `${tag} section order: #clients, then #situations, then #services`);
    }

    // the simulator explains itself: help under each control, the formula in words, one calm sentence for screen readers
    const sim = section("simulateur");
    if (check(!!sim, `${tag} the #simulateur section is missing`)) {
      for (const id of ["sim-form", "s-people", "s-hours", "s-share", "o-people", "o-hours", "o-share", "r-hours", "r-days", "e-people", "e-hours", "e-share", "e-total", "sbars", "sim-cap", "sim-fine", "sim-say"])
        check(idsHere.has(id), `${tag} the simulator needs #${id} (assets/js/calculator.js writes into it)`);
      check(!/<details\b/.test(sim.html), `${tag} the simulator hides something in a <details>: its controls and its result stay visible`);
      for (const id of ["s-people", "s-hours", "s-share"]) {
        const field = (sim.html.match(new RegExp(`<input\\b[^>]*\\sid="${id}"[^>]*>`)) || [])[0];
        const d = field && parseAttrs(field)["aria-describedby"];
        const help = d ? textOf((sim.html.match(new RegExp(`\\sid="${d}"[^>]*>([\\s\\S]*?)</p>`)) || [])[1] || "") : "";
        check(help.length >= 15, `${tag} #${id} needs a help line (aria-describedby pointing at a <p> with a sentence): visitors who do not work in IT must know what to enter`);
      }
      const say = (sim.html.match(/<p\b[^>]*\sid="sim-say"[^>]*>/) || [""])[0];
      check(/\srole="status"/.test(say) && /\saria-live="polite"/.test(say) && /\bsr-only\b/.test(say), `${tag} #sim-say must be class="sr-only" role="status" aria-live="polite": it is the one sentence a screen reader gets, a moment after the visitor stops moving a control`);
      check(!/aria-live/.test((sim.html.match(/<[^>]*\sid="r-(?:hours|days)"[^>]*>/g) || []).join("")), `${tag} the animated numbers (#r-hours, #r-days) must not be live regions: they change on every frame and a screen reader would read each step`);
      const ops = sim.html.match(/<span class="eq__op"[^>]*>/g) || [];
      check(ops.length === 4 && ops.every((o) => /\saria-hidden="true"/.test(o)), `${tag} the formula needs its four signs (x x x =), each aria-hidden="true"`);
      // the formula written on the page is the formula the script uses
      const weeksText = (sim.html.match(/<b data-i18n="sim\.weeks">([^<]+)<\/b>/) || [])[1] || "";
      const weeksJs = (read("assets/js/calculator.js").match(/\bWEEKS\s*=\s*([\d.]+)/) || [])[1] || "";
      check(weeksText !== "" && parseFloat(weeksText.replace(",", ".")) === parseFloat(weeksJs), `${tag} the formula says "${weeksText}" weeks per month but assets/js/calculator.js uses ${weeksJs || "?"}: the page would show one calculation and run another`);
      check(textOf((sim.html.match(/\sid="sim-fine"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || "").includes(weeksText), `${tag} the fine print under the result should repeat the ${weeksText} weeks per month used in the formula`);
    }

    // developer profile
    const dev = section("developpeur");
    if (check(!!dev, `${tag} the #developpeur section ("Who writes the code?") is missing: recruiters and technical teams look for it`)) {
      ownHeading(dev, "developpeur");
      check((dev.html.match(/<dt\b/g) || []).length === DEV_AREAS.length, `${tag} #developpeur should describe ${DEV_AREAS.length} areas (one <dt> each; DEV_AREAS in tools/seo.mjs)`);
      const dds = [...dev.html.matchAll(/<dd>([\s\S]*?)<\/dd>/g)].map((m) => m[1]);
      check(dds.length === DEV_AREAS.length && dds.every((d) => /<ul class="tags"[^>]*\saria-label="[^"]+"/.test(d) && /<li class="tech/.test(d)), `${tag} every area of #developpeur needs its list of technologies, with logos and an aria-label`);
      const ext = [...dev.html.matchAll(/<a\b[^>]*\shref="(https?:[^"]+)"[^>]*>/g)].map((m) => parseAttrs(m[0]));
      const wantExt = [cfg.repo, PROFILES.github, PROFILES.linkedin].filter(Boolean);
      check(JSON.stringify(ext.map((a) => a.href)) === JSON.stringify(wantExt), `${tag} #developpeur should link to exactly the addresses set in src/site.json ("repo", "profiles.github", "profiles.linkedin"; an empty one is left out). Found: ${ext.map((a) => a.href).join(", ") || "none"}`);
      check(ext.every((a) => /\bnoopener\b/.test(a.rel || "")), `${tag} every external link in #developpeur needs rel="noopener"`);
      const mails = [...dev.html.matchAll(/<a\b[^>]*\shref="(mailto:[^"]+)"/g)].map((m) => decode(m[1]));
      check(mails.length >= 1 && mails.every((h) => h.startsWith(`mailto:${cfg.email}?subject=`) && h.includes("&body=")), `${tag} the "propose an assignment" link in #developpeur must be a mailto: to ${cfg.email} with a subject and a body to fill in (context, technologies, duration)`);
      check(at("about") < at("developpeur") && at("developpeur") < at("faq"), `${tag} section order: #about, then #developpeur, then #faq`);
    }
    check(/<a\b[^>]*\shref="#developpeur"/.test((section("about") || { html: "" }).html), `${tag} the About section should link to #developpeur (the technical profile)`);

    // contact: two doors, what happens next, WhatsApp only when a number is set
    const con = section("contact");
    if (check(!!con, `${tag} the #contact section is missing`)) {
      check((con.html.match(/<div class="door">/g) || []).length === 2, `${tag} #contact needs two doors: "you have a project" and "you are looking for a developer"`);
      const mails = [...con.html.matchAll(/<a\b[^>]*\shref="(mailto:[^"]+)"/g)].map((m) => decode(m[1]));
      const msgs = mails.filter((h) => h.includes("?subject="));
      check(msgs.length === 2 && msgs.every((h) => h.startsWith(`mailto:${cfg.email}?subject=`) && /&body=[^&]{20,}/.test(h)) && new Set(msgs.map((h) => h.split("&body=")[0])).size === 2 && msgs.every((h) => /\?subject=[^&]+&body=/.test(h) && /(connu|heard about|عرفت)/i.test(decodeURIComponent(h.split("&body=")[1]))), `${tag} #contact needs two mailto: links (projects, assignments), each with a subject and a guided body, and the body must ask how the visitor heard about GrowDev`);
      const steps = (con.html.match(/<div class="next">[\s\S]*?<ol>([\s\S]*?)<\/ol>/) || [])[1] || "";
      check((steps.match(/<li\b/g) || []).length === 3, `${tag} #contact must say what happens after the first message: three steps in <div class="next"><ol>`);
    }
    const wa = [...html.matchAll(/https:\/\/wa\.me\/(\d+)/g)].map((m) => m[1]);
    check(cfg.whatsapp ? wa.length === 1 && wa[0] === String(cfg.whatsapp) : wa.length === 0, `${tag} the WhatsApp button must appear once when "whatsapp" is set in src/site.json (${cfg.whatsapp || "empty"}) and never when it is empty (found ${wa.length})`);

    // plain words where visitors who do not work in IT read first
    const JARGON = /(?<![\w-])(ERP|API|SaaS|CRM|back-?end|front-?end|framework|stack|workflow|DevOps|CI\/CD|cron)(?![\w-])/i;
    const plain = {
      "the hero lead": (hero.match(/class="hero__lead"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || "",
      "#situations": sit ? sit.html : "",
      "the contact text": con ? con.html.replace(/<a class="mail"[\s\S]*?<\/a>/, "") : ""
    };
    for (const [where, text] of Object.entries(plain)) {
      const m = JARGON.exec(textOf(text));
      check(!m, `${tag} ${where} uses the jargon word "${m && m[1]}": visitors who do not work in IT read it first. Say what it does instead (docs/UX-AUDIT.md)`);
    }

    // technology logos
    check(!/\sdata-logo=/.test(html), `${tag} a data-logo attribute is still in the page: the build only converts <li data-logo="odoo">Odoo</li> (or a <span>) that holds plain text (docs/LOGOS.md)`);
    const chips = [...body.matchAll(/<li class="tech( is-wide)?"([^>]*)>(<span class="tech__plate"><img\b[^>]*><\/span>)<span class="(tech__name|sr-only)"([^>]*)>([^<]+)<\/span><\/li>/g)];
    check(chips.length === (body.match(/<li class="tech/g) || []).length && chips.length >= 24, `${tag} some technology chips are malformed (${chips.length} well-formed of ${(body.match(/<li class="tech/g) || []).length}); each is <li class="tech"><span class="tech__plate"><img></span><span class="tech__name">Name</span></li>`);
    for (const c of chips) {
      const img = parseAttrs(c[3].match(/<img\b[^>]*>/)[0]), name = c[6].trim(), wide = !!c[1], ir = resolveRef(rel, img.src || "");
      const n = `${tag} logo "${name}"`;
      if (!check(!!ir.file && /^assets\/img\/tech\/[a-z0-9-]+\.svg$/.test(ir.file) && has(ir.file), `${n}: the picture is missing or is not in assets/img/tech/ (${img.src})`)) continue;
      techUsed.add(path.basename(ir.file, ".svg"));
      const real = imageSize(path.join(SITE, ir.file));
      check(!!real && +img.width === real.w && +img.height === real.h, `${n}: width/height are ${img.width}x${img.height} but the file is ${real ? real.w + "x" + real.h : "unreadable"}: the logo would be stretched. Run node tools/build.mjs`);
      check(img.alt === "" && img.decoding === "async", `${n}: the picture is decoration (alt="") with decoding="async"; the name next to it is the text`);
      checkVersion(n, img.src, ir);
      check(!!real && wide === real.w / real.h >= 2 && (c[4] === "sr-only") === wide, `${n}: a wide mark (width at least twice its height) already spells the name, so it is class "tech is-wide" and its name is sr-only; a square mark shows its name (tech__name)`);
      check(name.length >= 2 && name.length <= 20, `${n}: the name should be 2 to 20 characters`);
      check(L.code === "ar" ? /\slang="en"/.test(c[5]) : !/\slang=/.test(c[5]), `${n}: the name is written in Latin letters, so it carries lang="en" on the Arabic page (a screen reader pronounces it correctly) and no lang elsewhere`);
    }
    const marq = (body.match(/<div class="marquee"[\s\S]*?<\/div>\s*<\/div>/) || [])[0] || "";
    const sets = [...marq.matchAll(/<ul class="marquee__set"([^>]*)>([\s\S]*?)<\/ul>/g)];
    if (check(sets.length === 2 && !/aria-hidden/.test(sets[0][1]) && /\saria-hidden="true"/.test(sets[1][1]), `${tag} the marquee needs two lists, the second one aria-hidden="true" (it is the copy that makes the loop)`)) {
      const names = (h) => [...h.matchAll(/<span class="(?:tech__name|sr-only)"[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]).join("|");
      check(names(sets[0][2]) !== "" && names(sets[0][2]) === names(sets[1][2]), `${tag} the two marquee lists must hold the same technologies in the same order`);
    }
    for (const m of body.matchAll(/<ul class="tags"([^>]*)>/g)) check(/\saria-label="[^"]+"/.test(m[1]), `${tag} a technology list (<ul class="tags">) has no aria-label`);

    // footer: credits for the logos, links to the new sections, GitHub only when set
    const foot = (body.match(/<footer\b[\s\S]*?<\/footer>/) || [])[0] || "";
    check(/\shref="#situations"/.test(foot) && /\shref="#developpeur"/.test(foot), `${tag} the footer should link to #situations and #developpeur`);
    const ghLinks = [...foot.matchAll(/<a\b[^>]*\shref="(https:\/\/github\.com[^"]*)"/g)].map((m) => m[1]);
    check(PROFILES.github ? ghLinks.length === 1 && ghLinks[0] === PROFILES.github : ghLinks.length === 0, `${tag} the footer shows the GitHub link only when "profiles.github" is set in src/site.json`);
    const credits = textOf((foot.match(/<p class="credits"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || "");
    check(credits.includes("Simple Icons"), `${tag} the footer must say where the technology logos come from (Simple Icons, CC0)`);
    for (const f of TECH_FILES) {
      const by = /logo by ([^,(]+?),\s*CC[ -]BY/i.exec(read(`assets/img/tech/${f}`));
      if (by) check(credits.includes(by[1].trim()), `${tag} assets/img/tech/${f} is licensed CC BY: the footer must credit its author "${by[1].trim()}" (foot.logos in the dictionaries)`);
    }
  }

  // form fields need a label
  const labelled = new Set([...body.matchAll(/<label\b[^>]*\sfor="([^"]+)"/g)].map((m) => m[1]));
  const wrapped = [...body.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)].map((m) => m[1]);
  for (const m of body.matchAll(/<(input|select|textarea)\b[^>]*>/g)) {
    const a = parseAttrs(m[0]);
    if (a.type === "hidden") continue;
    const inLabel = wrapped.some((w) => w.includes(m[0]));
    check(inLabel || (a.id && labelled.has(a.id)) || a["aria-label"] || a["aria-labelledby"], `${tag} form field without a label: ${m[0].slice(0, 80)}`);
  }

  // CSP + no inline code
  const csp = (metas.find((a) => a["http-equiv"] === "Content-Security-Policy") || {}).content || "";
  check(/script-src 'self'/.test(csp) && !/unsafe-eval/.test(csp) && /object-src 'none'/.test(csp) && /base-uri 'self'/.test(csp), `${tag} Content-Security-Policy meta is missing or too loose`);
  const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => !/\ssrc=/.test(m[1]) && !/application\/ld\+json/.test(m[1]));
  check(inline.length === 0, `${tag} inline <script> found (blocked by the CSP)`);
  check(!/\son(click|load|error|mouse\w+|key\w+|focus|blur|change|submit)=/i.test(body), `${tag} inline event handler found (blocked by the CSP)`);
  check(!/\{\{|\}\}/.test(html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, "")), `${tag} unreplaced {{placeholder}} left in the page`);

  // fonts: Arabic fonts only on the Arabic page
  const pre = links.filter((a) => a.rel === "preload" && a.as === "font").map((a) => path.basename(a.href));
  check(L.code === "ar" ? pre.some((f) => f.startsWith("plex-arabic")) : !pre.some((f) => f.startsWith("plex-arabic")), `${tag} Arabic font preload should be on the Arabic page only (found: ${pre.join(", ") || "none"})`);

  // each page loads its own language dictionary and no other
  check(html.includes(`dict-${L.code}.js`) && !cfg.langs.some((o) => o.code !== L.code && html.includes(`dict-${o.code}.js`)), `${tag} should load dict-${L.code}.js and no other language dictionary`);

  // weight
  const htmlGz = gzKB(Buffer.from(html));
  const css = refs.filter((r) => r.el === "link" && r.a.rel === "stylesheet").map((r) => resolveRef(rel, r.ref).file).filter(Boolean);
  const js = refs.filter((r) => r.el === "script").map((r) => resolveRef(rel, r.ref).file).filter(Boolean);
  const cssGz = css.reduce((n, f) => n + (has(f) ? gzKB(fs.readFileSync(path.join(SITE, f))) : 0), 0);
  const jsGz = js.reduce((n, f) => n + (has(f) ? gzKB(fs.readFileSync(path.join(SITE, f))) : 0), 0);
  check(htmlGz <= BUDGET.htmlKB, `${tag} HTML is ${kb(htmlGz)} gzipped (budget ${BUDGET.htmlKB} KB)`);
  check(cssGz <= BUDGET.cssKB, `${tag} CSS is ${kb(cssGz)} gzipped (budget ${BUDGET.cssKB} KB)`);
  check(jsGz <= BUDGET.jsKB, `${tag} JavaScript is ${kb(jsGz)} gzipped (budget ${BUDGET.jsKB} KB)`);
  pages.push({ code: L.code, rel, htmlGz, cssGz, jsGz, scripts: js.length, title: title.length, desc: desc.length });
}

for (const L of cfg.langs) checkPage(L);
for (const [k, m] of [["title", seen.title], ["meta description", seen.desc]]) {
  for (const [v, langs] of m) check(langs.length === 1, `the ${k} is identical on ${langs.join(", ")} ("${v.slice(0, 50)}…"): each language needs its own`);
}
for (const [k, m] of Object.entries(seen.cx)) for (const [v, langs] of m) check(!v || langs.length === 1, `the carousel's "${k}" text is identical on ${langs.join(", ")} ("${v}"): each language needs its own`);

// ---------- shared files ----------
// sitemap.xml
if (check(has("sitemap.xml"), "sitemap.xml is missing")) {
  const xml = read("sitemap.xml");
  const blocks = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
  const locs = blocks.map((b) => (b.match(/<loc>([^<]+)<\/loc>/) || [])[1]);
  check(JSON.stringify(locs.sort()) === JSON.stringify(cfg.langs.map((l) => pageUrl(cfg, l.code)).sort()), `sitemap.xml should list exactly the ${cfg.langs.length} language pages (found: ${locs.join(", ")})`);
  const wantAlt = [...cfg.langs.map((l) => `${l.code}=${pageUrl(cfg, l.code)}`), `x-default=${pageUrl(cfg, cfg.xDefault)}`].sort().join("|");
  for (const b of blocks) {
    const alts = [...b.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => `${m[1]}=${m[2]}`).sort().join("|");
    check(alts === wantAlt, `sitemap.xml: every <url> needs the full set of hreflang alternates (incl. itself and x-default)`);
    check(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(b), "sitemap.xml: <lastmod> missing or not a date");
  }
}
// robots.txt
if (check(has("robots.txt"), "robots.txt is missing")) {
  const r = read("robots.txt");
  check(r.includes(`Sitemap: ${origin}/sitemap.xml`), "robots.txt should point to the sitemap");
  // Read the file the way a crawler does: consecutive User-agent lines share the rules that follow them.
  const groups = [];
  let cur = null;
  for (const raw of r.split(/\r?\n/)) {
    const m = raw.replace(/#.*/, "").trim().match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === "user-agent") {
      if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
    } else if ((key === "allow" || key === "disallow") && cur) cur.rules.push([key, val]);
  }
  const groupFor = (bot) => groups.find((g) => g.agents.includes(bot.toLowerCase())) || groups.find((g) => g.agents.includes("*"));
  const blocked = (bot) => { const g = groupFor(bot); return !!g && g.rules.some(([k, v]) => k === "disallow" && v === "/"); };
  const explicit = (bot) => groups.some((g) => g.agents.includes(bot.toLowerCase()));

  check(!blocked("*"), "robots.txt blocks the whole site");
  for (const bot of ["Googlebot", "Bingbot"]) check(!blocked(bot), `robots.txt blocks ${bot}, so the site could not appear in search`);
  for (const bot of AI_SEARCH) {
    check(explicit(bot), `robots.txt has no explicit rule for ${bot}`, "warn");
    check(!blocked(bot), `robots.txt blocks ${bot}, an AI assistant that answers questions with live web results`);
  }
  const trainOk = cfg.allowAiTraining === true;
  for (const bot of AI_TRAINING) {
    check(explicit(bot), `robots.txt has no explicit rule for ${bot}`, "warn");
    check(trainOk ? !blocked(bot) : blocked(bot), `robots.txt should ${trainOk ? "allow" : "block"} ${bot} ("allowAiTraining" is ${trainOk} in src/site.json)`);
  }
}
// llms.txt / llms-full.txt
if (check(has("llms.txt") && has("llms-full.txt"), "llms.txt and llms-full.txt are required")) {
  const l = read("llms.txt"), full = read("llms-full.txt");
  check(/^# GrowDev\n\n> .+/.test(l), "llms.txt must start with '# GrowDev' and a one-line summary in a blockquote");
  check(/Tunisia/.test(l) && /Odoo/.test(l), "llms.txt should state where GrowDev works (Tunisia) and what it does (Odoo, web, mobile)");
  for (const m of l.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) {
    const r = resolveRef("llms.txt", m[1]);
    if (r.external) { check(false, `llms.txt links to another host: ${m[1]}`); continue; }
    if (check(has(r.file), `llms.txt links to a missing file: ${m[1]}`) && r.hash && r.file.endsWith(".html")) check(pageIds(r.file).has(r.hash), `llms.txt anchor does not exist: ${m[1]}`);
  }
  for (const L of cfg.langs) check(full.includes(pageUrl(cfg, L.code)), `llms-full.txt should contain the ${L.code} page`);
  check(full.length > 8000, "llms-full.txt looks too short");
  // the clients are part of what an AI assistant can quote: once in llms.txt, once per language in llms-full.txt
  for (const c of CLIENTS) {
    check(l.includes(`\n- ${c.name}\n`), `llms.txt does not list the client "${c.name}"`);
    check(full.split(`\n- ${c.name}\n`).length - 1 === cfg.langs.length, `llms-full.txt should list the client "${c.name}" once per language (${cfg.langs.length} times)`);
  }
  // an assistant quotes these lines word for word: a product name keeps its capital ("specialised in Odoo", never "specialised in odoo")
  for (const [name, text] of [["llms.txt", l], ["llms-full.txt", full]]) {
    const lower = [...new Set(text.replace(/https?:\/\/\S+/g, " ").match(/\b(?:odoo|wordpress|prestashop|flutter|django|python)\b/g) || [])];
    check(lower.length === 0, `${name} writes a product name in lower case (${lower.join(", ")}); fix it where the line is built (tools/seo.mjs) or in the dictionary`);
  }
  // the price principle is a fact an assistant can quote: why no fixed rate is published, and in which currencies the quote comes
  if (DICT.en) check(l.includes(DICT.en["facts.v5"]) && full.includes(DICT.en["facts.v5"]), "llms.txt and llms-full.txt should carry the pricing sentence (facts.v5): the price depends on the client and on the complexity of the project");
  // the founder's profiles are written as plain text (never as a markdown link to another host)
  for (const k of ["github", "linkedin"]) if (PROFILES[k]) check(l.includes(`: ${PROFILES[k]}\n`) && !l.includes(`](${PROFILES[k]}`), `llms.txt should write the founder's ${k} address as plain text (${PROFILES[k]})`);
}
// ---------- identity: one address, one contact e-mail ----------
// "url" and "email" in src/site.json are the only truth. The pages, the dictionaries, the llms files and 404.html are built from them or checked
// against them, so a leftover of an earlier address (the old host, the old mailbox) fails the build instead of reaching a visitor's mail client.
// "legacyHosts" lists the hosts the site used to have; none of them may be written anywhere in the built site.
{
  const legacy = Array.isArray(cfg.legacyHosts) ? cfg.legacyHosts : [];
  const mail = typeof cfg.email === "string" ? cfg.email.trim() : "";
  const validMail = /^[^\s@]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(mail);
  check(validMail, `"email" in src/site.json is not an e-mail address (got ${JSON.stringify(cfg.email)})`);
  check(legacy.every((h) => typeof h === "string" && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(h) && h !== hostname), `"legacyHosts" in src/site.json must be plain host names (no https://, no path) and must not contain the current host ${hostname}`);
  if (!hostname.endsWith(".github.io") && validMail) check(mail.toLowerCase().endsWith("@" + hostname), `the contact address ${mail} is not on the site's own domain ${hostname}; visitors may take "GrowDev" and that address for two companies (docs/UX-AUDIT.md)`, "warn");
  const pageFiles = cfg.langs.map((L) => (L.path === "/" ? "index.html" : L.path.slice(1) + "index.html"));
  const files = [...pageFiles, "404.html", "assets/js/config.js", ...cfg.langs.map((L) => `assets/js/dict-${L.code}.js`), "llms.txt", "llms-full.txt", "sitemap.xml", "robots.txt", "site.webmanifest"].filter(has);
  const MAIL = /[A-Za-z0-9._%+-]+@[A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z][A-Za-z0-9-]*)*\.[A-Za-z]{2,}/g;   // a name, an @, a host that starts with a letter (so "logo@2x.png" is not an address)
  for (const f of files) {
    const text = read(f);
    const others = [...new Set((text.match(MAIL) || []).filter((a) => a.toLowerCase() !== mail.toLowerCase()))];
    check(others.length === 0, `${f} contains an e-mail address other than ${mail}: ${others.join(", ")}. Change it at the source: the template, the three src/i18n files, site/assets/js/config.js and site/404.html each write the address`);
    // the address of the source repository may contain an old host name (the repository kept its name when the site moved to its own domain)
    const scan = cfg.repo ? text.split(cfg.repo).join("") : text;
    const old = legacy.filter((h) => scan.includes(h));
    check(old.length === 0, `${f} still mentions an earlier address of the site: ${old.join(", ")}`);
  }
  // every page and the 404 page offer the configured address; the runtime brief (composer.js) reads it from config.js
  for (const f of [...pageFiles, "404.html"].filter(has)) check(read(f).includes(`href="mailto:${mail}`), `${f} has no mailto: link to ${mail}`);
  if (has("assets/js/config.js")) check((/\bemail:\s*"([^"]+)"/.exec(read("assets/js/config.js")) || [])[1] === mail, `site/assets/js/config.js: "email" should be exactly ${mail} (the brief's mail button uses it)`);
}
// GitHub Pages essentials
check(new URL(origin).pathname === "/", `"url" in src/site.json must be the root of a host, without a path (got ${origin})`);
if (hostname.endsWith(".github.io")) check(!has("CNAME"), `CNAME must not exist on a github.io address (it is only for custom domains); run the build to remove it`);
else check(has("CNAME") && read("CNAME").trim() === hostname, `CNAME should contain exactly ${hostname}`);
check(has(".nojekyll"), ".nojekyll is missing (GitHub Pages would run Jekyll)");
check(has("favicon.ico") && has("assets/img/favicon.svg") && has("assets/img/apple-touch-icon.png"), "favicon.ico, favicon.svg or apple-touch-icon.png is missing");
if (check(has("404.html"), "404.html is missing")) {
  const h = read("404.html");
  check(/<meta name="robots" content="noindex">/.test(h), "404.html should be noindex");
  for (const l of cfg.langs) check(h.includes(`lang="${l.code}"`) && h.includes(`href="${l.path}"`), `404.html should offer the ${l.code} version`);
  for (const m of h.matchAll(/<(?:link|script|img)\b[^>]*(?:href|src)="([^"]+)"/g)) { const r = resolveRef("404.html", m[1]); if (!r.skip && !r.external) { if (check(has(r.file), `404.html points to a missing file: ${m[1]}`) && !/\srel="(?:icon|apple-touch-icon|manifest)"/.test(m[0])) checkVersion("404.html", m[1], r); } }
}
if (check(has("site.webmanifest"), "site.webmanifest is missing")) {
  try {
    const wm = JSON.parse(read("site.webmanifest"));
    check(wm.name === "GrowDev" && wm.icons && wm.icons.every((i) => has("assets/img/" + path.basename(i.src))), "site.webmanifest: name or icons are wrong");
  } catch (e) { check(false, "site.webmanifest is not valid JSON"); }
}
// CSS url() references
{
  const css = read("assets/css/styles.css");
  for (const m of css.matchAll(/url\(["']?([^)"']+)["']?\)/g)) {
    if (/^(data:|#)/.test(m[1])) continue;
    check(fs.existsSync(path.join(SITE, "assets/css", m[1])), `styles.css references a missing file: ${m[1]}`);
  }
  check(!/https?:\/\//.test(css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/xmlns=['"]?http[^'" >)]+/g, "")), "styles.css loads something from another host");
}
// ---------- the workflows that publish the site and watch it ----------
// live-check.yml starts after the deploy workflow, found by its NAME: rename one and not the other and the live check silently stops running.
{
  const wf = (f) => { const p = path.join(ROOT, ".github/workflows", f); return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null; };
  const pagesYml = wf("pages.yml"), liveYml = wf("live-check.yml");
  if (pagesYml && liveYml) {
    const deployName = ((pagesYml.match(/^name:\s*(.+?)\s*$/m) || [])[1] || "").replace(/^["']|["']$/g, "");
    const watched = (liveYml.match(/workflows:\s*\[\s*"([^"]+)"\s*\]/) || [])[1];
    check(deployName !== "" && watched === deployName, `.github/workflows/live-check.yml watches the workflow "${watched}", but pages.yml is named "${deployName}": the live check would never start after a deploy`);
    check(/bash tools\/verify-launch\.sh/.test(liveYml) && fs.existsSync(path.join(ROOT, "tools/verify-launch.sh")), ".github/workflows/live-check.yml should run tools/verify-launch.sh, and that file should exist");
  }
}

// ---------- no price on the site ----------
// The price of a project depends on the client and on how complex the project is, so the site states no amount and the simulator turns hours into
// hours only (docs/SEO-GEO-AEO.md, "No price"). The page-level rules (text, attributes, meta tags, JSON-LD) are in checkPage; these cover what a page
// is built from: the scripts, the styles, the three source dictionaries, the 404 page and the files written for AI assistants.
{
  const text = (f) => (has(f) ? read(f) : "");
  check(!/hourlyCost|defaultCurrency/.test(text("assets/js/config.js")), "site/assets/js/config.js still holds a price list (hourlyCost / defaultCurrency): the site never turns hours into money");
  check(!/hourlyCost|defaultCurrency|curfmt|s-rate|s-cur|r-value|r-rate/.test(text("assets/js/calculator.js")), "site/assets/js/calculator.js still computes or writes a cost (hourlyCost, curfmt, #s-rate, #s-cur, #r-value, #r-rate)");
  check(!/sim__cost|res__money|res__value|res__rate/.test(text("assets/css/styles.css")), "site/assets/css/styles.css still styles the removed cost block (sim__cost, res__money, res__value, res__rate)");
  for (const L of cfg.langs) {
    const keys = Object.keys(DICT[L.code]).filter((k) => /^(?:cur|curfmt)\./.test(k) || /^sim\.(?:cost|rate|cur)\b/.test(k) || k === "sim.res.value" || k === "sim.res.rate");
    check(keys.length === 0, `src/i18n/${L.code}.json still has price keys: ${keys.join(", ")}`);
    const hit = Object.entries(DICT[L.code]).find(([, v]) => typeof v === "string" && amountIn(v));
    check(!hit, `src/i18n/${L.code}.json: "${hit && hit[0]}" states an amount ("${hit && amountIn(hit[1])}"): the price depends on the client and on the complexity of the project`);
  }
  for (const f of ["404.html", "llms.txt", "llms-full.txt", "site.webmanifest"].filter(has)) {
    const found = amountIn(decode(f.endsWith(".html") ? withoutCode(read(f)) : read(f)));
    check(!found, `${f} states an amount ("${found}"): the price depends on the client and on the complexity of the project, so no figure is published`);
  }
}

// ---------- clients (the logo wall) ----------
// The list lives in src/site.json ("clients": [{ "name", "logo", "lang"? }]). The build turns it into the #clients section on every page and into the
// lists in llms.txt; the per-page checks (checkPage above) compare each page with it, and the CSS checks are in the theme section below.
{
  const CL = CLIENTS, dir = "assets/img/clients";
  check(cfg.clients === undefined || Array.isArray(cfg.clients), `src/site.json: "clients" must be a list`);
  const names = CL.map((c) => String(c.name).trim().toLowerCase());
  check(new Set(names).size === names.length, `src/site.json: two clients have the same name`);
  check(new Set(CL.map((c) => c.logo)).size === CL.length, `src/site.json: two clients use the same logo file`);
  for (const c of CL) {
    check(typeof c.name === "string" && c.name.trim() !== "" && typeof c.logo === "string" && c.logo.trim() !== "", `src/site.json: every client needs a "name" and a "logo" file name (got ${JSON.stringify(c)})`);
    if (c.lang !== undefined) check(cfg.langs.some((o) => o.code === c.lang), `src/site.json: client "${c.name}" has an unknown "lang" (${c.lang}); use one of ${cfg.langs.map((o) => o.code).join(", ")}`);
    if (/[؀-ۿ]/.test(c.name || "")) check(c.lang === "ar", `src/site.json: the client name "${c.name}" is written in Arabic, so it needs "lang": "ar" (screen readers use it to pronounce the name)`);
  }
  // a logo nobody shows is weight for nothing
  if (has(dir)) {
    const used = new Set(CL.map((c) => c.logo));
    for (const f of fs.readdirSync(path.join(SITE, dir))) check(used.has(f), `${dir}/${f} is not used by any client in src/site.json (delete the file, or add the client)`, "warn");
  } else check(!CL.length, `${dir}/ is missing but src/site.json lists clients`);
}

// ---------- technology logos ----------
// <li data-logo="odoo">Odoo</li> in the template becomes a logo chip (tools/build.mjs). The pictures live in site/assets/img/tech/ (docs/LOGOS.md).
{
  const dir = "assets/img/tech";
  if (check(has(dir) && TECH_FILES.length >= 12, `${dir}/ is missing or holds fewer than 12 logos`)) {
    for (const f of TECH_FILES) {
      const n = `${dir}/${f}`, svg = read(n), open = (svg.match(/^<svg\b[^>]*>/) || [""])[0], bytes = Buffer.byteLength(svg);
      check(/^[a-z0-9-]+\.svg$/.test(f), `${n}: use a lower-case name made of letters, digits and hyphens (it is the id written in data-logo)`);
      check(/\sxmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(open) && /\sviewBox="[^"]+"/.test(open) && /\swidth="\d+"/.test(open) && /\sheight="\d+"/.test(open), `${n}: the <svg> needs xmlns, viewBox, width and height (the build reads the logo's shape from them)`);
      check(!/<script|\son[a-z]+\s*=|<image\b|<foreignObject|<style\b|\bhref\s*=|url\(|javascript:|<!ENTITY|<!DOCTYPE/i.test(svg.replace(/<!--[\s\S]*?-->/g, "")), `${n}: a logo must be a plain drawing: no script, event handler, linked file, style sheet or entity`);
      check(bytes <= 6144, `${n} is ${bytes} bytes (budget 6 KB per logo): use the simple version of the mark`);
      check(/\b(CC0|MIT|CC[ -]BY|Apache|BSD)\b/i.test((svg.match(/<!--([\s\S]*?)-->/) || [])[1] || ""), `${n}: add a comment right after the <svg> tag saying where the logo comes from and under which licence (CC0, MIT, CC BY...). See docs/LOGOS.md`);
      const d = imageSize(path.join(SITE, n));
      check(!!d && d.w / d.h >= 0.4 && d.w / d.h <= 5, `${n}: its shape is unreadable or too extreme (width/height ${d ? d.w + "x" + d.h : "?"})`);
    }
    // a logo nobody shows is weight for nothing
    for (const f of TECH_FILES) check(techUsed.has(f.replace(/\.svg$/, "")), `${dir}/${f} is not used by any data-logo in the template (delete the file, or use it)`, "warn");
  }
}

// ---------- keyboard focus ----------
// Every control shows a 2 px ring when it has keyboard focus (the global :focus-visible rule). The project builder's fields once switched it off and relied on a
// border colour change: in the light theme that goes from a grey to a blue of almost the same lightness (1.09:1, measured on 26 Nov 2026), so a keyboard user could lose their place.
{
  const focusCss = has("assets/css/styles.css") ? read("assets/css/styles.css") : "";
  check(/(?:^|\n):focus-visible\s*\{[^}]*outline\s*:\s*2px\s+solid\s+var\(--sky\)/.test(focusCss), `styles.css: the global :focus-visible rule (2px solid var(--sky)) is missing: controls would show no ring for keyboard users`);
  const fieldFocus = focusCss.match(/\.field input:focus[^{]*\{([^}]*)\}/);
  check(!!fieldFocus, `styles.css: the rule for focused form fields (.field input:focus) is missing`);
  check(!fieldFocus || !/outline\s*:\s*(?:0|none)\b/.test(fieldFocus[1]), `styles.css: .field input:focus removes the outline. Keep the ring (the global :focus-visible rule): in the light theme the border colour alone barely changes, so a keyboard user would lose their place`);
}

// ---------- theme: light / dark ----------
// The site has two themes: "dark" (the GrowDev look, defined in :root) and "light" (:root[data-theme="light"], same names, other values).
// A visitor switches with the toggle in the header; the wave that plays on the switch is drawn by assets/js/theme.js.
// These checks keep the two themes in step, so that a colour added later cannot silently be unreadable in one of them.
{
  const DEFAULT_THEME = cfg.defaultTheme || "dark";
  const THEME_COLOR = { dark: "#020b18", light: "#eef3f8", ...(cfg.themeColor || {}) };
  check(["dark", "light", "system"].includes(DEFAULT_THEME), `src/site.json: "defaultTheme" must be "dark", "light" or "system" (got "${DEFAULT_THEME}")`);

  // --- colour helpers (WCAG 2 relative luminance) ---
  const hexRGB = (h) => { h = h.replace("#", ""); if (h.length === 3) h = [...h].map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (h) => { const [r, g, b] = hexRGB(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const isHex = (v) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v || "");

  // --- the two token blocks of styles.css ---
  const css = has("assets/css/styles.css") ? read("assets/css/styles.css") : "";
  const darkBlock = (css.match(/(?:^|\n)(:root\{[\s\S]*?\n\})/) || [])[1] || "";
  const lightBlock = (css.match(/(?:^|\n)(:root\[data-theme="light"\]\{[\s\S]*?\n\})/) || [])[1] || "";
  const tokensOf = (b) => Object.fromEntries([...b.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]/g)].map((m) => [m[1], m[2].trim()]));
  const dark = tokensOf(darkBlock), light = tokensOf(lightBlock);
  const L = { ...dark, ...light };                       // what the light theme really sees: its own values, the rest inherited
  check(Object.keys(dark).length > 20 && Object.keys(light).length > 20, "styles.css: could not read the theme tokens (:root and :root[data-theme=\"light\"] blocks)");

  // Tokens that are the same in both themes on purpose (typography, geometry, and values built from other tokens). Everything else needs a light value.
  const SHARED = new Set(["--ease", "--font-body", "--font-display", "--font-mono", "--grad", "--gut", "--header-h", "--line", "--line-2", "--on-grow", "--r-card", "--r-chip", "--wrap"]);
  const missing = Object.keys(dark).filter((k) => !(k in light) && !SHARED.has(k));
  check(missing.length === 0, `styles.css: ${missing.join(", ")} defined for the dark theme only. Give each a value in :root[data-theme="light"] (or list it as shared in tools/check.mjs if it is the same in both)`);
  const stray = Object.keys(light).filter((k) => !(k in dark));
  check(stray.length === 0, `styles.css: ${stray.join(", ")} defined for the light theme only; the dark theme (:root) needs it too`);

  // --- the colour of the phone's address bar equals the page background, in each theme ---
  for (const th of ["dark", "light"]) {
    const bg = (th === "dark" ? dark : L)["--bg"];
    check(isHex(bg) && bg.toLowerCase() === THEME_COLOR[th].toLowerCase(), `styles.css --bg (${th}) is ${bg} but the ${th} theme-color is ${THEME_COLOR[th]} (src/site.json "themeColor"): the browser bar would not match the page`);
  }

  // --- contrast: text 4.5:1, graphics and large gradient text 3:1, on every surface of the theme ---
  const resolve = (T, name, depth = 0) => {
    const v = T[name]; if (v === undefined) return null;
    const m = v.match(/^var\((--[\w-]+)\)$/);
    if (m && depth < 4) return resolve(T, m[1], depth + 1);
    return v;
  };
  const stopsOf = (T, name) => [...String(resolve(T, name) || "").matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0]);
  const SURF = ["--bg", "--bg-2", "--panel", "--panel-2"];
  for (const [th, T] of [["dark", dark], ["light", L]]) {
    const surf = SURF.map((n) => [n, resolve(T, n)]);
    check(surf.every(([, v]) => isHex(v)), `styles.css (${th}): the surface colours ${SURF.join(", ")} must be plain #rrggbb values (the contrast check needs them)`);
    if (!surf.every(([, v]) => isHex(v))) continue;
    const need = (names, min, what) => {
      for (const n of names) {
        const fg = resolve(T, n);
        if (!check(isHex(fg), `styles.css (${th}): ${n} must be a plain #rrggbb value so that its contrast can be checked`)) continue;
        for (const [sn, sv] of surf) check(ratio(fg, sv) >= min, `styles.css (${th}): ${what} ${n} (${fg}) on ${sn} (${sv}) has contrast ${ratio(fg, sv).toFixed(2)}:1, below ${min}:1`);
      }
    };
    need(["--ink", "--ink-2", "--muted", "--grow-ink", "--sky-ink", "--gold-ink"], 4.5, "text colour");
    need(["--grow", "--grow-2", "--sky", "--gold", "--violet"], 3, "graphic colour");
    const gi = stopsOf(T, "--grad-ink");
    check(gi.length >= 2, `styles.css (${th}): --grad-ink should be a gradient of #rrggbb stops`);
    for (const c of gi) for (const [sn, sv] of surf) check(ratio(c, sv) >= 3, `styles.css (${th}): gradient-text stop ${c} on ${sn} (${sv}) has contrast ${ratio(c, sv).toFixed(2)}:1, below 3:1 (large text)`);
    // text on the gradient buttons
    const onGrow = resolve(T, "--on-grow");
    for (const c of [resolve(T, "--grow"), resolve(T, "--grow-2"), resolve(T, "--sky")]) check(isHex(onGrow) && isHex(c) && ratio(onGrow, c) >= 4.5, `styles.css (${th}): button text ${onGrow} on ${c} has contrast ${isHex(c) && isHex(onGrow) ? ratio(onGrow, c).toFixed(2) : "?"}:1, below 4.5:1`);
  }

  // --- no colour written directly in a rule: it would look the same in both themes ---
  // Colours built from tokens (rgba(var(--g-rgb), .3)) are fine. These few are drawn the same in both themes on purpose.
  const ALLOWED_RAW = new Set(["#ffeaa9", "#f2b230", "#b9760d", "#8a5608", "#7a4a05", "rgba(255,255,255,.2)", "#000"]); // gold coins, a highlight, a mask cut
  const rules = css.replace(darkBlock, "").replace(lightBlock, "");
  const raw = [...rules.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*(?!var\()[^)]*\)|hsla?\([^)]*\)/g)].map((m) => m[0].replace(/\s+/g, "").toLowerCase());
  const bad = [...new Set(raw.filter((c) => !ALLOWED_RAW.has(c)))];
  check(bad.length === 0, `styles.css: colour(s) written directly in a rule: ${bad.join(", ")}. Use a token from the theme blocks (or, if it must be the same in both themes, add it to ALLOWED_RAW in tools/check.mjs)`);
  const lightOnly = (css.match(/:root\[data-theme="light"\][^{]*\{/g) || []).length;
  check(lightOnly >= 1, "styles.css: no light-theme override rules found");

  // --- SVG art in the page: every gradient has a light-theme colour, and no stray colours ---
  const tpl = fs.readFileSync(path.join(ROOT, "src/index.template.html"), "utf8");
  for (const g of tpl.matchAll(/<linearGradient id="([^"]+)"[^>]*>([\s\S]*?)<\/linearGradient>/g)) {
    const stops = (g[2].match(/<stop\b/g) || []).length;
    for (let i = 1; i <= stops; i++) check(css.includes(`[data-theme="light"] #${g[1]} stop:nth-child(${i})`), `styles.css: stop ${i} of the SVG gradient #${g[1]} has no light-theme colour ("…[data-theme=\\"light\\"] #${g[1]} stop:nth-child(${i}) {stop-color: …}")`);
  }
  check(css.includes('[data-theme="light"] .mcore'), "styles.css: the system-map core icon (.mcore) has no light-theme override");
  const MARKUP_OK = new Set(["#fff", "#2fe56a", "#10ce97", "#00bafc", "#7dffa5"]); // the mask, and the neon art that the light theme recolours with CSS
  const strayMarkup = [...new Set([...tpl.replace(/<style[\s\S]*?<\/style>/g, "").matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)].map((m) => m[0].toLowerCase()))].filter((c) => !MARKUP_OK.has(c));
  check(strayMarkup.length === 0, `src/index.template.html: colour(s) written in the markup: ${strayMarkup.join(", ")}. Colours belong in styles.css, where each theme can change them`);

  // --- every page: default theme, browser-bar colours, toggle, scripts in the right order ---
  for (const Lg of cfg.langs) {
    const rel = Lg.path === "/" ? "index.html" : Lg.path.slice(1) + "index.html";
    if (!has(rel)) continue;
    const html = read(rel), tag = `[${Lg.code}]`;
    const root = parseAttrs((html.match(/<html\b[^>]*>/) || [""])[0]);
    check(root["data-theme-default"] === DEFAULT_THEME, `${tag} <html data-theme-default> is "${root["data-theme-default"]}" but src/site.json says "${DEFAULT_THEME}"`);
    const bar = parseAttrs((html.match(/<meta\b[^>]*name="theme-color"[^>]*>/) || [""])[0]);
    check(bar["data-dark"] === THEME_COLOR.dark && bar["data-light"] === THEME_COLOR.light, `${tag} theme-color needs data-dark="${THEME_COLOR.dark}" data-light="${THEME_COLOR.light}" (the script swaps them with the theme)`);
    check(bar.content === THEME_COLOR[DEFAULT_THEME === "light" ? "light" : "dark"], `${tag} theme-color content is ${bar.content}, expected the ${DEFAULT_THEME === "light" ? "light" : "dark"} colour for the first paint`);
    // boot.js applies the theme before the first paint, so it must run from <head>, without defer or async
    const head = (html.match(/<head>([\s\S]*?)<\/head>/) || [])[1] || "";
    const boot = (head.match(/<script\b[^>]*boot\.js[^>]*>/) || [])[0] || "";
    check(!!boot && !/\b(defer|async)\b/.test(boot), `${tag} boot.js must be a plain <script> in <head> (no defer/async): it sets the theme before the first paint, so the page never flashes`);
    const iTheme = html.search(/<script\b[^>]*assets\/js\/theme\.js/), iMain = html.search(/<script\b[^>]*assets\/js\/main\.js/);
    check(iTheme > -1 && iMain > -1 && iTheme < iMain, `${tag} theme.js must load before main.js`);
    if (CLIENTS.length) { const iCar = html.search(/<script\b[^>]*assets\/js\/carousel\.js/); check(iCar > -1 && iCar < iMain, `${tag} carousel.js must load before main.js (main.js starts the carousel)`); }
    // the toggle
    const btnHtml = (html.match(/<button\b[^>]*id="theme-toggle"[\s\S]*?<\/button>/) || [""])[0];
    const ba = parseAttrs((btnHtml.match(/^<button\b[^>]*>/) || [""])[0]);
    check(!!btnHtml && ba.type === "button", `${tag} the theme toggle (<button id="theme-toggle" type="button">) is missing`);
    const toLight = textOf((btnHtml.match(/class="to-light"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || ""), toDark = textOf((btnHtml.match(/class="to-dark"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || "");
    check(toLight.length > 3 && toDark.length > 3 && toLight !== toDark, `${tag} the toggle needs two different visible labels (to-light / to-dark): that text is its accessible name`);
    check(/<svg\b[^>]*aria-hidden="true"/.test(btnHtml), `${tag} the toggle's icon must be aria-hidden (the label names the button)`);
    const st = parseAttrs((html.match(/<[a-z]+\b[^>]*id="theme-status"[^>]*>/) || [""])[0]);
    check(st.role === "status" && /sr-only/.test(st.class || ""), `${tag} #theme-status must be a visually hidden role="status" (it announces the change to screen readers)`);
    const dict = has(`assets/js/dict-${Lg.code}.js`) ? read(`assets/js/dict-${Lg.code}.js`) : "";
    for (const k of ["theme.nowLight", "theme.nowDark"]) check(new RegExp(`"${k.replace(".", "\\.")}":"[^"]{3,}"`).test(dict), `${tag} dict-${Lg.code}.js is missing "${k}" (spoken when the theme changes)`);
  }

  // --- 404.html follows the same settings (written by hand, kept in step by tools/build.mjs) ---
  if (has("404.html")) {
    const h = read("404.html");
    const root = parseAttrs((h.match(/<html\b[^>]*>/) || [""])[0]);
    const bar = parseAttrs((h.match(/<meta\b[^>]*name="theme-color"[^>]*>/) || [""])[0]);
    check(root["data-theme-default"] === DEFAULT_THEME, `404.html: data-theme-default is "${root["data-theme-default"]}", expected "${DEFAULT_THEME}" (run node tools/build.mjs)`);
    check(bar["data-dark"] === THEME_COLOR.dark && bar["data-light"] === THEME_COLOR.light, "404.html: theme-color data-dark / data-light do not match src/site.json (run node tools/build.mjs)");
    const hd = (h.match(/<head>([\s\S]*?)<\/head>/) || [])[1] || "";
    check(/<script\b[^>]*boot\.js/.test(hd), "404.html: boot.js must be loaded from <head> so the 404 page uses the visitor's theme");
    const inlineCss = (h.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || "";
    const rawIn404 = [...inlineCss.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*(?!var\()[^)]*\)/g)].map((m) => m[0]);
    check(rawIn404.length === 0, `404.html: colour(s) written directly in its <style>: ${rawIn404.join(", ")}. Use the tokens (var(--…)), so it works in both themes`);
  }

  // --- privacy: the site sets no cookie and sends nothing anywhere. The only things kept on the visitor's device are the language and theme choices. ---
  const jsFiles = fs.readdirSync(path.join(SITE, "assets/js")).filter((f) => f.endsWith(".js") && !f.startsWith("dict-"));
  const KEYS_OK = new Set(["gd-lang", "gd-theme"]);
  for (const f of jsFiles) {
    const code = read(`assets/js/${f}`);
    check(!/document\.cookie/.test(code), `assets/js/${f}: uses document.cookie (the site promises no cookies)`);
    check(!/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource)\b/.test(code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")), `assets/js/${f}: makes a network request (the site promises no tracking and no third-party calls)`);
    check(!/\b(sessionStorage|indexedDB)\b/.test(code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")), `assets/js/${f}: uses sessionStorage/indexedDB, which the privacy wording does not cover`);
    for (const m of code.matchAll(/["'](gd-[a-z-]+)["']/g)) check(KEYS_OK.has(m[1]), `assets/js/${f}: stores "${m[1]}" on the visitor's device. Only ${[...KEYS_OK].join(" and ")} are covered by the privacy wording; update the docs and KEYS_OK in tools/check.mjs together`);
  }

  // --- header menu: the width where the links move into the Menu button is written twice (a CSS media query and ui.js). The two numbers must be equal,
  //     otherwise the Menu button could be shown with no menu behind it, or the open menu would stay open after the window grows. ---
  {
    const ui = has("assets/js/ui.js") ? read("assets/js/ui.js") : "";
    const jsBp = (ui.match(/MENU_BREAKPOINT\s*=\s*(\d+)/) || [])[1];
    const cssBp = (css.match(/@media\s*\(max-width:\s*(\d+)px\)\s*\{\s*\.menu-btn\s*\{\s*display:\s*block/) || [])[1];
    check(!!jsBp && !!cssBp, "the menu breakpoint could not be read: expected `MENU_BREAKPOINT = <px>` in assets/js/ui.js and `@media (max-width:<px>px){ .menu-btn{display:block` in styles.css");
    if (jsBp && cssBp) check(jsBp === cssBp, `the Menu button appears below ${cssBp}px in styles.css but ui.js closes the menu above ${jsBp}px. Make the two numbers equal`);
  }

  // --- header: it hosts the fixed mobile menu. A blur, filter, transform or containment on the header itself makes the header the menu's container, and the
  //     menu then shrinks to a 48px strip as soon as the page is scrolled (found on a real iPhone, 15 Nov 2026). The frosted look lives on `.site-header::before`. ---
  {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");   // comments would end up inside the selectors
    const rules = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sels: m[1].split(",").map((x) => x.trim().replace(/\s+/g, " ")), decl: m[2].split(";").map((d) => { const i = d.indexOf(":"); return i < 0 ? null : [d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim().toLowerCase()]; }).filter(Boolean) }));
    const makesContainer = (prop, val) => /^(?:-webkit-)?(?:backdrop-filter|filter)$/.test(prop) ? val !== "none"
      : /^(?:transform|translate|rotate|scale|perspective|container-type)$/.test(prop) ? !/^(?:none|normal)$/.test(val)
      : prop === "will-change" ? /transform|perspective|filter|backdrop/.test(val)
      : prop === "contain" ? /layout|paint|strict|content/.test(val) : false;
    const bad = [];
    for (const r of rules) if (r.sels.some((x) => /^\.site-header(?:\.[\w-]+|:[\w-]+)*$/.test(x))) for (const [prop, val] of r.decl) if (makesContainer(prop, val)) bad.push(`${r.sels.join(", ")} { ${prop}: ${val} }`);
    check(!bad.length, `the header must not carry a property that makes it the container of the fixed mobile menu (${bad.join("; ")}). Put the blur on .site-header::before instead`);

    // the open menu is a panel the links sit on: it must be nearly opaque, or the page shows through the links
    const nav = rules.find((r) => r.sels.includes(".nav") && r.decl.some(([p, v]) => p === "position" && v === "fixed"));
    const alpha = nav && (nav.decl.find(([p]) => p === "background") || [])[1] && Number(((nav.decl.find(([p]) => p === "background"))[1].match(/rgba\(var\(--bg-rgb\),\s*([\d.]+)\)/) || [])[1]);
    check(Number.isFinite(alpha) && alpha >= 0.9, "the open mobile menu (.nav, position:fixed) must have a background of the form rgba(var(--bg-rgb), 0.9 or more) so the page does not show through the links");
  }

  // --- images: an <img> with width and height attributes keeps the height from the attribute when CSS sets only a width, and the picture is stretched.
  //     (The About emblem was 140 x 200 px on phones for that reason.) A rule that sets a width on such an image needs a height (usually auto) in the same selector. ---
  {
    const html = has("index.html") ? read("index.html") : "";
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => parseAttrs(m[0])).filter((a) => a.width && a.height);
    const classes = new Set(imgs.flatMap((a) => (a.class || "").split(/\s+/).filter(Boolean)));
    const bySel = new Map();
    for (const m of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const decl = m[2].split(";").map((d) => d.split(":")[0].trim().toLowerCase());
      for (const sel of m[1].split(",").map((x) => x.trim().replace(/\s+/g, " "))) {
        const last = sel.split(/[\s>+~]+/).pop();
        const target = last === "img" || [...classes].some((c) => last === "." + c || last.endsWith("." + c));
        if (!target || /::?(before|after)/.test(sel)) continue;
        const e = bySel.get(sel) || { width: false, height: false }; e.width ||= decl.includes("width"); e.height ||= decl.includes("height"); bySel.set(sel, e);
      }
    }
    const stretched = [...bySel].filter(([, e]) => e.width && !e.height).map(([sel]) => sel);
    check(!stretched.length, `these rules set a width on an image that has width and height attributes, but no height, so the image can be stretched: ${stretched.join(", ")}. Add height:auto`);
  }

  // --- client logos: the logo files have white backgrounds, so each logo sits on a white plate in BOTH themes (--logo-plate). The picture is fitted
  //     inside the plate (object-fit: contain), so a logo of any shape is neither cropped nor stretched. A client's logo is shown as supplied: it is never
  //     recoloured (no filter, blend mode or opacity), not even to "fit" the dark theme. ---
  if (CLIENTS.length) {
    for (const [th, T] of [["dark", dark], ["light", L]]) check(/^#(?:fff|ffffff)$/i.test(T["--logo-plate"] || ""), `styles.css (${th}): --logo-plate must be #fff (found ${T["--logo-plate"] || "nothing"}). The client logo files have white backgrounds; on any other colour each logo would show as a white box`);
    const bareCss = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const declsOf = (sel) => [...bareCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => m[1].split(",").some((x) => x.trim().replace(/\s+/g, " ") === sel))
      .flatMap((m) => m[2].split(";").map((d) => { const i = d.indexOf(":"); return i < 0 ? null : [d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim().toLowerCase()]; }).filter(Boolean));
    const plate = declsOf(".client"), pic = declsOf(".client img");
    check(plate.some(([p, v]) => p === "background" && v === "var(--logo-plate)"), "styles.css: `.client` must have background: var(--logo-plate) (the plate stays white in both themes)");
    check(pic.some(([p, v]) => p === "object-fit" && v === "contain"), "styles.css: `.client img` needs object-fit: contain, so a logo of any shape is fitted in its plate and never stretched or cropped");
    const recoloured = pic.filter(([p, v]) => /^(?:-webkit-)?filter$/.test(p) && v !== "none" || p === "mix-blend-mode" && v !== "normal" || p === "opacity" && v !== "1").map(([p, v]) => `${p}: ${v}`);
    check(!recoloured.length, `styles.css: \`.client img\` changes the look of the client's logo (${recoloured.join("; ")}). Logos are shown exactly as supplied`);

    // the carousel: assets/js/carousel.js moves the belt, but the stylesheet decides what a visitor sees without it and before it has started
    const rulesOf = (test) => [...bareCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1].split(",").some((x) => test(x.trim().replace(/\s+/g, " "))))
      .flatMap((m) => m[2].split(";").map((d) => { const i = d.indexOf(":"); return i < 0 ? null : [d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim().toLowerCase().replace(/\s+/g, "")]; }).filter(Boolean));
    check(rulesOf((x) => x.endsWith(".carousel__viewport")).some(([p, v]) => p === "touch-action" && v === "pan-y"), "styles.css: the carousel window (.carousel__viewport) needs touch-action: pan-y. Without it the browser keeps the horizontal swipe for itself (the belt cannot be dragged) or blocks the vertical one (the page cannot be scrolled from the carousel)");
    check(rulesOf((x) => x === ".carousel__viewport").some(([p, v]) => p === "overflow" && /^(?:hidden|clip)$/.test(v)), "styles.css: .carousel__viewport must clip (overflow: hidden or clip), or the plates waiting outside the window would show and the page would scroll sideways");
    check(rulesOf((x) => x === ".js .carousel:not(.is-static) .clients").some(([p, v]) => p === "flex-wrap" && v === "nowrap"), "styles.css: the belt (.js .carousel:not(.is-static) .clients) must be one row (flex-wrap: nowrap)");
    check(/\.carousel__btn\[hidden\]\s*\{[^}]*display\s*:\s*none/.test(bareCss), "styles.css: `.carousel__btn[hidden]{display:none}` is missing: the button's own display would override the hidden attribute and Pause would stay visible with reduced motion");
    const barBase = rulesOf((x) => x === ".carousel__bar"), barJs = rulesOf((x) => x === ".js .carousel__bar");
    check(barBase.some(([p, v]) => p === "display" && v === "none"), "styles.css: .carousel__bar must be display:none by default: without JavaScript its buttons would do nothing");
    check(barJs.some(([p, v]) => p === "visibility" && v === "hidden") && !barJs.some(([p, v]) => p === "display" && v === "none"), "styles.css: with JavaScript the bar must keep its room before the script starts (.js .carousel__bar: display flex + visibility hidden), otherwise the page jumps when the bar appears");
    check(!plate.some(([p]) => p === "transform" || p === "transition"), "styles.css: `.client` must not set transform or transition: the carousel script moves the plates with transforms, and a CSS one would fight it");
    check(/\.carousel__btn--prev svg\s*\{[^}]*transform\s*:\s*scaleX\(-1\)/.test(bareCss) && /\[dir="rtl"\]\s*\.carousel__btn--prev svg\s*\{[^}]*transform\s*:\s*none/.test(bareCss) && /\[dir="rtl"\]\s*\.carousel__btn--next svg\s*\{[^}]*transform\s*:\s*scaleX\(-1\)/.test(bareCss), "styles.css: the arrows must point the way the belt goes: Previous flipped in left-to-right pages, Next flipped in Arabic ([dir=rtl])");
    // how many plates are in view: --show on .carousel (the belt) and on html:not(.js) .carousel (the wall, which wraps onto rows and so needs whole numbers)
    for (const m of bareCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const v = (m[2].match(/(?:^|;)\s*--show\s*:\s*([^;]+)/) || [])[1];
      if (v === undefined) continue;
      const sel = m[1].trim().replace(/\s+/g, " "), x = Number(v.trim()), n = CLIENTS.length;
      if (sel === ".carousel") {
        if (!check(Number.isFinite(x) && x >= 1, `styles.css: .carousel --show is "${v.trim()}"; it must be a number, at least 1 (how many plates are in view)`)) continue;
        check(!(x > n - 1 && x < n), `styles.css: .carousel --show: ${x} with ${n} clients. Between ${n - 1} and ${n} the belt cannot fill its window all the way round, so it falls back to the still wall. Show ${n - 1} or fewer, or ${n} or more`, "warn");
        check(x < n, `styles.css: .carousel --show: ${x} shows every client at once, so the belt never moves at that width (a carousel needs at least one client out of view)`, "warn");
      } else if (sel === "html:not(.js) .carousel") check(Number.isInteger(x) && x >= 1, `styles.css: ${sel} --show is "${v.trim()}"; without JavaScript the plates wrap onto rows, so it must be a whole number`);
    }

    // the carousel's script
    const carJs = has("assets/js/carousel.js") ? read("assets/js/carousel.js") : "";
    if (check(!!carJs, "assets/js/carousel.js is missing: without it the Clients section stays a still wall")) {
      for (const [needle, why] of [
        ["prefers-reduced-motion", "it must not move by itself for a visitor who asked for less motion"],
        ["visibilitychange", "it must wait while the tab is hidden"],
        ["IntersectionObserver", "it must wait while the section is out of view, and load the logos before they slide in"],
        ['"eager"', "the plates outside the window are loading=lazy, and a browser never loads a lazy picture that an ancestor clips away: they must be switched to eager shortly before the section is reached"],
        ["pointercancel", "it must cope with the browser taking a touch gesture over (a vertical swipe scrolls the page)"],
        ["ResizeObserver", "it must follow the window being resized or turned"],
        ["data-play", "the Pause/Play button swaps its label between data-pause and data-play"]
      ]) check(carJs.includes(needle), `assets/js/carousel.js no longer contains ${needle}: ${why}`);
      const every = Number((carJs.match(/\bEVERY\s*=\s*(\d+)/) || [])[1]), glide = Number((carJs.match(/\bGLIDE\s*=\s*(\d+)/) || [])[1]);
      check(every >= 2500, `assets/js/carousel.js: EVERY = ${every || "?"} ms. A logo needs at least 2.5 s in view before the belt moves on`);
      check(glide >= 300 && glide <= 1200, `assets/js/carousel.js: GLIDE = ${glide || "?"} ms. A step should take between 0.3 and 1.2 s: quicker is a jerk, slower is sluggish`);
      check(/GD\.carousel\s*=\s*\{/.test(carJs) && /\binit\s*:/.test(carJs), "assets/js/carousel.js must export GD.carousel.init");
    }
    check(/GD\.carousel\.init\(\)/.test(has("assets/js/main.js") ? read("assets/js/main.js") : ""), "assets/js/main.js must call GD.carousel.init(), or the logos never move");
  }

  // --- the wave: theme.js is run here, in Node, and the shape it draws is checked for every screen size ---
  // The wave is an outline that grows from the toggle until the whole viewport is inside it. If this ever stops being true, part of the page would be left in the old theme.
  if (has("assets/js/theme.js")) {
    const sandbox = { window: {}, document: { documentElement: {} }, Math, Date, Array, Object, Number, String, setTimeout, clearTimeout };
    sandbox.window = sandbox;
    let W = null;
    try { vm.runInNewContext(read("assets/js/theme.js"), sandbox, { filename: "theme.js", timeout: 2000 }); W = sandbox.GD && sandbox.GD.theme && sandbox.GD.theme.wave; } catch (e) { check(false, `assets/js/theme.js does not load: ${e.message}`); }
    if (check(!!W && typeof W.build === "function", "assets/js/theme.js: GD.theme.wave.build is missing")) {
      const inside = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
      const segDist = (px, py, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy)); };
      const inscribed = (poly, cx, cy) => Math.min(...poly.map((a, i) => segDist(cx, cy, a, poly[(i + 1) % poly.length])));
      let rng = 12345; const rand = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 4294967296; };   // fixed seed: the same screens and shapes every run
      const screens = [[320, 568], [360, 640], [390, 844], [412, 915], [768, 1024], [1024, 768], [1280, 720], [1440, 900], [1920, 1080], [2560, 1440], [390, 14000], [1440, 11000]];
      let worst = { gap: Infinity, where: "" }, uncovered = 0, nonFinite = 0, bigStart = 0, shrink = 0, wrongCount = 0, badDuration = 0, runs = 0, badCss = 0;
      for (const [w, h] of screens) {
        const spots = [[w - 44, 36], [44, 36], [w / 2, 36], [w / 2, h / 2], [w - 2, 2], [2, h - 2]];     // the toggle, mirrored (Arabic), centred, and extreme places
        for (const [cx, cy] of spots) for (let n = 0; n < 12; n++) {
          runs++;
          const r = W.build(cx, cy, w, h, W.newSeed(rand)), sh = r.shapes;
          if (sh.length !== W.STEPS + 1 || r.css.length !== W.STEPS + 1) wrongCount++;
          if (sh.some((poly) => poly.length !== W.POINTS || poly.some((q) => !Number.isFinite(q[0]) || !Number.isFinite(q[1])))) { nonFinite++; continue; }
          if (r.css.some((c) => !/^polygon\((-?[\d.]+px -?[\d.]+px,?){96}\)$/.test(c))) badCss++;
          const far = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
          const last = sh[sh.length - 1], gap = inscribed(last, cx, cy) - far;                // how far past the farthest corner the closest part of the outline is
          if (gap < worst.gap) worst = { gap, where: `${w}x${h} at ${Math.round(cx)},${Math.round(cy)}` };
          if (!(gap >= 0) || ![[0, 0], [w, 0], [0, h], [w, h]].every((c) => inside(c, last))) uncovered++;
          if (!inside([cx, cy], sh[0]) || Math.max(...sh[0].map((q) => Math.hypot(q[0] - cx, q[1] - cy))) > W.START_R * 1.3) bigStart++;
          for (let i = 1; i < sh.length; i++) if (inscribed(sh[i], cx, cy) < inscribed(sh[i - 1], cx, cy) * 0.97 - 1) { shrink++; break; }   // the wave never falls back
          const d = W.duration(cx, cy, w, h); if (!(d >= 700 && d <= 1400)) badDuration++;
        }
      }
      check(wrongCount === 0, `theme.js: a wave does not have ${W.STEPS + 1} keyframes of ${W.POINTS} points`);
      check(nonFinite === 0, `theme.js: the wave outline contains invalid numbers in ${nonFinite} of ${runs} test waves`);
      check(badCss === 0, `theme.js: ${badCss} keyframes are not valid CSS polygon() strings`);
      check(uncovered === 0, `theme.js: the wave does not cover the whole screen at the end in ${uncovered} of ${runs} test waves (worst: ${worst.where}, ${worst.gap.toFixed(1)}px short). Part of the page would stay in the old theme`);
      check(bigStart === 0, `theme.js: the wave does not start as a small shape around the toggle in ${bigStart} of ${runs} test waves`);
      check(shrink === 0, `theme.js: the wave falls back (shrinks by more than 3%) in ${shrink} of ${runs} test waves`);
      check(badDuration === 0, `theme.js: wave duration outside 0.7–1.4 s in ${badDuration} test waves`);
      check(worst.gap >= 8, `theme.js: the outline clears the farthest corner by only ${worst.gap.toFixed(1)}px at ${worst.where}; keep a margin of at least 8px`, "warn");
    }
    // reduced motion and old browsers
    const js = read("assets/js/theme.js");
    check(/prefers-reduced-motion:\s*reduce/.test(js), "theme.js: must respect prefers-reduced-motion (switch at once, no wave)");
    check(/startViewTransition/.test(js) && /theme-fade/.test(js), "theme.js: needs the fallback for browsers without View Transitions (the .theme-fade class)");
    check(css.includes("::view-transition-new(root)") && css.includes(".theme-fade"), "styles.css: needs the ::view-transition rules and the .theme-fade fallback");
  }
}

// ---------- report ----------
console.log("GrowDev site check\n");
console.log("  page  html(gz)  css(gz)   js(gz)  scripts  title  description");
for (const p of pages) console.log(`  ${p.code.padEnd(4)}  ${kb(p.htmlGz).padStart(8)}  ${kb(p.cssGz).padStart(7)}  ${kb(p.jsGz).padStart(7)}  ${String(p.scripts).padStart(7)}  ${String(p.title).padStart(5)}  ${String(p.desc).padStart(11)}`);
console.log(`\n  ${passed} checks passed`);
if (warns.length) console.log(`\n  ${warns.length} warning(s):\n   - ${warns.join("\n   - ")}`);
if (fails.length) { console.error(`\n  ${fails.length} failure(s):\n   - ${fails.join("\n   - ")}\n`); process.exit(1); }
console.log("\n  All checks passed.\n");
