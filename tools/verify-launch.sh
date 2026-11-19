#!/usr/bin/env bash
# Launch check for the GrowDev site.   Usage: bash tools/verify-launch.sh [domain]
# Run it from the repository (it reads "email" and "legacyHosts" from src/site.json). Needs curl (Git Bash has it).
cd "$(dirname "$0")/.." 2>/dev/null || true
D="${1:-growdev.tn}"
EMAIL=$(grep -o '"email" *: *"[^"]*"' src/site.json 2>/dev/null | head -1 | sed 's/^[^:]*: *"\(.*\)"$/\1/')
LEGACY=$(grep -o '"legacyHosts" *: *\[[^]]*\]' src/site.json 2>/dev/null | grep -o '"[a-z0-9.-]*\.[a-z]*"' | tr -d '"')
ok=0; ko=0
pass() { echo "  ok    $1"; ok=$((ok+1)); }
fail() { echo "  FAIL  $1"; ko=$((ko+1)); }
code() { curl -s -o /dev/null -w '%{http_code}' --max-time 25 "$1"; }
body() { curl -s --max-time 25 "$1"; }
hop()  { curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 25 "$1"; }   # one request, not followed: "<status> <Location>"
expect_code() {
  c=$(code "https://$D$1")
  if [ "$c" = "$2" ]; then pass "$2 on $1"
  elif [ "$c" = "000" ]; then fail "$1 gave no answer: DNS is not ready, the HTTPS certificate is not issued yet, or there is no network"
  else fail "$1 should answer $2 (got $c)"; fi
}
expect_text() { body "https://$D$1" | grep -Fq -- "$2" && pass "$1 contains: $2" || fail "$1 is missing: $2"; }
expect_redirect() {   # $1 = address to request, $2 = where it must lead
  r=$(hop "$1"); c=${r%% *}; t=${r#* }
  case "$c" in
    301|302|307|308) [ "$t" = "$2" ] && pass "$1 leads to $2 ($c)" || fail "$1 leads to ${t:-nowhere}, not $2";;
    *) fail "$1 should redirect to $2 (it answered $c)";;
  esac
}

echo "Address: $D"
echo "Pages"
for p in / /ar/ /en/; do expect_code "$p" 200; done
expect_text /    'lang="fr" dir="ltr"'
expect_text /ar/ 'lang="ar" dir="rtl"'
expect_text /en/ 'lang="en" dir="ltr"'
expect_text /    "rel=\"canonical\" href=\"https://$D/\""
expect_text /ar/ "rel=\"canonical\" href=\"https://$D/ar/\""
expect_text /en/ "rel=\"canonical\" href=\"https://$D/en/\""
expect_text /en/ 'hreflang="x-default"'
echo "Contact address and earlier addresses"
if [ -n "$EMAIL" ]; then for p in / /ar/ /en/; do expect_text "$p" "mailto:$EMAIL"; done
else fail '"email" could not be read from src/site.json (run the script from the repository)'; fi
for h in $LEGACY; do body "https://$D/" | grep -Fq -- "$h" && fail "/ still mentions the earlier address $h" || pass "/ does not mention $h"; done
echo "Search and AI files"
for f in /sitemap.xml /robots.txt /llms.txt /llms-full.txt; do expect_code "$f" 200; done
expect_text /sitemap.xml "https://$D/ar/"
expect_text /robots.txt  "Sitemap: https://$D/sitemap.xml"
expect_text /robots.txt  "User-agent: GPTBot"
echo "Share images"
for f in /assets/img/og-fr.jpg /assets/img/og-ar.jpg /assets/img/og-en.jpg; do expect_code "$f" 200; done
echo "HTTPS, other addresses and 404"
loc=$(curl -sI --max-time 25 "http://$D/" | tr -d '\r' | awk 'tolower($1)=="location:"{print $2}')
case "$loc" in https://*) pass "http redirects to https";; *) fail "http does not redirect to https (GitHub Pages should force HTTPS: Settings, Pages, Enforce HTTPS)";; esac
case "$D" in
  *.github.io) ;;   # on a github.io address there is nothing else to redirect
  *) expect_redirect "https://www.$D/" "https://$D/"
     for h in $LEGACY; do case "$h" in *.github.io) expect_redirect "https://$h/" "https://$D/";; esac; done;;
esac
expect_code /does-not-exist 404
expect_text /does-not-exist "GrowDev"
echo; echo "$ok passed, $ko failed"; [ "$ko" -eq 0 ]
