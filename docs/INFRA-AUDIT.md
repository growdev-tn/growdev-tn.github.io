# Infrastructure audit: `growdev.tn` (19 Nov 2026)

Scope: everything between the registrar and the page: domain, DNS, e-mail records, HTTPS, headers, routing between the names of the site, and page-load cost. The application itself (copy, design, accessibility) is covered by `UX-AUDIT.md` and `tools/check.mjs`.

**This is a pre-launch audit and it is Claude's own review.** `growdev.tn` does not serve the site yet, and the sandbox this audit ran in cannot reach DNS or live sites. So **no live measurement was made and no score is given**: a score here would be invented. What follows is (1) what could be measured on the built site, (2) a review of the plan against GitHub's and OVHcloud's documentation and your OVH screenshot, and (3) the commands that turn every "not measured" into a measurement once the domain is live (last section).

## Summary

- The site itself is in good shape for this layer: a strict `Content-Security-Policy`, no request to any other host, no `http://` resource, versioned assets, no cookies.
- The launch can go wrong in five places, all outside the code. In order: **old OVH hosting records left in the DNS zone** (visitors split between two servers), **publishing the address before the mailbox exists**, **domain not verified at GitHub**, **no SPF and DMARC on a brand-new mail domain** (your mails land in spam), and **the mailbox may depend on an OVH hosting plan with its own renewal date**.
- Three limits come from GitHub Pages and cannot be fixed here: you cannot set HTTP response headers (no `Strict-Transport-Security` of your own, no `X-Frame-Options`), you cannot set cache lifetimes, and a certificate takes up to about an hour to appear.

## How it was done (Phase 0: which modes were possible)

| Mode | Result |
|---|---|
| Live external audit (DNS-over-HTTPS, the site, SSL Labs, securityheaders.com, PageSpeed) | **Not possible from here.** The two live fetches tried (a DNS-over-HTTPS lookup and `growdev-tn.github.io`) were refused by the sandbox's network allowlist; I did not work around it. Before the switch there is also nothing at `growdev.tn` to measure |
| Static audit of the built site (`site/`) | **Done**, with a local Chromium (3 languages, 2 themes, phone and desktop widths: 114 checks, 0 failed) |
| Documentation review (GitHub Pages, OVHcloud DNS and MX Plan) and your OVH screenshot of the domain's *General information* tab | **Done.** The screenshot does not show the *DNS zone* tab or any renewal date |
| Server mode (`infra_audit.sh` over SSH) | Not applicable: there is no server of your own |
| Nginx and Docker phases | Not applicable: GitHub serves the site. Docker is only used on your PC to run the build |

## Scorecard

| Area | Status | Basis |
|---|---|---|
| Registrar | 🟡 Mostly fine | From the screenshot: *Registered*, *Active*, transfer protection **ON**, standard OVH DNS servers. **Data protection is Disabled** (finding 9), DNSSEC is unavailable at the `.tn` registry (finding 11). Renewal date not visible |
| DNS | ⚪ Not measured | Records to create and to delete are listed in `DEPLOY.md`, step 3; the main risk is finding 1 |
| E-mail records | ⚪ Not measured | MX, one SPF, DMARC, DKIM if offered (finding 4) |
| HTTPS / certificate | ⚪ Not measured | Issued and renewed by GitHub after the DNS check; gap of up to about an hour (finding 13) |
| HTTP headers | 🟡 Partly measured | A `Content-Security-Policy` is delivered as a `<meta>` tag (measured, strong). Real response headers cannot be set on GitHub Pages (finding 10) |
| Performance | 🟡 Static budget measured | First-view weight below; TTFB, compression, caching and Core Web Vitals not measured |
| Nginx, Docker | n/a | No server of your own |
| Routing between the names | ⚪ Not measured | Plan reviewed below |

## Findings

### Before you push

