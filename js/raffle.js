/* =========================================================
   Raffle – prizes, "my numbers" and the results
   ---------------------------------------------------------
   ⚖ THE LAW: this is an "incidental lottery" (Gambling Act
   2005). Tickets may ONLY be sold at the show, on the day.
   So this app never sells tickets – it only shows the prizes,
   lets visitors note the numbers on their paper tickets, and
   shows the results.

   The price, draw time, where the stand is and how long
   unclaimed prizes are kept are KEY FACTS (register G6, set in
   Team hub → Key facts; see js/facts.js), and the charities are
   A5. The rest comes from config/raffle, which the Team hub's
   raffle.html writes:
     show            true = visitors see the raffle details
     prizes   [{ id, name, donor }]
     results  [{ pid, p (prize), c (colour), n (number), name?, claimed }]
   Winners' names are only included when the winner agreed.

   This file runs on every page:
   • on raffle.html it draws the whole page
   • on other pages it only checks "have I won?" – and only
     for visitors who have added some numbers – then shows
     a green banner at the top.
   ========================================================= */

(function () {
  const CACHE_KEY = "silageday-raffle";
  const MINE_KEY = "silageday-raffle-mine";
  const SEEN_KEY = "silageday-raffle-seen";
  const COLOURS = ["", "pink", "blue", "green", "yellow", "white", "orange", "purple", "red"];
  const SWATCH = { pink: "#f4a6c6", blue: "#8cc1f0", green: "#9fd69a", yellow: "#f6e27a", white: "#ffffff",
                   orange: "#f7b56b", purple: "#c3a5e8", red: "#ef8f8f" };
  const pageEl = document.getElementById("raffle-app");

  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  let raffle = load(CACHE_KEY, null);
  let mine = load(MINE_KEY, []);      // [{ c: "pink", n: 427 }]

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function pick(obj, field) {
    const cy = obj[field + "Cy"], en = obj[field + "En"];
    return (currentLang === "en" ? (en || cy) : (cy || en)) || "";
  }
  function money(n) { return "£" + (Number.isInteger(n) ? n : Number(n).toFixed(2)); }
  function colourName(c) { return c ? t("rf_col_" + c) : ""; }
  function ticketLabel(c, n) { return (c ? colourName(c) + " " : "") + n; }
  function swatch(c) { return c ? '<span class="rf-swatch" style="background:' + SWATCH[c] + '" aria-hidden="true"></span>' : ""; }
  const key = (c, n) => (c || "") + ":" + n;
  // A number saved with no colour matches that number in any colour
  const same = (m, r) => m.n === r.n && (!m.c || m.c === (r.c || ""));
  function isMine(r) { return mine.some((m) => same(m, r)); }
  function shown() { return !!(raffle && raffle.show); }
  function myWins() { return shown() && raffle.results ? raffle.results.filter(isMine) : []; }

  /* ---------- The Raffle page ---------- */
  function renderPage() {
    if (!pageEl) return;
    if (!shown()) {
      pageEl.innerHTML = '<section class="card"><p>' + t("rf_soon") + '</p><p class="muted">' + t("rf_not_app") + '</p></section>';
      return;
    }
    // Keep anything half-typed when the page redraws
    const keep = ["rf-c", "rf-n", "rf-to"].map((id) => { const el = document.getElementById(id); return el ? el.value : null; });
    const r = raffle, f = FACTS;
    const rp = Number(f.rafflePrice) || 0, strip = Number(f.raffleStrip) || 1;
    const price = rp > 0 ? (strip > 1 ? t("rf_price", { price: money(rp), n: strip }) : t("rf_price_one", { price: money(rp) })) : "";
    const where = currentLang === "en" ? (f.raffleWhereEn || f.raffleWhereCy) : (f.raffleWhereCy || f.raffleWhereEn);
    const drawTime = factTime(f.raffleDraw, currentLang);
    const results = r.results || [];

    pageEl.innerHTML =
      // How to enter
      '<section class="card rf-enter">' +
        ((f.charities || []).length ? '<p class="rf-charity">' + t("rf_charity") + '</p>' : '') +
        '<h2>' + t("rf_buy_h") + '</h2>' +
        '<p>' + t("rf_buy") + '</p>' +
        '<dl class="facts">' +
          (price ? '<dt>' + t("rf_price_l") + '</dt><dd>' + price + '</dd>' : '') +
          (where ? '<dt>' + t("rf_where_l") + '</dt><dd>' + esc(where) + '</dd>' : '') +
          (drawTime ? '<dt>' + t("rf_draw_l") + '</dt><dd>' + t("rf_draw", { time: drawTime }) + '</dd>' : '') +
        '</dl>' +
        '<p class="muted rf-law">' + t("rf_not_app") + '</p>' +
      '</section>' +

      // Results (only once the draw has started)
      (results.length ? resultsHtml(results) : '') +

      // Prizes
      '<section class="card"><h2>' + t("rf_prizes_h") + '</h2>' +
        ((r.prizes || []).length
          ? '<ol class="rf-prizes">' + r.prizes.map((p) => {
              const res = results.find((x) => x.pid === p.id);
              return '<li><b>' + esc(p.name) + '</b>' +
                (p.donor ? '<small>' + t("rf_donated", { who: esc(p.donor) }) + '</small>' : '') +
                (res ? '<small class="rf-won-by">' + t("rf_won_by", { ticket: ticketLabel(res.c, res.n) }) + '</small>' : '') + '</li>';
            }).join("") + '</ol><p class="muted">' + t("rf_thanks") + '</p>'
          : '<p class="muted">' + t("rf_prizes_none") + '</p>') +
      '</section>' +

      // My numbers
      '<section class="card"><h2>' + t("rf_mine_h") + '</h2>' +
        '<p>' + t("rf_mine_intro") + '</p>' +
        '<form class="rf-add" id="rf-add" novalidate>' +
          '<div class="rf-add-row">' +
            '<div><label class="field" for="rf-c">' + t("rf_colour") + '</label>' +
              '<select class="input" id="rf-c">' + COLOURS.map((c) => '<option value="' + c + '">' + (c ? colourName(c) : t("rf_col_none")) + '</option>').join("") + '</select></div>' +
            '<div><label class="field" for="rf-n">' + t("rf_from") + '</label><input class="input" id="rf-n" type="number" inputmode="numeric" min="0" max="99999"></div>' +
            '<div><label class="field" for="rf-to">' + t("rf_to") + '</label><input class="input" id="rf-to" type="number" inputmode="numeric" min="0" max="99999"></div>' +
          '</div>' +
          '<p class="form-error" id="rf-err" role="alert" hidden></p>' +
          '<button type="submit" class="btn">' + t("rf_add") + '</button>' +
        '</form>' +
        (mine.length
          ? '<ul class="rf-mine">' + mine.map((m, i) => {
              const won = results.some((r) => same(m, r));
              return '<li class="' + (won ? "won" : "") + '">' + swatch(m.c) + '<span>' + esc(ticketLabel(m.c, m.n)) + (won ? ' 🎉' : '') + '</span>' +
                '<button type="button" data-rm="' + i + '" aria-label="' + esc(t("rf_remove", { ticket: ticketLabel(m.c, m.n) })) + '">✕</button></li>';
            }).join("") + '</ul><button type="button" class="link-btn" id="rf-clear">' + t("rf_clear") + '</button>'
          : '<p class="muted">' + t("rf_mine_none") + '</p>') +
        '<p class="muted">' + t("rf_keep") + '</p>' +
      '</section>' +

      (!results.length ? '<section class="card"><h2>' + t("rf_results_h") + '</h2><p>' +
        (drawTime ? t("rf_results_none", { time: drawTime }) : t("rf_results_none_notime")) + '</p></section>' : '');

    // Remember the colour last used
    const lastC = mine.length ? mine[mine.length - 1].c : "";
    document.getElementById("rf-c").value = keep[0] !== null ? keep[0] : (lastC || "");
    if (keep[1]) document.getElementById("rf-n").value = keep[1];
    if (keep[2]) document.getElementById("rf-to").value = keep[2];
    document.getElementById("rf-add").addEventListener("submit", addNumbers);
    pageEl.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => {
      mine.splice(Number(b.dataset.rm), 1); save(MINE_KEY, mine); renderPage(); listen();
    }));
    const clear = document.getElementById("rf-clear");
    if (clear) clear.addEventListener("click", () => { if (confirm(t("rf_clear_q"))) { mine = []; save(MINE_KEY, mine); renderPage(); } });
  }

  function resultsHtml(results) {
    const weeks = Number(FACTS.raffleUnclaimedWeeks) || 0;
    return '<section class="card rf-results"><h2>🎉 ' + t("rf_results_h") + '</h2><ol class="rf-result-list">' +
      results.map((r) => '<li class="' + (isMine(r) ? "mine" : "") + '">' +
        '<span class="rf-ticket">' + swatch(r.c) + esc(ticketLabel(r.c, r.n)) + '</span>' +
        '<span class="rf-prize">' + esc(r.p) + (r.name ? ' – ' + esc(r.name) : '') + '</span>' +
        '<span class="rf-state ' + (r.claimed ? "done" : "") + '">' + (isMine(r) ? t("rf_you") : r.claimed ? t("rf_claimed") : t("rf_unclaimed")) + '</span>' +
      '</li>').join("") + '</ol>' +
      (weeks ? '<p class="muted">' + t("rf_unclaimed_note", { weeks: weeks }) + '</p>' : '') +
    '</section>';
  }

  function addNumbers(e) {
    e.preventDefault();
    const err = document.getElementById("rf-err");
    const c = document.getElementById("rf-c").value;
    const fromV = document.getElementById("rf-n").value.trim(), toV = document.getElementById("rf-to").value.trim();
    const from = Number(fromV), to = toV ? Number(toV) : from;
    const fail = (k) => { err.textContent = t(k); err.hidden = false; };
    if (!fromV || !Number.isInteger(from) || from < 0 || !Number.isInteger(to) || to < 0) return fail("rf_bad_number");
    const lo = Math.min(from, to), hi = Math.max(from, to);
    if (hi - lo >= 100) return fail("rf_too_many");
    for (let n = lo; n <= hi; n++) if (!mine.some((m) => m.n === n && (m.c || "") === c)) mine.push({ c: c, n: n });
    mine = mine.slice(-300);
    save(MINE_KEY, mine);
    document.getElementById("rf-n").value = ""; document.getElementById("rf-to").value = "";
    renderPage();
    listen();
  }

  /* ---------- "You've won!" banner (every page) ---------- */
  function renderBanner() {
    const old = document.getElementById("raffle-banner");
    if (old) old.remove();
    if (document.documentElement.classList.contains("gated")) return; // not over the welcome / safety screens
    const seen = load(SEEN_KEY, []);
    const wins = myWins().filter((r) => !r.claimed && !seen.includes(key(r.c, r.n)));
    if (!wins.length) return;
    const header = document.querySelector(".site-header");
    if (!header) return;
    const banner = document.createElement("div");
    banner.id = "raffle-banner";
    banner.className = "news-banner raffle-banner";
    banner.setAttribute("role", "alert");
    banner.innerHTML =
      '<div class="news-banner-text"><b>🎉 ' + t("rf_won_title") + '</b>' +
      '<span>' + wins.map((w) => t("rf_won_body", { ticket: esc(ticketLabel(w.c, w.n)), prize: esc(w.p) })).join(" ") + " " + t("rf_won_bring") + '</span>' +
      (pageEl ? '' : ' <a href="raffle.html">' + t("rf_won_view") + ' →</a>') + '</div>' +
      '<button type="button" class="news-banner-close" aria-label="' + esc(t("news_dismiss")) + '">✕</button>';
    banner.querySelector("button").addEventListener("click", () => {
      save(SEEN_KEY, seen.concat(wins.map((r) => key(r.c, r.n))).slice(-100));
      banner.remove();
    });
    header.insertAdjacentElement("afterend", banner);
  }

  function render() { renderPage(); renderBanner(); }

  /* ---------- Listening for changes ---------- */
  let listening = false;
  function listen() {
    if (listening || !firebaseConfigured()) return;
    if (!pageEl && !mine.length) return; // nothing to check on other pages
    listening = true;
    getFirebase().then(({ F, db }) => {
      F.onSnapshot(F.doc(db, "config", "raffle"), (snap) => {
        const d = snap.exists() ? snap.data() : null;
        raffle = d ? {
          show: !!d.show,
          prizes: Array.isArray(d.prizes) ? d.prizes : [], results: Array.isArray(d.results) ? d.results : []
        } : null;
        save(CACHE_KEY, raffle);
        render();
      }, () => { /* no signal – keep the saved copy */ });
    }).catch(() => { listening = false; });
  }

  render();
  document.addEventListener("languagechange", render); // also fires when the key facts change
  new MutationObserver(renderBanner).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  if (document.readyState === "complete") setTimeout(listen, 400);
  else window.addEventListener("load", () => setTimeout(listen, 400));
})();
