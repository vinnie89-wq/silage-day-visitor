/* =========================================================
   The yellow Safety button in the header
   ---------------------------------------------------------
   Tapping it opens a pop-up panel (like the Comfort one) with
   everything to do with safety:
     1. Lost child or emergency – with the 999 button, first,
        because that's what someone tapping in a hurry needs
     2. The safety rules – the same list as the first-visit
        pop-up, from rule_1, rule_2 … in translations.js
     3. Loud machinery and the quiet area
   The button is really a link to safety.html, so if this script
   ever fails to load, it still takes people to the Safety page.
   The page is also kept for links on QR signs and in texts.

   Needs: openPanel() from comfort.js and fillSafetyBits() from
   first-visit.js, so this file loads after both of them.
   ========================================================= */

function openSafetyPanel() {
  const html =
    '<button type="button" class="sheet-close" data-close data-i18n-attr="aria-label:close"><span aria-hidden="true">×</span></button>' +
    '<h2 id="safety-title"><span aria-hidden="true">⚠️</span> <span data-i18n="nav_safety"></span></h2>' +

    // 1. Lost child / emergency – at the top so it's quick to find
    '<section class="safety-part alert-part" aria-labelledby="sp-lost-h">' +
      '<h3 id="sp-lost-h" data-i18n="lost_h"></h3>' +
      '<p data-i18n="lost_intro"></p>' +
      '<ol class="steps">' +
        '<li data-i18n="lost_1"></li><li data-i18n="lost_2"></li>' +
        '<li data-i18n="lost_3"></li><li data-i18n="lost_4"></li>' +
      '</ol>' +
      '<a class="btn red" href="tel:999" data-i18n="call_999"></a>' +
      '<p class="note" data-i18n="control_note"></p>' +
    '</section>' +

    // 2. The rules
    '<section class="safety-part" aria-labelledby="sp-rules-h">' +
      '<h3 id="sp-rules-h" data-i18n="safety_h"></h3>' +
      '<p class="sheet-intro" data-i18n="safety_intro"></p>' +
      '<ol class="rules" data-rules-list></ol>' +
      '<p class="accepted-note" data-accepted-note></p>' +
      '<p class="note" data-i18n="disclaimer"></p>' +
    '</section>' +

    // 3. Noise and the quiet area
    '<section class="safety-part" aria-labelledby="sp-noise-h">' +
      '<h3 id="sp-noise-h" data-i18n="noise_h"></h3>' +
      '<p data-i18n="noise_1"></p>' +
      '<p data-i18n="noise_2"></p>' +
      '<a class="btn alt" href="map.html" data-i18n="noise_btn"></a>' +
    '</section>';

  const button = document.getElementById("safety-btn");
  if (button) button.setAttribute("aria-expanded", "true");
  const opened = openPanel(html, "safety-title", function () {
    if (button) button.setAttribute("aria-expanded", "false");
  });
  opened.panel.classList.add("safety-sheet");
  fillSafetyBits(); // the rules list and the "✓ You have accepted…" line
}

document.addEventListener("DOMContentLoaded", function () {
  const button = document.getElementById("safety-btn");
  if (!button) return;
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", "false");
  button.addEventListener("click", function (e) {
    e.preventDefault(); // open the panel instead of going to safety.html
    openSafetyPanel();
  });
});
