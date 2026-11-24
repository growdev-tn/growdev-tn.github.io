# GrowDev: portfolio site

Animated portfolio for **GrowDev** (Odoo ERP, web, WordPress, PrestaShop, mobile apps, automation), in **French, Arabic and English**, for Tunisia first, then Africa, then the world.

Live address: **https://growdev.tn/** · French `/` · Arabic `/ar/` (right-to-left) · English `/en/`

No framework, no runtime dependencies, no cookies, no third-party requests. A zero-dependency Node script turns one template and three dictionaries into three real HTML pages.

Two looks: **dark** (the default) and **light**, switched with the sun/moon button in the header. The change plays as an organic wave that starts at the button and reveals the new theme, so text and cards stay readable throughout; with reduced motion it switches at once. The visitor's choice is remembered on their device (`localStorage`, no cookie).

## ⚠️ The one rule

**Edit `src/`. Never edit the generated files.** They are overwritten by every build (locally and in CI):

`site/index.html` · `site/ar/index.html` · `site/en/index.html` · `site/assets/js/dict-*.js` · `site/sitemap.xml` · `site/robots.txt` · `site/llms.txt` · `site/llms-full.txt`

`site/CNAME` is also managed by the build: it exists only when `url` in `src/site.json` is a custom domain, and is removed for a `github.io` address.

**After you edit a stylesheet, a script or a logo (client or technology), run the build again.** Every local stylesheet, script and logo is requested as `file?v=<hash of the file>`; the build writes that version into the three pages and into `site/404.html` (which is hand-written, but gets its versions and theme settings from the build). It is what stops a visitor's browser from pairing a new page with an old cached stylesheet. The check fails with "carries the version … but the file now hashes to …" if you forget.

## Everyday commands

You need Node 18 or newer, or Docker. Nothing else to install.

```bash
node tools/build.mjs      # src/ → site/   (fails if a translation is missing or inconsistent)
node tools/check.mjs      # SEO, links, accessibility basics, CSP, size budgets (fails the deploy)
npm run serve             # preview at http://localhost:8080  (needs python3)
```

Without Node on your PC (Windows, PowerShell), run the same two commands in Docker, from the project folder:

```powershell
docker run --rm -v "${PWD}:/app" -w /app node:22-alpine node tools/build.mjs
docker run --rm -v "${PWD}:/app" -w /app node:22-alpine node tools/check.mjs
```

## What to edit

