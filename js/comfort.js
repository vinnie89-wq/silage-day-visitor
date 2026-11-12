/* =========================================================
   Comfort settings (🌿 Comfort / Cysur)
   ---------------------------------------------------------
   Choices that make the app easier to use (laid out as in the prototype):
     • Calm visuals  – softer colours, nothing moving or flashing
     • Larger text   – Normal, Large or Extra large
     • Easy-read text – Atkinson Hyperlegible with extra spacing
     • Language       – Cymraeg / English (moved here from the header)

   How it works:
   - The choices are saved on the device (localStorage).
   - This file is loaded in the <head>, so the saved choices are
     put on the page as classes on <html> (e.g. "calm", "text-xl")
     BEFORE anything is drawn – no flicker. style.css does the rest.
   - The panel itself is only built when someone opens it.
   ========================================================= */

const COMFORT_STORAGE_KEY = "silageday-comfort";
const COMFORT_OFFER_KEY = "silageday-comfort-offered";
const TEXT_SIZES = ["normal", "large", "xl"];

function loadComfort() {
  const settings = { calm: false, size: "normal", easy: false }; // the defaults
  try {
    const saved = JSON.parse(localStorage.getItem(COMFORT_STORAGE_KEY) || "{}");
    if (saved.calm === true) settings.calm = true;
    if (saved.easy === true) settings.easy = true;
    if (TEXT_SIZES.includes(saved.size)) settings.size = saved.size;
  } catch (e) { /* nothing saved, or storage blocked – use the defaults */ }
  return settings;
}

let comfort = loadComfort();

// Put the settings on the page by adding or removing classes on <html>
function applyComfort() {
  const root = document.documentElement;
  root.classList.toggle("calm", comfort.calm);
  root.classList.toggle("easy-read", comfort.easy);
  root.classList.toggle("text-large", comfort.size === "large");
  root.classList.toggle("text-xl", comfort.size === "xl");

  // The header button turns blue when any setting is switched on
  const button = document.getElementById("comfort-btn");
  if (button) {
    button.classList.toggle("is-on", comfort.calm || comfort.easy || comfort.size !== "normal");
  }
}

function changeComfort(name, value) {
  comfort[name] = value;
  try { localStorage.setItem(COMFORT_STORAGE_KEY, JSON.stringify(comfort)); } catch (e) { /* not saved */ }
  applyComfort();
}

applyComfort(); // right now, in the <head>, before the page is drawn

// Is the phone set to "reduce motion"? (style.css already switches
// animations off in that case; we just mention it in the panel.)
function phoneReducesMotion() {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
}


/* ---------- Pop-up panels ----------
   Shared by the Comfort panel and the one-off offer. While a panel
   is open, the page behind is "inert" (can't be tapped or tabbed to),
   Escape closes it, and focus goes back where it came from. */
