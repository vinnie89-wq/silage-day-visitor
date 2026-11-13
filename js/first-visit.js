/* =========================================================
   First-visit steps: language → safety rules → the app
                      (→ a one-off offer of Comfort settings)
   ---------------------------------------------------------
   Every page loads this file (in the <head>), so it works
   even if someone opens a direct link to the map or the
   timetable. Until both steps are done, the page itself is
   hidden and can't be tapped.

   1. No language chosen yet?   → show the Cymraeg/English
                                   welcome screen (language.js)
   2. Rules not accepted yet,   → show the safety rules pop-up
      or the rules have changed?
   3. Both done?                → show the page.
   4. Then, once only           → offer the Comfort settings
                                   (comfort.js)

   The acceptance is remembered on the device, together with
   the rules' version number (SAFETY_RULES_VERSION in
   translations.js). Raise that number and everyone is asked
   again.

   ON THE EVENT DAY (the show date in js/facts.js) the rules are asked for
   EVERY time the app is freshly opened – an acceptance from
   before the day doesn't count, and an acceptance on the day
   only lasts until the browser tab is closed.
   To test this before the day, add ?eventday=1 to the address,
   e.g. index.html?eventday=1 (and ?eventday=0 to switch it off).
   ========================================================= */

const SAFETY_STORAGE_KEY = "silageday-safety-accepted";
const SAFETY_SESSION_KEY = "silageday-safety-today"; // only lasts until the tab is closed
// The show date (year-month-day) comes from the key facts – js/facts.js, A1

// Is today the event day (on the visitor's phone clock)?
function isEventDay() {
  try {
    const test = new URLSearchParams(location.search).get("eventday");
    if (test === "1") sessionStorage.setItem("silageday-test-eventday", "1");
    if (test === "0") sessionStorage.removeItem("silageday-test-eventday");
    if (sessionStorage.getItem("silageday-test-eventday") === "1") return true;
  } catch (e) { /* ignore */ }
  const now = new Date();
  const today = now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, "0") + "-" +
    String(now.getDate()).padStart(2, "0");
  return today === FACTS.date;
}

// Has the visitor accepted since opening the app today?
function acceptedThisVisit() {
  try { return sessionStorage.getItem(SAFETY_SESSION_KEY) === String(SAFETY_RULES_VERSION); }
  catch (e) { return false; }
}

// Which version of the rules did this device accept? (null = never)
function loadAcceptedVersion() {
  try {
    const saved = parseInt(localStorage.getItem(SAFETY_STORAGE_KEY), 10);
    return isNaN(saved) ? null : saved;
  } catch (e) {
    return null; // storage blocked (e.g. private browsing) – treat as not accepted
  }
}

let acceptedVersion = loadAcceptedVersion();

function hasAcceptedRules() {
  if (acceptedVersion !== SAFETY_RULES_VERSION) return false;
  return isEventDay() ? acceptedThisVisit() : true;
}

function saveAcceptance() {
  acceptedVersion = SAFETY_RULES_VERSION;
  try { localStorage.setItem(SAFETY_STORAGE_KEY, String(SAFETY_RULES_VERSION)); } catch (e) { /* not saved – they'll be asked again next time */ }
  try { sessionStorage.setItem(SAFETY_SESSION_KEY, String(SAFETY_RULES_VERSION)); } catch (e) { /* ignore */ }
}

// If either step is still to do, hide the page straight away –
// before it's drawn – so nothing flashes up behind the pop-ups.
if (!hasChosenLanguage() || !hasAcceptedRules()) {
  document.documentElement.classList.add("gated");
}


/* ---------- The safety rules list ----------
   Builds the numbered list from rule_1, rule_2 … in translations.js.
   Used by both the pop-up and the Safety page, so the rules are
   only ever written in one place. */
function safetyRuleKeys() {
  const keys = [];
  for (let n = 1; TRANSLATIONS["rule_" + n]; n++) keys.push("rule_" + n);
  return keys;
}

