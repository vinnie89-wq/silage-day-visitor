/* =========================================================
   Ticket prices – one place for every page
   ---------------------------------------------------------
   The organisers set prices in the Team hub (Firebase:
   config/prices → adult, child, show). This keeps the latest
   prices (and a copy on the phone for no-signal), and fills in:
     • Key facts on the home page  (<dd id="fact-entry">)
     • the Tickets page (js/tickets.js asks this file)
   Until "show" is ticked in the Team hub, visitors see
   "prices to be confirmed". Under-5s are always free.
   ========================================================= */

const PRICES_KEY = "silageday-prices";
let ticketPrices = (function () { try { return JSON.parse(localStorage.getItem(PRICES_KEY) || "null"); } catch (e) { return null; } })();

function pricesShown() {
  const p = ticketPrices;
  return !!(p && p.show && p.adult >= 0 && p.child >= 0);
}
function money(n) { return "£" + (Number.isInteger(n) ? n : Number(n).toFixed(2)); }
function priceOf(type) { return !ticketPrices ? 0 : type === "adult" ? ticketPrices.adult : type === "child" ? ticketPrices.child : 0; }

// Home page: Key facts → Entry
function fillEntryFact() {
  const el = document.getElementById("fact-entry");
  if (!el) return;
  el.innerHTML = pricesShown()
    ? t("fact_entry_prices", { adult: money(ticketPrices.adult), child: money(ticketPrices.child) })
    : t("fact_entry");
}

(function () {
  fillEntryFact();
  document.addEventListener("languagechange", fillEntryFact);
  if (typeof firebaseConfigured !== "function" || !firebaseConfigured()) return;
  // Wait until the page has loaded so this never slows it down
  const start = function () {
    getFirebase().then(function (fb) {
      fb.F.onSnapshot(fb.F.doc(fb.db, "config", "prices"), function (snap) {
        const d = snap.exists() ? snap.data() : null;
        const next = d ? { adult: Number(d.adult), child: Number(d.child), show: !!d.show } : null;
        if (JSON.stringify(next) === JSON.stringify(ticketPrices)) return;
        ticketPrices = next;
        try { localStorage.setItem(PRICES_KEY, JSON.stringify(ticketPrices)); } catch (e) {}
        fillEntryFact();
        document.dispatchEvent(new Event("priceschange")); // the Tickets page redraws
      }, function () { /* no signal – keep the saved prices */ });
    }).catch(function () {});
  };
  if (document.readyState === "complete") setTimeout(start, 300);
  else window.addEventListener("load", function () { setTimeout(start, 300); });
})();