function openPanel(innerHtml, labelId, whenClosed) {
  const app = document.querySelector(".app");
  const returnFocusTo = document.activeElement;

  const scrim = document.createElement("div");
  scrim.className = "scrim";

  const panel = document.createElement("div");
  panel.className = "sheet";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", labelId);
  panel.innerHTML = innerHtml;

  document.body.appendChild(scrim);
  document.body.appendChild(panel);
  if (app) app.inert = true;
  applyLanguage(); // fill in the words from translations.js

  function close() {
    panel.remove();
    scrim.remove();
    document.removeEventListener("keydown", onKey);
    if (app) app.inert = false;
    if (whenClosed) whenClosed();
    const comfortBtn = document.getElementById("comfort-btn");
    const target = returnFocusTo && document.body.contains(returnFocusTo) && returnFocusTo !== document.body ? returnFocusTo : comfortBtn;
    if (target) target.focus();
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  scrim.addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  panel.querySelectorAll("[data-close]").forEach(function (b) { b.addEventListener("click", close); });

  // Start keyboard and screen-reader users at the panel's heading
  const heading = panel.querySelector("#" + labelId);
  heading.setAttribute("tabindex", "-1");
  heading.focus();

  return { panel: panel, close: close };
}


/* ---------- The Comfort settings panel ---------- */
function openComfortPanel() {
  const html =
    '<button type="button" class="sheet-close" data-close data-i18n-attr="aria-label:close"><span aria-hidden="true">×</span></button>' +
    '<h2 id="comfort-title" data-i18n="comfort_h"></h2>' +

    // 1. Calm visuals – an on/off switch
    '<div class="option">' +
      '<div class="option-row">' +
        '<div class="option-text"><b id="calm-l" data-i18n="calm_l"></b><small id="calm-d" data-i18n="calm_d"></small></div>' +
        '<button type="button" class="switch" role="switch" id="calm-switch" aria-labelledby="calm-l" aria-describedby="calm-d"></button>' +
      '</div>' +
      (phoneReducesMotion() ? '<p class="motion-note" data-i18n="motion_note"></p>' : '') +
    '</div>' +

    // 2. Easy-read text – an on/off switch
    '<div class="option">' +
      '<div class="option-row">' +
        '<div class="option-text"><b id="easy-l" data-i18n="easy_l"></b><small id="easy-d" data-i18n="easy_d"></small></div>' +
        '<button type="button" class="switch" role="switch" id="easy-switch" aria-labelledby="easy-l" aria-describedby="easy-d"></button>' +
      '</div>' +
    '</div>' +

    // 3. Text size – three choices (radio buttons)
    '<div class="option" role="radiogroup" aria-labelledby="size-l" aria-describedby="size-d">' +
      '<div class="option-text"><b id="size-l" data-i18n="size_l"></b><small id="size-d" data-i18n="size_d"></small></div>' +
      '<div class="size-choice">' +
        '<label><input type="radio" name="text-size" value="normal"><span data-i18n="size_normal"></span></label>' +
        '<label><input type="radio" name="text-size" value="large"><span data-i18n="size_large"></span></label>' +
        '<label><input type="radio" name="text-size" value="xl"><span data-i18n="size_xl"></span></label>' +
      '</div>' +
    '</div>' +

    // 4. Language – the same choice as on the welcome screen
    '<div class="option">' +
      '<div class="option-row">' +
        '<div class="option-text"><b id="lang-l" data-i18n="lang_l"></b></div>' +
        '<div class="lang-chips" role="group" aria-labelledby="lang-l">' +
          '<button type="button" class="chip" data-lang="cy" lang="cy">Cymraeg</button>' +
          '<button type="button" class="chip" data-lang="en" lang="en">English</button>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<p class="note sunflower" data-i18n="sunflower"></p>';

  // aria-expanded tells screen readers whether the panel is open
  const comfortBtn = document.getElementById("comfort-btn");
  if (comfortBtn) comfortBtn.setAttribute("aria-expanded", "true");
  const panel = openPanel(html, "comfort-title", function () {
    if (comfortBtn) comfortBtn.setAttribute("aria-expanded", "false");
  }).panel;

  // Show the current settings on the controls
  function showCurrent() {
    panel.querySelector("#calm-switch").setAttribute("aria-checked", String(comfort.calm));
    panel.querySelector("#easy-switch").setAttribute("aria-checked", String(comfort.easy));
    panel.querySelectorAll('input[name="text-size"]').forEach(function (radio) {
      radio.checked = radio.value === comfort.size;
    });
    panel.querySelectorAll(".lang-chips .chip").forEach(function (chip) {
      const on = chip.dataset.lang === (currentLang || "cy");
      chip.classList.toggle("on", on);
      chip.setAttribute("aria-pressed", String(on));
    });
  }
  showCurrent();

  // Each change is saved and applied straight away
  panel.querySelector("#calm-switch").addEventListener("click", function () {
    changeComfort("calm", !comfort.calm); showCurrent();
  });
  panel.querySelector("#easy-switch").addEventListener("click", function () {
    changeComfort("easy", !comfort.easy); showCurrent();
  });
  panel.querySelectorAll('input[name="text-size"]').forEach(function (radio) {
    radio.addEventListener("change", function () { changeComfort("size", radio.value); });
  });
  panel.querySelectorAll(".lang-chips .chip").forEach(function (chip) {
    chip.addEventListener("click", function () { setLanguage(chip.dataset.lang); showCurrent(); });
  });
}


/* ---------- The one-off offer after the safety rules ---------- */
function comfortOfferShown() {
  try { return localStorage.getItem(COMFORT_OFFER_KEY) === "1"; } catch (e) { return true; } // can't remember? don't nag
}

function offerComfortSettings() {
  if (comfortOfferShown()) return;
  try { localStorage.setItem(COMFORT_OFFER_KEY, "1"); } catch (e) { /* ignore */ }

  const opened = openPanel(
    '<h2 id="offer-title"><span aria-hidden="true">🌿</span> <span data-i18n="offer_h"></span></h2>' +
    '<p class="sheet-intro" data-i18n="offer_text"></p>' +
    '<button type="button" class="btn" id="offer-yes" data-i18n="offer_yes"></button>' +
    '<button type="button" class="btn alt" data-close data-i18n="offer_no"></button>',
    "offer-title"
  );
  opened.panel.querySelector("#offer-yes").addEventListener("click", function () {
    opened.close();
    openComfortPanel();
  });
}


/* ---------- The header button ---------- */
document.addEventListener("DOMContentLoaded", function () {
  const button = document.getElementById("comfort-btn");
  if (!button) return;
  applyComfort(); // sets the button's blue "on" look
  button.addEventListener("click", openComfortPanel);
});
