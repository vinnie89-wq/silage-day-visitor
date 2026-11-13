/* =========================================================
   Sponsors
   ---------------------------------------------------------
   The organisers keep the sponsors in the Team hub → Sponsors
   page. Each sponsor they switch on is copied to the Firebase
   collection "sponsorsPublic" (only what visitors should see):
     name, level   "headline" | "field" | "supporter" | "partner"
     field         5–11 for a field sponsor (names the field)
     logo, url     "in aid of"-style logo (small picture) and website
     blurbEn/Cy    a line about them
     offerEn/Cy    an offer or voucher (optional)
     visible       "live"    = everyone sees it
                   "preview" = only shown in preview mode (?preview=1),
                               e.g. last year's sponsors, to try the look
     order         sort order within a level

   This file:
   • fills the "Our sponsors" card on the home page
   • draws the Sponsors page (sponsors.html)
   • gives the timetable and map field names their sponsor:
     "Field 6 – sponsored by …" (tokens {sp5} … {sp11} in translations.js)
   It only asks Firebase on the home and Sponsors pages (to save
   database reads); other pages use the copy kept on the phone.
   ========================================================= */

const SPONSORS_KEY = "silageday-sponsors";
let SPONSORS = (function () { try { return JSON.parse(localStorage.getItem(SPONSORS_KEY) || "[]"); } catch (e) { return []; } })();

function sponsorPreviewOn() {
  try {
    const q = new URLSearchParams(location.search).get("preview");
    if (q === "1") return true;
    if (q === "0") return false;
    return sessionStorage.getItem("silageday-preview") === "1";
  } catch (e) { return false; }
}

// The sponsors this visitor should see, in order
function visibleSponsors() {
  const preview = sponsorPreviewOn();
  const rank = { headline: 0, field: 1, supporter: 2, partner: 3 };
  return SPONSORS.filter((s) => s.visible === "live" || (preview && s.visible === "preview"))
    .sort((a, b) => (rank[a.level] ?? 9) - (rank[b.level] ?? 9) || (a.field || 0) - (b.field || 0) || (a.order || 0) - (b.order || 0) || String(a.name).localeCompare(b.name));
}

// Tokens for field names: {sp6} → " – sponsored by …" (or nothing)
function sponsorTokens(lang) {
  const out = {};
  for (let n = 5; n <= 11; n++) out["sp" + n] = "";
  visibleSponsors().forEach((s) => {
    if (s.level === "field" && s.field >= 5 && s.field <= 11 && !out["sp" + s.field])
      out["sp" + s.field] = (lang === "en" ? " – sponsored by " : " – noddir gan ") + spEsc(s.name);
  });
  return out;
}

function spEsc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function spPick(s, field) {
  const en = s[field + "En"], cy = s[field + "Cy"];
  return (typeof currentLang !== "undefined" && currentLang === "en" ? (en || cy) : (cy || en)) || "";
}
function spLogo(s, size) {
  const ok = s.logo && /^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(s.logo);
  return ok ? '<img class="sp-logo ' + size + '" src="' + s.logo + '" alt="' + spEsc(s.name) + '">' : '<span class="sp-name ' + size + '">' + spEsc(s.name) + '</span>';
}
function spLink(s, inner, cls) {
  return s.url && /^https:\/\//.test(s.url)
    ? '<a class="' + cls + '" href="' + spEsc(s.url) + '" target="_blank" rel="noopener">' + inner + '</a>'
    : '<span class="' + cls + '">' + inner + '</span>';
}

