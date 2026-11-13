/* =========================================================
   KEY FACTS – one place for the event's details
   ---------------------------------------------------------
   The master copy is the organisers' "Key assumptions and
   details" register. The visitor app gets them from the Team
   hub → Key facts page (Firebase: config/facts), where each box
   is labelled with its register ID (A1, A2 …).

   So when something changes:
     1. change it in the register (as always), then
     2. change the matching box in Team hub → Key facts.
   Every page of the app updates – no code to touch.

   The values below are only the starting point, used until
   the phone has heard from Firebase (and kept on the phone
   after that, so it works with no signal).

   Words in js/translations.js can use these "tokens", which
   are filled in automatically in the right language:
     {dateLong}   Saturday 11 September 2027 · Dydd Sadwrn 11 Medi 2027
     {dateShort}  Sat 11 Sept 2027 · Sad 11 Medi 2027
     {dateOn}     on Saturday 11 … · ddydd Sadwrn 11 …  (after "for the show")
     {year}       2027
     {opens} {closes}   10am · 10yb   /   5pm · 5yh
     {venue} {postcode} Slade Hall Farm, near Haverfordwest · SA61 2UX
     {charities}  the charity names, as links
   ========================================================= */

const FACTS_KEY = "silageday-facts";
const FACTS_DEFAULT = {
  date: "2027-09-11",                 // A1
  opens: "10:00", closes: "17:00",    // A2
  venueEn: "Slade Hall Farm, near Haverfordwest", venueCy: "Fferm Slade Hall, ger Hwlffordd", postcode: "SA61 2UX", // A3
  charities: [                        // A5
    { en: "Paul Sartori Foundation", cy: "Sefydliad Paul Sartori", url: "https://paulsartori.org/" },
    { en: "British Heart Foundation", cy: "Sefydliad Prydeinig y Galon", url: "https://www.bhf.org.uk/" }
  ],
  adult: 6, child: 3, showPrices: false,          // G5 entry prices (paid at the gate)
  rafflePrice: 0, raffleStrip: 5, raffleDraw: "", // G6 raffle
  raffleWhereEn: "", raffleWhereCy: "", raffleUnclaimedWeeks: 4
};

let FACTS = (function () {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(FACTS_KEY) || "null"); } catch (e) {}
  return Object.assign({}, FACTS_DEFAULT, saved || {});
})();

// The show date as a local Date (midnight)
function showDate() {
  const p = String(FACTS.date || FACTS_DEFAULT.date).split("-").map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}

const FACT_WORDS = {
  en: { days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        daysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
        monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"],
        and: "and" },
  cy: { days: ["Dydd Sul", "Dydd Llun", "Dydd Mawrth", "Dydd Mercher", "Dydd Iau", "Dydd Gwener", "Dydd Sadwrn"],
        daysShort: ["Sul", "Llun", "Maw", "Mer", "Iau", "Gwe", "Sad"],
        months: ["Ionawr", "Chwefror", "Mawrth", "Ebrill", "Mai", "Mehefin", "Gorffennaf", "Awst", "Medi", "Hydref", "Tachwedd", "Rhagfyr"],
        monthsShort: ["Ion", "Chwef", "Maw", "Ebr", "Mai", "Meh", "Gorff", "Awst", "Medi", "Hyd", "Tach", "Rhag"],
        and: "a" }
};

// "10:00" → 10am / 10yb ;  "17:30" → 5:30pm / 5:30yh
function factTime(hhmm, lang) {
  const p = String(hhmm || "").split(":").map(Number);
  if (p.length < 2 || isNaN(p[0])) return "";
  const h12 = ((p[0] + 11) % 12) + 1, am = p[0] < 12;
  return h12 + (p[1] ? ":" + String(p[1]).padStart(2, "0") : "") + (lang === "cy" ? (am ? "yb" : "yh") : (am ? "am" : "pm"));
}

