#!/usr/bin/env bash
# Launch check for the GrowDev site.   Usage: bash tools/verify-launch.sh [domain]
# Run it from the repository: it reads the settings it compares the live site with from src/site.json, and the built scripts and stylesheet from site/.
# Needs curl (Git Bash has it). Exit code 0 only when every check passed and none was skipped.
# Each page is downloaded ONCE and every check on it reads that copy, so one failed download is reported once, with curl's own
# reason, and the checks that depend on it are listed as "not checked" instead of passing or failing for the wrong reason.
cd "$(dirname "$0")/.." 2>/dev/null || true
D="${1:-growdev.tn}"
setting() { grep -o "\"$1\" *: *\"[^\"]*\"" src/site.json 2>/dev/null | head -1 | sed 's/^[^:]*: *"\(.*\)"$/\1/'; }
EMAIL=$(setting email); REPO=$(setting repo); WHATSAPP=$(setting whatsapp); LINKEDIN=$(setting linkedin)
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
sha8()   {                                                     # first 8 hex digits of the SHA-256 of a text file, line endings ignored (a Windows checkout may have CRLF, the deployed build has LF); empty if the computer has no sha tool
  if command -v sha256sum >/dev/null 2>&1; then tr -d '\r' <"$1" | sha256sum | cut -c1-8
  elif command -v shasum >/dev/null 2>&1; then tr -d '\r' <"$1" | shasum -a 256 | cut -c1-8; fi
}
page_text() {                                                  # a downloaded page, without the link to this site's source code (that link legitimately contains the earlier github.io name)
  local t; t=$(<"$1")
  if [ -n "$REPO" ]; then printf '%s' "${t//"$REPO"/}"; else printf '%s' "$t"; fi
}

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
expect_absent() { # $1 = path, $2 = text that must NOT be in the page, $3 = what it is, for the message (default: the text itself)
  c=$(status "$1"); f="$T/$(key "$1").body"
  if [ "$c" = "000" ]; then skip "$1 does not mention ${3:-$2}" "the page could not be downloaded"; return; fi
  if [ ! -s "$f" ]; then fail "$1 came back empty (status $c), so nothing can be said about ${3:-$2}"; return; fi
  if page_text "$f" | grep -Fq -- "$2"; then fail "$1 still mentions ${3:-$2}"; else pass "$1 does not mention ${3:-$2}"; fi
}
expect_redirect() {   # $1 = address to request, $2 = where it must lead
  r=$(hop "$1"); c=${r%% *}; t=${r#* }
  case "$c" in
    301|302|307|308) [ "$t" = "$2" ] && pass "$1 leads to $2 ($c)" || fail "$1 leads to ${t:-nowhere}, not $2";;
    000) fail "$1 gave no answer: DNS is not ready or the HTTPS certificate is not issued yet";;
    *) fail "$1 should redirect to $2 (it answered $c)";;
  esac
}
expect_same_as_checkout() {   # every stylesheet and script the live pages load is byte for byte the one in this checkout's site/ folder
  local what="the live stylesheet and scripts are the ones in this checkout"
  if [ ! -d site/assets ]; then skip "$what" "there is no site/ folder here: run the build first (node tools/build.mjs)"; return; fi
  if [ -z "$(sha8 /dev/null)" ]; then skip "$what" "this computer has neither sha256sum nor shasum"; return; fi
  local refs="" p f ref file live here n=0 stale=""
  for p in / /ar/ /en/; do
    f="$T/$(key "$p").body"
    [ -s "$f" ] && refs="$refs $(grep -Eo 'assets/(css|js)/[A-Za-z0-9_.-]+\?v=[0-9a-f]{8}' "$f")"
  done
  if [ -z "${refs// /}" ]; then skip "$what" "the live pages could not be read"; return; fi
  for ref in $(printf '%s\n' $refs | sort -u); do
    file=${ref%%\?*}; live=${ref##*=}; n=$((n+1)); here=""
    [ -f "site/$file" ] && here=$(sha8 "site/$file")
    [ "$here" = "$live" ] || stale="$stale ${file##*/}"
  done
  if [ -z "$stale" ]; then pass "$what ($n files)"
  else fail "the live site is not this checkout yet (different:$stale). Push, wait for the green run in the Actions tab, then run this script again. If you pushed long ago, run the build here and push again: site/ may be out of date"; fi
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
for p in / /ar/ /en/; do expect_text "$p" 'application/ld+json'; done
echo "Contact, profiles and earlier addresses"
if [ -n "$EMAIL" ]; then for p in / /ar/ /en/; do expect_text "$p" "mailto:$EMAIL"; done
else fail '"email" could not be read from src/site.json (run the script from the repository)'; fi
if [ -n "$WHATSAPP" ]; then for p in / /ar/ /en/; do expect_text "$p" "href=\"https://wa.me/$WHATSAPP"; done; fi
if [ -n "$REPO" ]; then expect_text / "href=\"$REPO\""; fi
if [ -n "$LINKEDIN" ]; then expect_text / "href=\"$LINKEDIN\""; fi
for p in / /ar/ /en/; do for h in $LEGACY; do expect_absent "$p" "$h" "the earlier address $h"; done; done
echo "Search and AI files"
for f in /sitemap.xml /robots.txt /llms.txt /llms-full.txt; do expect_code "$f" 200; done
expect_text /sitemap.xml "https://$D/ar/"
expect_text /sitemap.xml "https://$D/en/"
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
echo "Live site and this checkout"
expect_same_as_checkout
echo; echo "$ok passed, $ko failed, $skipped not checked"; [ "$ko" -eq 0 ] && [ "$skipped" -eq 0 ]
