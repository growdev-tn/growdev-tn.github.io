# Real-world testing: how to test the live site the way people meet it

Written on 25 Nov 2026 for **https://growdev.tn** (French `/`, Arabic `/ar/`, English `/en/`). The build checks (`node tools/check.mjs`, about 4,100 checks) and the live check (`bash tools/verify-launch.sh`, 44 checks) prove that the site is built correctly and reachable. They cannot tell you how it feels on a phone in a weak-coverage area, how a screen reader speaks it, whether Google and an AI assistant describe GrowDev truthfully, or whether a stranger understands it. This guide covers exactly that. Nothing here can promise a search ranking or an AI citation: it tells you whether the site is reachable, readable and correctly described, and what to fix when it is not.

**How to use it.** Go in order, tick the boxes, and write every failure in the log (§0). Each test has *Do*, *Pass if* and, when useful, *If not*. If something fails and you do not know why, send what §10 asks for.

| § | Test | Time | You need |
|---|---|---|---|
| 0 | Start here | 15 min | a computer |
| 1 | Phones | 40 min | an Android and, if you can borrow one, an iPhone |
| 2 | Desktop browsers and keyboard | 25 min | Chrome, Edge or Firefox |
| 3 | Screen readers | 30 min | NVDA (free), or a phone's built-in reader |
| 4 | Share previews | 10 min | WhatsApp, LinkedIn |
| 5 | Speed, security, HTTPS | 15 min | a browser |
| 6 | Search engines | 20 min now, then wait days | a Google account |
| 7 | Mail | 25 min | a Gmail address and the OVH mailbox |
| 8 | AI assistants | 20 min, **2 to 4 weeks after indexing** | any assistant that can browse |
| 9 | Five real people | 1 hour in total | five people |

## 0. Start here (15 minutes)

1. Open the repository on GitHub, tab **Actions**. The last run of **Build, check and deploy** is green, and the **Live check** that follows it is green too. (If Live check is red, open it: its log is the output of `verify-launch.sh`, with the failing line marked `FAIL`.)
2. On your computer, in Git Bash, from the project folder:
   ```bash
   bash tools/verify-launch.sh
   ```
   Pass if the last line says `44 passed, 0 failed, 0 not checked`. A `skip` line is not a pass: read why it says it was not checked.
3. Use a **private window** (Ctrl+Shift+N in Chrome and Edge, Ctrl+Shift+P in Firefox) for every search and every first-visit test, so that your account, your history and your cache do not flatter the result.
4. Keep this log open while you test (copy it into a note on your phone, a spreadsheet or a text file):

   | Date | § | Device, browser, language | What I did | Expected | What happened | Screenshot |
   |---|---|---|---|---|---|---|

## 1. Phones

Many of your visitors will arrive on a phone, often on mobile data. Do this section on **an Android phone and an iPhone** if you can borrow one (Safari on iPhone behaves differently from Chrome on Android), and in **each of the three languages**. Type the address (do not tap a link) so that you test what a visitor who types it sees. Buttons are named below in English; the French and Arabic pages have the same buttons in their own words.

For each phone and each language (`https://growdev.tn/`, `/ar/`, `/en/`):