| To change… | Edit |
|---|---|
| Any text (all three languages) | `src/i18n/fr.json`, `src/i18n/ar.json`, `src/i18n/en.json`. Keep the same keys in all three; the build tells you what is missing |
| Page structure, sections, order | `src/index.template.html` (`data-i18n="key"` marks translated text) |
| **Clients** shown in the "Clients" carousel (name and logo) | One line each in `"clients"` in `src/site.json`, plus the logo file in `site/assets/img/clients/`. The build reads the logo's real size. The heading, the note and the button names are `clients.*` in the three JSON files. How many plates are in view at once: `--show` in the `.carousel` rules of `styles.css`. Details and the rules: `docs/ARCHITECTURE.md` §5.6 |
| E-mail, founder, **site address (`url`)**, the organisation's profiles (`sameAs`), languages, whether AI training crawlers are allowed (`allowAiTraining`) | `src/site.json` |
| **Aziz's profile links and the WhatsApp button** (technical profile and contact section) | `src/site.json`: `"repo"` (source-code link), `"profiles": { "github", "linkedin" }`, `"whatsapp"` (digits with the country code). An empty value leaves the item out. Then build. Details: `docs/HANDOVER.md` (open tasks 9 and 10) |
| **Technology logos** (marquee, service cards, technical profile) | Write `<li data-logo="python">Python</li>` in the template and keep the file in `site/assets/img/tech/`. Sources, licences, how to add one: `docs/LOGOS.md` |
| The **situation guide** ("Which of these sounds like you?") | `sit.*` in the three JSON files, the six rows in `src/index.template.html`, and `SITUATIONS` in `tools/seo.mjs` (same order and targets) |
| **Which theme a first-time visitor sees** (`"defaultTheme"`: `"dark"` now, `"light"`, or `"system"` to follow the visitor's phone or computer) and the browser-bar colours (`"themeColor"`) | `src/site.json`, then build |
| Colours of either theme | The two token blocks at the top of `site/assets/css/styles.css` (`:root` = dark, `:root[data-theme="light"]` = light). Give every colour a value in both; the checker tells you if you forget one or if a text colour is too pale |
| Structured data, sitemap, robots, llms.txt | `tools/seo.mjs` |
| Look and animation | `site/assets/css/styles.css`, `site/assets/js/*.js` (the theme button and wave: `theme.js`; the wave's duration and shape: the `wave` object at the top of that file) |
| Simulator hourly costs, default currency | `site/assets/js/config.js` |
| Share images (WhatsApp, LinkedIn…) | `tools/og.html`, then `npm i -D playwright && npx playwright install chromium && npm run og` |

## Project layout

```
src/                  sources: template, translations, site facts
site/                 what gets published (generated pages + static assets)
tools/                build.mjs · check.mjs · seo.mjs · make-og.cjs · og.html
docs/                 documentation (see below)
.github/workflows/    build → check → deploy to GitHub Pages
branding/             original logo file
```

## Publish

Push to `main`. GitHub Actions builds, runs the checks and deploys in about a minute. Everyday commands (PowerShell, Docker, SSH), the domain and mailbox setup at OVHcloud, Search Console, the AI-crawler policy and a first-time setup: **[docs/DEPLOY.md](docs/DEPLOY.md)**.

## Documentation

| File | What it is |
|---|---|
| [docs/DEPLOY.md](docs/DEPLOY.md) | Publishing on `growdev.tn` (GitHub Pages, OVHcloud DNS and mail): PowerShell, Docker and SSH commands, the order of operations for the domain and the mailbox, Search Console, AI-crawler policy, troubleshooting |
| [docs/SEO-GEO-AEO.md](docs/SEO-GEO-AEO.md) | What is built in for search engines and AI assistants, keyword map, launch checklist |
| [docs/CREATIVE-BRIEF.md](docs/CREATIVE-BRIEF.md) | Audience, messaging, tone, visual direction, open questions |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Principles, stack decisions, security, performance, design system, roadmap |
| [docs/UX-AUDIT.md](docs/UX-AUDIT.md) | UX/UI audit of 15 Nov 2026: scores, evidence (accessibility scan, contrast, layout, speed), what was fixed, what is left; plus addenda of 17 and 18 Nov on the Clients section and its carousel, of 19 Nov on the contact address and of 24 Nov on the two visitors (a business owner and a technical hirer): user stories, simulator, situation guide, technical profile, browser test results |
| [docs/MARKETING-PLAN.md](docs/MARKETING-PLAN.md) | One-page marketing plan after Allan Dib's *The 1-Page Marketing Plan*: the nine squares applied to GrowDev with only true claims, which part of the site serves which square, the decisions Aziz still has to make, and how to measure without trackers |
| [docs/LOGOS.md](docs/LOGOS.md) | The twelve technology logos: sources, licences (CC0, CC BY 3.0, MIT), the `data-logo` mechanism, how to add or remove one |
| [docs/INFRA-AUDIT.md](docs/INFRA-AUDIT.md) | Infrastructure audit of 19 Nov 2026 (domain, DNS, mail, HTTPS, headers, performance): what was measured, what could not be, what to fix and what to re-run once the domain is live |

## Credits and licence

Fonts (self-hosted, SIL Open Font License 1.1): [Sora](https://github.com/sora-xor/sora-font), [IBM Plex Sans, Mono and Sans Arabic](https://github.com/IBM/plex).

No open-source licence is granted for the code or the brand assets: all rights reserved by GrowDev unless the owner adds a `LICENSE` file.
