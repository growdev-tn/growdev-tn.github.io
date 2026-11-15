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
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