1. **[CRITICAL] Old OVH hosting records in the DNS zone.**
   *Evidence:* the screenshot shows the domain attached to the hosting plan `growdes.cluster129.hosting.ovh.net`, with `growdev.tn` and `www.growdev.tn` as multisite entries. OVH normally keeps `A`/`AAAA` and `www` records for those, pointing at its own hosting. I could not read the zone itself.
   *Risk:* if they stay next to GitHub's addresses, some visitors get an OVH page and some get the site, and GitHub's DNS check fails.
   *Fix:* `DEPLOY.md`, step 3 (delete them, add the nine GitHub records, keep every `MX` and `TXT`).
   *Verify:* `Resolve-DnsName growdev.tn -Type A -Server 8.8.8.8 -DnsOnly` shows only the four `185.199.108–111.153` addresses.

2. **[CRITICAL] Publish the address only when the mailbox works.** E-mail is the site's only contact channel. *Fix:* `DEPLOY.md`, step 1; test a message in both directions before `git push`.

3. **[HIGH] Verify `growdev.tn` for the GitHub organization.** Without it, someone else could point the name at their own GitHub Pages site if a record is ever left dangling. *Fix:* step 4.1 (the `_github-pages-challenge-growdev-tn` TXT record, kept forever).

4. **[HIGH] Mail authentication on a new domain.** A domain without SPF and DMARC sends to spam more often. *Fix:* step 2: exactly **one** SPF record (`v=spf1 include:mx.ovh.com ~all`), the `_dmarc` TXT (`v=DMARC1; p=none;`), and DKIM if the MX Plan page offers it (activation not verified from here). *Verify:* send from `contact@growdev.tn` to Gmail, **Show original**: SPF `PASS`.

### Soon after

5. **[HIGH] Renewal dates and the hosting-plan dependency.** The screenshot says *Emails: Your business emails included* and lists the hosting plan. Mailboxes included with a plan may disappear when the plan ends. *Fix:* in the OVH panel, read the renewal date of the **domain** and of the **hosting plan**, turn on automatic renewal for both, and do not cancel the plan before you have confirmed what the mailbox depends on. If the domain lapses, both the site and the mailbox stop.

6. **[MEDIUM] A leftover `growdev.werchti.tn` record.** The old plan used that name and was dropped on 7 Nov 2026. A record still pointing at GitHub, in the `werchti.tn` zone, is the classic way a subdomain gets taken over. *Verify:* `Resolve-DnsName growdev.werchti.tn -Type CNAME -Server 8.8.8.8 -DnsOnly` must find nothing. If it finds a record, delete it in the `werchti.tn` zone.

7. **[MEDIUM] Protect the accounts that control everything.** Whoever controls the OVH account controls the domain, its DNS and the mailbox; whoever controls `growdev-tn` on GitHub controls the site. I could not see whether two-step verification is on for either. Turn it on for both and keep the recovery codes offline.

8. **[MEDIUM] Keep `contact@werchti.tn` alive and forwarded** to the new mailbox for 6 to 12 months (`DEPLOY.md`, step 1.6).

9. **[MEDIUM] Data protection is *Disabled*.** The screenshot says "Your personal information is visible: no data has been anonymised". Open the *Contact management* tab to see what that is. If the panel lets you turn *Data protection* on for `.tn`, do; if it cannot, know that the registrant details are public.

### Limits and options

10. **[LOW] Response headers cannot be set on GitHub Pages.** The page carries a strict CSP as a `<meta>` tag, which covers scripts, styles, images, fonts, forms and `<base>`. A `<meta>` CSP cannot carry `frame-ancestors`, so another site can still frame the pages (clickjacking). The site has no login, no payment and no form that stores anything, so the impact is small. `Strict-Transport-Security`, `X-Frame-Options`, `Permissions-Policy` and cache lifetimes are GitHub's to set. A proxy in front (Cloudflare, say) could add them, but it puts a third party between you and your visitors and breaks the "no third-party request" rule: not recommended now. No `referrer` meta is needed, browsers already default to `strict-origin-when-cross-origin`.

11. **[LOW] No DNSSEC for `.tn`.** The panel says the registry does not offer it, so there is nothing to switch on. The transfer protection is on, which is the main protection that is available.

12. **[LOW] GitHub Actions are pinned by version tag** (`actions/checkout@v6`, …), not by commit. Dependabot proposes updates weekly; merge them after the checks are green.

