/* =========================================================
   Preview the tickets email with sample data
   ---------------------------------------------------------
   Run from the project folder:   node emails/preview.js
   It writes emails/preview-en.html and emails/preview-cy.html –
   open them in a browser to see the email.

   buildEmailData() makes the same information the real Firebase
   function will make when it sends the email, so when we switch
   emails on (January 2027) this part can be reused as it is.

   Differences from the real email:
   - QR codes here are drawn as SVG pictures. Gmail doesn't show
     SVG, so the real function will attach them as PNG pictures.
   - Pictures here load from this folder; the real email loads
     them from the website (appUrl).
   ========================================================= */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const APP_URL = "https://vinnie89-wq.github.io/silage-day-visitor/";

// Load the app's own files, so the email uses exactly the same words,
// key facts and QR codes as the app
const noop = () => {};
const box = {
  console, setTimeout: noop, addEventListener: noop,
  localStorage: { getItem: () => null, setItem: noop },
  document: { readyState: "loading", addEventListener: noop, getElementById: () => null, querySelectorAll: () => [] }
};
box.window = box;
vm.createContext(box);
["js/translations.js", "js/facts.js", "js/qrcode.js"].forEach((f) =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), box, { filename: f }));
// "const"/"let" values in those files are shared between them but aren't
// properties of box, so fetch the two we need by name
box.TRANSLATIONS = vm.runInContext("TRANSLATIONS", box);
const FACTS = vm.runInContext("FACTS", box);

// The same as t() in js/language.js, for one language
function t(key, lang, values) {
  const entry = box.TRANSLATIONS[key];
  if (!entry) return key;
  let text = entry[lang] !== undefined ? entry[lang] : entry.en;
  const all = Object.assign({}, box.factTokens(lang), values || {});
  return text.replace(/\{(\w+)\}/g, (m, name) => (all[name] !== undefined ? all[name] : m));
}
const plain = (html) => String(html).replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
const base64Url = (text) => Buffer.from(text, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const money = (n) => "£" + (Number.isInteger(n) ? n : n.toFixed(2));

/* Everything the template needs, in the visitor's language */
function buildEmailData(reg, lang, appUrl, qrPicture) {
  const counts = { adult: 0, child: 0, under5: 0 };
  reg.members.forEach((m) => counts[m.type]++);
  const breakdown = ["adult", "child", "under5"].filter((k) => counts[k])
    .map((k) => counts[k] + " × " + t("tk_type_" + k, lang)).join(" · ");
  // The "Open my tickets" link: the same restore link as the app's backup email
  const payload = { v: 1, c: reg.code, g: reg.leadName, t: reg.members.map((m) => [m.n, m.name, m.type]), r: 1 };
  const F = FACTS;
  return {
    lang, appUrl,
    code: reg.code,
    breakdown: plain(t("tk_people", lang, { n: reg.members.length })) + " · " + breakdown,
    restoreUrl: appUrl + "tickets.html#share=" + base64Url(JSON.stringify(payload)),
    tickets: reg.members.map((m) => ({
      name: m.name,
      type: t("tk_type_" + m.type, lang),
      number: reg.code + "-" + m.n,
      state: m.type === "under5" ? t("tk_free_entry", lang) : t("tk_pay_gate_short", lang),
      qr: qrPicture("PSD27|" + reg.code + "|" + m.n)
    })),
    w: {
      subject: plain(t("em_subject", lang, { code: reg.code })),
      preheader: plain(t("em_preheader", lang)),
      title: plain(t("tk_img_title", lang)),
      hello: plain(t("em_hello", lang, { name: reg.leadName })),
      intro: plain(t("em_intro", lang)),
      date: plain(t("tk_date", lang)),
      openTimes: plain(t("em_open_times", lang)),
      where: plain(t("fact_where", lang)),
      directions: plain(t("em_directions", lang)),
      groupCode: plain(t("tk_group_code", lang)),
      openBtn: plain(t("em_open_btn", lang)),
      openNote: plain(t("em_open_note", lang)),
      ticketsH: plain(t("tk_restored_h", lang)),
      gateH: plain(t("em_gate_h", lang)),
      payAtGate: plain(F.showPrices
        ? t("tk_pay_at_gate_prices", lang, { adult: money(F.adult), child: money(F.child) })
        : t("tk_pay_at_gate", lang)),
      gate: plain(t("em_gate", lang)),
      safetyH: plain(t("em_safety_h", lang)),
      safety: plain(t("em_safety", lang)),
      safetyBtn: plain(t("em_safety_btn", lang)),
      // the charity names are links – coloured to match
      aid: t("em_aid", lang).replace(/<a /g, '<a style="color:#2c4a1c;" '),
      privacy: plain(t("tk_privacy", lang)),
      why: plain(t("em_why", lang))
    }
  };
}

/* A tiny version of Handlebars (what the Trigger Email extension uses):
   {{x}} safe text, {{{x}}} may contain links, {{#each list}}…{{/each}} */
function fill(template, data) {
  const get = (obj, key) => key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const one = (tpl, ctx) => tpl
    .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (m, k) => String(get(ctx, k) ?? ""))
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => esc(get(ctx, k)));
  const withLoops = template.replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (m, list, inner) => (data[list] || []).map((item) => one(inner, Object.assign({}, data, item))).join(""));
  return one(withLoops.replace(/<!--[\s\S]*?-->\n?/, ""), data); // drop the notes at the top
}

// ---- Sample group (made-up people) ----
const SAMPLE = {
  code: "K7PM3Q", leadName: "Siân",
  members: [
    { n: 1, name: "Siân Llewelyn-Hughes", type: "adult" },
    { n: 2, name: "Rhodri Llewelyn-Hughes", type: "adult" },
    { n: 3, name: "Gwilym", type: "child" },
    { n: 4, name: "Ffion", type: "under5" }
  ]
};
const svgQr = (text) => "data:image/svg+xml;base64," + Buffer.from(box.qrSvg(text)).toString("base64");
const template = fs.readFileSync(path.join(__dirname, "tickets-email.html"), "utf8");

["en", "cy"].forEach((lang) => {
  const data = buildEmailData(SAMPLE, lang, "../", svgQr); // "../" = pictures from this project folder
  const out = path.join(__dirname, "preview-" + lang + ".html");
  fs.writeFileSync(out, fill(template, data));
  console.log("Wrote " + path.relative(ROOT, out) + "  –  subject: " + data.w.subject);
});

module.exports = { buildEmailData, fill };
