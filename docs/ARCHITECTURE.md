# GrowDev Portfolio — Architecture Constitution

Version: 0.4 | Date: 2026-11-18 | Author: Aziz Chaibi (with Claude)

Written with the *dev-architect* method: constitution first, then architecture, security, performance, design system and roadmap. The "discovery" phase is already answered by the brief:

| Question | Answer |
|---|---|
| Project type | Marketing and portfolio site, static, three languages |
| Users | Owners and managers of SMEs: Tunisia first, then Africa, then the world |
| Scale | Low traffic with spikes (a shared link on WhatsApp or LinkedIn) |
| Team and budget | One developer; no hosting budget |
| Deployment | GitHub Pages from GitHub Actions at `https://growdev.tn/` (own domain registered at OVHcloud, DNS zone and mailbox there too; organization `growdev-tn`, repository `growdev-tn.github.io`) |
| Compliance | The site collects no personal data (see §3) |

---

## 📜 Phase 1 — Constitution

### Mission

A fast, accessible, animated showcase that tells a non-technical owner what GrowDev does in one screen, lets them sketch their own system and send a brief, and is easy for search engines and AI assistants to read, in French, Arabic and English. Success: a visitor writes to GrowDev with a clear brief, and nothing on the site ever needs maintenance beyond editing text.

### Core principles

1. **Readable without JavaScript.** Every page is prerendered HTML. Scripts add interaction, never content. (Search, AI crawlers, slow phones, accessibility.)
2. **No runtime dependencies, no third-party requests.** No framework, no CDN, no analytics, no web-font service. (Privacy, speed, security, nothing to patch.)
3. **One source of truth.** `src/` generates everything. `site/*.html` is output; nobody edits it by hand.
4. **Three languages are equal.** Same keys, same structure. The build fails if a key, a placeholder or an HTML tag differs between languages. Arabic is right-to-left by design, not a mirror afterthought.
5. **Motion has a job and can be switched off.** Animation explains or guides, and respects `prefers-reduced-motion`. The theme wave only plays when the visitor presses the button.
6. **Honesty.** No invented clients, reviews, prices or partner badges. A client is shown only with the owner's confirmation that the client agrees (§5.6).
7. **Simple enough for a junior.** Change copy in a JSON file, run two commands, push.

### Hard constraints

| Area | Rule |
|---|---|
| Languages | French (`/`), Arabic (`/ar/`, `dir="rtl"`), English (`/en/`) |
| Hosting | GitHub Pages: static files only, no custom response headers, no server logic |
| Address | `https://growdev.tn/`, set once as `url` in `src/site.json`, next to `email` and `legacyHosts` (the earlier hosts, forbidden anywhere in the built site). For a custom domain the build writes `site/CNAME` itself; GitHub ignores that file for Actions deployments (the domain is set in Settings → Pages) and the checker keeps it equal to the host |
| Price | None published (25 Nov 2026): the price depends on the client and on the complexity of the project. The site names currencies ("quote in DT, in € or $") but never an amount; the checker enforces it |
| Data | No cookies, no personal data stored or sent. Only two `localStorage` keys, each written when the visitor clicks the matching control: `gd-lang` (language link) and `gd-theme` (light/dark button). The checker fails the build if any other key, a cookie or a network call appears in the scripts |
| Browsers | Current evergreen browsers (2022 onward). The FAQ's one-at-a-time behaviour (`<details name>`) needs Chrome 120, Safari 17.2 or Firefox 130; older browsers simply allow several answers open |
| Must not | Load anything from another host; add a cookie banner; claim unverifiable facts |

### Definition of done (every change)

- [ ] `npm run build` and `npm run check` both pass
- [ ] Looked at in the three languages, in both themes, at 390 px and 1440 px (and 320 px if the header or a card changed)
- [ ] Keyboard pass on anything interactive that changed
- [ ] Copy updated in all three JSON files (the build enforces it)
- [ ] Animations checked with reduced motion on

---

## 🏗️ Phase 2 — Architecture

### 2.1 Stack decisions

| Layer | Options considered | Chosen | Why |
|---|---|---|---|
| Rendering | Client-side i18n in the browser · Astro or Eleventy · a small custom build | **Custom Node build (`tools/build.mjs`, zero dependencies)** | One template and three dictionaries produce three real HTML pages. No `node_modules`, CI runs in seconds. Astro or Eleventy become worth it only when a blog arrives |
| Runtime JS | React · Alpine · vanilla modules | **Vanilla, 9 small scripts (about 13 KB gzipped)** | Interactions are few and local; no framework to load |
| CSS | Tailwind · CSS-in-JS · one hand-written stylesheet | **One stylesheet (about 9.5 KB gzipped), custom properties, logical properties** | Logical properties give RTL almost for free; no build step |
| Hosting | GitHub Pages · Cloudflare Pages · Netlify · OVH hosting | **GitHub Pages** | Free, automatic HTTPS, your choice, deploy from Actions |
| Fonts | Google Fonts · self-hosted woff2 | **Self-hosted variable woff2** | Privacy and one less connection; Arabic font loads only on `/ar/` |
| Images | PNG · WebP · SVG | **WebP and SVG; JPEG for share images** | Smallest sizes; share images about 110 KB for reliable chat previews |
| CI/CD | Manual upload · Actions | **GitHub Actions: build, check, deploy** | A broken page never goes live |
| Analytics | Google Analytics · privacy analytics · none | **None on the site**; Search Console and Bing for search data | Keeps the "no cookies, no trackers" promise; enquiries are counted from e-mails |

