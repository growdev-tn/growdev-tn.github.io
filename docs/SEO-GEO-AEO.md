# SEO · GEO · AEO — GrowDev

Tunisia first, then Africa, then the world. Three languages, one URL each: `/` (français), `/ar/` (العربية), `/en/` (English).

**GEO** is used in both senses, because the term means two things today:

- **Generative Engine Optimization**: being found, understood and quoted correctly by AI assistants (ChatGPT, Claude, Perplexity, Gemini, Copilot).
- **Geographic targeting**: telling search engines which country and languages the site serves.

**AEO** (Answer Engine Optimization) means giving direct, quotable answers to the questions buyers actually ask.

## 1. What is built in

| Layer | What the site does | Where |
|---|---|---|
| **SEO** | One prerendered HTML page per language: the content is readable without JavaScript. Unique `<title>` and meta description per language, canonical URL, `hreflang` fr / ar / en plus `x-default` (English), Open Graph and Twitter cards with a share image per language. `sitemap.xml` with the alternates, `robots.txt`, one `<h1>` and a clean heading outline. | `tools/build.mjs`, `tools/seo.mjs`, `src/i18n/*.json` |
| **GEO — generative** | `llms.txt` (short summary and links) and `llms-full.txt` (whole site text in three languages). Explicit rules in `robots.txt` for the AI search and user agents and for the training crawlers. One JSON-LD `@graph` per page with stable `@id`s: Organization + ProfessionalService, founder (Person, with `url` pointing at `#developpeur`, `knowsAbout` listing the twelve technologies and, when set in `src/site.json`, `sameAs` with Aziz's own GitHub and LinkedIn profiles), WebSite, WebPage, 7 Services, FAQPage. `llms.txt` and `llms-full.txt` also carry the situation guide ("Which of these sounds like you?") and the developer profile, so an assistant asked "who builds this?" or "what does GrowDev do for a business that works in Excel?" finds a plain answer. A visible "GrowDev en bref" fact list says the same facts in every language, **the pricing principle included** (no fixed rate: the price depends on the client and on the complexity of the project), so an assistant asked "how much does GrowDev cost?" quotes the real answer instead of guessing one. Since 25 Nov `llms.txt` also lists Aziz's GitHub and LinkedIn profiles as plain text (never as markdown links: it points only at this site) and keeps product names capitalised ("specialised in Odoo"). | `tools/seo.mjs`, `src/index.template.html` |
| **GEO — geographic** | `areaServed` lists Tunisia, Africa and Worldwide. `geo.region=TN`. Tunisia-first copy (SMEs in Tunisia, quotes in DT first, € or $ abroad). `og:locale` and `inLanguage` per page. Language targeting through `hreflang`, not through a country setting. | `src/site.json`, `tools/seo.mjs` |
| **AEO** | A visible FAQ of 10 questions, each answered in the first sentence, then detailed. **Since 25 Nov the first sentence of every answer is a complete answer on its own** (the checker requires at least five words, so "Yes." alone fails): a search snippet, a voice assistant and `llms.txt` quote that sentence and nothing else. Question 3 (cost) starts with the principle: "The price depends on the client and the complexity of the project". Questions 9 ("I know nothing about IT: can I still trust you?") and 10 (freelance work for recruiters, agencies and technical teams) were added on 24 Nov for the two kinds of visitor. The same text is published as `FAQPage` JSON-LD. The checker fails the build if the two ever differ. | `src/i18n/*.json` (`faq.*`), `tools/check.mjs` |

**Honest notes**

- Since August 2023 Google shows FAQ rich results only for well-known government and health sites. The `FAQPage` markup will therefore not produce expandable results for GrowDev in Google. It is kept because it is valid, other engines and AI tools can read it, and the visible FAQ is the real answer-engine asset.
- No major AI provider has confirmed that it ranks pages using `llms.txt`. It costs nothing, and assistants and agents that fetch pages do read it. Treat it as a bonus, not a lever.
- Nobody can promise rankings or AI citations. New sites usually take weeks to months to settle. The work here removes technical obstacles and gives the engines clear, consistent facts.
- `geo.*` meta tags are ignored by Google; they are a harmless hint for other engines.
- There is no `aggregateRating` and no review in the markup: nothing is invented. The client names (from `src/site.json`) are in the visible Clients carousel and in `llms.txt` and `llms-full.txt`; they are not repeated in the JSON-LD. The carousel is plain HTML (a list of five logos with their names as `alt` text) that a script only moves, so crawlers and AI assistants read the same five names without running it. Add ratings or reviews only when they are real and visible on the page.
- Publishing no price has a cost: a visitor who compares suppliers by price may leave. That is why the question "how much?" gets a real answer instead of a blank: what the price depends on (the client and the complexity of the project: number of modules, data to migrate, custom development, training), what comes first (a clear quote after a first conversation) and in which currency the quote comes.

### No price on the site (decision of 25 Nov 2026)

The price of a project depends on the client and on how complex the project is, so any figure on the site would be invented or soon wrong ("nothing invented" is a standing rule). Since 25 Nov:

- **Removed:** the simulator's hourly cost, its currency picker and its "value of the time" result (markup, script, styles, `config.js`, and the keys `cur.*`, `curfmt.*`, `sim.cost.t`, `sim.rate*`, `sim.cur`, `sim.res.value`, `sim.res.rate` in the three dictionaries). The simulator turns hours into hours, days and a share of a full-time job, and writes the formula out.
- **Said instead:** the fine print under the simulator ("…every project is analysed before any commitment, and its price depends on your situation and on how complex it is"), the fact "Pricing and quotes" in the About block (also in `llms.txt` and `llms-full.txt`), the first sentence of FAQ 3, and the hero note "A clear quote before we start". Currencies are *named* ("quote in DT for Tunisia, in € or $ internationally"), never attached to an amount.
- **Structured data:** the `Offer` items in `hasOfferCatalog` carry no `price`, `priceRange` or `priceCurrency`.
- **Enforced:** the checker fails the build if an amount of money (a number next to DT, TND, DH, DZD, EGP, XOF, EUR, USD, €, $, د.ت, "dinars", "euros"…) appears in a page, an attribute, a meta tag, a dictionary, `404.html`, `llms.txt`, `llms-full.txt` or the JSON-LD, if the JSON-LD has a `price*` key, or if the old simulator ids, styles, script constants or dictionary keys come back. If one day you decide to publish a price, change that rule on purpose.

## 2. Keyword map

I could not run a keyword-volume tool from here, so these are working hypotheses. Confirm them with Search Console after the first month. A live look at the results showed:

- **French** queries ("intégrateur Odoo Tunisie", "création site web Tunisie") are dominated by directories (Sortlist, Clutch, ERPResearch, Elioplus, GoAfricaOnline) and Odoo's own partner pages.
- **Arabic** queries mostly return freelance marketplaces (Khamsat) and Odoo's Arabic partner pages. Few Tunisian companies have a real Arabic page, so `/ar/` has a good chance to rank.

| | Français (`/`) | العربية (`/ar/`) | English (`/en/`) |
|---|---|---|---|
| **Main** | ERP Odoo Tunisie · développement web Tunisie · application mobile Tunisie | نظام Odoo ERP تونس · تطوير مواقع الويب تونس · تطبيقات الجوال تونس | Odoo ERP Tunisia · web development Tunisia · mobile app development Tunisia |
| **Secondary** | implémentation Odoo · développement Odoo sur mesure · site WordPress · boutique PrestaShop · transformation digitale PME · automatisation | تنفيذ Odoo · وحدات Odoo مخصصة · متجر إلكتروني · التحول الرقمي للمؤسسات · الأتمتة | Odoo implementation · custom Odoo modules · WordPress site · PrestaShop store · digital transformation for SMEs · automation |
| **Questions (FAQ)** | Odoo convient-il à une PME tunisienne ? · combien coûte un projet Odoo… · combien de temps faut-il… | هل يناسب Odoo المؤسسات الصغرى والمتوسطة في تونس؟ · كم تبلغ كلفة مشروع Odoo… | Is Odoo a good fit for a Tunisian small or medium business? · how much does an Odoo project… · how long does it take… |
| **On the page** | title, description, `h1`, services, FAQ, facts | same, written natively (not translated word for word) | same |

Rules for editing the copy:

- Write each language for its readers. Do not translate sentence by sentence.
- Keep the title under 65 characters and the description between 70 and 165 (the checker enforces both).
- Mention Tunisia in the title or description of every language.
- **Do not claim "official Odoo partner" or "certified"** unless GrowDev is listed as such by Odoo. Nothing in the current copy says so.

### Long-tail and recruiter queries (24 Nov 2026, hypotheses to test)

Not measured: no volume or ranking is known. They tell the copy which words to use in plain language and give Search Console something to compare against after a month.

| Visitor | Words they probably use (to be confirmed by Search Console) | Where the page answers |
|---|---|---|
| Owner, French | remplacer Excel par un logiciel de gestion · gestion de stock et factures PME Tunisie · automatiser la facturation · créer une boutique en ligne en Tunisie | `#situations` (six first-person rows), the service cards, the FAQ |
| Owner, English | replace spreadsheets with business software Tunisia · small business inventory and invoicing software Tunisia · online store Tunisia | same, written natively in `en.json` |
| Owner, Arabic | برنامج لتسيير المخزون والفواتير تونس · متجر إلكتروني تونس · تقليص العمل اليدوي في الشركة | same, written natively in `ar.json` |
| Recruiter or technical team | développeur Odoo freelance Tunisie · Odoo developer freelance Tunisia · full-stack developer Odoo Python Django · مبرمج Odoo تونس | `#developpeur`, FAQ 10, the Person node (`knowsAbout`, `sameAs`), the source-code and profile links |

The plain-language headlines of the situation guide are deliberate: visitors search with their problem, not with a product name. The jargon guard in the checker keeps ERP, API and similar words out of the hero, the guide and the contact text; the product names stay in the service cards, the FAQ and the technical profile, where the keyword map above applies.

## 3. Launch checklist (in this order)

1. **Deploy and check HTTPS** (see `docs/DEPLOY.md`). The *Live check* workflow does this after every deploy (and every Monday); `bash tools/verify-launch.sh` shows the details on your computer. Open `/`, `/ar/`, `/en/`, `/sitemap.xml`, `/robots.txt`, `/llms.txt` once yourself.
2. **Google Search Console.** Add a *Domain* property for `growdev.tn` (the site has its own DNS zone since the move to `growdev.tn`) and verify it with the TXT record Google gives you, added in the OVH DNS zone. Then submit `https://growdev.tn/sitemap.xml` and use *URL inspection → Request indexing* for the three pages. Details are in `docs/DEPLOY.md`.
3. **Bing Webmaster Tools.** Import the site from Search Console, then submit the same sitemap. Bing's index also feeds Microsoft Copilot and some other assistants.
4. **Validate the markup.** Run the three URLs through the Google Rich Results Test and validator.schema.org. Run PageSpeed Insights on mobile.
5. **Google Business Profile.** Create a *Software company* profile (service-area business if there is no public address). Use the same name, email and website everywhere.
6. **Entity links (`sameAs`).** The company's `sameAs` lists the GitHub organisation `https://github.com/growdev-tn`; Aziz's own GitHub profile is `profiles.github` and feeds the Person node. Aziz's LinkedIn URL is set in `profiles.linkedin` (24 Nov) and is in the Person node. Still to do: create the LinkedIn company page and add its URL to `sameAs` in `src/site.json`. Rebuild. These links are the strongest signal that tells engines and AI tools "this is the same entity".
7. **Backlinks.** Link to the site from `werchti.tn`, from the founder's LinkedIn and GitHub profiles, and from directories where GrowDev qualifies (Sortlist, Clutch, GoAfricaOnline). Odoo.com's partner directory only if GrowDev is an official partner.
8. **Share test.** Paste each URL into WhatsApp, LinkedIn and Facebook to see the language-specific share image.
9. **Real-world tests.** Phones, screen readers, mail, PageSpeed, AI assistants and five real people: `docs/REAL-WORLD-TESTING.md`.

## 4. Routine

- Edit text in `src/i18n/*.json` only, then run `npm run build && npm run check`. Never edit `site/*.html` by hand: the build overwrites it.
- The sitemap `lastmod` comes from the last git commit that touched `src/` or `site/assets/`.
- The six situation rows and their targets are listed in `SITUATIONS` in `tools/seo.mjs` (n and anchor); `llms.txt` and the checker read the same list. Changing the order or the target of a row means editing that list and the template together.
- To add a FAQ item: add `faq.qN` and `faq.aN` to the three JSON files, add the `<details>` block to `src/index.template.html`, and raise `FAQ_COUNT` in `tools/seo.mjs`. The build and the checker tell you if something is missing. Write the answer so that its **first sentence answers the question on its own** ("Yes, we work with companies outside Tunisia." and not "Yes."): the checker requires at least five words.
- Each month: look at Search Console (Performance → by country and by language), turn real queries into new FAQ entries, and refresh the facts block when something changes (services, languages, the pricing wording).
- Next content step: one short case study per project in the three languages, once clients agree to be named. The Clients section (17 Nov 2026) shows names and logos only; a case study per client is the natural next step. Real case studies are the best source of citations for both search and AI answers.
- To add a client: one line in `"clients"` in `src/site.json` and the logo in `site/assets/img/clients/` (see `ARCHITECTURE.md` §5.6). The build puts the name in `llms.txt` and `llms-full.txt` by itself.

## 5. AI crawlers

`robots.txt` is generated from `tools/seo.mjs` and `src/site.json`. It allows search engines and names the AI agents explicitly so the policy is visible:

- **Search and live-answer agents** (allowed): OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, Applebot, DuckAssistBot, MistralAI-User.
- **Training crawlers** (**blocked**, `"allowAiTraining": false` in `src/site.json`): GPTBot, ClaudeBot, Google-Extended, Applebot-Extended, CCBot. Blocking `Google-Extended` does not affect Google Search.

To allow training instead, set `"allowAiTraining": true` in `src/site.json` and rebuild; the checker follows the setting. Search visibility and live answers are not affected either way. `robots.txt` is a request that reputable crawlers respect, not a lock.

## 6. Off-page signals (25 Nov 2026): what to do outside the code

The page is technically ready. What decides whether a new site is found and quoted now is mostly **what other places say about it**. In order of value for the effort (none of this can promise a ranking or a citation):

| # | Action | Why it helps | Notes |
|---|---|---|---|
| 1 | **Search Console, Domain property**, sitemap, "Request indexing" for the three pages | Without being indexed nothing else counts; the Domain property covers `www`, `http` and all paths | TXT record in the OVH DNS zone; `docs/DEPLOY.md` |
| 2 | **Bing Webmaster Tools** (import from Search Console) | Bing's index feeds Microsoft Copilot and other assistants and search tools | same sitemap |
| 3 | **GitHub repository page:** *About → Website* = `https://growdev.tn`; pin the repository on your profile; put the site in the URL field of your profile (Settings → Public profile) | A second, trusted page that links to the site and names the founder | one minute, gear icon next to *About* |
| 4 | **LinkedIn:** the website in your profile's contact info and *Featured* section; then a **company page** for GrowDev | Same entity, same name, same address everywhere; the company page's URL goes into `sameAs` in `src/site.json` (then rebuild) | your own profile is already in the Person node |
| 5 | **Google Business Profile**, category *Software company*, service-area business if there is no public address | Local and "near me" results in Tunisia, a verified entity | same name, e-mail and website as the site |
| 6 | **A credit link on sites GrowDev built** (the five clients, Werchti, IqrarSanté): "Site by GrowDev" linking to `https://growdev.tn/` (the Arabic client to `/ar/`, English-language sites to `/en/`) | A real backlink from sites that already exist, in the right language | **ask each owner first.** Anchor text = the brand name, not keywords ("Odoo Tunisie"): keyword-stuffed footer links across many sites look like a link scheme. A plain link, no extra attributes, is fine |
| 7 | **Directories where GrowDev truly qualifies** (Sortlist, Clutch, GoAfricaOnline) | Third-party mentions of the same name, services and country | Odoo's own partner directory only if GrowDev is an official partner |
| 8 | **One case study per client**, in the three languages, once the client agrees to be named | The best source of citations for search and for AI answers; also the proof the marketing plan lacks | `docs/MARKETING-PLAN.md` |
| 9 | **Real reviews**, only when real | Google reviews on the Business Profile | never written, bought or invented |

Do not buy backlinks or join link-exchange groups. **Measuring:** Search Console and Bing show queries, pages and countries (look at them monthly); for AI assistants, ask the same five questions every quarter and write the answers down (the prompts and a log table are in `docs/REAL-WORLD-TESTING.md` §8). Most AI assistants that answer with live results rely on a search index, so being indexed and mentioned on other trusted pages is what lets them find GrowDev; the site's own `llms.txt` helps only the ones that read it.

## 7. What the checker enforces (`npm run check`)

Per page: `lang`/`dir`, title and description length and uniqueness, canonical, reciprocal `hreflang`, Open Graph and Twitter tags, 1200×630 share image, one `h1` and no skipped heading level, valid JSON-LD with no dangling `@id`, FAQ text identical on the page and in JSON-LD, working internal links and anchors, `alt` on images, labels on form fields, accessible names on links and buttons, CSP present, no inline scripts, no resource from another host, Arabic fonts only on the Arabic page, size budgets.

Since 25 Nov also: **no price anywhere** (no amount of money in any page, attribute, meta tag, dictionary, `404.html`, `llms.txt`, `llms-full.txt` or JSON-LD; no `price*` key in the JSON-LD; none of the old simulator ids, styles, constants or dictionary keys); **every FAQ answer opens with a sentence of at least five words** that answers on its own; `llms.txt` and `llms-full.txt` write product names with their capitals, carry the pricing sentence, and write the founder's GitHub and LinkedIn addresses as plain text; `.github/workflows/live-check.yml` watches the deploy workflow by its exact name and runs `tools/verify-launch.sh`.

Since 24 Nov also: the six situation rows lead to existing service anchors and have text in every language, the technical profile links to exactly the addresses set in `src/site.json` (`repo`, `profiles.github`, `profiles.linkedin`), the Person node follows `profiles`, `llms.txt` and `llms-full.txt` carry the situation guide and the developer profile in step with the page, the hero, the guide and the contact text contain no IT jargon, and both mail links in the contact section have a subject and a guided body.

Site-wide: sitemap and alternates, `robots.txt`, `llms.txt` links, `CNAME`, `.nojekyll`, `404.html`, web manifest, files referenced by the CSS.

CI runs the build and the checker before every deployment: a broken page never goes live.