(function () {
  const homeEl = document.getElementById("sponsors-home");
  const pageEl = document.getElementById("sponsors-page");

  /* Home page: headline sponsor big, field sponsors medium, link to the rest */
  function renderHome() {
    if (!homeEl) return;
    const list = visibleSponsors();
    if (!list.length) { homeEl.hidden = true; return; }
    const head = list.filter((s) => s.level === "headline");
    const fields = list.filter((s) => s.level === "field");
    homeEl.hidden = false;
    homeEl.innerHTML = '<h2>' + t("sp_home_h") + '</h2>' +
      (sponsorPreviewOn() && list.some((s) => s.visible === "preview") ? '<p class="sp-preview-note">' + t("sp_preview_note") + '</p>' : '') +
      (head.length ? '<p class="sp-label">' + t("sp_headline") + '</p><div class="sp-row sp-row-head">' + head.map((s) => spLink(s, spLogo(s, "lg"), "sp-tile")).join("") + '</div>' : '') +
      (fields.length ? '<p class="sp-label">' + t("sp_fields") + '</p><div class="sp-row">' + fields.map((s) => spLink(s, spLogo(s, "md"), "sp-tile")).join("") + '</div>' : '') +
      '<a class="btn alt" href="sponsors.html">' + t("sp_all") + ' →</a>';
  }

  /* The Sponsors page: everyone, by level, with their line and offer */
  function renderPage() {
    if (!pageEl) return;
    const list = visibleSponsors();
    if (!list.length) { pageEl.innerHTML = '<section class="card"><p>' + t("sp_none") + '</p></section>'; return; }
    const groups = [["headline", "sp_headline", "lg"], ["field", "sp_fields", "md"], ["supporter", "sp_supporters", "sm"], ["partner", "sp_partners", "md"]];
    pageEl.innerHTML =
      (sponsorPreviewOn() && list.some((s) => s.visible === "preview") ? '<p class="map-message">' + t("sp_preview_note") + '</p>' : '') +
      groups.map(([level, key, size]) => {
        const g = list.filter((s) => s.level === level);
        if (!g.length) return "";
        return '<h2 class="sp-group-h">' + t(key) + '</h2>' + g.map((s) => {
          const blurb = spPick(s, "blurb"), offer = spPick(s, "offer");
          return '<section class="card sp-card sp-' + level + '">' +
            spLink(s, spLogo(s, size), "sp-card-logo") +
            '<div class="sp-card-text"><h3>' + spEsc(s.name) + '</h3>' +
              (level === "field" && s.field ? '<p class="sp-field">' + t("sp_field_of", { n: s.field }) + '</p>' : '') +
              (blurb ? '<p>' + spEsc(blurb) + '</p>' : '') +
              (offer ? '<p class="sp-offer"><b>' + t("sp_offer") + '</b> ' + spEsc(offer) + '</p>' : '') +
              (s.url && /^https:\/\//.test(s.url) ? '<a href="' + spEsc(s.url) + '" target="_blank" rel="noopener">' + t("sp_visit") + ' →</a>' : '') +
            '</div></section>';
        }).join("");
      }).join("") +
      '<p class="muted pad-x">' + t("sp_offers_note") + '</p>';
  }

  function render() { renderHome(); renderPage(); }
  render();
  document.addEventListener("languagechange", render);

  /* Ask Firebase – only on the pages that show the sponsors */
  if (!homeEl && !pageEl) return;
  function listen() {
    if (typeof firebaseConfigured !== "function" || !firebaseConfigured()) return;
    getFirebase().then(({ F, db }) => {
      F.onSnapshot(F.collection(db, "sponsorsPublic"), (snap) => {
        const next = snap.docs.map((d) => {
          const x = d.data();
          return { id: d.id, name: x.name || "", level: x.level || "supporter", field: Number(x.field) || 0, logo: x.logo || "", url: x.url || "",
                   blurbEn: x.blurbEn || "", blurbCy: x.blurbCy || "", offerEn: x.offerEn || "", offerCy: x.offerCy || "",
                   visible: x.visible === "live" ? "live" : "preview", order: Number(x.order) || 0 };
        });
        if (JSON.stringify(next) === JSON.stringify(SPONSORS)) return;
        SPONSORS = next;
        try { localStorage.setItem(SPONSORS_KEY, JSON.stringify(SPONSORS)); } catch (e) {}
        if (typeof applyLanguage === "function") applyLanguage(); // redraws everything, field names included
        else render();
      }, () => { /* no signal – keep the saved copy */ });
    }).catch(() => {});
  }
  if (document.readyState === "complete") setTimeout(listen, 400);
  else window.addEventListener("load", () => setTimeout(listen, 400));
})();
