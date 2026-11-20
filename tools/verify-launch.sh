#!/usr/bin/env bash
# Launch check for the GrowDev site.   Usage: bash tools/verify-launch.sh [domain]
# Run it from the repository (it reads "email" and "legacyHosts" from src/site.json). Needs curl (Git Bash has it).
# Each page is downloaded ONCE and every check on it reads that copy, so one failed download is reported once, with curl's own
# reason, and the checks that depend on it are listed as "not checked" instead of passing or failing for the wrong reason.
cd "$(dirname "$0")/.." 2>/dev/null || true
D="${1:-growdev.tn}"
EMAIL=$(grep -o '"email" *: *"[^"]*"' src/site.json 2>/dev/null | head -1 | sed 's/^[^:]*: *"\(.*\)"$/\1/')
LEGACY=$(grep -o '"legacyHosts" *: *\[[^]]*\]' src/site.json 2>/dev/null | grep -o '"[a-z0-9.-]*\.[a-z]*"' | tr -d '"')
T=$(mktemp -d 2>/dev/null) || { T="${TMPDIR:-/tmp}/gd-verify-$$"; mkdir -p "$T"; }
trap 'rm -rf "$T"' EXIT
ok=0; ko=0; skipped=0
pass() { echo "  ok    $1"; ok=$((ok+1)); }
fail() { echo "  FAIL  $1"; ko=$((ko+1)); }
skip() { echo "  skip  $1 (not checked: $2)"; skipped=$((skipped+1)); }

key() { printf '%s' "$1" | tr -c 'A-Za-z0-9' '_'; }          # "/ar/" -> "_ar_"
get() {                                                        # download https://$D$1 once; keep body, status and curl's message
  local k; k=$(key "$1")
  [ -e "$T/$k.code" ] && return
  curl -sS --max-time 25 -o "$T/$k.body" -w '%{http_code}' "https://$D$1" >"$T/$k.code" 2>"$T/$k.err"
  [ -s "$T/$k.code" ] || echo 000 >"$T/$k.code"
}
status() { get "$1"; cat "$T/$(key "$1").code"; }
why()    { head -c 160 "$T/$(key "$1").err" 2>/dev/null | tr -d '\r\n'; }
hop()    { curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 25 "$1"; }   # one request, not followed: "<status> <Location>"

expect_code() {
  c=$(status "$1")
  if [ "$c" = "$2" ]; then pass "$2 on $1"
  elif [ "$c" = "000" ]; then fail "$1 gave no answer ($(why "$1")): DNS is not ready, the HTTPS certificate is not issued yet, or there is no network"
  else fail "$1 should answer $2 (got $c)"; fi
}
expect_text() {   # $1 = path, $2 = text that must be in the page
  c=$(status "$1"); f="$T/$(key "$1").body"
  if [ "$c" = "000" ]; then skip "$1 contains: $2" "the page could not be downloaded"; return; fi
  if [ ! -s "$f" ]; then fail "$1 came back empty (status $c), so it cannot contain: $2"; return; fi
  if grep -Fq -- "$2" "$f"; then pass "$1 contains: $2"; else fail "$1 is missing: $2 (status $c, $(wc -c <"$f" | tr -d ' ') bytes received)"; fi
}
expect_absent() { # $1 = path, $2 = text that must NOT be in the page
  c=$(status "$1"); f="$T/$(key "$1").body"
  if [ "$c" = "000" ]; then skip "$1 does not mention $2" "the page could not be downloaded"; return; fi
  if [ ! -s "$f" ]; then fail "$1 came back empty (status $c), so nothing can be said about $2"; return; fi
  if grep -Fq -- "$2" "$f"; then fail "$1 still mentions the earlier address $2"; else pass "$1 does not mention $2"; fi
}
expect_redirect() {   # $1 = address to request, $2 = where it must lead
  r=$(hop "$1"); c=${r%% *}; t=${r#* }
  case "$c" in
    301|302|307|308) [ "$t" = "$2" ] && pass "$1 leads to $2 ($c)" || fail "$1 leads to ${t:-nowhere}, not $2";;
    000) fail "$1 gave no answer: DNS is not ready or the HTTPS certificate is not issued yet";;
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
for h in $LEGACY; do expect_absent / "$h"; done
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
echo; echo "$ok passed, $ko failed, $skipped not checked"; [ "$ko" -eq 0 ] && [ "$skipped" -eq 0 ]
