# UX/UI audit

**Project:** GrowDev portfolio site: French `/`, Arabic `/ar/` (right-to-left) and English `/en/`, in the dark theme (default) and the new light theme.
**Target user:** owner or manager of a small or mid-size business in Tunisia, then Africa and the world. Not technical. Often on a phone. Reads Arabic, French or English.
**Main action:** write to GrowDev ("Parler de mon projet", then the composer and its e-mail brief).
**Audit date:** 2026-11-15

**Method.** The `ux-ui-audit` skill (three lenses, scored out of 9, 8 and 6 = 23), applied to the built site served locally, with the measurements listed under "Evidence". Scoring: ✅ = 1 point, ⚠️ = ½, ❌ = 0.

**Limits, stated plainly.** This is the author's own review, not an independent one: a separate reviewer agent was started three times and was cut off by a usage limit each time, so it was not used. Nobody outside the project has used the site while being observed. The scores are a judgement; the measurements are facts. Real phones (iOS Safari, Samsung Internet) and a screen reader were not available to the author.

**What the first pass missed.** The owner opened the delivered site on a real iPhone the same evening and found two defects that a desktop Chromium audit had not caught: the open mobile menu turned see-through once the page was scrolled, and the logo in the About section was stretched into an oval and too large. Both were already in the version before the theme work, and both are fixed (see "What the audit changed"). The lesson is in the method: test fixed and overlaid elements after scrolling, and check images against their natural proportions. The scores below describe the site after these fixes.

---

## 🧍 Non-Technical Usability: 7.5 / 9

A first-time visitor understands the offer on the first screen and has one obvious button to press. The composer is the best part: it explains what each choice covers in plain words and tells the visitor what to do if no mail app opens. The weak points are two icon-only buttons and a single contact channel.

| Dimension | | Finding |
|---|---|---|
| Onboarding clarity | ✅ | The headline is a slogan ("Votre croissance, notre code."), but the paragraph under it says in plain words what GrowDev is (a development company in Tunisia: Odoo ERP, websites, online shops, mobile apps, automation). Both sit above the fold at 390 px and 1440 px, next to the one green button. |
| Navigation simplicity | ✅ | Five labelled links and one button, a sticky header, a reading-progress line. Below 1140 px the links move into a full-screen menu that Escape closes. The language links are always visible. No hidden gestures. |
| Label readability | ✅ | Buttons say what happens: "Parler de mon projet", "Voir nos services", "Envoyer ce brief par e-mail", "Copier le brief", "Écrire à GrowDev". |
| Error messages | ✅ | There is little to get wrong: no login, no validation. The messages that exist are plain ("Choisissez au moins un besoin ci-dessus pour générer votre brief."). The 404 page answers in the visitor's language. |
| Icon legibility | ⚠️ | The sun/moon button and the menu button (three bars) show no word. Both have an accessible name, and the theme button shows its label on hover and keyboard focus, but a touch user never sees a word. Sun/moon is widely understood; three bars less so for a first-time smartphone user. |
| Form simplicity | ✅ | Every field of the brief is optional and says so ("facultatif"). Needs are chips, not typing. The simulator has three sliders and folds the advanced settings. |
| Cognitive load | ⚠️ | Most screens ask for three decisions or fewer. The composer asks for more at once (15 chips, then four fields). It is the page's main interaction and it works, but it shows everything together. |
| Feedback and confirmation | ✅ | The composer draws the system as the visitor ticks boxes. Sliders update their numbers live. Copy and send answer with a message ("Brief copié. Collez-le dans un e-mail à …"). The theme button changes the page with a wave and announces it ("Mode clair activé"). |
| Help and escape paths | ⚠️ | When no mail app opens, the page says so and offers to copy the brief (good). But e-mail is the only channel: no phone, no WhatsApp, and the address is on `werchti.tn`, another name than the brand. |

**Works well:** three equal languages from the first screen; the "sans jargon" promise in the headings; honest wording on the simulator ("Estimation indicative… pas une promesse de résultat"); the mail fallback; no cookie banner because there are no cookies.

---

## 👁️ Clarity & Comprehension: 7 / 8

The page has one clear order: offer, services, build your system, method, savings, about, questions, contact. Contrast and spacing are strong. The two soft spots are very small label text and a few technical words.