**Decision record: React and Tailwind.** The *web-artifacts-builder* skill targets interactive claude.ai artifacts built with React, Tailwind and shadcn/ui. For a public site that must rank in search and be quoted by AI assistants, client-rendered React would hide content behind JavaScript, add a runtime and a build chain, and gain nothing. What we kept from that skill is its design discipline: no centred-everything layouts, no purple gradients, no uniform rounded cards, no default fonts.

### 2.2 System overview

```
 src/index.template.html ─┐
 src/i18n/{fr,ar,en}.json ├─► tools/build.mjs ─┬─► site/index.html        fr  "/"
 src/site.json ───────────┤   (strict: fails    ├─► site/ar/index.html     ar  RTL
 tools/seo.mjs ───────────┘    on any gap)      ├─► site/en/index.html     en
                                                 ├─► site/assets/js/dict-{fr,ar,en}.js   runtime strings
                                                 └─► sitemap.xml · robots.txt · llms.txt · llms-full.txt

 tools/check.mjs ──► reads site/ and fails the build on SEO, links, a11y basics, CSP, budgets

 git push ─► GitHub Actions: build → check → upload-pages-artifact → deploy-pages
                                                  │
 Visitor ─► growdev.tn (OVH DNS: A, AAAA, www CNAME) ─► GitHub Pages (HTTPS)
```

### 2.3 Content model (instead of a database)

