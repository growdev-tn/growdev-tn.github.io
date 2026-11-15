# GrowDev Portfolio — Architecture Constitution

Version: 0.2 | Date: 2026-11-15 | Author: Aziz Chaibi (with Claude)

Written with the *dev-architect* method: constitution first, then architecture, security, performance, design system and roadmap. The "discovery" phase is already answered by the brief:

| Question | Answer |
|---|---|
| Project type | Marketing and portfolio site, static, three languages |
| Users | Owners and managers of SMEs: Tunisia first, then Africa, then the world |
| Scale | Low traffic with spikes (a shared link on WhatsApp or LinkedIn) |
| Team and budget | One developer; no hosting budget |
| Deployment | GitHub Pages from GitHub Actions at `https://growdev-tn.github.io/` (organization `growdev-tn`, repository `growdev-tn.github.io`); no DNS to manage |
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
6. **Honesty.** No invented clients, reviews, prices or partner badges.
7. **Simple enough for a junior.** Change copy in a JSON file, run two commands, push.

### Hard constraints

| Area | Rule |
|---|---|
| Languages | French (`/`), Arabic (`/ar/`, `dir="rtl"`), English (`/en/`) |
| Hosting | GitHub Pages: static files only, no custom response headers, no server logic |
| Address | `https://growdev-tn.github.io/`, set once as `url` in `src/site.json`. Moving to a custom domain later is a one-line change; the build then writes `site/CNAME` itself |
| Currency | DT first and default; MAD, DZD, EGP, XOF, EUR, USD selectable |
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
 Visitor ─► growdev-tn.github.io ─► GitHub Pages (HTTPS)