| Dimension | | Finding |
|---|---|---|
| Visual hierarchy | ✅ | One large headline, one filled button per screen, quieter ghost buttons for second choices. |
| Text legibility | ⚠️ | Body text is 17 px and **every text passes WCAG AA in both themes** (measured, see Evidence). But about 70 labels on the phone page are 11.5 to 12.8 px mono capitals: the line above each heading, the field labels, the bar-chart labels (written sideways), step and service numbers, the technology chips. The same information is repeated in larger text nearby, so nothing is lost, but they are hard on tired or older eyes. |
| Whitespace | ✅ | Generous, and the cards do not crowd at 320 px. |
| Consistency | ✅ | One token system; buttons, chips and cards look the same everywhere, in both themes. The checker blocks a colour that is not in the system. |
| Language level | ⚠️ | Headings and paragraphs are plain. A few bullets under the services still use words a business owner may not know: "API", "Django", "Flutter", "applications métier". The technology names are already in the chips under each card. |
| Call-to-action clarity | ✅ | One filled button per screen; the one in the header repeats the hero's on purpose. |
| Information grouping | ✅ | Cards, chips and sections group related things; the facts card and the FAQ are easy to scan. |
| Loading and empty states | ✅ | The content is in the HTML (nothing to load). The composer shows a hint until a module is chosen. |

**Works well:** the contrast; the section titles that state the benefit ("Tout pour digitaliser votre entreprise, sans jargon."); the live diagram in the composer.

---

## 🎨 Color-Context Fit: 5.5 / 6

**Context detected:** B2B software services (tech), with a money-and-growth story (growth chart, DT coin).
**Palette assessment:** the dark theme is navy (`#020b18`), white text, one accent family from green to sky blue, and gold only for money. It says "developer" and keeps the brand's glowing look. It stays on the right side of the brief's "no neon hacker look" because the navy is deep and the accent is used with restraint. The new light theme (pale blue-grey `#eef3f8`, dark-ink text, a deeper green for text) reads calmer and more "business", which suits owners opening the page by day. Dark stays the default because the brief asked for it; `"defaultTheme": "system"` in `src/site.json` makes the page follow the visitor's device instead.

| Dimension | | Finding |
|---|---|---|
| Palette fits project context | ✅ | Blue, green and gold match tech, growth and money. |
| Sufficient contrast | ✅ | Text 4.5 : 1 or better and graphics 3 : 1 or better in both themes, measured on the real pixels (see Evidence). The light theme needed two corrections to get there (below). |
| No conflicting meanings | ✅ | Green means "go" and "grow" everywhere (primary button, accents, ticks). Gold only means money or parallel work. There is no red, so nothing looks like an error. |
| Culturally appropriate | ✅ | Green and white are positive in Tunisia, the Maghreb, West Africa and France. No colour here carries a mourning or warning meaning. |
| Consistent use | ✅ | Same meaning, same token, in both themes. |
| Accent used sparingly | ⚠️ | Below the first screen the page is quiet. The hero chart and its glow are mostly accent green, perhaps a fifth of the first screen. It is the page's one bold moment, so it is a choice, but it is above the usual 10 %. |

**Works well:** one accent family; gold kept for money; both themes share the same names so a new colour cannot be forgotten in one of them.

---

## 🏆 Overall score: 20 / 23

| Lens | Score |
|---|---|
| Non-Technical Usability | 7.5 / 9 |
| Clarity & Comprehension | 7 / 8 |
| Color-Context Fit | 5.5 / 6 |
| **Total** | **20 / 23** |

Band: **Excellent (20 to 23), at its lower edge.** Read it as "solid, with five specific improvements", not as a perfect page.

---

## 📋 Priority action list

Ordered by impact for the target visitor.

1. **Add a second way to reach you (WhatsApp or a phone number).** E-mail is the only channel, and many small-business owners in the target markets live on WhatsApp. Needs your number (open question in `docs/HANDOVER.md`), then a button next to "Écrire à GrowDev". Already in the roadmap, Phase 5.
2. **Show real proof.** One or two case studies or a short quote make the offer believable. Nothing was invented, on purpose. Needs your decision on which projects may be named.
3. **Raise the smallest text to 12.5 to 13 px** (see quick win 1) and write the bar-chart labels horizontally on phones.
4. **Plain-words pass on the service bullets,** and have a native Arabic reader go through `src/i18n/ar.json` (also pending in the handover).
5. **Write the word "Menu" beside the three bars** from about 400 px, and keep the sun/moon icon (it is widely understood).
6. **Use an address on the brand's own name** when one exists, so "GrowDev" and `contact@werchti.tn` do not look like two companies.

## ✅ Quick wins (about an hour each, none applied)