| Piece | Where | Rules |
|---|---|---|
| Template | `src/index.template.html` | `data-i18n="key"` shells, `data-i18n-attr="attr:key"`, `{{placeholder}}` |
| Dictionaries | `src/i18n/{fr,ar,en}.json`, flat keys | Same keys in all three; same `{vars}` and tags; Arabic adds plural forms |
| Site facts | `src/site.json` | URL, e-mail, founder, languages, `sameAs`, font preloads, runtime keys; since 24 Nov also `repo` (the source-code link), `profiles.github` and `profiles.linkedin` (Aziz's own pages) and `whatsapp` (digits with the country code). Empty means "leave it out"; the build validates their shape and the checker verifies the pages (§5.7) |
| Clients | `src/site.json` → `clients`, logos in `site/assets/img/clients/` | One `{ "name", "logo", "lang"? }` per client, in display order. The build writes the plates (each logo's real `width` and `height`, and a `?v=` version on its URL); the names also go into `llms.txt` and `llms-full.txt` (§5.6) |
| Runtime slice | `site/assets/js/dict-<lang>.js` (generated) | Only keys that scripts need (`mod.`, `hint.`, `sum.`, `phase.`, `brief.`, `theme.`, plus a handful of single keys such as `comp.hint` and `sim.say`: `runtimeKeys` in `src/site.json`) |
| Technology logos | `site/assets/img/tech/*.svg`, used with `data-logo="id"` in the template | The build writes the chip, the real size and the version (`docs/LOGOS.md`) |
| Structured data | `tools/seo.mjs` | One JSON-LD `@graph` per page, stable `@id`s. `SITUATIONS` and `DEV_AREAS` in the same file list the situation rows and the technical-profile areas for `llms.txt` and the checker |

Key namespaces: `meta`, `ld`, `nav`, `hero`, `sit`, `svc`, `clients`, `comp`, `method`, `sim`, `about`, `dev`, `facts`, `faq`, `contact`, `foot`, `mod`, `hint`, `sum`, `phase`, `brief`, `theme`. (The `cur` and `curfmt` namespaces of the old simulator no longer exist: there is no price on the site.)

### 2.4 "API" design

There is no API and no server, so there is nothing to attack. Contact works through a composed `mailto:` link, with a **Copy** button and a visible e-mail address as fallbacks.

🚨 **Trade-off:** `mailto:` needs a mail client on the visitor's device (common on phones, less so on shared desktops). The fallbacks cover it. If enquiries show friction, the next step is a form endpoint, which would add a third party and a privacy notice. Decide with real data, not before.

URL rules: `/` French, `/ar/` Arabic, `/en/` English; trailing slashes; reciprocal `hreflang`; `x-default` is English. Language links are plain `<a>` elements, so they work without JavaScript. The remembered choice is honoured only on `/`, never on `/ar/` or `/en/`, so crawlers and shared links always get the page they asked for.

### 2.5 Runtime modules

| File | Responsibility | Depends on |
|---|---|---|
| `boot.js` | Blocking script in `<head>`: adds the `js` class, sets the theme and the browser-bar colour before first paint, remembered-language redirect on `/` | nothing |
| `config.js` | Business constants: the contact e-mail (no price list, on purpose) | nothing |
| `dict-<lang>.js` | Generated runtime strings | build |
| `i18n.js` | `t()`, plural rules, number formats | dict |
| `hero.js` | Growth chart: bars as links, computed arrows, coin stack | i18n |
| `theme.js` | Light/dark toggle, memory, the wave (View Transitions), fallbacks, announcement | i18n |
| `ui.js` | Header, mobile menu, reveal on scroll, service cards, method timeline, language memory | i18n |
| `carousel.js` | The Clients carousel: endless belt, drag, arrows, Pause/Play, dots. Enhances markup that already works as a still wall | nothing (the DOM it enhances works without it) |
| `composer.js` | Chips → live map → phased scope → e-mail brief | i18n, config |
| `calculator.js` | Time-saving simulator: computes hours, days and the share of a full-time job (never money), writes the equation and caption, and one debounced sentence for screen readers (§5.7) | i18n |
| `main.js` | Starts the modules in order (`theme` first, so the toggle works before anything else) | all |
| `404.js` | Chooses the 404 language | nothing |

---

## 🔒 Phase 3 — Security

There are no accounts, no database, no uploads and no secrets, so the posture is "small surface, strict defaults".

| Area | Decision |
|---|---|
| Authentication | None |
| Personal data | None collected. The brief stays in the visitor's mail client until they press send. Only `gd-lang` and `gd-theme` (the two choices the visitor made) are stored locally |
| Transport | HTTPS by GitHub Pages (tick *Enforce HTTPS* once the certificate is issued) |
| CSP | Set by `<meta>`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'`. No inline scripts, no `eval`. The checker enforces it |
| Output handling | Visitor text is written with `textContent` and `encodeURIComponent`, never `innerHTML`. Page HTML comes only from our own dictionaries at build time |
| Supply chain | No runtime dependencies. The build tool has none. Playwright is used only on a developer machine for share images. Actions are pinned to major versions and updated by Dependabot |
| DNS and domain | `growdev.tn` is registered at OVHcloud. The zone holds the website records (four `A` and four `AAAA` on the bare domain, `www` as a `CNAME` to `growdev-tn.github.io.`), the mail records of the MX Plan mailbox (`MX`, SPF, DMARC) and the proofs of ownership (`TXT`). Rules: no wildcard record; delete the old OVH hosting records so that no foreign address sits next to GitHub's; verify the domain in GitHub (organization Settings → Pages) so that nobody else can claim it; a `CAA` record, if any, must allow `letsencrypt.org`; mail records are never edited for a website change. The `.tn` registry does not offer DNSSEC (OVH panel). The mail of `werchti.tn` (Zimbra) is a different system and is unrelated to this site. Details and findings: `INFRA-AUDIT.md` |
| Spam | The address is public text; Zimbra filtering is the defence. Obfuscating it would hurt accessibility |
| Monitoring | Actions logs, Search Console security report, a free uptime monitor |

🚨 **Known limits of GitHub Pages:** response headers cannot be set. A `<meta>` CSP cannot carry `frame-ancestors`, and there is no `X-Frame-Options`, so the page can be framed by another site. With no login and no actions this is low risk. If it ever matters, put Cloudflare (free) in front to add headers.

✅ **Improvement for later:** the 28 inline `style="--i:…"` attributes (animation stagger) are why `style-src` still allows `'unsafe-inline'`. Moving them to classes would let the CSP drop it. Scripts are already strict, which is the part that matters most.

Privacy note: with no cookies, analytics or forms, the site itself processes no personal data. If you add any of them, review Tunisian personal-data rules (organic law 2004-63) and the data-protection authority's requirements with a lawyer first.

---

## ⚡ Phase 4 — Performance

| Metric | Target | Alert | Measured 2026-11-15 |
|---|---|---|---|
| LCP (mobile, slow 4G) | < 2.5 s | > 4 s | 1.30 s dark, 1.43 s light (phone 390 px, CPU 4× slower, throttled network); 0.17 s on desktop |
| CLS | < 0.1 | > 0.25 | 0 on every run |
| INP | < 200 ms | > 500 ms | not measured (needs a real device or field data) |
| HTML, gzipped | ≤ 45 KB per page | checker fails | 13.1 to 14.5 KB (re-measured 2026-11-18, with the Clients carousel's controls and the asset versions) |
| CSS, gzipped | ≤ 22 KB | checker fails | 13.3 KB (re-measured 2026-11-18; the light theme and the toggle added about 2 KB, the Clients carousel 0.9 KB) |
| JavaScript, gzipped | ≤ 30 KB | checker fails | 20.9 to 21.2 KB (re-measured 2026-11-18; `carousel.js` is 4.1 KB of it, `theme.js` about 3 KB) |
| Client logos | ≤ 40 KB each | checker fails | 7.5 to 11.6 KB each, about 48 KB for the five. Lazy until the section is within 900 px of the screen, then all five load (the belt needs them all) |
| Third-party requests | 0 | any | 0 |

How the speed numbers were taken: headless Chromium against the built `site/` on a local server, median of three runs, first paint of the page with the saved theme already applied. The same method on the version before the themes gave a 1.25 s phone LCP and 0.17 s on desktop, so the themes cost about 50 ms on a slow phone and nothing measurable on desktop. A local server has no network distance: the numbers compare builds, they do not predict what a visitor in Sfax sees. Re-measure with Lighthouse or PageSpeed Insights after the next push.

- **Rendering:** content is in the HTML, so first paint does not wait for scripts. Only the two critical fonts are preloaded (the Arabic page preloads its own). `font-display: swap`.
- **Animation:** transforms and opacity only (the theme wave animates one `clip-path` on the browser's own snapshot, not the page); scroll handlers throttled with `requestAnimationFrame`; illustrations animate only while on screen (`IntersectionObserver`); everything stops under reduced motion.
- **Caching:** GitHub Pages sends a short cache lifetime (about 10 minutes) that cannot be changed, and file names carry no hash. On 17 Nov that showed a desktop browser a new page with the old cached stylesheet, and the new Clients section looked broken. Since 18 Nov every local stylesheet, script and client logo is requested as `file?v=<first eight hex digits of its SHA-256>`: `tools/build.mjs` writes the versions into the three pages and into `404.html`, and `tools/check.mjs` recomputes them and fails on a missing or stale one, so a stylesheet, script or logo edited without a build cannot reach the live site. A changed file has a new URL, so a fresh page can no longer pair with an old cached file. What is left is the reverse: an old cached page whose old file has left the browser's cache is answered with the new file (the server ignores the query), and shows a mismatch until the cached page expires, 10 minutes after it was fetched at most. That needs a cached page and an uncached file together, which is rare, and it heals itself.
- **Database, queues, workers:** not applicable.
- **Scalability ceiling:** GitHub Pages documents soft limits of 1 GB of site size and 100 GB of bandwidth per month. At roughly 250 KB per first visit that is several hundred thousand visits a month, far above the goal. Past that, put a CDN in front.

---

## 🎨 Phase 5 — Design system

### 5.1 Principles

Mobile-first. RTL-native. Two themes: dark (the default, and the look the brief asked for) and light, switched by the visitor (§5.5). WCAG 2.2 AA as the target. One accent family (green to sky), gold reserved for the coin in the hero (an illustration, no amount) and parallel work.

Dark theme (`:root`):

| Token | Value | Use | Contrast on `#020b18` |
|---|---|---|---|
| `--bg` / `--bg-2` | `#020b18` / `#041424` | Page, bands | — |
| `--panel` / `--panel-2` | `#06192c` / `#0a2138` | Cards | — |
| `--ink` | `#f2f6fa` | Headlines, body | 18.2 : 1 |
| `--ink-2` | `#b9c6d3` | Secondary text | 11.4 : 1 |
| `--muted` | `#8fa2b5` | Labels, hints | 7.5 : 1 (6.2 : 1 on `--panel-2`) |
| `--grow` / `--sky` | `#2fe56a` / `#00bafc` | Accent, gradient | 11.8 : 1 / 8.9 : 1 |
| `--gold` | `#f2b230` | Coins, "parallel" | 10.5 : 1 |
| Button text | `#02130a` on the gradient | Primary buttons | above 8.8 : 1 |

Light theme (`:root[data-theme="light"]`, same token names). Text colours are darker variants of the accents, because the bright green that glows on navy is too pale to read on white:

| Token | Value | Use | Contrast on `#eef3f8` (worst of the four surfaces) |
|---|---|---|---|
| `--bg` / `--bg-2` | `#eef3f8` / `#e3ebf3` | Page, bands | — |
| `--panel` / `--panel-2` | `#ffffff` / `#f5f8fc` | Cards | — |
| `--ink` | `#06192c` | Headlines, body | 15.9 : 1 (14.7 : 1) |
| `--ink-2` | `#33485c` | Secondary text | 8.5 : 1 (7.9 : 1) |
| `--muted` | `#475c71` | Labels, hints | 6.2 : 1 (5.7 : 1) |
| `--grow-ink` / `--sky-ink` / `--gold-ink` | `#07712f` / `#00679b` / `#8a5a00` | Accent text | 5.5 : 1 / 5.5 : 1 / 5.3 : 1 (all above 4.9 : 1) |
| `--grow` / `--sky` / `--gold` | `#0c9a4a` / `#0086c3` / `#b07100` | Fills, drawings, chart (not text) | 3.3 : 1 / 3.6 : 1 / 3.6 : 1 (graphics need 3 : 1) |
| Button text | `#02130a` on the gradient | Primary buttons | above 4.7 : 1 |

Type: Sora (display), IBM Plex Sans (text), IBM Plex Mono (labels), IBM Plex Sans Arabic (Arabic only). Fluid sizes with `clamp()`: `h1 2.3rem → 4.6rem`, `h2 1.95rem → 3.3rem`, body `1.0625rem / 1.6`. Arabic: root size +6.25 %, body line-height 1.75, letter-spacing 0.

Shapes: asymmetric corners (`--r-card: 6px 28px 6px 28px`, `--r-chip: 4px 16px 4px 16px`). Spacing: page gutter `clamp(20px, 4vw, 40px)`, max width 1200 px.

### 5.2 Component choices

Hand-built, no library: sticky header with language switch and the light/dark button, mobile full-screen menu below 1140 px (Escape closes it), gradient and ghost buttons, toggle chips (`aria-pressed`), bento service cards, one-at-a-time accordion (`details`), labelled fields, range sliders with live `<output>`, scroll-drawn timeline, "facts" list, footer.

### 5.3 Patterns

- **Forms:** labels always visible; nothing is sent to a server.
- **Empty state:** the composer shows a hint until a module is chosen.
- **Errors:** a trilingual 404 that picks the visitor's language.
- **Focus:** visible focus ring on every control.

### 5.4 Locale and RTL

- Layout uses logical properties (`inline-start`, `padding-inline`…). Arrows and chevrons flip. Range tracks and radial backgrounds mirror.
- Pictures stay as drawn (growth chart, marquee, system map, language switch) and are forced `direction: ltr`.
- The method timeline progresses right to left in Arabic.
- Numbers use Latin digits with a space as thousands separator (`fr-TN` style) in French and Arabic, `en-GB` style in English. The site shows no amount of money, so there are no currency patterns. No Hijri dates are shown.

### 5.5 Themes (dark and light) and the wave

- **Two themes, one set of names.** `:root` in `styles.css` holds the dark values; `:root[data-theme="light"]` gives the same names other values. Translucent tints are built from `*-rgb` triples (`rgba(var(--g-rgb), .3)`) so they switch with the theme. Text uses the `-ink` tokens; fills and drawings use the plain accent tokens, because a colour that works as a fill is often too pale as text on light. The three SVG gradients and the system-map core have their own light colours in CSS.
- **Default and memory.** `defaultTheme` in `src/site.json` is `"dark"` (now), `"light"` or `"system"` (follow the device, including a later change of the device setting). The visitor's click is stored in `localStorage["gd-theme"]` and wins over the default. `boot.js` is a plain `<script>` in `<head>` (no `defer`): it sets `data-theme` and the browser-bar colour before the first paint, so the page never flashes the wrong theme. `404.html` does the same.
- **The wave.** `theme.js` uses the View Transitions API. The browser takes a picture of the old page, the new theme is applied, and the *new* page is revealed through an organic outline that grows from the toggle (a 96-point polygon, 49 keyframes, three sine lobes with a random seed, 0.7 to 1.4 s) until it is past the farthest corner of the screen. It is a reveal, not a coloured layer laid over the page: every pixel is wholly the old theme or wholly the new one, so text and cards stay readable for the whole transition, in both directions. In Arabic the toggle sits on the left and the wave starts there.
- **Fallbacks.** Reduced motion: instant switch, no wave. A browser without View Transitions: a short cross-fade (`.theme-fade`). Storage blocked: the switch still works for the visit. A second open tab follows through the `storage` event. The hero canvas redraws in the new colours on the `gd:theme` event.
- **Accessibility.** The toggle is a `<button type="button">` named by its visible label ("Passer en mode clair", "Switch to dark mode", «التبديل إلى الوضع الفاتح»), which appears on hover and keyboard focus. It is 44 px on desktop and on phones from 375 px (42 px at 360 to 374 px, 40 px below). The change is announced in a `role="status"` region ("Mode clair activé").
- **Header width.** The five links, the language switch, the toggle and the call-to-action only fit side by side from 1141 px. Below that the links move into the Menu button (`@media (max-width:1140px)` in `styles.css`, `MENU_BREAKPOINT` in `ui.js`: the checker fails if the two numbers differ). Below 340 px the "GrowDev" word beside the logo is dropped; the logo link keeps its accessible name. **The header must never carry `backdrop-filter`, `filter`, `transform` or containment itself**: it hosts the fixed menu, and any of those makes the header the menu's container, so the menu collapses to a strip once the page is scrolled. The frosted bar is `.site-header::before`; the open menu is opaque (`.nav` background at least 0.9) and scrolls on its own; `ui.js` puts `is-menu-open` on the header so the bar turns opaque with it.
- **What `tools/check.mjs` enforces** (section "theme"): every colour token exists in both themes (unless listed as shared); text colours reach 4.5 : 1 and graphic colours 3 : 1 on all four surfaces of each theme; the browser-bar colour equals `--bg`; no colour is written directly in a rule or in the markup; every SVG gradient stop has a light colour; each page has the right default, toggle, status region and script order; no cookie, network call or other storage key in the scripts; the wave geometry (it runs `theme.js` in Node over 12 screen sizes, 6 starting points and 12 seeds: the outline must cover the whole screen at the end, start small and never shrink); reduced-motion and fallback code present; the menu breakpoint is the same in CSS and JS; nothing on `.site-header` can turn it into the menu's container; the open menu is at least 90 % opaque; any CSS rule that sets a width on an image that has width and height attributes also sets a height (else the picture is stretched).
- **What it cannot see** (checked by hand with a browser on 2026-11-15, see `docs/UX-AUDIT.md`): contrast on gradients and photos, header overlap at each width, and how the wave looks frame by frame.

### 5.6 Client logos (the "Clients" carousel)

A carousel of white plates, one logo each, between the marquee and the services (`#clients`, `.clients-sec`). It says who GrowDev has worked for and claims nothing else: the copy never says what was built for a client. A phone shows two plates and a quarter of the next one, which says "swipe" without a word; a tablet shows three plates and a desktop four.

- **The list is data, not markup.** `src/site.json` → `"clients"`, in display order: `{ "name": "Hijabella", "logo": "hijabella.webp" }`. Add `"lang": "ar"` (or `"fr"`, `"en"`) when the name is written in a language that is not the page's: a screen reader then pronounces it correctly (the build writes `lang` on a logo only on the pages in another language, and the checker fails an Arabic name without `"lang": "ar"`). The logo file lives in `site/assets/img/clients/`. The build opens every logo and writes its real `width` and `height` (`tools/imgsize.mjs`: PNG, JPEG, WebP, GIF and SVG, no dependency), so a logo cannot be given a wrong shape by hand, and ends the logo's URL with `?v=` and a hash of the file (see §4, Caching). The same names go into `llms.txt` and, once per language, `llms-full.txt`. Texts, in the three dictionaries: `clients.eyebrow`, `clients.title`, `clients.lead`, `clients.note`, `clients.role` (what a screen reader calls the widget), `clients.pause`, `clients.play`, `clients.prev`, `clients.next` (the button names) and `nav.clients` (the footer link).
- **To add a client:** put the logo in `site/assets/img/clients/` (WebP, PNG or SVG; ideally 400 px or more on the long side, or an SVG; at most 40 KB; the checker warns under 200 px), add one line to `"clients"`, run build and check. Nothing else changes: the belt takes the new plate in by itself and the dots follow. **How many plates are in view** is `--show` in the `.carousel` rules of `styles.css` (2.25 on phones, 3 from 600 px, 4 from 1000 px). It must stay below the number of clients: the belt needs at least one plate out of view, and between *n* − 1 and *n* it cannot fill its window all the way round, so it falls back to the still wall. In practice, with fewer than 4 clients a phone shows the still wall, and with 5 clients a desktop moves at 4 in view but shows a still row, without controls, at 5 in view. The checker warns about both.
- **How it works** (`assets/js/carousel.js`, 11.4 KB, 4.1 KB gzipped). The HTML is a plain `<ul>` of plates inside `.carousel__viewport`. Without the script it is a still wall (`.is-static`: 2 plates per row on phones, 3 from 600 px, 5 from 1000 px, a short last row centred), and it stays a still wall when every plate already fits and when the script fails (an error inside it, or a missing file). With the script it becomes an endless belt: the plates form a ring, one number (`pos`, in plates) says where the belt is, and each plate gets a `translate3d` worked out from it, so the page layout never changes and nothing jumps; a plate that leaves on one side comes back on the other. The belt only starts when the plates cover its window at every position, so no hole can show at the end of the ring. Arabic runs the other way (every move is multiplied by `dir`) and its arrows are mirrored.
- **By itself, and when it waits.** One step every 3.2 s, each taking 0.64 s (the checker refuses less than 2.5 s between steps: a logo needs time to be read). It holds still while the mouse is over the logos, while an arrow has keyboard focus, while the tab is hidden, while the section is out of view and while a finger or the mouse is dragging. Taking any control (an arrow, Pause, a drag) stops it for good until the visitor presses Play. Under `prefers-reduced-motion` nothing moves by itself, a step is instant, and the Pause button is hidden because there is nothing to pause. Pause/Play comes first in the tab order (WCAG 2.2.2: anything that moves by itself for more than five seconds must be stoppable).
- **Controls.** Pause/Play, Previous and Next (44 px targets), and dots that show where the belt is. The dots are decoration (`aria-hidden`, not buttons): five more tab stops would add nothing. Dragging works with a finger or the mouse (pointer events; `touch-action: pan-y`, so a vertical swipe still scrolls the page; a press counts as a drag after 6 px; a flick carries on by up to two plates; the belt always settles on a whole plate).
- **The logos outside the window.** The logos are `loading="lazy"`, which suits a section far down the page, but a browser never loads a lazy picture that an ancestor clips away, so the plates beyond the window would only start loading when they slid into view, and arrive empty. When the section comes within 900 px of the screen, the script sets all five to `eager`.
- **A white plate in both themes.** Logo files come with white backgrounds, and on the dark page they would show as white boxes. Each logo therefore sits on a white plate (`--logo-plate`, `#fff` in both token blocks) with the brand's asymmetric corners and a hairline border, in 4 : 3 proportion. The picture is fitted inside it with `object-fit: contain` in an absolutely positioned box, so a logo of any shape is neither stretched nor cropped. **Never recolour a client's logo**: no `filter`, blend mode or opacity, not even to suit the dark theme.
- **Preparing a logo.** WebP: lossless for flat-colour artwork, high-quality lossy for the rest. The source of one logo (Bonayaty) had its drop shadow cut by the bottom edge of the file, which would show as a hard line on a white plate, so its last rows were faded to white. Check any new logo for the same thing at its edges.
- **Accessibility.** The carousel is `role="group"` named by the section heading, with a translated `aria-roledescription` (`clients.role`). Pause/Play changes its accessible name with its state; its icons, like those of Previous and Next, are hidden from screen readers. Each logo's `alt` is the client's name; logos are not links, so there are no extra tab stops. Everything a screen reader needs is in the HTML (a list of named logos) and does not depend on the script. The control bar is hidden until the script has decided the belt can run, but its room is kept from the first paint, so the page does not shift (measured: 0). The reveal-on-scroll is on the carousel as a whole, not on the plates, because the belt owns the plates' `transform`.
- **No link in the header.** The header is already full between 1141 and 1400 px (§5.5), so the section is linked from the footer only. The scroll-spy tracks navigation links only, so it ignores the section by design.
- **What `tools/check.mjs` enforces** (section "clients", the per-page block and the theme section). *Logos:* the section exists on all three pages with the same logos in the same order as `src/site.json`; each `alt` is the client's name; the file exists in `assets/img/clients/` and `width` and `height` equal its real size (a warning under 200 px on the long side); at most 40 KB per logo; `lazy` and `async`; the right `lang` on each page; no two clients with the same name or file; a logo file that no client uses is reported; `--logo-plate` is `#fff` in both themes, `.client` uses it, and `.client img` keeps `object-fit: contain` and has no filter, blend mode or opacity; `llms.txt` lists every client and `llms-full.txt` lists each one once per language; for every image on every page, `width` and `height` have the real ratio of the file. *Carousel markup:* the wrapper (`data-carousel`, `role="group"` named by the heading, a translated `aria-roledescription`), the viewport, the list and the bar in that order; three buttons in the order Pause/Play, Previous, Next, each with `type="button"`, an accessible name and `aria-hidden` icons that exist in the sprite; the two Pause/Play names differ and it starts as Pause; the dots are `aria-hidden`; no plate carries `data-reveal`; the button names and the role description differ from the English text on the French and Arabic pages (so an untranslated string cannot slip through); `carousel.js` loads before `main.js`. *Stylesheet:* `touch-action: pan-y` on the viewport, the viewport clips, the belt is one row that does not wrap, `[hidden]` is honoured on the buttons, the bar is hidden without JavaScript and keeps its room before the script starts, a plate has no `transform` or `transition` of its own, the arrows are mirrored in Arabic, `--show` is a number of at least 1 (a whole number on the no-script wall), with warnings when it is between *n* − 1 and *n* or shows every client. *Script:* it still contains the parts that matter (reduced motion, hidden tab, out of view, `eager` loading, a cancelled touch, resizing, the Pause/Play name swap), at least 2.5 s between steps and a step of 0.3 to 1.2 s, it exports `GD.carousel.init`, `main.js` calls it, and the privacy scan (no cookie, network call or storage key) covers it. *Versions:* every local stylesheet, script and logo URL ends in `?v=` and the first eight characters of the file's SHA-256, in the three pages and in `404.html`; a missing or out-of-date version fails the check.
- **What it cannot see** (checked by hand in Chromium on 2026-11-17 and 2026-11-18, see the addendum in `docs/UX-AUDIT.md`): how the belt looks and feels in motion, the Arabic wording (the button names included), and Safari. The touch tests drive Chromium's touch events, not a finger on a phone. **It cannot know whether a client agrees to be shown.** Confirm that with each client before publishing (and with the employer, for a project delivered through one).

### 5.7 The two-visitor rework (21–24 Nov 2026)

Why: a visitor with no IT background had to understand the offer from technology names, the simulator showed numbers without saying what they were, and a recruiter found nothing about Aziz. The pieces below answer those two cases. The reasoning and the measurements are in the 24 Nov addendum of `docs/UX-AUDIT.md`; the commercial logic is in `docs/MARKETING-PLAN.md`.

- **Situation guide** (`#situations`, before the services). Six rows `<li><a class="pick" href="#svc-…">`: a first-person sentence (`sit.N.q`), a short title and one line (`sit.N.t`, `sit.N.p`), and an arrow. Each row leads to its service card, which the existing hash handling highlights (`is-hl`). The order and the targets live in `SITUATIONS` (`tools/seo.mjs`); the template, `llms.txt` and the checker read the same list. Six is the ceiling (Hick's law); a seventh row means removing one.
- **Plain words.** The hero lead, the situation guide and the contact text must not contain IT jargon (ERP, API, CRM, SaaS, workflow, framework, stack, DevOps, cron…). The checker enforces it (`JARGON` in `tools/check.mjs`). Product names stay in the service cards, the FAQ and the technical profile.
- **Simulator** (`calculator.js`). The formula is *people × hours per week × share that can be automated × 4.33 weeks = hours per month*; × 12 gives the year. **It never turns hours into money** (25 Nov 2026: the hourly cost, the currency picker and the "value of the time" result were removed, because the price of a project depends on the client and on the complexity of the project; the fine print under the result says so). `WEEKS` (4.33) and the 160-hour full-time month are constants in the script; the visible equation (`#e-people`, `#e-hours`, `#e-share`, `#e-total`), the `sim.how.*` text and the script must agree, and the checker compares them. Inputs come in the order of the sentence, each with a help line. The big numbers are animated and are **not** live regions; `#sim-say` (`role="status"`, polite, screen-reader only) is written 0.8 s after the visitor stops, and never on load. With reduced motion the numbers jump to their value.
- **Technical profile** (`#developpeur`, between `#about` and `#faq`). How Aziz works (`dev.how.*`), the proof (this website: three languages, no cookies, automatic checks), four technology areas (`dev.s1…s4`, `DEV_AREAS`) with logo chips, and the links, which come from the settings in `src/site.json` and appear only when set: source code (`repo`), GitHub and LinkedIn profiles (`profiles`), and a `mailto:` link to propose an assignment with a subject and a body to fill in. Profile links carry `rel="me noopener"`, the repository link `rel="noopener"`. The build refuses a `repo` that is not an `https://` address, any unknown `profiles` key, and a `whatsapp` value that is not 8 to 15 digits.
- **Technology logos.** Twelve SVG files and the `data-logo` mechanism: `docs/LOGOS.md`. They appear in the marquee, on the service cards and in the technical profile. A white plate in both themes (same reason as §5.6), the picture is decoration, the name is the text. The footer credits the sources (`foot.logos`).
- **Contact: two doors.** "You have a project" (a mail with a short guided body, the project builder, WhatsApp when a number is set) and "You are looking for a developer" (the assignment mail and a link to the technical profile), then "What happens next?" in three steps (a real sequence, so a numbered list). Both mail bodies end by asking how the sender heard about GrowDev, which is the only channel measurement the site has (`docs/MARKETING-PLAN.md` §6).
- **Method steps stay readable.** The timeline used to dim a whole step to 50% until it was reached; that failed the text contrast on phones. Now only the marker and the title colour change.
- **What `tools/check.mjs` enforces:** the section order; the six rows, their anchors and texts in three languages; the hero's two links; the jargon guard; the simulator's help line, signs, polite sentence, absence of live regions on animated numbers, and the agreement between formula and script; every logo (size read from the file, version, decoration, licence comment, credit, size budget, plain drawing); the marquee's two lists; the technical profile's links against `src/site.json`, `rel` values and mail bodies; the contact doors, steps and mail links; WhatsApp only with a number; the footer links; `llms.txt` sections. 4,089 checks in all on 24 Nov (with WhatsApp and LinkedIn set); each new rule was tested by breaking it (34 ways, all caught). On 25 Nov: no price anywhere (see "No price" in `docs/SEO-GEO-AEO.md`), answer-first FAQ openers, product-name capitals and the pricing sentence in `llms.txt`, the live-check workflow's name: 4,125 checks, 12 deliberate breakages, all caught.
- **What it cannot see** (checked by hand in Chromium on 24 Nov, see the addendum): whether the sentences make sense to a real visitor, the Arabic wording, Safari and real phones, how screen readers speak the rows and the simulator sentence, and whether the repository is public.

---

## 🗺️ Phase 6 — Roadmap

| Phase | Content | Status |
|---|---|---|
| **0 — Foundation** | Repo, build tool, design tokens, CSP, CI design | ✅ Done |
| **1 — Core loop** | Hero → services → composer → e-mail brief | ✅ Done |
| **2 — Secondary features** | Method, simulator, about, FAQ, contact; Arabic RTL; SEO, GEO, AEO; share images; 404 | ✅ Done |
| **3 — Hardening** | UX/UI audit and fixes, accessibility scan, performance numbers, cross-browser and real-device pass | ✅ Audit, axe scan, contrast and speed numbers done on 2026-11-15 (see `docs/UX-AUDIT.md`). ⏳ Still to do: real phones (iOS Safari, Samsung Internet), Lighthouse on the live address |
| **3b — Light theme** | Light/dark button with an organic wave, both themes audited | ✅ Done 2026-11-15 |
| **4 — Launch** | Push, enable Pages (GitHub Actions), Search Console, Bing, Google Business Profile, `sameAs` links | 🔄 Deployed at `growdev-tn.github.io` (7 Nov 2026); move to `growdev.tn` prepared 19 Nov 2026 (`DEPLOY.md`); Search Console and Bing next |
| **5 — Iteration** | Case studies, WhatsApp button, a blog in three languages, form endpoint if mailto shows friction | Backlog |

### Risk matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Deploy delay on GitHub Pages | Low | Low | Follow `DEPLOY.md`; a first deploy can take a few minutes |
| Arabic copy reads stiff to native readers | Medium | Medium | Have a native reader review `ar.json` before launch; wording changes need no code |
| Visitors without a mail client cannot send the brief | Medium | Medium | Copy button and visible address now; add WhatsApp or a form endpoint if data shows friction |
| Placeholder claims left in (quote policy wording, the freelance "yes") | Medium | Medium | The list in `CREATIVE-BRIEF.md` §8 must be answered before launch. The simulator's hourly costs no longer exist (25 Nov) |
| Search visibility is slow on a new site | High | Medium | Search Console and Bing on day one, backlinks from `werchti.tn` and profiles, steady content |
| A `github.io` address looks less professional than an own domain | Medium | Low | Handled: the domain `growdev.tn` was bought at OVHcloud; change `url`, `email` and `legacyHosts` in `src/site.json`, rebuild, regenerate the share images, push (see `DEPLOY.md`); GitHub redirects the old address. New dependency: the domain's renewal date, because the site and the mailbox both stop if it lapses |
| Someone edits generated HTML by hand | Medium | Low | README warning; the CI rebuilds and overwrites |
| GitHub Pages feature or limit changes | Low | Low | The `site/` folder is plain static files and can move to any host |

### Technical debt budget

Acceptable now, to be repaid:

- Inline `style="--i:…"` attributes (see Phase 3).
- No file hashing for cache busting.
- No automated visual regression tests (the checker covers structure, contrast tokens and the wave's geometry, not looks).
- The browser-level test scripts (behaviour, axe, real-background contrast, header sweep, speed) were run from a scratch folder and are not in the repo; the results are recorded in `docs/UX-AUDIT.md`.

Never acceptable, even in an MVP: invented proof, third-party trackers, content that needs JavaScript to be read, an untested language.

---

## ▶️ Next steps

1. **Deploy with the commands in `DEPLOY.md`**: organization `growdev-tn`, repository `growdev-tn.github.io`, Pages source *GitHub Actions*, custom domain `growdev.tn` (set it once the DNS records are in place; see the order of operations in `DEPLOY.md`).
2. **Answer the open questions** in `CREATIVE-BRIEF.md` §8 (founder spelling, case studies, WhatsApp number, quote policy, partner status) and have a native speaker read the Arabic page.
3. **Right after the deploy works:** add the site to Search Console and Bing, submit the sitemap, create the LinkedIn page and add its address to `sameAs` (`src/site.json`, which already lists `https://github.com/aziz-art`).
