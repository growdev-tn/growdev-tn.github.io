# UX/UI audit

**Project:** GrowDev portfolio site: French `/`, Arabic `/ar/` (right-to-left) and English `/en/`, in the dark theme (default) and the new light theme.
**Target user:** owner or manager of a small or mid-size business in Tunisia, then Africa and the world. Not technical. Often on a phone. Reads Arabic, French or English.
**Main action:** write to GrowDev ("Parler de mon projet", then the composer and its e-mail brief).
**Audit date:** 2026-11-15

**Method.** The `ux-ui-audit` skill (three lenses, scored out of 9, 8 and 6 = 23), applied to the built site served locally, with the measurements listed under "Evidence". Scoring: ✅ = 1 point, ⚠️ = ½, ❌ = 0.

**Limits, stated plainly.** This is the author's own review, not an independent one: a separate reviewer agent was started three times and was cut off by a usage limit each time, so it was not used. Nobody outside the project has used the site while being observed. The scores are a judgement; the measurements are facts. Real phones (iOS Safari, Samsung Internet) and a screen reader were not available.

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
| Layout | No horizontal scrolling and no clipped content from 320 to 1440 px, in the three languages. Header: no two items overlap and nothing leaves the screen at any width from 320 to 520 px (every pixel) and from 521 to 1400 px (every third). Tablet (768 px) checked in both themes. |
| Speed | Same as before the themes: LCP 0.17 s on desktop; on a slowed phone 1.30 s (dark) and 1.43 s (light) against 1.25 s before; CLS 0. |
| Checker | `node tools/check.mjs`: 1,287 checks pass. It was tested by deliberately breaking things (a missing light colour, a low-contrast colour, a wave that stops short, a gradient stop without a light colour, mismatched menu breakpoints) and caught each one. |

**Not measured:** real phones and tablets; screen readers (NVDA, VoiceOver, TalkBack) beyond the accessibility tree and the live-region text; INP; Lighthouse; a test with real visitors; the live address (not reachable from the build environment; run `bash tools/verify-launch.sh` after each push).

---

## Would you like me to

- suggest a palette for a third, high-contrast theme, or a calmer green for the light theme;
- rewrite the service bullets in plain language, in French, English and Arabic;
- sketch the contact block with a WhatsApp button once you have the number;
- apply the five quick wins and re-run every check?