These change the look you approved, so they were left for your decision. Each is a small CSS or copy edit; re-run `node tools/check.mjs` and look at the three languages afterwards.

1. **Small text floor.** Raise to 12.5 to 13 px: `.eyebrow`, `.bar__label`, `.growth__hint`, `.step__n`, `.svc__no`, `.pledge__n`, `.res__k`, `legend`, `dt` and the technology chips. Check the chart labels do not wrap.
2. **Sideways chart labels on phones:** show them horizontally under the bars, or at least at 12.5 px.
3. **Plain wording:** "Connexions avec vos autres outils (API, e-mail)" becomes "Connexions avec vos autres outils (e-mail, comptabilité…)"; drop "(Python, Django)" and "(Flutter)" from the sentences, since the chips already show them. Change all three languages together.
4. **Follow the visitor's device:** set `"defaultTheme": "system"` in `src/site.json`, then build. People whose phone is in light mode get the light theme; dark phones get dark.
5. **"Menu" word** next to the three bars at 400 px and above.

---

## What the audit changed

Fixed in this pass, and checked again afterwards:

| Finding | Fix |
|---|---|
| Light theme: hero text and labels measured 3.7 to 4.35 : 1 on the real background (below 4.5) | Darker `--muted` and `--grow-ink`, softer background grid. 0 failures after. |
| The header became too tight with the new button: logo, name, language switch, theme button and menu button overlapped on 340 to 365 px phones, and links crowded between 900 and 1140 px | Menu breakpoint moved from 900 to 1140 px (CSS and `MENU_BREAKPOINT` in `ui.js`, tied together by the checker). Narrower spacing and a compact language switch on phones; the "GrowDev" word is dropped under 340 px. No overlap at any width from 320 to 1400 px. |
| Touch targets in the header were 40 px or less | 44 px (menu and theme buttons) from 375 px, 42 px from 360 px, 40 px below; the language links get an invisible 44 px-high tap area. |
| **Mobile menu see-through when scrolled** (found by the owner on an iPhone). From about 40 px of scrolling the bar gets its frosted blur, and a blur on the header makes the header the container of the fixed menu, so the menu shrank to a 48 px strip and the page showed through the links. Present in the original version too | The blur moved to a layer of its own, `.site-header::before`, so the header is no longer the menu's container. The open menu fills the screen under the bar at every scroll position, scrolls by itself when taller than the screen (landscape phones), and the bar turns opaque with it. Checker rules: no blur, filter or transform on `.site-header`; menu at least 90 % opaque. Browser test: 98 runs (3 languages, both themes, phone, landscape, tablet, 1100 px, 320 px; scroll 0, 40, 600, 4000 px), where the original fails 368 checks |
| **About logo stretched and too big** (found by the owner). An `<img>` with `height="200"` kept that height while CSS set the width to 140 px, so the round emblem was a 140 × 200 oval on phones, and 144 to 176 × 200 up to 1250 px wide. Present in the original too | `height:auto` on the emblem, so it is round again. On phones and tablets (one-column layout) it is 88 to 116 px and centred. Checker rule: an image with width and height attributes needs a height in any CSS rule that sets its width. Browser test: 234 image measurements (13 widths, 3 languages, both themes), none stretched |
| Facts card: the e-mail address pushed the page wider than the screen in Arabic at 320 px | The label column is narrower and long values break instead of overflowing. |
| E-mail links in the footer and the facts card were 22 px high | A 28 px tap area (equal padding and negative margin, so the lines stay where they were, to within 1 px). |

---

## Evidence

All run on 2026-11-15 against the built `site/` (headless Chromium, local server).