function factEsc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// The tokens, in one language
function factTokens(lang) {
  lang = lang === "en" ? "en" : "cy";
  const w = FACT_WORDS[lang], d = showDate();
  const day = d.getDate(), month = w.months[d.getMonth()], year = d.getFullYear();
  const dateLong = w.days[d.getDay()] + " " + day + " " + month + " " + year;
  const names = (FACTS.charities || []).filter((c) => c && (c.en || c.cy)).map((c) => {
    const name = factEsc(lang === "en" ? (c.en || c.cy) : (c.cy || c.en));
    return c.url && /^https:\/\//.test(c.url) ? '<a href="' + factEsc(c.url) + '" target="_blank" rel="noopener">' + name + '</a>' : name;
  });
  const list = names.length < 2 ? names.join("") : names.slice(0, -1).join(", ") + " " + w.and + " " + names[names.length - 1];
  return {
    dateLong: dateLong,
    dateShort: w.daysShort[d.getDay()] + " " + day + " " + w.monthsShort[d.getMonth()] + " " + year,
    dateOn: lang === "en" ? "on " + dateLong : "d" + dateLong.charAt(0).toLowerCase() + dateLong.slice(1), // Dydd → ddydd (soft mutation)
    year: String(year),
    opens: factTime(FACTS.opens, lang), closes: factTime(FACTS.closes, lang),
    venue: factEsc(lang === "en" ? FACTS.venueEn : (FACTS.venueCy || FACTS.venueEn)),
    postcode: factEsc(FACTS.postcode),
    charities: list || (lang === "en" ? "charity" : "elusen")
  };
}

/* The charities' logos on the home page (welcome card).
   Each charity can have an "in aid of" logo, added in Team hub →
   Key facts. If none of them has one, the sentence with the names
   stays as it is. A charity without a logo shows as its name. */
function renderCharityLogos() {
  const box = document.getElementById("charity-logos"), line = document.getElementById("charity-line");
  if (!box) return;
  const list = (FACTS.charities || []).filter((c) => c && (c.en || c.cy));
  if (!list.some((c) => c.logo)) { box.hidden = true; box.innerHTML = ""; return; }
  const lang = typeof currentLang !== "undefined" && currentLang === "en" ? "en" : "cy";
  if (line) line.textContent = t("welcome_p2_logos");
  box.innerHTML = list.map((c) => {
    const name = factEsc(lang === "en" ? (c.en || c.cy) : (c.cy || c.en));
    const inner = c.logo && /^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(c.logo)
      ? '<img src="' + c.logo + '" alt="' + name + '">' : '<span>' + name + '</span>';
    return c.url && /^https:\/\//.test(c.url) ? '<a href="' + factEsc(c.url) + '" target="_blank" rel="noopener">' + inner + '</a>' : '<span class="charity-logo">' + inner + '</span>';
  }).join("");
  box.hidden = false;
}
document.addEventListener("languagechange", renderCharityLogos); // also runs after the words are drawn

/* Listen for changes from the Team hub. Starts once the page has
   loaded, so it never slows the page down. When something changes,
   the words are redrawn and a "factschange" event tells the other
   files (prices, raffle, countdown). */
(function () {
  function start() {
    if (typeof firebaseConfigured !== "function" || !firebaseConfigured()) return;
    getFirebase().then(function (fb) {
      fb.F.onSnapshot(fb.F.doc(fb.db, "config", "facts"), function (snap) {
        if (!snap.exists()) return;
        const next = Object.assign({}, FACTS_DEFAULT, snap.data());
        delete next.updatedAt; delete next.updatedBy;
        if (JSON.stringify(next) === JSON.stringify(FACTS)) return;
        FACTS = next;
        try { localStorage.setItem(FACTS_KEY, JSON.stringify(FACTS)); } catch (e) {}
        if (typeof applyLanguage === "function") applyLanguage();
        document.dispatchEvent(new Event("factschange"));
      }, function () { /* no signal – keep the saved facts */ });
    }).catch(function () {});
  }
  if (document.readyState === "complete") setTimeout(start, 200);
  else window.addEventListener("load", function () { setTimeout(start, 200); });
})();