13. **[LOW] Certificate gap.** After the DNS check passes, GitHub needs up to about an hour to issue the certificate, and **Enforce HTTPS** stays grey until then. Do the DNS and GitHub steps when no one is about to open the link. A `CAA` record in the zone, if there is one, must allow `letsencrypt.org`.

14. **[LOW] DMARC later.** `p=none` only reports. Once mail has flowed for a few weeks without problems you can move to `p=quarantine`. No hurry.

## Routing between the names

Layers, in the order to test them when something is wrong: DNS → certificate for that name → GitHub's custom-domain setting → the page. Nginx server blocks and `proxy_pass` belong to GitHub here.

| Name | Must lead to | Mechanism | First thing to test |
|---|---|---|---|
| `growdev.tn` | the site | four `A`, four `AAAA` → GitHub Pages | `Resolve-DnsName` shows only GitHub's addresses |
| `www.growdev.tn` | `https://growdev.tn/` (redirect) | `CNAME` → `growdev-tn.github.io.` | `curl.exe -sI https://www.growdev.tn/` answers 301 with `Location: https://growdev.tn/` |
| `growdev-tn.github.io` | `https://growdev.tn/` (redirect) | GitHub does it once the custom domain is set | `curl.exe -sI https://growdev-tn.github.io/` |
| `growdev.werchti.tn` | nothing | no record may remain | finding 6 |
| `growdev.tn` mail | OVH mail servers | the five `MX` records, never touched by website changes | `Resolve-DnsName growdev.tn -Type MX -Server 8.8.8.8 -DnsOnly` |
| `contact@werchti.tn` | still readable or forwarded | `werchti.tn` mail, unrelated to the site | finding 8 |

## Page-load cost (static, measured on the built site)

Measured with a local Chromium on a phone-sized window, dark theme, French/Arabic/English pages. Text files are counted gzipped (level 9, my estimate of what a compressing server sends); images and fonts as stored. This is a file count and a weight, **not a Lighthouse score**.

| Page | Files requested | Raw | Transferred (estimate) |
|---|---|---|---|
| `/` (French) | 22 | 305.6 KB | 192.8 KB |
| `/ar/` (Arabic) | 25 | 440.6 KB | 323.3 KB |
| `/en/` (English) | 22 | 303.1 KB | 191.8 KB |

Why Arabic is heavier: it loads three more font files (about 130 KB). What helps: one stylesheet (50.9 KB, 13.3 KB gzipped), one tiny script in `<head>` (`boot.js`, 1.6 KB, runs before the first paint), ten more scripts at the end of `<body>`, only the Latin fonts preloaded, 7 of 8 images loaded lazily, `width` and `height` on every image, and a `?v=` hash on every stylesheet and script.

Not measured: time to first byte, whether GitHub compresses and over which protocol (HTTP/2 or 3), the `Cache-Control` it sends (GitHub says changes appear within about 10 minutes, so assume a short cache; the `?v=` hashes make that safe), and Core Web Vitals.

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
curl.exe -s -o NUL --http2 -w "DNS %{time_namelookup}s  connect %{time_connect}s  TLS %{time_appconnect}s  first byte %{time_starttransfer}s  total %{time_total}s  HTTP/%{http_version}\n" https://growdev.tn/
```

What to read: `HTTP/2 200` and `server: GitHub.com` on the first; a `301` to `https://growdev.tn/` on the `http` one, on `www` and on `github.io`; `content-encoding` (gzip or br) on the stylesheet; whether `strict-transport-security` and `cache-control` appear in the headers (write down what they say); the timings. Then, in Git Bash, `bash tools/verify-launch.sh` (30 checks, all `ok`).

Then three public tools, each takes the address and needs no account: `https://www.ssllabs.com/ssltest/` (certificate, protocols, names covered), `https://securityheaders.com/` (headers; expect a modest grade, see finding 10) and `https://pagespeed.web.dev/` (Core Web Vitals on a phone profile). Paste the three results into a new chat and ask for `/web-infra-audit`: the scorecard above can then be filled with measurements.
