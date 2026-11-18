/* GrowDev — boot */
(function () {
  "use strict";
  function boot() {
    var GD = window.GD;
    GD.theme.init(); // first: the toggle must work even if something below fails
    GD.hero.init();
    GD.ui.init();
    GD.composer.init();
    GD.calculator.init();
    // last: the logo belt is an enhancement of a plain wall. If its script is missing the wall stays; if it fails, it puts the wall back itself.
    if (GD.carousel) GD.carousel.init();
    else { var belt = document.querySelector("[data-carousel]"); if (belt) belt.classList.add("is-static"); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
