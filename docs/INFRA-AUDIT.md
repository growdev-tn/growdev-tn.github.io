# Infrastructure audit: `growdev.tn` (19 Nov 2026)

Scope: everything between the registrar and the page: domain, DNS, e-mail records, HTTPS, headers, routing between the names of the site, and page-load cost. The application itself (copy, design, accessibility) is covered by `UX-AUDIT.md` and `tools/check.mjs`.

**This is a pre-launch audit and it is Claude's own review.** The sandbox this audit ran in cannot reach DNS or live sites, so Claude measured nothing live. Aziz ran the DNS and `curl` commands from his own PC on 19 Nov 2026 at about 20:00 GMT and pasted the output; the section *Measurements received* records it. It shows that `growdev.tn` still serves OVH's placeholder page. **No score is given**: DNS, HTTPS and mail are not in their final state, and a score now would describe something that is about to change. What follows is (1) what was measured on the built site, (2) Aziz's measurements, (3) a review of the plan against GitHub's and OVHcloud's documentation and the OVH screenshots, and (4) the commands that repeat the measurements once the domain is live (last section).

## Summary

- The site itself is in good shape for this layer: a strict `Content-Security-Policy`, no request to any other host, no `http://` resource, versioned assets, no cookies.
- The launch can go wrong in five places, all outside the code. In order: **old OVH hosting records left in the DNS zone** (confirmed on 19 Nov: `growdev.tn` still serves OVH's placeholder page), **publishing the address before the mailbox exists** (the mailbox now exists), **domain not verified at GitHub**, **no DMARC record on a brand-new mail domain** (SPF is there, DMARC is missing), and **the mailbox belongs to OVH's free hosting offer**, so that offer must never be deleted.
- **State on 20 Nov, morning:** the DNS was switched on the evening of 19 Nov, the domain is verified at GitHub and set as custom domain, and the site answers at `https://growdev.tn/` (see *Second round* below). Still to confirm: that **Enforce HTTPS** is ticked and that `bash tools/verify-launch.sh` says `ok` on every line.
- Three limits come from GitHub Pages and cannot be fixed here: you cannot add HTTP response headers of your own (GitHub sends `Strict-Transport-Security` and none of the other usual security headers; measured on 19 Nov), you cannot set cache lifetimes (GitHub sends `Cache-Control: max-age=600`), and a certificate takes up to about an hour to appear.

## How it was done (Phase 0: which modes were possible)

| Mode | Result |
|---|---|
| Live external audit (DNS-over-HTTPS, the site, SSL Labs, securityheaders.com, PageSpeed) | **Not possible from here.** The two live fetches tried (a DNS-over-HTTPS lookup and `growdev-tn.github.io`) were refused by the sandbox's network allowlist; I did not work around it. Aziz ran the DNS and `curl` commands on his own PC instead (section *Measurements received*) |
| Static audit of the built site (`site/`) | **Done**, with a local Chromium (3 languages, 2 themes, phone and desktop widths: 114 checks, 0 failed) |
| Documentation review (GitHub Pages, OVHcloud DNS and MX Plan) and your OVH screenshot of the domain's *General information* tab | **Done.** The screenshot does not show the *DNS zone* tab or any renewal date |
| Server mode (`infra_audit.sh` over SSH) | Not applicable: there is no server of your own |
| Nginx and Docker phases | Not applicable: GitHub serves the site. Docker is only used on your PC to run the build |

## Scorecard

| Area | Status | Basis |
|---|---|---|
| Registrar | 🟡 Mostly fine | From the screenshot: *Registered*, *Active*, transfer protection **ON**, standard OVH DNS servers. **Data protection is Disabled** (finding 9), DNSSEC is unavailable at the `.tn` registry (finding 11). Renewal date not visible |
| DNS | 🟢 Correct at OVH's server (19 Nov evening) | Four `A`, four `AAAA`, `www` `CNAME`, `_dmarc`; was wrong at 20:00 GMT (finding 1). Outside caches can lag up to an hour |
| E-mail records | 🟡 Measured by Aziz | Three `MX`, one SPF and `_dmarc` present; DKIM unknown (finding 4); the mailbox exists (finding 2) |
| HTTPS / certificate | 🟡 Pending, not yet confirmed | **Enforce HTTPS** was greyed out at about 22:00 on 19 Nov (certificate not ready); GitHub issues it after the DNS check, up to about an hour (finding 13) |
| HTTP headers | 🟡 Measured on `growdev-tn.github.io` | HSTS present, no other security header; the `Content-Security-Policy` is a `<meta>` tag (strong). Headers cannot be added on GitHub Pages (finding 10). Not yet measured on `growdev.tn` |
| Performance | 🟡 Static budget measured | First-view weight below; TTFB, compression, caching and Core Web Vitals not measured |
| Nginx, Docker | n/a | No server of your own |
| Routing between the names | 🟡 Partly confirmed | Custom domain set, "DNS check successful"; the `www` and `growdev-tn.github.io` redirects and `http`→`https` are still to be confirmed by `verify-launch.sh` |

## Findings

### Before you push

1. **[CRITICAL] Old OVH hosting records in the DNS zone.**
   *Evidence:* the screenshot shows the domain attached to the hosting plan `growdes.cluster129.hosting.ovh.net`, with `growdev.tn` and `www.growdev.tn` as multisite entries. OVH normally keeps `A`/`AAAA` and `www` records for those, pointing at its own hosting. I could not read the zone itself.
   *Risk:* if they stay next to GitHub's addresses, some visitors get an OVH page and some get the site, and GitHub's DNS check fails.
   *Fix:* `DEPLOY.md`, step 3 (delete them, add the nine GitHub records, keep every `MX` and `TXT`).
   *Verify:* `Resolve-DnsName growdev.tn -Type A -Server 8.8.8.8 -DnsOnly` shows only the four `185.199.108–111.153` addresses.
   *Status, 19 Nov about 20:00 GMT: confirmed.* `growdev.tn` resolves to `51.91.236.255` and `2001:41d0:301::29` (OVH's free hosting; OVH's activation guide says that activating the free offer can write these records), `www` has a record that is not a `CNAME`, and `https://growdev.tn/` and `https://www.growdev.tn/` both answer with OVH's Apache placeholder. The new pages were pushed before this step, so the pages at `growdev-tn.github.io` already name `growdev.tn` in their canonical links, sitemap and share-image links. The harm is limited while the site has no visitors (share previews have no image, search engines see a canonical address that serves a placeholder), but do steps 3 and 4 now.
   *Update, 19 Nov evening:* done. Two mistakes on the way, both fixed and now written in `DEPLOY.md`: a `TXT` record on `www` (`3|welcome`) blocked the `CNAME`, and the first `A` and `AAAA` records were typed with a subdomain (`a`, `aaaa`) instead of an empty field. The stray address `213.186.33.5` (OVH's redirection service) no longer appeared in the final check.

2. **[CRITICAL] Publish the address only when the mailbox works.** E-mail is the site's only contact channel. *Fix:* `DEPLOY.md`, step 1; test a message in both directions.
   *Status 19 Nov:* the mailbox exists (OVH *Emails* tab: account `contact`, 0 B of 5 GB, not blocked due to spam). The pages were pushed before a send-and-receive test was reported: send one now, in both directions.

3. **[HIGH] Verify `growdev.tn` for the GitHub organization.** Without it, someone else could point the name at their own GitHub Pages site if a record is ever left dangling. *Fix:* step 4.1 (the `_github-pages-challenge-growdev-tn` TXT record, kept forever). *Status 19 Nov evening:* done, GitHub shows `growdev.tn` as **Verified** for the organization.

4. **[HIGH] Mail authentication on a new domain.** A domain without SPF and DMARC sends to spam more often. *Status 19 Nov:* SPF exists (`v=spf1 include:mx.ovh.com -all`, made by OVH; `-all` rejects any sender that is not listed, so a second sender such as an Odoo server needs its own `include:` in the same record), `_dmarc.growdev.tn` does not exist, DKIM unknown. *Fix:* keep the one SPF record, add the `_dmarc` TXT (`v=DMARC1; p=none;`), and activate DKIM if the panel offers it (not verified from here). *Update 19 Nov evening:* the `_dmarc` record is added and OVH's name server returns `v=DMARC1; p=none;`. DKIM is still open. *Verify:* send from `contact@growdev.tn` to Gmail, **Show original**: SPF `PASS`.

### Soon after

5. **[HIGH] The mailbox belongs to OVH's free hosting offer; renewal date of the domain.** OVH's pages describe the free offer as 100 MB of hosting plus one 5 GB mailbox, included with the domain and renewed free every year until the domain expires, and its activation guide says the offer can be deleted after backing up the hosting data **and the e-mail contents**. So the free hosting (`growdes.cluster129.hosting.ovh.net`) is what holds `contact@growdev.tn`: **never delete it**. It only has to keep the mailbox; it does not need to serve a website. It includes one mailbox, so more addresses need a paid plan. *Fix:* in the OVH panel read the domain's renewal date (not visible on the screenshots) and turn on automatic renewal. If the domain lapses, the site and the mailbox stop together.

6. **[CLOSED] A leftover `growdev.werchti.tn` record.** The old plan used that name and was dropped on 7 Nov 2026; a record still pointing at GitHub would be the classic way a subdomain gets taken over. *Checked by Aziz on 19 Nov:* `Resolve-DnsName growdev.werchti.tn -Type CNAME -Server 8.8.8.8 -DnsOnly` says the DNS name does not exist. Nothing to do.

7. **[MEDIUM] Protect the accounts that control everything.** Whoever controls the OVH account controls the domain, its DNS and the mailbox; whoever controls `growdev-tn` on GitHub controls the site. I could not see whether two-step verification is on for either. Turn it on for both and keep the recovery codes offline.

8. **[MEDIUM] Keep `contact@werchti.tn` alive and forwarded** to the new mailbox for 6 to 12 months (`DEPLOY.md`, step 1.6).

9. **[MEDIUM] Data protection is *Disabled*.** The screenshot says "Your personal information is visible: no data has been anonymised". Open the *Contact management* tab to see what that is. If the panel lets you turn *Data protection* on for `.tn`, do; if it cannot, know that the registrant details are public.

### Limits and options

10. **[LOW] Response headers cannot be set on GitHub Pages.** The page carries a strict CSP as a `<meta>` tag, which covers scripts, styles, images, fonts, forms and `<base>`. A `<meta>` CSP cannot carry `frame-ancestors`, so another site can still frame the pages (clickjacking). The site has no login, no payment and no form that stores anything, so the impact is small. GitHub decides the response headers. Measured on 19 Nov on `growdev-tn.github.io`: `Strict-Transport-Security: max-age=31556952` (about one year) and `Cache-Control: max-age=600` (10 minutes) are sent; `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy` are not. A proxy in front (Cloudflare, say) could add them, but it puts a third party between you and your visitors and breaks the "no third-party request" rule: not recommended now. No `referrer` meta is needed, browsers already default to `strict-origin-when-cross-origin`.

11. **[LOW] No DNSSEC for `.tn`.** The panel says the registry does not offer it, so there is nothing to switch on. The transfer protection is on, which is the main protection that is available.

12. **[LOW] GitHub Actions are pinned by version tag** (`actions/checkout@v6`, …), not by commit. Dependabot proposes updates weekly; merge them after the checks are green.

13. **[LOW] Certificate gap.** After the DNS check passes, GitHub needs up to about an hour to issue the certificate, and **Enforce HTTPS** stays grey until then. Do the DNS and GitHub steps when no one is about to open the link. A `CAA` record in the zone, if there is one, must allow `letsencrypt.org`.

14. **[LOW] DMARC later.** `p=none` only reports. Once mail has flowed for a few weeks without problems you can move to `p=quarantine`. No hurry.

## Measurements received (run by Aziz on 19 Nov 2026, about 20:00 GMT, read by Claude)

| What | Result |
|---|---|
| `growdev.tn` `A` and `AAAA` (asked to 8.8.8.8) | `51.91.236.255` and `2001:41d0:301::29`, TTL 3600: OVH's free hosting, **not GitHub** |
| `www.growdev.tn` `CNAME` | none (the answer was the zone's SOA record) |
| `MX` | `mx1.mail.ovh.net` (preference 1), `mx2.mail.ovh.net` (5), `mx3.mail.ovh.net` (100). Three records, not five: leave them as OVH made them |
| `TXT` on the bare domain | `v=spf1 include:mx.ovh.com -all` (SPF) and `1\|www.growdev.tn` (an OVH marker for the hosting's `www` entry: leave it) |
| `_dmarc.growdev.tn` | does not exist |
| `growdev.werchti.tn` | does not exist (good: finding 6 is closed) |
| `https://growdev.tn/` and `https://www.growdev.tn/` | `200`, `Server: Apache`, 5,031 bytes: OVH's placeholder page |
| `http://growdev.tn/` | `200` over plain HTTP, no redirect to HTTPS (OVH's behaviour, not GitHub's) |
| `https://growdev-tn.github.io/` | `200`, `Server: GitHub.com`, 57,685 bytes (the size of the new French page), `Last-Modified` 20:00:09 GMT: the workflow deployed the new build |
| Headers of that last response | `Strict-Transport-Security: max-age=31556952`, `Cache-Control: max-age=600`, `Access-Control-Allow-Origin: *`, `Vary: Accept-Encoding`, served through Fastly. Absent: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy` |
| `curl.exe --http2` | refused by his `curl` ("the installed libcurl version does not support this"): not a server problem; the flag was removed from the re-run list below |
| OVH panel, *Emails* tab | account `contact`, 0 B of 5 GB used, *Blocked due to SPAM*: No |

**Second round (19 Nov evening and 20 Nov morning).**

- At OVH's own name server (`ns1.tn.ovh.net`): four `A` (`185.199.108–111.153`), four `AAAA` (`2606:50c0:8000–8003::153`), `www` `CNAME` → `growdev-tn.github.io`, and `_dmarc` `TXT` `v=DMARC1; p=none;`. The stray `213.186.33.5` no longer appeared. (Asked to OVH's server, so outside caches may still show old answers for up to an hour.)
- GitHub: `growdev.tn` shows as **Verified** for the organization; in the repository's Pages settings the custom domain is `growdev.tn` with "DNS check successful". **Enforce HTTPS** was greyed out at about 22:00 (GitHub's message: the domain is not yet configured to support HTTPS, meaning the certificate was still pending).
- The first version of `tools/verify-launch.sh`, run right after that: 22 passed, 8 failed. Two failures match the pending certificate (`http` did not redirect to `https`; `growdev-tn.github.io` led to `http://growdev.tn/`). The other six were content checks on `/`, `/ar/` and `/en/` that failed while other checks on the same pages passed. That is not explained: the old script downloaded each page several times and showed a failed download as "missing" (and as `ok` for the "does not mention" checks), so some downloads probably failed during the certificate rollout. The script was rewritten (one download per page, curl's reason shown, `skip` for what could not be checked). Re-run it.
- 20 Nov morning: Claude read `https://growdev.tn/` with a web-fetch tool: it shows the GrowDev site, with canonical `https://growdev.tn/` and the `contact@growdev.tn` link. That tool cannot show the HTTPS enforcement or the redirects.

## Routing between the names

Layers, in the order to test them when something is wrong: DNS → certificate for that name → GitHub's custom-domain setting → the page. Nginx server blocks and `proxy_pass` belong to GitHub here.

| Name | Must lead to | Mechanism | First thing to test |
|---|---|---|---|
| `growdev.tn` | the site | four `A`, four `AAAA` → GitHub Pages | `Resolve-DnsName` shows only GitHub's addresses |
| `www.growdev.tn` | `https://growdev.tn/` (redirect) | `CNAME` → `growdev-tn.github.io.` | `curl.exe -sI https://www.growdev.tn/` answers 301 with `Location: https://growdev.tn/` |
| `growdev-tn.github.io` | `https://growdev.tn/` (redirect) | GitHub does it once the custom domain is set | `curl.exe -sI https://growdev-tn.github.io/` (19 Nov: answers `200` with the site itself, as expected until the custom domain is set) |
| `growdev.werchti.tn` | nothing | no record may remain | finding 6 |
| `growdev.tn` mail | OVH mail servers | the three `MX` records OVH made, never touched by website changes | `Resolve-DnsName growdev.tn -Type MX -Server 8.8.8.8 -DnsOnly` |
| `contact@werchti.tn` | still readable or forwarded | `werchti.tn` mail, unrelated to the site | finding 8 |

## Page-load cost (static, measured on the built site)

Measured with a local Chromium on a phone-sized window, dark theme, French/Arabic/English pages. Text files are counted gzipped (level 9, my estimate of what a compressing server sends); images and fonts as stored. This is a file count and a weight, **not a Lighthouse score**.

| Page | Files requested | Raw | Transferred (estimate) |
|---|---|---|---|
| `/` (French) | 22 | 305.6 KB | 192.8 KB |
| `/ar/` (Arabic) | 25 | 440.6 KB | 323.3 KB |
| `/en/` (English) | 22 | 303.1 KB | 191.8 KB |

Why Arabic is heavier: it loads three more font files (about 130 KB). What helps: one stylesheet (50.9 KB, 13.3 KB gzipped), one tiny script in `<head>` (`boot.js`, 1.6 KB, runs before the first paint), ten more scripts at the end of `<body>`, only the Latin fonts preloaded, 7 of 8 images loaded lazily, `width` and `height` on every image, and a `?v=` hash on every stylesheet and script.

Measured by Aziz: GitHub sends `Cache-Control: max-age=600` (10 minutes; the `?v=` hashes make that safe) and serves the page through Fastly. Not measured: time to first byte, whether GitHub compresses text (the request that would show it went to OVH, not to GitHub), HTTP/2 or 3 (the `curl.exe` on his PC is built without HTTP/2, so it cannot tell), and Core Web Vitals.

## What works well

- `Content-Security-Policy`: `default-src 'self'; script-src 'self'; … object-src 'none'; base-uri 'self'; form-action 'self'`. No inline script. The one softer spot is `style-src 'unsafe-inline'`, needed by 60 inline `style` attributes on the French page.
- No request to another host on any page (checked in the browser on every page, language, theme and width). The only other hosts written in the pages are identifiers and links (`schema.org`, `github.com`, the `w3.org` XML namespace).
- No `http://` resource anywhere in the built site.
- Own fonts and images, no cookies, only two storage keys (`gd-theme`, `gd-lang`).
- The deploy workflow has least privileges: read-only by default, `pages: write` and `id-token: write` only in the deploy job, and it builds and checks before it publishes.
- The checker now fails the build if the address, the contact e-mail, an earlier host, `site/CNAME` or a share image does not match `src/site.json` (25 deliberate breakages, all caught), and `tools/verify-launch.sh` tests the live site in 30 checks, including the `www` and `github.io` redirects.

## Re-run this audit once the domain is live

In PowerShell:

```powershell
Resolve-DnsName growdev.tn         -Type A     -Server 8.8.8.8 -DnsOnly
Resolve-DnsName growdev.tn         -Type AAAA  -Server 8.8.8.8 -DnsOnly
Resolve-DnsName www.growdev.tn     -Type CNAME -Server 8.8.8.8 -DnsOnly
Resolve-DnsName growdev.tn         -Type MX    -Server 8.8.8.8 -DnsOnly
Resolve-DnsName growdev.tn         -Type TXT   -Server 8.8.8.8 -DnsOnly
Resolve-DnsName _dmarc.growdev.tn  -Type TXT   -Server 8.8.8.8 -DnsOnly
Resolve-DnsName growdev.werchti.tn -Type CNAME -Server 8.8.8.8 -DnsOnly
curl.exe -sI https://growdev.tn/
curl.exe -sI http://growdev.tn/
curl.exe -sI https://www.growdev.tn/
curl.exe -sI https://growdev-tn.github.io/
curl.exe -sI -H "Accept-Encoding: gzip, br" https://growdev.tn/assets/css/styles.css
curl.exe -s -o NUL -w "DNS %{time_namelookup}s  connect %{time_connect}s  TLS %{time_appconnect}s  first byte %{time_starttransfer}s  total %{time_total}s\n" https://growdev.tn/
```

What to read: `200` and `Server: GitHub.com` on the first (his `curl.exe` speaks HTTP/1.1 only, so it prints `HTTP/1.1`; PageSpeed or SSL Labs show whether the server offers HTTP/2); a `301` to `https://growdev.tn/` on the `http` one, on `www` and on `github.io`; `content-encoding` (gzip or br) on the stylesheet; whether `strict-transport-security` and `cache-control` appear in the headers (write down what they say); the timings. Then, in Git Bash, `bash tools/verify-launch.sh` (30 checks, all `ok`).

Then three public tools, each takes the address and needs no account: `https://www.ssllabs.com/ssltest/` (certificate, protocols, names covered), `https://securityheaders.com/` (headers; expect a modest grade, see finding 10) and `https://pagespeed.web.dev/` (Core Web Vitals on a phone profile). Paste the three results into a new chat and ask for `/web-infra-audit`: the scorecard above can then be filled with measurements.
