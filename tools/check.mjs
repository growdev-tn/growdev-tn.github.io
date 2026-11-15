#!/usr/bin/env node
// GrowDev site checker — zero dependencies (Node 18+). Run after `node tools/build.mjs`; CI runs both before every deploy.
// It checks what search engines, AI assistants and visitors depend on: metadata, hreflang, structured data, FAQ parity,
// links and assets, CSP, sitemap / robots / llms.txt, the Tunisia-first signals and size budgets.
// Usage: node tools/check.mjs [--site DIR]. Exit code 1 when anything fails; warnings do not fail the run.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { FAQ_COUNT, SERVICES, pageUrl, AI_SEARCH, AI_TRAINING } from "./seo.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteArg = process.argv.indexOf("--site");
const SITE = siteArg > -1 ? path.resolve(process.argv[siteArg + 1]) : path.join(ROOT, "site"); // --site DIR: check another build (used to test the checker itself)
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "src/site.json"), "utf8"));
const origin = cfg.url;
const hostname = new URL(origin).hostname;

// Budgets (gzip, per page). Generous on purpose: they exist to catch accidents, not to police every byte.
const BUDGET = { htmlKB: 45, cssKB: 22, jsKB: 30, ogKB: 200, titleMax: 65, titleMin: 20, descMax: 165, descMin: 70 };

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

// ---------- per-page checks ----------
const pages = [];
const seen = { title: new Map(), desc: new Map() };

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
  }

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
    if (r.hash && r.file.endsWith(".html")) check(pageIds(r.file).has(r.hash), `${tag} anchor #${r.hash} does not exist in ${r.file} (from ${ref})`);
  }
  for (const m of body.matchAll(/<img\b[^>]*>/g)) {
    const a = parseAttrs(m[0]);
    check("alt" in a, `${tag} <img> without alt: ${m[0].slice(0, 80)}`);
    check(a.width && a.height, `${tag} <img> without width/height (layout shift): ${a.src}`, "warn");
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

  // Tunisia-first: DT is the first and selected currency, the default rate matches the config
  check(/<select id="s-cur"><option value="TND"/.test(body), `${tag} the first currency option should be TND (DT)`);
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
  for (const m of h.matchAll(/<(?:link|script|img)\b[^>]*(?:href|src)="([^"]+)"/g)) { const r = resolveRef("404.html", m[1]); if (!r.skip && !r.external) check(has(r.file), `404.html points to a missing file: ${m[1]}`); }
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
// Currency defaults (DT first) agree between the page and the script config
{
  const cfgJs = read("assets/js/config.js");
  const rate = (cfgJs.match(/TND\s*:\s*(\d+)/) || [])[1];
  check(/defaultCurrency\s*:\s*"TND"/.test(cfgJs), "config.js: defaultCurrency should be TND (DT first)");
  check(rate && read("index.html").includes(`id="s-rate" min="1" step="1" value="${rate}"`), `the default hourly cost in the page should equal config.js hourlyCost.TND (${rate})`);
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
