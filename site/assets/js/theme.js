/* GrowDev — light / dark theme.
   boot.js has already applied the saved or default theme before the first paint. This file runs the toggle button and the wave:
   the new theme is revealed through an organic shape that grows from the button. The browser (View Transitions API) keeps a picture
   of the old theme and draws the new one live, so every pixel of the page is entirely old or entirely new and the text and cards
   stay readable the whole time. Without that API the theme switches with a short fade; with "reduce motion" it switches at once. */
(function () {
  "use strict";
  var GD = window.GD = window.GD || {};
  var root = document.documentElement;
  var KEY = "gd-theme", TAU = Math.PI * 2;

  /* ---------- wave geometry: pure functions (tools/check.mjs runs them in Node and checks the screen is always covered) ---------- */
  var POINTS = 96;     // vertices of the outline: smooth to the eye, cheap for the browser to animate
  var STEPS = 48;      // keyframes per wave, about one every 20 ms
  var START_R = 20;    // the wave leaves the button as a disc about the size of the button
  var END_AMP = 0.03;  // how wavy the outline still is once it has outgrown the screen

  // gathers at the button, rushes across the page, settles at the far corner
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  // Every wave gets its own small personality: three lobes (3, 5 and 7 per turn) with a random phase and drift direction.
  function newSeed(rand) {
    rand = rand || Math.random;
    return { a: rand() * TAU, b: rand() * TAU, c: rand() * TAU, da: rand() < 0.5 ? -1 : 1, db: rand() < 0.5 ? -1 : 1, dc: rand() < 0.5 ? -1 : 1 };
  }

  // Radius of the outline at angle th. r = mean radius, p = time (0..1), e = how far the wave has grown (0..1, eased).
  // The outline is lively while the wave is small and calms down as it spreads.
  function edge(th, r, p, e, s) {
    var amp = END_AMP + 0.17 * Math.pow(1 - e, 1.5);
    var w = 0.5 * Math.sin(3 * th + s.a + s.da * 0.6 * TAU * p) +
            0.3 * Math.sin(5 * th + s.b + s.db * 0.9 * TAU * p) +
            0.2 * Math.sin(7 * th + s.c + s.dc * 1.3 * TAU * p);
    return r * (1 + amp * w);
  }

  // Mean radius at the end: even where the outline is at its closest, it clears the farthest corner of the screen.
  function finalRadius(cx, cy, w, h) {
    return (Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) + 24) / (1 - END_AMP);
  }

  function points(cx, cy, r, p, e, s) {
    var out = [];
    for (var i = 0; i < POINTS; i++) {
      var th = i / POINTS * TAU, rr = edge(th, r, p, e, s);
      out.push([cx + rr * Math.cos(th), cy + rr * Math.sin(th)]);
    }
    return out;
  }
  function polygon(pts) {
    return "polygon(" + pts.map(function (q) { return q[0].toFixed(1) + "px " + q[1].toFixed(1) + "px"; }).join(",") + ")";
  }

  // The keyframes of one wave, as CSS polygon() strings, plus the outlines themselves (for tests)
  function build(cx, cy, w, h, seed) {
    var r1 = finalRadius(cx, cy, w, h), css = [], shapes = [];
    for (var i = 0; i <= STEPS; i++) {
      var p = i / STEPS, e = ease(p), pts = points(cx, cy, START_R + (r1 - START_R) * e, p, e, seed);
      shapes.push(pts); css.push(polygon(pts));
    }
    return { css: css, shapes: shapes };
  }

  // Farther corners take longer, within limits: about 0.8 s on a phone, 1.3 s on a large screen.
  function duration(cx, cy, w, h) {
    var far = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
    return Math.round(Math.max(760, Math.min(1300, 560 + far * 0.5)));
  }

  /* ---------- page behaviour ---------- */
  var busy = false, btn = null, status = null;

  function current() { return root.getAttribute("data-theme") === "light" ? "light" : "dark"; }
  function save(t) { try { localStorage.setItem(KEY, t); } catch (e) { /* storage blocked: the choice lasts until the page closes */ } }
  function reduced() { return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); }

  // Switch the page to theme t at once, without animation. Scripts that draw their own colours listen for "gd:theme".
  function paint(t, say) {
    root.setAttribute("data-theme", t);
    var bar = document.querySelector('meta[name="theme-color"]');
    if (bar && bar.getAttribute("data-" + t)) bar.setAttribute("content", bar.getAttribute("data-" + t));
    if (say && status && GD.i18n) status.textContent = GD.i18n.t(t === "light" ? "theme.nowLight" : "theme.nowDark");
    document.dispatchEvent(new CustomEvent("gd:theme", { detail: { theme: t } }));
  }

  // Browsers without View Transitions: backgrounds fade, text switches halfway (see .theme-fade in styles.css)
  function fade(t) {
    root.classList.add("theme-fade");
    paint(t, true);
    setTimeout(function () { root.classList.remove("theme-fade"); }, 480);
  }

  function wave(t) {
    var r = btn.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var w = window.innerWidth, h = Math.max(window.innerHeight, root.clientHeight);
    var ms = duration(cx, cy, w, h), frames = build(cx, cy, w, h, newSeed()).css, vt;
    root.style.setProperty("--wave-x", cx + "px");
    root.style.setProperty("--wave-y", cy + "px");
    try {
      vt = document.startViewTransition(function () { paint(t, true); });
    } catch (e) {
      paint(t, true);
      return;
    }
    busy = true;
    root.classList.add("theme-switching");
    var done = function () {
      if (!busy) return;
      busy = false;
      root.classList.remove("theme-switching");
      root.style.removeProperty("--wave-x");
      root.style.removeProperty("--wave-y");
    };
    vt.finished.then(done, done);
    vt.ready.then(function () {
      root.animate({ clipPath: frames }, { duration: ms, easing: "linear", fill: "both", pseudoElement: "::view-transition-new(root)" });
    }).catch(function () { /* the transition was skipped: the new theme is already applied, nothing else to do */ });
    setTimeout(done, ms + 1500); // safety net: the button is never left locked
  }

  function toggle() {
    if (busy) return;
    var next = current() === "dark" ? "light" : "dark";
    save(next);
    if (reduced() || document.visibilityState === "hidden") paint(next, true);
    else if (typeof document.startViewTransition === "function") wave(next);
    else fade(next);
  }

  function init() {
    btn = document.getElementById("theme-toggle");
    status = document.getElementById("theme-status");
    if (btn) btn.addEventListener("click", toggle);
    // another tab changed the theme: follow it, without a wave
    window.addEventListener("storage", function (e) {
      if (e.key === KEY && (e.newValue === "light" || e.newValue === "dark") && e.newValue !== current()) paint(e.newValue, false);
    });
    // default "system" and no choice made yet: follow the device when its setting changes
    if (root.getAttribute("data-theme-default") === "system" && window.matchMedia) {
      var mq = matchMedia("(prefers-color-scheme: light)");
      var follow = function () {
        var saved = null;
        try { saved = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
        var t = mq.matches ? "light" : "dark";
        if (!saved && t !== current()) paint(t, false);
      };
      if (mq.addEventListener) mq.addEventListener("change", follow); else if (mq.addListener) mq.addListener(follow);
    }
  }

  GD.theme = {
    init: init,
    get: current,
    toggle: toggle,
    wave: { ease: ease, newSeed: newSeed, edge: edge, finalRadius: finalRadius, points: points, build: build, duration: duration, POINTS: POINTS, STEPS: STEPS, START_R: START_R, END_AMP: END_AMP }
  };
})();