| Check | Result |
|---|---|
| Accessibility scan (axe-core, WCAG 2.x A and AA plus best practices) | **0 violations** on 18 page states (3 languages × dark and light × phone, tablet, desktop) and on the open mobile menu. 141 "needs review" items are all contrast on gradients or translucent layers, which axe cannot compute; the next line replaces them. |
| Real contrast | 3,044 text elements, 2,982 measured against the pixels actually behind each one (screenshot with and without the text, only the pixels around the glyphs sampled). **0 below 4.5 : 1** (3 : 1 for large text), both themes, 3 languages, phone and desktop. The other 62 draw nothing where they sit (hidden, clipped or covered), so there is nothing to measure. |
| Behaviour of the theme button | 28 tests pass: named by its visible label, Enter and Space work, focus ring visible, change announced to screen readers, saved choice applied before the first paint (no flash), browser-bar colour follows, double click gives one switch, second tab follows, blocked storage still works, no console error, 404 page uses the saved theme. Also passed: "system" mode follows the device and a live change of it. |
| Motion safety | Under reduced motion there is no wave and the switch is instant. Without View Transitions the page cross-fades. The wave is a reveal of the new theme, not a coloured layer: frame by frame, every pixel is wholly old or wholly new theme, so text and cards were never unreadable, on desktop, phone and in Arabic, in both directions. The wave only runs when the visitor presses the button, takes 0.7 to 1.4 s and cannot be restarted halfway. |
| Mobile menu | Opened at scroll 0, 40, 600 and 4,000 px in 3 languages, both themes, on a phone in portrait and landscape, a tablet, 1100 px and 320 px: it fills the screen under the bar, is opaque (no page visible through it, measured by comparing with the same screen with the page hidden), its last item can be reached, and Escape closes it without moving the page. |
| Layout | No horizontal scrolling and no clipped content from 320 to 1440 px, in the three languages. Header: no two items overlap and nothing leaves the screen at any width from 320 to 520 px (every pixel) and from 521 to 1400 px (every third). Tablet (768 px) checked in both themes. |
| Speed | Same as before the themes: LCP 0.17 s on desktop; on a slowed phone 1.30 s (dark) and 1.43 s (light) against 1.25 s before; CLS 0. |
| Checker | `node tools/check.mjs`: 1,290 checks passed on 15 Nov (1,549 after the Clients section of 17 Nov and 1,737 after the carousel of 18 Nov, see the addenda). It was tested by deliberately breaking things (a missing light colour, a low-contrast colour, a wave that stops short, a gradient stop without a light colour, mismatched menu breakpoints, a blur or transform on the header, a see-through menu, an image with a width but no height) and caught each one. |

**Not measured:** real phones and tablets beyond the owner's single iPhone check, and WebKit (Safari's engine) was not available to the author, so the menu fix is tested in Chromium and rests on the CSS rule that a blur or transform makes an element the container of fixed descendants, which Safari follows too; screen readers (NVDA, VoiceOver, TalkBack) beyond the accessibility tree and the live-region text; INP; Lighthouse; a test with real visitors; the live address (not reachable from the build environment; run `bash tools/verify-launch.sh` after each push).

---

## Addendum, 17 Nov 2026: the Clients section

Five client logos were added between the marquee and the services (`#clients`). This is the author's own review, done in headless Chromium against the built site. WebKit (Safari), real phones and the live address were not available. *On 18 Nov the wall became a carousel (next addendum); the still wall described here remains as the fallback without JavaScript.*

| Check | Result |
|---|---|
| Layout | 1,340 assertions pass: 3 languages × dark and light × 13 widths (320, 360, 390, 599, 600, 768, 820, 999, 1000, 1024, 1280, 1440 and 1920 px). Five plates of equal size and 4 : 3 proportion; 2, 3 and 5 per row, with a short last row centred; the first client on the right in Arabic and on the left in French and English; every plate pure white in both themes; every logo inside its plate and never drawn larger than its file; no sideways scrolling; nothing outside the content column; names and order equal to `src/site.json`; section texts equal to the three dictionaries. |
| Accessibility scan | axe-core: **0 violations** on 12 page states (3 languages × 2 themes × phone and desktop) with the section on screen; nothing left "to review" inside the section. |
| Motion and no script | The plates start hidden and fade in when scrolled to. With scripts blocked, or with reduced motion, all five are visible at once, and the logos still load without scripts. |
| Navigation | The footer "Clients" link brings the heading below the header at 390 and 1440 px in all three languages. The theme button keeps the plates white. While the section is centred, the scroll-spy marks no link (it has no header link, by design). |
| Speed and hygiene | Layout shift caused by the section: 0 (3 languages, 390 and 1440 px). No console message and no request to another host on any page. Weight: about 48 KB of lazily loaded images; HTML +0.3 to 0.4 KB and CSS +0.4 KB gzipped. LCP was not re-measured. |
| Checker | 1,549 checks pass (1,290 before). The new rules were tested by breaking them 39 ways, and each was caught: missing section, wrong or empty `alt`, swapped order, an extra or missing logo, a deleted logo or one outside the folder, a wrong `width` or `height`, a logo that is too small (warning) or over 40 KB, missing `lazy` or `async`, a wrong or missing `lang`, a duplicate name or file, an unknown `lang`, an orphan file (warning), a plate that is not white in either theme, a plate that no longer uses its colour token, `object-fit` removed or set to `cover`, and a filter, blend mode or opacity on a logo. The browser tests themselves were run on a deliberately broken copy (square plates, a grey plate, stretched logos) and raised 201 failures. |

