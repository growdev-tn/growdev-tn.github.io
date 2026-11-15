# Handover: where the project stands (2026-11-15)

Read this first in a new session. Then `README.md`, then the other files in `docs/`.

## State

- Trilingual static site (fr `/`, ar `/ar/` RTL, en `/en/`), generated from `src/` by `tools/build.mjs`. DT is the first currency. SEO, GEO and AEO layer built in.
- `node tools/build.mjs && node tools/check.mjs` ends with **All checks passed** (1,290 checks; the checker was tested against deliberate breakages, including the robots and CNAME rules and, since 15 Nov, the theme rules: missing light colour, low contrast, a wave that stops short, mismatched menu breakpoint).
- **Dark and light theme** with a wave transition (added 15 Nov 2026). Default is dark: `"defaultTheme"` in `src/site.json` (`dark`, `light` or `system`). Visitors' choice is kept in `localStorage["gd-theme"]`; the only other stored key is `gd-lang`. See `docs/ARCHITECTURE.md` §5.5.
- **Header:** the five links move into the Menu button below 1140 px (before: 900 px), because the theme button made the bar too tight. The number is in two places (`styles.css` and `MENU_BREAKPOINT` in `ui.js`); the checker fails if they differ.
- Address: `https://growdev-tn.github.io/`. It is the single `url` setting in `src/site.json`; the sitemap, canonical tags, `hreflang`, JSON-LD, share-image links, `llms.txt`, `robots.txt` and the launch script all follow it. There is no `site/CNAME` (the build removes it for a `github.io` address and writes it for a custom domain).
- GitHub: user `aziz-art`, organization `growdev-tn`, repository `growdev-tn/growdev-tn.github.io`, remote `git@github.com:growdev-tn/growdev-tn.github.io.git`. `sameAs` in `src/site.json` lists `https://github.com/aziz-art`.
- `robots.txt` blocks the AI training crawlers (`"allowAiTraining": false`) and allows search engines and AI assistants that answer with live results.
- The share images `og-fr/ar/en.jpg` show `growdev-tn.github.io`. They come from `tools/og.html`; regenerate them with `npm run og` whenever the address changes.
- Deployed with `.github/workflows/pages.yml` (Pages source: GitHub Actions). `docs/DEPLOY.md` and `tools/verify-launch.sh` describe and test it. No DNS record is used. The old plan (`growdev.werchti.tn` through OVH) was dropped on 2026-11-07.

## Open tasks

1. **After each push:** run `bash tools/verify-launch.sh`, then do the launch checklist in `docs/SEO-GEO-AEO.md` §3 (Search Console as a URL-prefix property, Bing, Rich Results test). The live address could not be reached from the build environment, so nothing about the live site was checked on 15 Nov.
2. **Audit follow-up:** `docs/UX-AUDIT.md` (20/23) lists six priority actions and five quick wins. None changes the approved dark look without your say-so. The ones that need you: a WhatsApp or phone number, which projects may be named as case studies, a native Arabic read of `ar.json`.
3. **Real devices:** open the three pages on an iPhone (Safari) and a Samsung or other Android phone, in both themes, and press the sun/moon button once on each. Everything else in the audit was measured in a desktop Chromium.
4. **Lighthouse / PageSpeed** on the live address once the next push is live (the numbers in `docs/ARCHITECTURE.md` §4 come from a local server).
5. **Preview and video:** no online preview and no demo video were produced.
6. **Dependabot:** the previous session's notes mention a Dependabot pull request (#1). It is not part of this archive: open *Pull requests* on GitHub, read what it changes, then merge or close it.

## Questions for the owner (draft content to confirm)

- Founder name and Arabic spelling (currently «عزيز الشايبي»).
- FAQ quote policy: no fixed prices; DT in Tunisia, € or $ abroad.
- Simulator default hourly costs (15 DT, 50 MAD, 700 DZD, 250 EGP, 3 000 XOF, 20 €, 22 $) are rough placeholders.
- Official Odoo partner? (nothing in the copy claims it.)
- Case studies: which projects may be named (Werchti, IqrarSanté?).
- A WhatsApp or phone number to add (only e-mail today).
- A native reader should review `src/i18n/ar.json`.
- "GEO" was read both as Generative Engine Optimization and as geographic targeting.

## Rules and gotchas

- Edit `src/` only. `site/index.html`, `site/ar/index.html`, `site/en/index.html`, `site/assets/js/dict-*.js`, sitemap, robots and llms files are generated.
- Share images: `tools/og.html` → `npm run og` (needs Playwright, developer machine only). The build fails if `og-<lang>.jpg` is missing.
- `site/404.html` uses absolute paths: it works at the root of a host, which is where the site now lives. It would not work under a sub-path such as `…github.io/some-repo/`.
- GitHub Pages cannot set response headers; the CSP is a `<meta>` tag. 28 inline `style` attributes keep `style-src 'unsafe-inline'`.
- The browser-level test scripts (Playwright: behaviour of the theme button, axe scan, real-background contrast, header sweep from 320 to 1400 px, speed) lived in a scratch folder and are not part of the repo. Their results are in `docs/UX-AUDIT.md`. `tools/check.mjs` keeps the rules that can be checked without a browser.
- **Do not add a colour straight into a rule** (`#abc`, `rgba(…)`): the checker fails the build. Add a token to both theme blocks of `styles.css` and use `var(--name)`.
- **Theme and the first paint:** `boot.js` must stay a plain script in `<head>` (no `defer`). If it moves, the page flashes the wrong theme before settling.
- **`defaultTheme` `system`** makes the default follow the visitor's device; a visitor's own click always wins over it.
- **Never put `backdrop-filter`, `filter` or `transform` on `.site-header`.** It hosts the fixed mobile menu; any of them makes the header the menu's container and the menu shrinks to a 48 px strip once the page is scrolled (this happened in the original version; found on an iPhone 15 Nov 2026). The frosted bar is `.site-header::before`. The checker enforces it.
- **Images:** an `<img>` with `width` and `height` attributes needs `height:auto` in any CSS rule that sets its width, or it is stretched (the About emblem was). The checker enforces it.
- Open the finished site on a real phone after every layout change, scrolled and not scrolled, with the menu open and closed. A desktop browser did not show the two defects above.