- [ ] **First screen.** The headline and the two buttons ("Talk about my project", "Find my solution") are visible without scrolling, and nothing is cut off at the sides.
- [ ] **Whole page.** Scroll slowly from top to bottom. Pass if: nothing sticks out sideways (the page never moves left or right under your finger), no text overlaps another, every logo appears (technologies, the five clients), nothing flashes or jumps while you scroll.
- [ ] **Language switch.** Use the **FR · عربي · EN** switch in the header. Pass if you land on the right address (`/`, `/ar/`, `/en/`), the page changes language, and for Arabic the whole layout mirrors (text aligned right, logo on the right, arrows pointing the other way).
- [ ] **Menu.** Tap the three-line Menu button (on a phone it replaces the links). Pass if the list opens over the page, the page behind does not scroll, and choosing an entry closes the menu and takes you to that section with its title visible.
- [ ] **Theme button** (sun or moon). Pass if the wave plays, the text stays readable during and after it, and after you reload the page your choice is still there.
- [ ] **Simulator** ("How much time could you win back?"). Drag each of the three sliders with your thumb. Pass if: they move smoothly; the page starts at 5 people, 6 hours a week, 35% and shows **45 hours per month** and **5.7 working days per month**; at 10 people, 8 hours, 35% it shows **121 hours** and **15.2 working days** (the formula line spells out the same sum: people × hours × share × 4.33); **nothing in the simulator talks about money**; and the small print under the result says that the price depends on your situation and on how complex the project is. (The French and Arabic pages write numbers the Tunisian way: a comma for decimals, 5,7, and a space between thousands. The values are the same.) Then press **"Talk about this result"**: it should lead to the contact section.
- [ ] **"Find my solution".** Tap it: the page goes to the situation guide ("Which of these sounds like you?", six rows). Tap a row. Pass if the page scrolls to the matching service card (the Odoo row goes to the Odoo ERP card, and so on) and the card's title is **not hidden under the header**.
- [ ] **Clients carousel.** Swipe it, use the arrows, press the pause button. Pass if each works and the page can still be scrolled with a finger placed on the carousel.
- [ ] **FAQ.** Open and close three questions. Pass if each opens at once and the text is readable. Read answer 3 (cost): it must start with "The price depends on the client and the complexity of the project" (or its French or Arabic equivalent).
- [ ] **Contact, first door** (business owners; the "Ready to grow your business?" panel). **"Describe my project by email"**: your mail app opens addressed to `contact@growdev.tn`, with the subject "GrowDev project" and a short guided body ("What takes up my time, or what I would like to build…"); close it without sending. **"Build my brief"** scrolls up to the project builder (§7 tests it). **"Message us on WhatsApp"**: WhatsApp opens a chat with a first message already written ("Hello GrowDev, I would like to talk about a project."); do not send it yet, §7 does that. (The number is deliberately not printed on the page.)
- [ ] **Contact, second door** (recruiters, agencies, technical teams). **"Propose an assignment"**: the mail app opens with the subject "GrowDev development assignment" and a short body (context, technologies, duration). **"See the technical profile"** scrolls to the developer profile ("Who writes the code?").
- [ ] **Largest text.** Set the phone's text size to the largest (iPhone: *Settings → Accessibility → Display & Text Size → Larger Text*; Android: *Settings → Display → Font size*, the exact menu varies by brand). Reload. Pass if nothing overlaps or disappears and buttons still read.
- [ ] **Landscape.** Turn the phone sideways. Pass if nothing breaks.

**Slow connection.** On a computer, in Chrome press F12, tab **Network**, set throttling to **Slow 4G**, tick *Disable cache*, reload `/`. Pass if the headline is readable in about three seconds and the page is usable before every image has arrived. In a real weak-coverage place, repeat on your phone with mobile data.

*If not:* write the language, the phone, the browser, what you did and take a screenshot (§10).

## 2. Desktop browsers and keyboard

On **Chrome, Edge and Firefox** (and Safari if you have a Mac), in the three languages, in dark and light:

- [ ] At 100% and at **200% zoom** (Ctrl and +): no text is cut, no horizontal scrolling at 200%.
- [ ] **Keyboard only** (put the mouse away). Press Tab from the top of the page. Pass if: the first Tab reveals a "Skip to content" link; a visible ring shows where you are at every step; the order follows the page; you can open a FAQ question with Enter or Space; you can move the simulator sliders with the arrow keys; you can open the language and theme buttons with Enter; you **never get stuck** (the carousel lets you out with Tab).
- [ ] **Reduced motion.** Windows 11: *Settings → Accessibility → Visual effects → Animation effects* **off**. (Or in Chrome: F12, then Ctrl+Shift+P, type "Rendering", and set *Emulate CSS media feature prefers-reduced-motion* to *reduce*.) Reload. Pass if: every section is visible at once (nothing waits to fade in), the technology row stops moving and sits as a still, wrapped list, the clients carousel no longer scrolls by itself (its pause button is gone, since there is nothing to pause, and the arrows still work), the theme changes at once without the wave, and the page is still complete.
- [ ] **Print preview** (Ctrl+P) is not a goal: skip it.
- [ ] Open the browser console (F12, tab **Console**) on each of the three pages. Pass if there is no red error. (A yellow warning about a browser extension is not the site.)

## 3. Screen readers

Screen-reader users are a minority of visitors, but the structure they depend on (headings, landmarks, a name on every control) is also what search engines and AI assistants read, so this test tells you how machines see the page too. Use **NVDA** (free, Windows, `https://www.nvaccess.org/download/`) with Firefox or Chrome, and the built-in reader of your phone: **VoiceOver** (iPhone: *Settings → Accessibility → VoiceOver*) or **TalkBack** (Android: *Settings → Accessibility → TalkBack*). Do the French and Arabic pages at least.