**Found and fixed while building:** square plates made the phone layout too tall (now 4 : 3); on a phone the Arabic lead and the footnote left one word alone on the last line (`text-wrap: balance`); the source of one logo had its drop shadow cut by the bottom edge of the file, which would have shown as a hard line on a white plate (its last rows were faded to white).

**Not measured, not decided:** Safari and iOS, real Android phones, screen-reader speech, the live address. The Arabic lines of the section need a native read. Logos under about 400 px on the long side (the smallest is 238 px) look slightly soft on high-density phones: SVG or larger files would fix that. Each client must agree to be shown; nothing in the code can check that.

---

## Addendum, 18 Nov 2026: the Clients carousel and the cache fix

The 17 Nov wall became a carousel (made for the phone first), and every local stylesheet, script and client logo URL now carries a version, so a browser can no longer pair a new page with an old cached file. This is the author's own review, done in headless Chromium (desktop, and touch emulated through Chromium's touch events) against the built site. WebKit (Safari), real phones and the live address were not available.

| Check | Result |
|---|---|
| Browser suite | **2,525 assertions pass, 0 fail**, in ten groups, run in one pass on the final build. The groups are the rows below. |
| Layout | 3 languages × dark and light × 15 widths (320, 360, 390, 414, 480, 599, 600, 768, 820, 999, 1000, 1024, 1280, 1440 and 1920 px): the belt runs where it should; 2.25, 3 and 4 plates in view (on a phone the window runs on to the edge of the screen, so the next plate peeks in); none cut except that one; no hole in the belt; the first logo at the leading edge (the right-hand one in Arabic); no sideways scrolling; plates of equal size, 4 : 3 and pure white in both themes; every logo loaded, inside its plate and never drawn larger than its file; controls inside the content column, dots at the start side; names and order equal to `src/site.json`; texts equal to the three dictionaries; no console message and no request to another host. |
| Steps | Previous and Next (mirrored in Arabic), wrap-around both ways, two quick clicks in a row. A frame recorder watched every move: no hole, no plate jumping from one end to the other while visible, no plate in view moving more than one step in a frame. |
| By itself | It starts alone; Pause stops it; Play steps at once and carries on; using an arrow stops it until Play; it waits while the mouse rests on the logos, while an arrow has focus, while the section is off screen and in a hidden tab, and starts again afterwards; it keeps running while Play has focus (how a keyboard user starts it again). |
| Drag | Mouse and touch: a short drag falls back, a long one advances, wrap-around both ways, a flick carries on, the belt always lands on a whole plate; a plain click moves nothing; no text is selected while dragging; a vertical swipe scrolls the page and does not move the belt. |
| Resize and fallbacks | Resizing keeps the place and leaves no hole. With every plate in view it becomes a still row without controls; with 4.6 in view (a hole would show at the end) it becomes the still wall. With scripts blocked, and with `carousel.js` missing, the five logos stay visible, loaded and inside the page. |
| Reduced motion | The belt stays (by hand), the Pause button is gone, a step lands at once, the carousel is visible at once; turning the preference on or off while the page is open takes effect immediately. |
| Keyboard | Tab order Pause/Play, Previous, Next; Shift+Tab goes back; Enter and Space work the buttons; the focus ring is visible; a plate is not a tab stop. |
| In the page | The footer link brings the heading below the header; the theme button keeps the plates white and the arrows in the theme's text colour; the carousel reveals on scroll; the scroll-spy is unaffected. |
| Layout shift | 0 (3 languages at 390, 820 and 1440 px). The bar's room is reserved from the first paint. |
| Accessibility scan | axe-core 4.10.2, 24 runs (3 languages × 2 themes × 390 and 1440 px × motion allowed and reduced): **0 violations in the Clients section**, nothing left "to review" inside it. Outside it, see "Found, not changed". |
| Weight | HTML 13.1 to 14.5 KB, CSS 13.3 KB, JavaScript 20.9 to 21.2 KB gzipped (`carousel.js` is 4.1 KB of it): all inside the budgets (45, 22, 30 KB). LCP was not re-measured. |
| Cache fix | `?v=` and the first eight hex digits of the file's SHA-256 on every local stylesheet, script and logo URL, in the three pages and in `404.html`. The build is idempotent (a second run changes nothing) and the checker recomputes every version. A fresh page can no longer meet an old cached file; the reverse case is rare and heals within 10 minutes (`docs/ARCHITECTURE.md` §4, Caching). |
| Checker | 1,737 checks pass (1,549 before). The new rules were tested by breaking them 99 ways in all (the 39 logo breakages of 17 Nov among them, re-run on the carousel markup), and each was caught. *Markup:* the wrapper, its role and its translated role description, a plate with `data-reveal`, the viewport, list and bar out of order, a missing or swapped button, a button without `type`, without a name, or with icons not hidden, a Pause/Play with one name for both states or starting as Play, the dots not hidden, a missing icon in the sprite, the script missing or loaded after `main.js`, an English button name or role description left on the French or Arabic page. *Stylesheet:* `touch-action`, clipping, a belt that wraps, `[hidden]` overridden, the bar visible without JavaScript or without its room, a transform or transition on a plate, the arrows not mirrored in Arabic, `--show` not a number, between *n* − 1 and *n* (warning), equal to *n* (warning) or fractional on the no-script wall. *Script:* each of seven required features removed, a step every 0.8 s, a 90 ms glide, no export, `main.js` not starting it, the file deleted, a network call or a storage key inside it. *Versions:* a stylesheet, script, dictionary or logo changed after the build, a missing or an invented version on a page or on `404.html`. |