function fillSafetyBits() {
  // Every <ol data-rules-list> on the page gets the rules
  document.querySelectorAll("[data-rules-list]").forEach(function (list) {
    list.innerHTML = safetyRuleKeys().map(function (key) {
      return "<li>" + t(key) + "</li>";
    }).join("");
  });
  // The "✓ You have accepted…" line on the Safety page
  document.querySelectorAll("[data-accepted-note]").forEach(function (note) {
    note.innerHTML = hasAcceptedRules() ? t("safety_accepted") : "";
  });
}

// Refill whenever the words change (first load, or switching language)
document.addEventListener("languagechange", fillSafetyBits);


/* ---------- The safety rules pop-up ---------- */
function showSafetyScreen(whenDone) {
  const eventDay = isEventDay();
  // Accepted an older version of the rules before (not just "it's the day")
  const rulesChanged = acceptedVersion !== null && acceptedVersion !== SAFETY_RULES_VERSION;

  const screen = document.createElement("div");
  screen.className = "safety-screen";
  screen.setAttribute("role", "dialog");
  screen.setAttribute("aria-modal", "true");
  screen.setAttribute("aria-labelledby", "safety-screen-title");

  // The words come from translations.js via data-i18n, so they
  // switch language along with everything else.
  screen.innerHTML =
    '<div class="safety-box">' +
      '<div class="safety-top">' +
        '<span class="safety-icon" aria-hidden="true">⚠️</span>' +
        '<button type="button" class="lang-switch" data-i18n="switch_text" data-i18n-attr="aria-label:switch_label;lang:switch_lang"></button>' +
      '</div>' +
      '<p class="draft-note" data-i18n="draft_note"></p>' +
      '<h1 id="safety-screen-title" tabindex="-1" data-i18n="safety_h"></h1>' +
      (eventDay ? '<p class="safety-changed" data-i18n="safety_today"></p>'
                : rulesChanged ? '<p class="safety-changed" data-i18n="safety_updated"></p>' : '') +
      '<p class="safety-intro" data-i18n="safety_intro"></p>' +
      '<ol class="rules" data-rules-list></ol>' +
      '<p class="note" data-i18n="disclaimer"></p>' +
      '<label class="accept-row">' +
        '<input type="checkbox" id="safety-tick">' +
        '<span data-i18n="safety_check"></span>' +
      '</label>' +
      '<button type="button" class="btn accept-btn" id="safety-accept" disabled aria-describedby="safety-hint" data-i18n="safety_accept"></button>' +
      '<p class="accept-hint" id="safety-hint" data-i18n="safety_hint"></p>' +
    '</div>';

  document.body.appendChild(screen);
  applyLanguage(); // fill in the words (and the rules list)

  const tick = screen.querySelector("#safety-tick");
  const acceptBtn = screen.querySelector("#safety-accept");
  const hint = screen.querySelector("#safety-hint");

  // The button only works once the box is ticked
  tick.addEventListener("change", function () {
    acceptBtn.disabled = !tick.checked;
    hint.hidden = tick.checked;
  });

  acceptBtn.addEventListener("click", function () {
    if (!tick.checked) return;
    saveAcceptance();
    screen.remove();
    whenDone();
  });

  // Language switch inside the pop-up
  screen.querySelector(".lang-switch").addEventListener("click", function () {
    setLanguage(currentLang === "cy" ? "en" : "cy");
  });

  // Start screen readers and keyboards at the top of the rules
  screen.querySelector("h1").focus();
}


/* ---------- Run the steps once the page has loaded ----------
   (language.js has already filled in the words by now) */
document.addEventListener("DOMContentLoaded", function () {
  const app = document.querySelector(".app");

  function showTheApp() {
    document.documentElement.classList.remove("gated");
    if (app) app.inert = false;
    fillSafetyBits(); // so the Safety page shows "✓ You have accepted…"
    offerComfortSettings(); // only appears once per device
  }

  function safetyStep() {
    if (hasAcceptedRules()) showTheApp();
    else showSafetyScreen(showTheApp);
  }

  if (hasChosenLanguage() && hasAcceptedRules()) {
    offerComfortSettings(); // e.g. people who accepted before this was added
    return;
  }

  if (app) app.inert = true; // nothing behind the pop-ups can be tapped or tabbed to

  if (!hasChosenLanguage()) showWelcomeScreen(safetyStep);
  else safetyStep();
});
