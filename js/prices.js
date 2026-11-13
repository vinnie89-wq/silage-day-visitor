/* =========================================================
   Ticket prices – one place for every page
   ---------------------------------------------------------
   The prices are key facts (register G5), set in the Team hub →
   Key facts page (Firebase config/facts → adult, child,
   showPrices) and kept by js/facts.js. This fills in:
     • Key facts on the home page  (<dd id="fact-entry">)
     • the Tickets page (js/tickets.js asks this file)
   Until "show prices" is ticked, visitors see "prices to be
   confirmed". Under-5s are always free.
   ========================================================= */

let ticketPrices = null;
function readPrices() {
  ticketPrices = { adult: Number(FACTS.adult), child: Number(FACTS.child), show: !!FACTS.showPrices };
}
readPrices();

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

fillEntryFact();
document.addEventListener("languagechange", fillEntryFact);
document.addEventListener("factschange", function () {
  const before = JSON.stringify(ticketPrices);
  readPrices();
  fillEntryFact();
  if (JSON.stringify(ticketPrices) !== before) document.dispatchEvent(new Event("priceschange")); // the Tickets page redraws
});