NVDA basics: start it with Ctrl+Alt+N; **H** next heading, **K** next link, **D** next landmark, **B** next button, **Insert+F7** the list of headings and links, **Ctrl** stops the speech. VoiceOver on iPhone: swipe right or left to move, double-tap to activate, two-finger swipe up to read from the top, twist two fingers to choose "Headings" on the rotor then swipe up or down.

- [ ] **Language.** The Arabic page is read with an Arabic voice, the French page with a French voice, the English one with an English voice. (If your reader has no voice for a language installed, that is your setup, not the site: the pages declare their language.)
- [ ] **Structure.** One main heading, then the sections as headings; header, navigation, main and footer announced as landmarks.
- [ ] **Images.** The five client logos are read as the client's name; the technology logos by name; decorative pictures are silent.
- [ ] **Simulator.** A slider is announced with its question and value ("How many people do these repetitive tasks?" and so on). After you stop moving it, a little under a second later, **one** sentence is spoken, for example at 10 people, 8 hours and 35%: "People: 10. Hours per week: 8. Share that can be automated: 35%. Result: about 121 hours per month." There is **no money** in it, nothing is spoken when the page loads, and there is no stream of changing numbers while you drag.
- [ ] **Carousel.** The pause button is named ("Pause automatic scrolling"), previous and next are named, and the content does not keep interrupting you.
- [ ] **FAQ.** Each question is announced as collapsed or expanded.
- [ ] **Links and buttons.** Every one says what it does (the mail button names the mail, the WhatsApp button names WhatsApp). You never hear "link" or "button" alone.

*If not:* write what the reader said and what you expected.

## 4. How the site looks when shared

Send each address to yourself and to a friend, and look at the preview **before sending**:

- [ ] **WhatsApp**: `https://growdev.tn/`, `https://growdev.tn/ar/`, `https://growdev.tn/en/`. Pass if each shows its own share image (one per language) and a title and description **in its own language**. WhatsApp keeps previews for hours or days; to test a fresh one, add `?x=1` to the address.
- [ ] **LinkedIn**: open the Post Inspector, `https://www.linkedin.com/post-inspector/`, paste each address. Pass if the image, title and description are right and no warning is shown.
- [ ] **Facebook** (needs an account): `https://developers.facebook.com/tools/debug/`. Pass if no error; use *Scrape again* if it shows an old preview.
- [ ] Also paste an address into **Telegram** and an **iMessage or SMS** chat if you can: the preview should appear.

## 5. Speed, HTTPS and security headers

- [ ] **PageSpeed Insights** (`https://pagespeed.web.dev/`): run `https://growdev.tn/`, `/ar/` and `/en/`, **Mobile** and **Desktop**. Aim for: Performance 90 or more, Accessibility 100, Best Practices and SEO 95 or more. Look at the three Core Web Vitals: **LCP 2.5 s or less, CLS 0.1 or less, INP 200 ms or less** (real-user data appears only after enough real visits; until then read the lab numbers). A score moves by a few points between runs; run twice. Investigate below 80 and send the report link.
- [ ] **SSL Labs** (`https://www.ssllabs.com/ssltest/analyze.html?d=growdev.tn`): takes about two minutes. An **A** or better is typical for a GitHub Pages site with HTTPS enforced. Below **B**: send me the result.
- [ ] **Security headers** (`https://securityheaders.com/?q=growdev.tn`): a modest grade is **expected and is not a defect of the site**: GitHub Pages decides the response headers, and the site's strict policy is in a `<meta>` tag (see `docs/INFRA-AUDIT.md`, finding 10). Do not chase this grade unless you later put a CDN in front.
- [ ] **Redirects and HTTPS by hand** (PowerShell on Windows):
  ```powershell
  curl.exe -sI http://growdev.tn/        | Select-String "HTTP|Location"
  curl.exe -sI https://www.growdev.tn/   | Select-String "HTTP|Location"
  curl.exe -sI https://growdev-tn.github.io/ | Select-String "HTTP|Location"
  curl.exe -sI https://growdev.tn/       | Select-String "HTTP|Server|Strict-Transport"
  ```
  Pass if the first three answer `301` with `Location: https://growdev.tn/` and the last answers `200`.

## 6. Search engines

Indexing is not instant: for a new domain it takes from a few days to a few weeks, and no tool can speed it up beyond asking.

1. **Search Console.** Follow `docs/DEPLOY.md`, section "Google Search Console and Bing": add a **Domain** property `growdev.tn`, copy the `google-site-verification=…` TXT record into the OVH DNS zone, wait, then click *Verify*. To see whether the record is visible before you click:
   ```powershell
   Resolve-DnsName growdev.tn -Type TXT -Server 8.8.8.8 -DnsOnly
   ```
   Pass if the property shows "Ownership verified".
