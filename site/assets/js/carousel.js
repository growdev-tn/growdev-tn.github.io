/* GrowDev — the clients carousel.
   The logos of the Clients section are an endless belt: a visitor drags it, steps it with the two arrow buttons, or leaves it alone and it moves
   by itself. This file only enhances markup that already works as a plain wall (no JavaScript, or every logo already fits), so nothing here is
   needed to read the section.
   The belt is a ring of n plates. `pos` says where it is, in plates: 0 = the first logo at the leading edge, 1.5 = half way between the second
   and the third. Each plate is moved with a transform worked out from `pos`; the layout of the page never changes, so nothing jumps. */
(function () {
  "use strict";
  var GD = window.GD = window.GD || {};

  var EVERY = 3200;   // ms between two automatic steps
  var GLIDE = 640;    // ms one step takes
  var SLOP = 6;       // px a finger or a mouse must travel before a press counts as a drag
  var FLING = 240;    // ms of coasting a flick adds (speed x FLING = how far the belt carries on)

  function mod(a, m) { return ((a % m) + m) % m; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  function init() {
    var root = document.querySelector("[data-carousel]");
    if (!root) return;
    var view = root.querySelector(".carousel__viewport"), list = root.querySelector(".clients");
    var bPrev = root.querySelector(".carousel__btn--prev"), bNext = root.querySelector(".carousel__btn--next");
    var bPlay = root.querySelector(".carousel__btn--play"), dotBox = root.querySelector(".carousel__dots");
    if (!view || !list || !bPrev || !bNext) return;
    var items = Array.prototype.slice.call(list.children), n = items.length;
    if (n < 2) return;

    // Arabic reads right to left: "forward" is then a move to the right, so every physical move is multiplied by dir
    var dir = getComputedStyle(list).direction === "rtl" ? -1 : 1;
    var mq = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : null;
    var reduced = !!(mq && mq.matches);

    var step = 0;                 // one plate plus one gap, in px
    var belt = false;             // true when the plates are too many to show at once and the belt can run seamlessly
    var pos = 0, goal = 0;        // where the belt is, and where it is going (in plates)
    var raf = 0, gliding = false, timer = 0;
    var drag = null;
    var paused = false;           // the visitor stopped the automatic movement (Pause, an arrow, a drag): it stays stopped until Play
    var hovering = false, focusing = false, inView = false;
    var dots = [], shown = -1;

    function measure() {
      var w = items[0].getBoundingClientRect().width;
      var gap = parseFloat(getComputedStyle(list).columnGap) || 0;
      var room = view.clientWidth;                   // the window the plates are seen through (on a phone it runs on to the edge of the screen)
      step = w + gap;
      var allFit = n * step - gap <= room + 1;       // nothing to scroll: the plain wall stays
      var seamless = (n - 2) * step + w >= room - 2; // the plates cover the window at every position, so no hole ever shows at the end of the belt
      belt = w > 0 && !allFit && seamless;
    }

    function mode() {
      root.classList.toggle("is-static", !belt);
      root.classList.toggle("is-ready", belt);
      if (!belt) items.forEach(function (li) { li.style.transform = ""; });
      refreshPlay();
    }

    function paint() {
      if (!belt) return;
      for (var i = 0; i < n; i++) {
        // the slot this plate is in, from -1 (just left of the window, out of sight) to n-2; a plate that leaves on one side comes back on the other
        var s = mod(i - pos + 1, n) - 1;
        items[i].style.transform = "translate3d(" + (dir * (s - i) * step).toFixed(2) + "px,0,0)";
      }
      var cur = mod(Math.round(pos), n);
      if (cur !== shown) {
        if (dots[shown]) dots[shown].classList.remove("is-on");
        if (dots[cur]) dots[cur].classList.add("is-on");
        shown = cur;
      }
    }

    function settle() {
      gliding = false;
      pos = mod(goal, n); goal = pos;     // the belt is a ring: keep the numbers small
      paint();
      sync();
    }

    function glide(to, ms) {
      cancelAnimationFrame(raf);
      goal = to;
      if (!belt) { pos = to; return; }
      var from = pos;
      if (reduced || !ms || Math.abs(to - from) < 0.002) { gliding = false; settle(); return; }
      ms *= clamp(Math.sqrt(Math.abs(to - from)), 1, 1.8);   // a longer way takes a little longer
      gliding = true;
      var t0 = 0;
      raf = requestAnimationFrame(function frame(now) {
        if (!t0) t0 = now;
        var k = clamp((now - t0) / ms, 0, 1);
        pos = from + (to - from) * ease(k);
        paint();
        if (k < 1) raf = requestAnimationFrame(frame); else settle();
      });
    }
    function go(delta) { glide(Math.round(goal) + delta, GLIDE); }

    /* ---------- by itself ---------- */
    function canRun() { return belt && !reduced && !paused && inView && !document.hidden && !hovering && !focusing && !drag && !gliding; }
    function sync() {
      clearTimeout(timer); timer = 0;
      if (canRun()) timer = setTimeout(function () { timer = 0; if (canRun()) go(1); }, EVERY);
    }
    function refreshPlay() {
      if (!bPlay) return;
      bPlay.hidden = reduced || !belt;      // with reduced motion nothing moves by itself, so there is nothing to pause
      bPlay.classList.toggle("is-paused", paused);
      var label = bPlay.getAttribute(paused ? "data-play" : "data-pause");
      if (label) bPlay.setAttribute("aria-label", label);
    }
    function stop() { if (!paused) { paused = true; refreshPlay(); } sync(); }

    /* ---------- the buttons ---------- */
    bPrev.addEventListener("click", function () { stop(); go(-1); });
    bNext.addEventListener("click", function () { stop(); go(1); });
    if (bPlay) bPlay.addEventListener("click", function () {
      paused = !paused; refreshPlay();
      if (paused) sync(); else go(1);       // Play answers at once with a step, then carries on every few seconds
    });

    /* ---------- drag: a finger or a mouse ---------- */
    view.addEventListener("pointerdown", function (e) {
      if (!belt || drag || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
      cancelAnimationFrame(raf); gliding = false; goal = pos;     // a press catches the belt where it is
      drag = { id: e.pointerId, x: e.clientX, from: pos, live: false, trail: [[e.timeStamp, e.clientX]] };
      sync();
    });
    view.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x;
      if (!drag.live) {
        if (Math.abs(dx) < SLOP) return;
        drag.live = true;
        root.classList.add("is-dragging");
        try { view.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is gone already */ }
        stop();
      }
      pos = drag.from - dir * dx / step; goal = pos;
      paint();
      drag.trail.push([e.timeStamp, e.clientX]);
      while (drag.trail.length > 2 && e.timeStamp - drag.trail[0][0] > 200) drag.trail.shift();
    });
    function release(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag; drag = null;
      root.classList.remove("is-dragging");
      try { view.releasePointerCapture(e.pointerId); } catch (err) { /* nothing to release */ }
      var to = Math.round(pos);
      if (d.live && e.type === "pointerup") {   // a flick carries the belt on, by up to two plates; a finger that stopped before it lifted carries nothing
        var now = e.timeStamp, recent = d.trail.filter(function (p) { return now - p[0] <= 100; });
        if (recent.length > 1 && now - recent[recent.length - 1][0] <= 60) {
          var a = recent[0], b = recent[recent.length - 1], dt = b[0] - a[0];
          if (dt > 0) to = Math.round(pos - dir * clamp((b[1] - a[1]) / dt * FLING / step, -2, 2));
        }
      }
      glide(to, GLIDE);                          // always settle on a whole plate
    }
    view.addEventListener("pointerup", release);
    view.addEventListener("pointercancel", release);   // the browser took the gesture over (a vertical swipe scrolls the page)
    // (a touch is first captured by the plate under the finger; when the belt takes the capture over, that plate "loses" it and the event bubbles up: ignore that one)
    view.addEventListener("lostpointercapture", function (e) { if (e.target === view) release(e); });
    view.addEventListener("dragstart", function (e) { e.preventDefault(); });

    /* ---------- the logos outside the window must be there when they slide in ---------- */
    // The logos are loading="lazy", which suits a wall far down the page; but a browser does not load a lazy picture that an ancestor clips away,
    // so the plates beyond the window would only start loading once they slid into view. Shortly before the section is reached, load them all.
    var pics = Array.prototype.slice.call(list.querySelectorAll("img"));
    function loadAll() { pics.forEach(function (im) { im.loading = "eager"; }); }
    if ("IntersectionObserver" in window) {
      var near = new IntersectionObserver(function (en) {
        if (en.some(function (x) { return x.isIntersecting; })) { near.disconnect(); loadAll(); }
      }, { rootMargin: "900px 0px" });
      near.observe(root);
    } else loadAll();

    /* ---------- when it should wait ---------- */
    view.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") { hovering = true; sync(); } });
    view.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") { hovering = false; sync(); } });
    root.addEventListener("focusin", function (e) { focusing = e.target !== bPlay; sync(); });   // somebody is at the arrows: do not move under their hand
    root.addEventListener("focusout", function () { focusing = false; sync(); });
    document.addEventListener("visibilitychange", sync);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { inView = en[en.length - 1].isIntersecting; sync(); }, { threshold: 0.25 }).observe(root);
    } else inView = true;
    if (mq) {
      var onMotion = function () {
        reduced = mq.matches;
        if (reduced && gliding) { cancelAnimationFrame(raf); gliding = false; pos = mod(goal, n); goal = pos; paint(); }
        refreshPlay(); sync();
      };
      if (mq.addEventListener) mq.addEventListener("change", onMotion); else if (mq.addListener) mq.addListener(onMotion);
    }

    /* ---------- the plates change size with the window ---------- */
    function relayout() {
      var was = belt;
      measure();
      if (belt !== was) mode();
      paint(); sync();
    }
    if ("ResizeObserver" in window) new ResizeObserver(relayout).observe(list); else window.addEventListener("resize", relayout);

    if (dotBox) for (var i = 0; i < n; i++) {
      var dot = document.createElement("span");
      dot.className = "carousel__dot";
      dotBox.appendChild(dot); dots.push(dot);
    }
    measure(); mode(); paint(); sync();
  }

  GD.carousel = {
    init: function () {
      try { init(); }
      catch (err) {   // whatever goes wrong, the logos stay visible as a plain wall
        var c = document.querySelector("[data-carousel]");
        if (c) { c.classList.add("is-static"); c.classList.remove("is-ready"); Array.prototype.forEach.call(c.querySelectorAll(".client"), function (li) { li.style.transform = ""; }); }
      }
    }
  };
})();