```

### 2.3 Content model (instead of a database)

| Piece | Where | Rules |
|---|---|---|
| Template | `src/index.template.html` | `data-i18n="key"` shells, `data-i18n-attr="attr:key"`, `{{placeholder}}` |
| Dictionaries | `src/i18n/{fr,ar,en}.json`, flat keys | Same keys in all three; same `{vars}` and tags; Arabic adds plural forms |
| Site facts | `src/site.json` | URL, e-mail, founder, languages, `sameAs`, font preloads, runtime keys |
| Runtime slice | `site/assets/js/dict-<lang>.js` (generated) | Only keys that scripts need (`mod.`, `hint.`, `sum.`, `phase.`, `brief.`, `curfmt.`…) |
| Structured data | `tools/seo.mjs` | One JSON-LD `@graph` per page, stable `@id`s |

Key namespaces: `meta`, `ld`, `hero`, `svc`, `comp`, `method`, `sim`, `about`, `facts`, `faq`, `contact`, `foot`, `mod`, `hint`, `sum`, `phase`, `brief`, `cur`, `curfmt`.

### 2.4 "API" design

There is no API and no server, so there is nothing to attack. Contact works through a composed `mailto:` link, with a **Copy** button and a visible e-mail address as fallbacks.

🚨 **Trade-off:** `mailto:` needs a mail client on the visitor's device (common on phones, less so on shared desktops). The fallbacks cover it. If enquiries show friction, the next step is a form endpoint, which would add a third party and a privacy notice. Decide with real data, not before.

URL rules: `/` French, `/ar/` Arabic, `/en/` English; trailing slashes; reciprocal `hreflang`; `x-default` is English. Language links are plain `<a>` elements, so they work without JavaScript. The remembered choice is honoured only on `/`, never on `/ar/` or `/en/`, so crawlers and shared links always get the page they asked for.

### 2.5 Runtime modules

| File | Responsibility | Depends on |
|---|---|---|
| `boot.js` | Blocking script in `<head>`: adds the `js` class, sets the theme and the browser-bar colour before first paint, remembered-language redirect on `/` | nothing |
| `config.js` | Business constants: e-mail, default currency, hourly costs | nothing |
| `dict-<lang>.js` | Generated runtime strings | build |
| `i18n.js` | `t()`, plural rules, number and currency formats | dict |
| `hero.js` | Growth chart: bars as links, computed arrows, coin stack | i18n |
| `theme.js` | Light/dark toggle, memory, the wave (View Transitions), fallbacks, announcement | i18n |
| `ui.js` | Header, mobile menu, reveal on scroll, service cards, method timeline, language memory | i18n |
| `composer.js` | Chips → live map → phased scope → e-mail brief | i18n, config |
| `calculator.js` | Savings simulator | i18n, config |
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
| DNS and domain | No DNS record is needed on `growdev-tn.github.io`, so there is no subdomain to take over. If a custom domain is added later: no wildcard CNAME to GitHub, verify the domain in GitHub (organization Settings → Pages), and a CAA record, if any, must allow `letsencrypt.org`. The mail records of `werchti.tn` (MX, Zimbra) are unrelated to the site and must not be touched |
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
| HTML, gzipped | ≤ 45 KB per page | checker fails | 12.3 to 13.6 KB |
| CSS, gzipped | ≤ 22 KB | checker fails | 11.6 KB (the light theme and the toggle added about 2 KB) |
| JavaScript, gzipped | ≤ 30 KB | checker fails | 16.6 to 17.0 KB (`theme.js` is about 3 KB of it) |
| Third-party requests | 0 | any | 0 |

How the speed numbers were taken: headless Chromium against the built `site/` on a local server, median of three runs, first paint of the page with the saved theme already applied. The same method on the version before the themes gave a 1.25 s phone LCP and 0.17 s on desktop, so the themes cost about 50 ms on a slow phone and nothing measurable on desktop. A local server has no network distance: the numbers compare builds, they do not predict what a visitor in Sfax sees. Re-measure with Lighthouse or PageSpeed Insights after the next push.

- **Rendering:** content is in the HTML, so first paint does not wait for scripts. Only the two critical fonts are preloaded (the Arabic page preloads its own). `font-display: swap`.
- **Animation:** transforms and opacity only (the theme wave animates one `clip-path` on the browser's own snapshot, not the page); scroll handlers throttled with `requestAnimationFrame`; illustrations animate only while on screen (`IntersectionObserver`); everything stops under reduced motion.
- **Caching:** GitHub Pages sends a short cache lifetime (about 10 minutes) that cannot be changed, and file names carry no hash. Acceptable for a three-page site. If stale files ever become a problem, add `?v=` to asset URLs in the template.
- **Database, queues, workers:** not applicable.
- **Scalability ceiling:** GitHub Pages documents soft limits of 1 GB of site size and 100 GB of bandwidth per month. At roughly 250 KB per first visit that is several hundred thousand visits a month, far above the goal. Past that, put a CDN in front.

---

## 🎨 Phase 5 — Design system

### 5.1 Principles

Mobile-first. RTL-native. Two themes: dark (the default, and the look the brief asked for) and light, switched by the visitor (§5.5). WCAG 2.2 AA as the target. One accent family (green to sky), gold reserved for money and parallel work.

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
- Numbers use Latin digits with a space as thousands separator (`fr-TN` style) in French and Arabic, `en-GB` style in English. Currency patterns come from the dictionaries (`{n} DT`, `{n} د.ت`, `€{n}`, `${n}`). No Hijri dates are shown.

### 5.5 Themes (dark and light) and the wave

- **Two themes, one set of names.** `:root` in `styles.css` holds the dark values; `:root[data-theme="light"]` gives the same names other values. Translucent tints are built from `*-rgb` triples (`rgba(var(--g-rgb), .3)`) so they switch with the theme. Text uses the `-ink` tokens; fills and drawings use the plain accent tokens, because a colour that works as a fill is often too pale as text on light. The three SVG gradients and the system-map core have their own light colours in CSS.
- **Default and memory.** `defaultTheme` in `src/site.json` is `"dark"` (now), `"light"` or `"system"` (follow the device, including a later change of the device setting). The visitor's click is stored in `localStorage["gd-theme"]` and wins over the default. `boot.js` is a plain `<script>` in `<head>` (no `defer`): it sets `data-theme` and the browser-bar colour before the first paint, so the page never flashes the wrong theme. `404.html` does the same.
- **The wave.** `theme.js` uses the View Transitions API. The browser takes a picture of the old page, the new theme is applied, and the *new* page is revealed through an organic outline that grows from the toggle (a 96-point polygon, 49 keyframes, three sine lobes with a random seed, 0.7 to 1.4 s) until it is past the farthest corner of the screen. It is a reveal, not a coloured layer laid over the page: every pixel is wholly the old theme or wholly the new one, so text and cards stay readable for the whole transition, in both directions. In Arabic the toggle sits on the left and the wave starts there.
- **Fallbacks.** Reduced motion: instant switch, no wave. A browser without View Transitions: a short cross-fade (`.theme-fade`). Storage blocked: the switch still works for the visit. A second open tab follows through the `storage` event. The hero canvas redraws in the new colours on the `gd:theme` event.
- **Accessibility.** The toggle is a `<button type="button">` named by its visible label ("Passer en mode clair", "Switch to dark mode", «التبديل إلى الوضع الفاتح»), which appears on hover and keyboard focus. It is 44 px on desktop and on phones from 375 px (42 px at 360 to 374 px, 40 px below). The change is announced in a `role="status"` region ("Mode clair activé").
- **Header width.** The five links, the language switch, the toggle and the call-to-action only fit side by side from 1141 px. Below that the links move into the Menu button (`@media (max-width:1140px)` in `styles.css`, `MENU_BREAKPOINT` in `ui.js`: the checker fails if the two numbers differ). Below 340 px the "GrowDev" word beside the logo is dropped; the logo link keeps its accessible name. **The header must never carry `backdrop-filter`, `filter`, `transform` or containment itself**: it hosts the fixed menu, and any of those makes the header the menu's container, so the menu collapses to a strip once the page is scrolled. The frosted bar is `.site-header::before`; the open menu is opaque (`.nav` background at least 0.9) and scrolls on its own; `ui.js` puts `is-menu-open` on the header so the bar turns opaque with it.
- **What `tools/check.mjs` enforces** (section "theme"): every colour token exists in both themes (unless listed as shared); text colours reach 4.5 : 1 and graphic colours 3 : 1 on all four surfaces of each theme; the browser-bar colour equals `--bg`; no colour is written directly in a rule or in the markup; every SVG gradient stop has a light colour; each page has the right default, toggle, status region and script order; no cookie, network call or other storage key in the scripts; the wave geometry (it runs `theme.js` in Node over 12 screen sizes, 6 starting points and 12 seeds: the outline must cover the whole screen at the end, start small and never shrink); reduced-motion and fallback code present; the menu breakpoint is the same in CSS and JS; nothing on `.site-header` can turn it into the menu's container; the open menu is at least 90 % opaque; any CSS rule that sets a width on an image that has width and height attributes also sets a height (else the picture is stretched).
- **What it cannot see** (checked by hand with a browser on 2026-11-15, see `docs/UX-AUDIT.md`): contrast on gradients and photos, header overlap at each width, and how the wave looks frame by frame.

---

## 🗺️ Phase 6 — Roadmap

| Phase | Content | Status |
|---|---|---|
| **0 — Foundation** | Repo, build tool, design tokens, CSP, CI design | ✅ Done |
| **1 — Core loop** | Hero → services → composer → e-mail brief | ✅ Done |
| **2 — Secondary features** | Method, simulator, about, FAQ, contact; Arabic RTL; SEO, GEO, AEO; share images; 404 | ✅ Done |
| **3 — Hardening** | UX/UI audit and fixes, accessibility scan, performance numbers, cross-browser and real-device pass | ✅ Audit, axe scan, contrast and speed numbers done on 2026-11-15 (see `docs/UX-AUDIT.md`). ⏳ Still to do: real phones (iOS Safari, Samsung Internet), Lighthouse on the live address |
| **3b — Light theme** | Light/dark button with an organic wave, both themes audited | ✅ Done 2026-11-15 |
| **4 — Launch** | Push, enable Pages (GitHub Actions), Search Console, Bing, Google Business Profile, `sameAs` links | 🔄 Deployed at `growdev-tn.github.io` (7 Nov 2026); Search Console and Bing next |
| **5 — Iteration** | Case studies, WhatsApp button, a blog in three languages, form endpoint if mailto shows friction | Backlog |

### Risk matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Deploy delay on GitHub Pages | Low | Low | Follow `DEPLOY.md`; a first deploy can take a few minutes |
| Arabic copy reads stiff to native readers | Medium | Medium | Have a native reader review `ar.json` before launch; wording changes need no code |
| Visitors without a mail client cannot send the brief | Medium | Medium | Copy button and visible address now; add WhatsApp or a form endpoint if data shows friction |
| Placeholder claims left in (hourly costs, quote policy) | Medium | Medium | The list in `CREATIVE-BRIEF.md` §8 must be answered before launch |
| Search visibility is slow on a new site | High | Medium | Search Console and Bing on day one, backlinks from `werchti.tn` and profiles, steady content |
| A `github.io` address looks less professional than an own domain | Medium | Low | Buy a domain later; change `url` in `src/site.json`, rebuild, push (see `DEPLOY.md`); GitHub redirects the old address |
| Someone edits generated HTML by hand | Medium | Low | README warning; the CI rebuilds and overwrites |
| GitHub Pages feature or limit changes | Low | Low | The `site/` folder is plain static files and can move to any host |

### Technical debt budget

Acceptable now, to be repaid:

- Inline `style="--i:…"` attributes (see Phase 3).
- No file hashing for cache busting.
- Hourly-cost defaults in the simulator are rough placeholders.
- No automated visual regression tests (the checker covers structure, contrast tokens and the wave's geometry, not looks).
- The browser-level test scripts (behaviour, axe, real-background contrast, header sweep, speed) were run from a scratch folder and are not in the repo; the results are recorded in `docs/UX-AUDIT.md`.

Never acceptable, even in an MVP: invented proof, third-party trackers, content that needs JavaScript to be read, an untested language.

---

## ▶️ Next steps

1. **Deploy with the commands in `DEPLOY.md`**: organization `growdev-tn`, repository `growdev-tn.github.io`, Pages source *GitHub Actions*, no custom domain.
2. **Answer the open questions** in `CREATIVE-BRIEF.md` §8 (founder spelling, case studies, WhatsApp number, quote policy, partner status) and have a native speaker read the Arabic page.
3. **Right after the deploy works:** add the site to Search Console and Bing, submit the sitemap, create the LinkedIn page and add its address to `sameAs` (`src/site.json`, which already lists `https://github.com/aziz-art`).