2. [ ] **Sitemaps** → submit `sitemap.xml`. Pass if the status becomes **Success** and it discovers **3 pages**.
3. [ ] **URL inspection** → paste each of the three addresses → **Request indexing**. Pass if each says "URL is on Google" within one to four weeks. If it still says it is not after two weeks, open *Pages* in the left menu and read the reason it gives; send me that line.
4. [ ] **Rich Results Test** (`https://search.google.com/test/rich-results`) and **Schema Markup Validator** (`https://validator.schema.org/`) on the three addresses. Pass if there are **no errors**. The FAQ may be reported as detected but not eligible for a rich result: that is normal, Google shows FAQ rich results only for large authoritative sites. The value of the FAQ is that people, snippets and assistants read it.
5. [ ] **Bing Webmaster Tools** (`https://www.bing.com/webmasters`): *Import from Google Search Console*. Pass if the sitemap is accepted.
6. [ ] **After one to two weeks**, in a private window: search `site:growdev.tn` on Google and Bing. Pass if the three pages appear, each with its own title and description in its own language. Then search `GrowDev`, `GrowDev Tunisie` and `growdev.tn`: the site should be on the first page for these (a brand name has no rival). Do **not** expect page one for "Odoo Tunisie" for a long time: that comes from §6 of `docs/SEO-GEO-AEO.md` (off-page signals), not from the code.
7. [ ] **Monthly**: Search Console → *Performance*: which queries, which countries, which pages. Turn real questions into new FAQ entries (`docs/SEO-GEO-AEO.md`, §4).

## 7. Mail: can a customer really reach you?

E-mail is the site's main door, so test it in both directions before any customer does.

- [ ] **Send in.** From your Gmail, write to `contact@growdev.tn`. Pass if it arrives within a few minutes in the OVH mailbox's **inbox** (check spam too).
- [ ] **Reply out.** Answer that message **from** `contact@growdev.tn`. Pass if it arrives in Gmail's **inbox, not spam**.
- [ ] **Authentication.** In Gmail open that received reply, ⋮ → **Show original**. Pass if you read `SPF: PASS` and `DMARC: PASS`. `DKIM: PASS` too if OVH's panel offers DKIM for the domain (`docs/DEPLOY.md`, step 2, "Check the mail records in the OVH DNS zone"). If there is no DKIM line, SPF and DMARC passing is enough for now; switch DKIM on when OVH offers it and test again.
- [ ] **Score.** Go to `https://www.mail-tester.com/`, send a message from `contact@growdev.tn` to the address it shows, read the score. Pass if **9/10 or more**; the page lists what to fix.
- [ ] **Every door on the site, for real.** (1) **"Describe my project by email"** (contact panel): send the prepared message and check that it arrives in the mailbox. (2) **"Compose your system"** (menu entry "Your project"): tick two or three needs, add a name, a company and a start date, press **"Send this brief by email"**, send it, and check that the brief arrives readable, with the chosen modules and the suggested phases. Then press **"Copy the brief"**, paste it into a note, and check that the text is the same. (3) **"Propose an assignment"**: send it and check that the subject reads "GrowDev development assignment". (4) **"Message us on WhatsApp"**, from a phone: send the prepared message. Pass if it arrives on the phone that has **+216 25135166**, in WhatsApp. **That number must be a WhatsApp number**: before anything else, send a test message to it from another phone's WhatsApp.
- [ ] **Reply time.** Note how long each took to arrive. The site promises "a clear quote before we start"; be sure you can keep the habit of answering within a day.

## 8. AI assistants: do they know GrowDev, and do they say true things?

Do this **two to four weeks after the pages are indexed**, in a private window or a logged-out session, and repeat **every quarter**. Use the assistants your clients use: ChatGPT (with search), Gemini, Microsoft Copilot, Perplexity and Claude (with web search). Ask each the same questions, in the language of the question, word for word. Do not paste any text from the site into the question.

