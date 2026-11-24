#!/usr/bin/env node
// GrowDev static build — zero dependencies (Node 18+).
//   src/index.template.html + src/i18n/{fr,ar,en}.json  ->  site/index.html, site/ar/index.html, site/en/index.html
//   plus runtime dictionaries, sitemap.xml, robots.txt, llms.txt, llms-full.txt and (custom domains only) CNAME.
//   The site address is the single "url" setting in src/site.json; everything above is derived from it.
// Usage: node tools/build.mjs [--out DIR] [--index-links]
//   --out DIR       copy site/ to DIR and write the generated files there (site/ stays untouched)
//   --index-links   link to ".../index.html" instead of ".../" (for file:// previews and artifact hosts)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { jsonLd, sitemap, robots, llms, llmsFull, pageUrl } from "./seo.mjs";
import { imageSize } from "./imgsize.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const INDEX_LINKS = flag("--index-links");

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "src/site.json"), "utf8"));
const template = fs.readFileSync(path.join(ROOT, "src/index.template.html"), "utf8");
const D = Object.fromEntries(cfg.langs.map((l) => [l.code, JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/${l.code}.json`), "utf8"))]));

let OUT = path.join(ROOT, "site");
if (opt("--out")) {
  OUT = path.resolve(opt("--out"));
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.cpSync(path.join(ROOT, "site"), OUT, { recursive: true });
}

const problems = [];
const fail = (m) => problems.push(m);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const used = new Set();

// Asset versions. GitHub Pages lets a browser keep a stylesheet or a script for about ten minutes without asking again, and nothing in
// a file name changes when the file does. After a deploy a visitor could therefore receive the NEW page with the OLD stylesheet: a broken
// layout until the cache expires. So every local stylesheet, script and client logo is requested as "file?v=<8 hex digits>", where the digits
// are the start of the file's SHA-256. The address changes exactly when the content changes, and never otherwise.
// tools/check.mjs recomputes the same digits and fails the build on any reference that is missing one or carries a stale one.
const assetVersion = (relPath, where) => {
  const f = path.join(OUT, relPath);
  if (!fs.existsSync(f)) { fail(`${where}: ${relPath} does not exist`); return "missing"; }
  return crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex").slice(0, 8);
};
const CODE_REF = /(<(?:link|script)\b[^>]*?\s(?:href|src)=")((?:\.\.\/|\/)?assets\/(?:css|js)\/[\w.-]+\.(?:css|js))(?:\?v=[0-9a-f]*)?(")/g;
const versionCodeRefs = (html, where) => html.replace(CODE_REF, (m, a, ref, c) => `${a}${ref}?v=${assetVersion(ref.replace(/^(?:\.\.\/|\/)/, ""), where)}${c}`);

// Theme: "dark" is the GrowDev look. "defaultTheme" is what a first-time visitor sees ("dark", "light", or "system" = follow the device);
// a choice made with the toggle always wins (boot.js, theme.js). The two colours feed <meta name="theme-color"> (the browser bar on phones)
// and tools/check.mjs checks that they equal --bg in each theme of styles.css.
const THEME_DEFAULT = cfg.defaultTheme || "dark";
if (!["dark", "light", "system"].includes(THEME_DEFAULT)) fail(`"defaultTheme" in src/site.json must be "dark", "light" or "system" (got "${THEME_DEFAULT}")`);
const THEME_COLOR = { dark: "#020b18", light: "#eef3f8", ...(cfg.themeColor || {}) };
for (const [k, v] of Object.entries(THEME_COLOR)) if (!/^#[0-9a-f]{6}$/i.test(v)) fail(`"themeColor.${k}" in src/site.json must be a #rrggbb colour (got "${v}")`);

// Clients: the logos of the Clients section. One entry per client in src/site.json ("clients"); the picture lives in site/assets/img/clients/.
// The build reads each picture's real size, so the width and height attributes in the pages are always right and a logo can never be stretched by a wrong attribute.
// "lang" (optional) is the language of the name when it is not the page's own (the Arabic name shown on the French and English pages gets lang="ar").
const CLIENTS = Array.isArray(cfg.clients) ? cfg.clients : [];
const clientDims = CLIENTS.map((c, i) => {
  const where = `src/site.json clients[${i}]${c && c.name ? ` ("${c.name}")` : ""}`;
  if (!c || typeof c.name !== "string" || !c.name.trim()) { fail(`${where}: "name" is required`); return null; }
  if (typeof c.logo !== "string" || !/^[\w.-]+\.(webp|png|jpe?g|svg)$/i.test(c.logo)) { fail(`${where}: "logo" must be a file name such as acme.webp (webp, png, jpg or svg)`); return null; }
  if (c.lang !== undefined && !cfg.langs.some((l) => l.code === c.lang)) fail(`${where}: "lang" must be one of ${cfg.langs.map((l) => l.code).join(", ")}`);
  const file = path.join(OUT, "assets/img/clients", c.logo);
  const dim = fs.existsSync(file) ? imageSize(file) : null;
  if (!dim) { fail(`${where}: site/assets/img/clients/${c.logo} is missing or is not a readable image`); return null; }
  return dim;
});

// Technology logos. The template writes <li data-logo="odoo">Odoo</li> (an <li> or a <span>); the build turns it into a small white plate that holds the logo
// followed by the name. The pictures live in site/assets/img/tech/ (docs/LOGOS.md: where they come from, their licences, how to add one). The logo is
// decoration (alt=""): the name next to it is the accessible text. A wide mark that already spells the name (the Odoo wordmark) shows it once and keeps
// the text for screen readers only. Each file is requested as "file?v=<hash>" like every other asset, and its width and height come from the file itself.
const TECH_DIR = "assets/img/tech";
const techSize = {};
function techDims(id, where) {
  if (!(id in techSize)) {
    const f = path.join(OUT, TECH_DIR, id + ".svg");
    techSize[id] = fs.existsSync(f) ? imageSize(f) : null;
    if (!techSize[id]) fail(`${where}: data-logo="${id}" has no readable site/${TECH_DIR}/${id}.svg`);
  }
  return techSize[id];
}

// Optional links and contact switches (all in src/site.json). Nothing is shown for a setting that is empty or missing.
const HTTPS = /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s"'<>]*)?$/i;
const PROFILES = cfg.profiles && typeof cfg.profiles === "object" ? cfg.profiles : {};
if (cfg.repo !== undefined && cfg.repo !== "" && !HTTPS.test(cfg.repo)) fail(`"repo" in src/site.json must be an https:// address (got ${JSON.stringify(cfg.repo)})`);
for (const [k, v] of Object.entries(PROFILES)) {
  if (!["github", "linkedin"].includes(k)) fail(`"profiles.${k}" in src/site.json is not supported; use "github" or "linkedin"`);
  else if (v !== "" && !HTTPS.test(v)) fail(`"profiles.${k}" in src/site.json must be an https:// address (got ${JSON.stringify(v)})`);
}
if (cfg.whatsapp !== undefined && cfg.whatsapp !== "" && !/^\d{8,15}$/.test(String(cfg.whatsapp))) fail(`"whatsapp" in src/site.json must be the number in international format, digits only, for example 21620123456 (got ${JSON.stringify(cfg.whatsapp)})`);

function lastmod() {
  try {
    const d = execSync("git log -1 --format=%cs -- src site/assets", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  } catch (e) { /* not a git checkout */ }
  return new Date().toISOString().slice(0, 10);
}
const LASTMOD = lastmod();

// ---------- dictionary checks ----------
const PLURAL = /^sum\.(zero|one|two|few|many|other)$/;
const baseKeys = Object.keys(D.fr).filter((k) => !PLURAL.test(k));
const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
const tags = (s) => [...s.matchAll(/<\/?(\w+)/g)].map((m) => m[1]).join(",");
for (const l of cfg.langs) {
  if (!D[l.code]["sum.other"]) fail(`${l.code}: sum.other is required`);
  for (const k of baseKeys) {
    if (!(k in D[l.code])) { fail(`${l.code}: missing key "${k}"`); continue; }
    if (vars(D.fr[k]) !== vars(D[l.code][k])) fail(`${l.code}: placeholders differ for "${k}"`);
    if (tags(D.fr[k]) !== tags(D[l.code][k])) fail(`${l.code}: HTML tags differ for "${k}"`);
  }
  for (const k of Object.keys(D[l.code])) if (!PLURAL.test(k) && !(k in D.fr)) fail(`${l.code}: unknown key "${k}"`);
}

// ---------- page generation ----------
const rel = (from, to) => {
  const base = from.path === "/" ? "" : "../";
  const r = base + (to.path === "/" ? "" : to.path.slice(1));
  return (r || "./") + (INDEX_LINKS && r.endsWith("/") ? "index.html" : "");
};

function render(L) {
  const T = D[L.code];
  const tr = (k) => { if (!(k in T)) { fail(`${L.code}: template uses missing key "${k}"`); return k; } used.add(k); return T[k]; };
  const base = L.path === "/" ? "" : "../";
  let html = template;

  html = html.replace(/(<(\w+)\b[^>]*?\sdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g, (m, open, tag, key, inner, close) => open + tr(key) + close);
  html = html.replace(/<(\w+)\b[^>]*?\sdata-i18n-attr="([^"]+)"[^>]*>/g, (tagStr, tag, spec) => {
    let out = tagStr;
    for (const pair of spec.split(";")) {
      const i = pair.indexOf(":"), attr = pair.slice(0, i), val = esc(tr(pair.slice(i + 1)));
      const re = new RegExp(`(\\s${attr}=")[^"]*(")`);
      out = re.test(out) ? out.replace(re, (mm, a, b) => a + val + b) : out.replace(/>$/, ` ${attr}="${val}">`);
    }
    return out;
  });

  // data-logo -> plate + name (see "Technology logos" above)
  html = html.replace(/<(li|span)\b([^>]*?)\sdata-logo="([a-z0-9-]+)"([^>]*)>([^<]*)<\/\1>/g, (m, el, before, id, after, name) => {
    const d = techDims(id, L.code);
    if (!d) return m;
    const wide = d.w / d.h >= 2;
    const src = `${base}${TECH_DIR}/${id}.svg?v=${assetVersion(`${TECH_DIR}/${id}.svg`, L.code)}`;
    const plate = `<span class="tech__plate"><img src="${src}" width="${d.w}" height="${d.h}" alt="" decoding="async"></span>`;
    const label = `<span class="${wide ? "sr-only" : "tech__name"}"${L.code === "ar" ? ' lang="en"' : ""}>${name}</span>`;
    return `<${el} class="tech${wide ? " is-wide" : ""}"${before}${after}>${plate}${label}</${el}>`;
  });

  // links to the developer's public pages; each one appears only when it is set in src/site.json
  // rel="me" marks a link to the person's own profile (it lets search engines tie the profile to this page); the repository is a project, not a profile
  const ext = (href, key, rel) => `<li><a class="btn btn-ghost" href="${esc(href)}" rel="${rel}">${esc(tr(key))}</a></li>`;
  const devLinks = [
    cfg.repo ? ext(cfg.repo, "dev.link.repo", "noopener") : (tr("dev.link.repo"), ""),
    PROFILES.github ? ext(PROFILES.github, "dev.link.github", "me noopener") : (tr("dev.link.github"), ""),
    PROFILES.linkedin ? ext(PROFILES.linkedin, "dev.link.linkedin", "me noopener") : (tr("dev.link.linkedin"), "")
  ].filter(Boolean).join("\n          ");
  const waButton = cfg.whatsapp
    ? `<a class="btn btn-ghost btn-lg" href="https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(tr("contact.wa.text"))}" rel="noopener">${esc(tr("contact.wa"))}</a>`
    : (tr("contact.wa"), tr("contact.wa.text"), "");

  const ogFile = `og-${L.code}.jpg`;
  if (!fs.existsSync(path.join(OUT, "assets/img", ogFile))) fail(`${L.code}: missing assets/img/${ogFile} (run: node tools/make-og.cjs)`);
  const ogImage = `${cfg.url}/assets/img/${ogFile}`;
  const others = cfg.langs.filter((o) => o.code !== L.code);
  const xdef = cfg.langs.find((o) => o.code === cfg.xDefault);
  const entry = L.path === "/";
  const vals = {
    lang: L.code, dir: L.dir, base,
    themeDefault: THEME_DEFAULT,
    themeColorInit: THEME_COLOR[THEME_DEFAULT === "light" ? "light" : "dark"], themeColorDark: THEME_COLOR.dark, themeColorLight: THEME_COLOR.light,
    title: esc(tr("meta.title")), description: esc(tr("meta.desc")),
    canonical: pageUrl(cfg, L.code), ogImage, ogAlt: esc(tr("meta.og.alt")), ogLocale: L.ogLocale,
    ogAlternates: others.map((o) => `<meta property="og:locale:alternate" content="${o.ogLocale}">`).join("\n"),
    hreflang: [...cfg.langs.map((o) => `<link rel="alternate" hreflang="${o.code}" href="${pageUrl(cfg, o.code)}">`),
      `<link rel="alternate" hreflang="x-default" href="${pageUrl(cfg, xdef.code)}">`].join("\n"),
    preload: (cfg.preload[L.code] || []).map((f) => `<link rel="preload" href="${base}assets/fonts/${f}.woff2" as="font" type="font/woff2" crossorigin>`).join("\n"),
    entryAttrs: entry ? " data-entry" + others.map((o) => ` data-${o.code}="${rel(L, o)}"`).join("") : "",
    langLinks: cfg.langs.map((o) => `<a href="${o.code === L.code ? "#top" : rel(L, o)}" hreflang="${o.code}" lang="${o.code}" data-lang="${o.code}" title="${o.name}"${o.code === L.code ? ' aria-current="page"' : ""}>${o.label}</a>`).join(""),
    clients: CLIENTS.map((c, i) => !clientDims[i] ? "" :
      `<li class="client"><img src="${base}assets/img/clients/${esc(c.logo)}?v=${assetVersion("assets/img/clients/" + c.logo, L.code)}" width="${clientDims[i].w}" height="${clientDims[i].h}" alt="${esc(c.name)}"${c.lang && c.lang !== L.code ? ` lang="${c.lang}"` : ""} loading="lazy" decoding="async"></li>`
    ).join("\n      "),
    mailSubject: encodeURIComponent(tr("contact.mailsubject")),
    mailBody: encodeURIComponent(tr("contact.mailbody")),
    mailSubject2: encodeURIComponent(tr("contact.mailsubject2")),
    mailBody2: encodeURIComponent(tr("contact.mailbody2")),
    devLinks, waButton,
    footGithub: PROFILES.github ? `<li><a href="${esc(PROFILES.github)}" rel="me noopener" dir="ltr">GitHub</a></li>` : "",
    jsonld: JSON.stringify(jsonLd(cfg, D, L.code, { ogImage, lastmod: LASTMOD })).replace(/</g, "\\u003c")
  };
  html = html.replace(/\{\{(\w+)\}\}/g, (m, k) => { if (!(k in vals)) { fail(`${L.code}: unknown placeholder ${m}`); return m; } return vals[k]; });
  html = versionCodeRefs(html, L.code);

  // sanity checks on the final page
  if (/\{\{\w+\}\}/.test(html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, ""))) fail(`${L.code}: unreplaced placeholder left in page`);
  if (/data-i18n="[^"]+"[^>]*><\/\w+>/.test(html)) fail(`${L.code}: an element with data-i18n is still empty`);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) fail(`${L.code}: duplicate ids ${[...new Set(dup)].join(", ")}`);

  const file = path.join(OUT, L.path === "/" ? "index.html" : L.path.slice(1), L.path === "/" ? "" : "index.html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  return path.relative(ROOT, file);
}

function runtimeDict(L) {
  const { prefixes, exact } = cfg.runtimeKeys, T = D[L.code], out = {};
  for (const k of Object.keys(T)) if (exact.includes(k) || prefixes.some((p) => k.startsWith(p))) out[k] = T[k];
  const file = path.join(OUT, `assets/js/dict-${L.code}.js`);
  fs.writeFileSync(file, `/* generated by tools/build.mjs — do not edit */\nwindow.GD = window.GD || {};\nGD.dict = ${JSON.stringify(out)};\n`);
  return path.relative(ROOT, file);
}

const written = [];
for (const L of cfg.langs) { const dict = runtimeDict(L); written.push(render(L)); written.push(dict); }   // the dictionary is written first: the page carries its version
const put = (name, body) => { fs.writeFileSync(path.join(OUT, name), body); written.push(path.relative(ROOT, path.join(OUT, name))); };
put("sitemap.xml", sitemap(cfg, LASTMOD));
put("robots.txt", robots(cfg));
put("llms.txt", llms(cfg, D));
put("llms-full.txt", llmsFull(cfg, D));

// 404.html is written by hand (it needs absolute paths), but its theme settings come from src/site.json like every other page,
// and its stylesheet and script addresses carry the same asset versions as the other pages.
{
  const f = path.join(OUT, "404.html");
  if (fs.existsSync(f)) {
    const before = fs.readFileSync(f, "utf8");
    const after = versionCodeRefs(before, "404.html")
      .replace(/(<html\b[^>]*?\sdata-theme-default=")[^"]*(")/, `$1${THEME_DEFAULT}$2`)
      .replace(/<meta name="theme-color"[^>]*>/, `<meta name="theme-color" content="${THEME_COLOR[THEME_DEFAULT === "light" ? "light" : "dark"]}" data-dark="${THEME_COLOR.dark}" data-light="${THEME_COLOR.light}">`);
    if (after !== before) fs.writeFileSync(f, after);
  }
}

// CNAME is for custom domains only. A *.github.io address must not ship one; a custom domain must.
// So moving to your own domain later is a one-line change of "url" in src/site.json.
const HOST = new URL(cfg.url).hostname;
if (HOST.endsWith(".github.io")) fs.rmSync(path.join(OUT, "CNAME"), { force: true });
else put("CNAME", HOST);

// keys that no template uses and that the runtime does not load are dead weight
const { prefixes, exact } = cfg.runtimeKeys;
const dead = baseKeys.filter((k) => !used.has(k) && !exact.includes(k) && !prefixes.some((p) => k.startsWith(p)) && !k.startsWith("ld.") && !k.startsWith("meta."));
if (dead.length) console.warn("warning: unused keys:", dead.join(", "));

console.log(written.map((f) => "  " + f).join("\n"));
if (problems.length) { console.error("\nBUILD FAILED:\n - " + [...new Set(problems)].join("\n - ")); process.exit(1); }
console.log(`\nOK — ${cfg.langs.length} pages, lastmod ${LASTMOD}${opt("--out") ? ", output: " + OUT : ""}`);
