/* =========================================================
   Language: Welsh (cy) or English (en)
   ---------------------------------------------------------
   1. Remembers the visitor's choice on their device.
   2. Shows the "Croeso! Welcome!" screen on the first visit.
   3. Fills every element that has data-i18n="key" with the
      words for that key from translations.js.
   4. Makes the header switch change language.

   This file is loaded in the <head>, straight after
   translations.js. The order of the first-visit screens
   (language, then safety rules) is run by first-visit.js.
   ========================================================= */

const LANG_STORAGE_KEY = "silageday-language";

// localStorage keeps small bits of text on the visitor's device,
// even after they close the browser. Some browsers block it (e.g.
// private mode), so we use try/catch to carry on quietly if so.
function loadSavedLanguage() {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    return saved === "cy" || saved === "en" ? saved : null;
  } catch (e) {
    return null;
  }
}
function saveLanguage(lang) {
  try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch (e) { /* not saved – that's OK */ }
}

let currentLang = loadSavedLanguage();
document.documentElement.lang = currentLang || "cy";

// Has the visitor picked a language yet? (first-visit.js asks this)
function hasChosenLanguage() {
  return currentLang !== null;
}


/* Look up the words for a key in the current language.
   Falls back to English if the Welsh is missing.
   {n}-style gaps are filled from the "values" object,
   e.g. t("pill_soon", { n: 20 }) → "Starts in 20 min". */
function t(key, values) {
  const entry = TRANSLATIONS[key];
  if (!entry) return key; // shows the key name so a missing entry is easy to spot
  let text = entry[currentLang || "cy"];
  if (text === undefined) text = entry.en;
  if (values) {
    text = text.replace(/\{(\w+)\}/g, function (match, name) { return values[name]; });
  }
  return text;
}


/* Put the right words into the page.
   - data-i18n="key"            → the element's contents
   - data-i18n-attr="alt:key"   → an attribute (several are split with ;)
   The text comes only from our own translations.js file, so it's
   safe to put it in as HTML (that's what lets <strong> and <br> work). */
function applyLanguage() {
  const lang = currentLang || "cy";
  document.documentElement.lang = lang;

  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    const text = t(el.dataset.i18n);
    if (el.tagName === "TITLE") {
      el.textContent = text;
    } else {
      el.innerHTML = text;
    }
  });

  document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
    el.dataset.i18nAttr.split(";").forEach(function (pair) {
      const [attr, key] = pair.split(":").map(function (s) { return s.trim(); });
      el.setAttribute(attr, t(key));
    });
  });

  // Tell app.js the words have changed, so it can redo the
  // countdown and timetable labels in the new language.
  document.dispatchEvent(new CustomEvent("languagechange", { detail: { lang: lang } }));
}

function setLanguage(lang) {
  currentLang = lang;
  saveLanguage(lang);
  applyLanguage();
}


/* ---------- The welcome screen ----------
   Built here rather than written into every page. It's shown
   in both languages at once, with Welsh first.
   "whenDone" is what to do next (first-visit.js passes in
   "show the safety rules"). */
function showWelcomeScreen(whenDone) {
  const screen = document.createElement("div");
  screen.className = "welcome-screen";
  screen.setAttribute("role", "dialog");
  screen.setAttribute("aria-modal", "true");
  screen.setAttribute("aria-labelledby", "welcome-title");
  screen.innerHTML =
    '<div class="welcome-box">' +
      '<img src="images/logo.png" alt="Diwrnod Silwair Sir Benfro · Pembrokeshire Silage Day" width="300" height="150">' +
      '<h1 id="welcome-title">' + t("welcome_title") + '</h1>' +
      '<p><span lang="cy">' + t("welcome_cy") + '</span><br><span lang="en">' + t("welcome_en") + '</span></p>' +
      '<button type="button" class="btn" data-choose="cy" lang="cy">Cymraeg</button>' +
      '<button type="button" class="btn" data-choose="en" lang="en">English</button>' +
    '</div>';

  screen.querySelectorAll("[data-choose]").forEach(function (button) {
    button.addEventListener("click", function () {
      setLanguage(button.dataset.choose);
      screen.remove();
      whenDone();
    });
  });

  document.body.appendChild(screen);
  screen.querySelector("button").focus(); // keyboard users start on "Cymraeg"
}


/* ---------- Start up once the page has loaded ---------- */
document.addEventListener("DOMContentLoaded", function () {
  applyLanguage();

  // Header switch: swaps to the other language
  const switchBtn = document.getElementById("lang-switch");
  if (switchBtn) {
    switchBtn.addEventListener("click", function () {
      setLanguage(currentLang === "cy" ? "en" : "cy");
    });
  }
});