| # | Prompt (French, English or Arabic) | Pass if the answer | Red flag |
|---|---|---|---|
| 1 | Qu'est-ce que GrowDev ? / What is GrowDev (growdev.tn)? / ما هي GrowDev؟ | describes a software company in Tunisia (Odoo ERP, websites, mobile apps, automation) and names `growdev.tn` | confuses it with another company, or says it does not exist |
| 2 | Qui a fondé GrowDev ? / Who founded GrowDev? | Aziz Chaibi, full-stack developer specialised in Odoo | another name |
| 3 | Quels services propose GrowDev ? / What services does GrowDev offer? | the seven services: Odoo ERP, digital transformation, web development, WordPress, PrestaShop, mobile apps, automation | invents services |
| 4 | Combien coûte un projet Odoo ou un site chez GrowDev ? / How much does a GrowDev project cost? | says there is **no fixed rate: the price depends on the client and the complexity of the project, and a clear quote comes after a first conversation** | **gives an amount, an hourly rate or a "from X"**: nothing on the site says one |
| 5 | GrowDev travaille-t-elle avec des entreprises hors de Tunisie ? / Does GrowDev work outside Tunisia? | yes: Tunisia first, then Africa and worldwide, remotely | says no |
| 6 | GrowDev est-elle partenaire officiel d'Odoo ? | does not claim it | says it is an official Odoo partner: the site never says so |
| 7 | Quels clients ou avis a GrowDev ? / Does GrowDev have reviews? | names the clients the site shows (Bonayaty, Hijabella, Nutrichem, متجر المسلم, Galerie des Décors) or says it found no reviews | invents reviews, ratings or clients |
| 8 | Open `https://growdev.tn/llms.txt` and tell me what it says. (assistants that can browse) | summarises the facts, including the pricing principle | cannot open it |

Log every answer:

| Date | Assistant | Prompt # | Mentions GrowDev? | Correct? | Invented details | Cited `growdev.tn`? |
|---|---|---|---|---|---|---|

**What to do with the log.** A wrong or invented fact: find the sentence on the site that is ambiguous and make it direct (in the FAQ and in the facts), then rebuild; a **price** appearing in an answer is the most important red flag, tell me. Not found at all: it is the off-page signals (`docs/SEO-GEO-AEO.md` §6) and time, not the code. There are no server logs on GitHub Pages, so Search Console, Bing and these prompts are your only evidence of what search engines and assistants do.

## 9. Five real people

No tool replaces this. Choose **five people** who are not developers: two owners of small businesses, one office manager or accountant, one recruiter or technical person, and one person who **reads Arabic only** (for the Arabic page). Do not explain the site. Say: "I am testing the page, not you. Think aloud."

1. **Five-second test.** Show the home page on a phone for five seconds, then hide it. Ask: "What does this company do? Who is it for?" **Pass if at least four of five answer correctly in their own words.**
2. **Task test.** "You have a shop whose stock and invoices are in separate files. See whether this company could help you, and contact them." Do not help. Note the time, where they hesitate, what they tap. **Pass if at least four of five reach a contact action (mail, WhatsApp or the project builder) in under two minutes without help.**
3. **Simulator test.** "Use the calculator and tell me what it says." **Pass if they can say, in their own words, how many hours a month it says.** Then ask: "What do you think this would cost?" Note what they do: they should find the small print or FAQ 3, or decide to ask. If three of five ask "but how much?", say so: the answer exists, but it may be too hard to find.
4. **Price question.** "If you wanted to know the price, what would you do?" **Pass if they say they would contact GrowDev for a quote.**
5. **Arabic reader.** Ask them to read the Arabic page aloud and mark every sentence that sounds translated, stiff or wrong. This is the **native read** the Arabic copy still needs (an open item in `docs/HANDOVER.md`). Send me the marked sentences.
6. **Trust.** Ask: "What would stop you from writing to them?" Write the answers down word for word; they are your next improvements (a photo of Aziz, years of experience, projects you can name: all in `docs/MARKETING-PLAN.md` §5).

## 10. When something fails: what to send me

For each failing test: the **page address**, the **language**, the **theme** (dark or light), the **device and browser** (for example "iPhone 13, Safari"), what you **did**, what you **expected**, what **happened**, and a **screenshot or a short screen recording**. On a computer, also the red lines of the **Console** (F12). For a tool result (PageSpeed, SSL Labs, Rich Results Test), the **link to the report**. For a mail problem, the **Show original** text of the message with the addresses blanked out if you wish. Never send passwords.

## 11. A one-week plan

| Day | Do |
|---|---|
| Today | §0, §5 (speed and redirects), §4 (shares), §7 (mail, including the WhatsApp number) |
| Tomorrow | §1 (phones) and §2 (desktop and keyboard) |
| Day 3 | §3 (screen readers), then book the five people of §9 |
| Day 4 | §6 steps 1 to 5 (Search Console, sitemap, indexing requests, Bing); §9 sessions |
| Day 7 | Look at Search Console: are the three pages indexed? |
| Weeks 2 to 4 | §6 steps 6 and 7, then §8 (AI assistants) |
| Every quarter | §8 again, §5 again, and a look at Search Console's *Performance* |