**Found and fixed while building:** on a desktop the belt fell back to the still wall because a half-pixel safety margin in the plate width left it 1 to 2 px short of its window (exact width in belt mode, 2 px tolerance); logos outside the window never loaded, because a browser does not load a lazy picture that an ancestor clips away (the section now loads them all when it is within 900 px of the screen); three drag defects (a flick after holding the finger still, the "grabbing" cursor being overridden, and a touch drag aborted by an event that bubbled up from the plate under the finger).

**Found, not changed:** outside the carousel, axe reports `color-contrast` on the Method steps while they are dimmed (6 of the 24 runs, at 390 px with motion allowed: 3.5 : 1 for the paragraphs in the dark theme, 2.5 : 1 for paragraphs and 3.3 : 1 for titles in the light theme). The cause is `.step{opacity:.5}` until a step is reached, which is in the original files and is part of the look you approved, so it is yours to decide: an opacity of .8 instead of .5 would pass in both themes (worked out from the colours, not tried in a browser).

**Not measured, not decided:** Safari and iOS, real Android phones and a real finger (touch was emulated), how screen readers announce the carousel, the live address. The Arabic lines of the section (text, widget name and the four button names) need a native read. Logos under about 400 px on the long side (the smallest is 238 px) look slightly soft on high-density phones. Each client must agree to be shown; nothing in the code can check that.

## Addendum, 19 Nov 2026: the contact address and the domain

The site moves to its own domain, `growdev.tn` (OVHcloud), and the contact address moves with it: `contact@growdev.tn` replaces `contact@werchti.tn` on every page, in the structured data, in `llms.txt` and `llms-full.txt`, in the brief's mail button and on the 404 page.

**Resolved from this audit:** the *Help and escape paths* note that the address "is on `werchti.tn`, another name than the brand", and priority action 6, "Use an address on the brand's own name". The checker now warns when the contact address is not on the site's own domain.

**Still open from the same row:** e-mail is the only channel (no phone or WhatsApp number yet). The new mailbox is an OVH MX Plan mailbox; it must exist, and have received a test message, before the new pages are pushed (`docs/DEPLOY.md`, step 1).

**Measured on the built site (Claude's own review, headless Chromium, local server):** 3 languages × 2 themes × 390 and 1440 px, plus `404.html` and an unknown address: 114 checks, 0 failures; no console message, no failed request and no request to another host; every `mailto:` link and `GD.config.email` carry the new address; the canonical link and the share-image links use `https://growdev.tn`; no sideways scrolling. The Arabic contact card, where the address sits left-to-right inside right-to-left text, was looked at on a phone: no overflow and no change of layout (the new address is as long as the old one). The three share images were regenerated; a pixel comparison with the old ones shows that only the strip with the address changed.

**Not measured:** the live domain (nothing answers there yet), DNS, the HTTPS certificate, mail delivery. See `docs/INFRA-AUDIT.md`.

---

## Would you like me to

- suggest a palette for a third, high-contrast theme, or a calmer green for the light theme;
- rewrite the service bullets in plain language, in French, English and Arabic;
- sketch the contact block with a WhatsApp button once you have the number;
- apply the five quick wins and re-run every check?
