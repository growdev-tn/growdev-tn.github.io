/* GrowDev — runs first, from <head>. */
(function () {
  var d = document.documentElement;
  d.classList.add("js");

  // Theme, applied before the first paint so the page never flashes the wrong one. A choice made with the toggle wins; otherwise the
  // default set in src/site.json, which the build writes on <html>: "dark" (the GrowDev look), "light", or "system" (follow the device).
  var theme = d.getAttribute("data-theme-default"), saved = null;
  try { saved = localStorage.getItem("gd-theme"); } catch (e) { /* storage blocked: use the default */ }
  if (saved === "light" || saved === "dark") theme = saved;
  else if (theme === "system") theme = window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  if (theme !== "light") theme = "dark";
  d.setAttribute("data-theme", theme);
  var bar = document.querySelector('meta[name="theme-color"]'); // the browser bar on phones follows the theme
  if (bar && bar.getAttribute("data-" + theme)) bar.setAttribute("content", bar.getAttribute("data-" + theme));

  // A language chosen on purpose with the switcher is remembered, and honoured on the neutral entry page only
  // (never on /ar/ or /en/, which people and search engines reach on purpose).
  try {
    var pref = localStorage.getItem("gd-lang");
    if (d.hasAttribute("data-entry") && pref && pref !== d.getAttribute("lang") && d.getAttribute("data-" + pref) &&
        document.referrer.indexOf(location.origin) !== 0) {
      location.replace(d.getAttribute("data-" + pref) + location.hash);
    }
  } catch (e) { /* storage blocked: stay on this page */ }
})();
