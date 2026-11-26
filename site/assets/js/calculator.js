/* GrowDev — time-saving simulator. Everything runs in the browser; nothing is stored or sent.
   The formula is written out on the page (people x hours x share x 4.33 weeks = hours per month), so a visitor can check every number.
   Time only, on purpose: the price of a project depends on the client and on how complex the project is, so the page never turns hours into money. */
(function () {
  "use strict";
  var GD = window.GD = window.GD || {};
  var $ = function (s) { return document.querySelector(s); };
  var WEEKS = 4.33, FTE_MONTH = 160, SAY_DELAY = 800;

  GD.calculator = {
    init: function () {
      var form = $("#sim-form");
      if (!form) return;
      var people = $("#s-people"), hours = $("#s-hours"), share = $("#s-share");
      var oP = $("#o-people"), oH = $("#o-hours"), oS = $("#o-share");
      var rH = $("#r-hours"), rD = $("#r-days");
      var eP = $("#e-people"), eH = $("#e-hours"), eS = $("#e-share"), eT = $("#e-total");
      var cap = $("#sim-cap"), say = $("#sim-say");
      var bars = Array.prototype.slice.call(document.querySelectorAll("#sbars i"));
      var shown = { h: 0, d: 0 }, target = { h: 0, d: 0 }, raf = 0, touched = false, sayTimer = 0;
      var t = GD.i18n.t;

      // ICU separates thousands with a narrow no-break space (U+202F); a regular no-break space (U+00A0) reads better at display size
      function nf(o) { var f = new Intl.NumberFormat(GD.i18n.numLocale(), o); return { format: function (v) { return f.format(v).replace(/ /g, " "); } }; }
      function whole(v) { return nf({ maximumFractionDigits: 0 }).format(Math.round(v)); }
      function paintNumbers() {
        rH.textContent = nf({ maximumFractionDigits: 0 }).format(shown.h);
        rD.textContent = nf({ minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(shown.d);
      }
      function tween() {
        var k = 0.22, done = true;
        ["h", "d"].forEach(function (key) {
          var diff = target[key] - shown[key];
          if (Math.abs(diff) > Math.max(0.05, Math.abs(target[key]) * 0.002)) { shown[key] += diff * k; done = false; } else { shown[key] = target[key]; }
        });
        paintNumbers();
        raf = done ? 0 : requestAnimationFrame(tween);
      }
      function paintInputs() {
        [people, hours, share].forEach(function (el) {
          el.style.setProperty("--fill", ((el.value - el.min) / (el.max - el.min) * 100) + "%");
        });
        oP.textContent = people.value;
        oH.textContent = t("sim.h", { n: hours.value });
        oS.textContent = t("sim.pct", { n: share.value });
      }
      // One polite sentence for screen readers, a moment after the visitor stops moving a control. Never on page load, and never once per animation frame.
      function announce(perMonth) {
        if (!touched || !say) return;
        clearTimeout(sayTimer);
        sayTimer = setTimeout(function () {
          say.textContent = t("sim.say", {
            p: people.value, h: hours.value, s: t("sim.pct", { n: share.value }),
            m: whole(perMonth)
          });
        }, SAY_DELAY);
      }
      function compute() {
        var perMonth = (+people.value) * (+hours.value) * (+share.value / 100) * WEEKS;
        target = { h: perMonth, d: perMonth / 8 };
        bars.forEach(function (b, i) {
          // cumulative hours freed after month i+1, as a share of one full-time job (160 h x 12 months)
          b.style.setProperty("--v", Math.min(1, perMonth * (i + 1) / (FTE_MONTH * 12)).toFixed(3));
        });
        paintInputs();
        // the equation and the caption say in words what the big numbers mean
        eP.textContent = people.value;
        eH.textContent = t("sim.h", { n: hours.value });
        eS.textContent = t("sim.pct", { n: share.value });
        eT.textContent = t("sim.h", { n: whole(perMonth) });
        cap.textContent = t("sim.cap", { h: whole(perMonth * 12), p: t("sim.pct", { n: whole(perMonth / FTE_MONTH * 100) }) });
        if (GD.reduceMotion) { shown = { h: target.h, d: target.d }; paintNumbers(); }
        else if (!raf) raf = requestAnimationFrame(tween);
        announce(perMonth);
      }

      form.addEventListener("submit", function (e) { e.preventDefault(); });
      [people, hours, share].forEach(function (el) { el.addEventListener("input", function () { touched = true; compute(); }); });
      compute();
    }
  };
})();
