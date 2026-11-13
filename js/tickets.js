/* =========================================================
   Tickets – free pre-registration, pay at the gate
   ---------------------------------------------------------
   1. Intro: why register.
   2. Step 1: the lead adult's details and everyone in the group.
   3. Step 2: the safety declaration, signed once for the group.
   4. Tickets: one per person, each with its own QR code.

   The registration is saved to Firebase (collection
   "registrations", one document per group, named by its
   6-letter group code) so the gate can look it up, AND kept on
   this phone so the tickets still show with no signal.

   The QR code on each ticket holds  PSD27|GROUPCODE|personNumber
   – no names or details, just a reference the gate looks up.

   Who can see a registration: only the phone that made it, and
   the organisers (see firebase/firestore.rules).
   ========================================================= */

const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
const STORE_KEY = "silageday-registration";
const MAX_PEOPLE = 12;
const TYPES = ["adult", "child", "under5"];
const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I, easy to read out

const appEl = document.getElementById("tickets-app");
let fb = null;        // Firebase tools once loaded
let step = "intro";   // intro | group | declare | tickets
let draft = null;     // the form while filling it in
let saved = loadLocal();
let busy = false;

const configured = typeof FIREBASE_CONFIG !== "undefined" && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId;


/* ---------- Small helpers ---------- */
function esc(text) {
  return String(text == null ? "" : text).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function loadLocal() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) { return null; }
}
function saveLocal(reg) {
  try {
    if (reg) localStorage.setItem(STORE_KEY, JSON.stringify(reg));
    else localStorage.removeItem(STORE_KEY);
  } catch (e) { /* storage full or blocked – the tickets are still in Firebase */ }
}
function newCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_LETTERS[b % CODE_LETTERS.length]).join("");
}
function typeLabel(type) { return t("tk_type_" + type); }
function qrText(code, n) { return "PSD27|" + code + "|" + n; }
function ticketNumber(code, n) { return code + "-" + n; }


/* ---------- Firebase ---------- */
async function firebase() {
  if (fb) return fb;
  const [appMod, authMod, fsMod] = await Promise.all([
    import(SDK + "firebase-app.js"),
    import(SDK + "firebase-auth.js"),
    import(SDK + "firebase-firestore.js")
  ]);
  const app = appMod.initializeApp(FIREBASE_CONFIG);
  fb = { auth: authMod.getAuth(app), db: fsMod.getFirestore(app), A: authMod, F: fsMod };
  // Wait for Firebase to remember who this phone is (from an earlier visit)
  await new Promise((resolve) => { const stop = authMod.onAuthStateChanged(fb.auth, () => { stop(); resolve(); }); });
  if (!fb.auth.currentUser) await authMod.signInAnonymously(fb.auth);
  return fb;
}


/* ---------- Drawing each step ---------- */
function render() {
  if (step === "tickets" && saved) return renderTickets();
  if (step === "group") return renderGroup();
  if (step === "declare") return renderDeclare();
  return renderIntro();
}

function renderIntro() {
  appEl.innerHTML =
    '<section class="card">' +
      '<h2>' + t("tk_free_h") + '</h2>' +
      '<p>' + t("tk_intro") + '</p>' +
      '<ul class="tick-list"><li>' + t("tk_b1") + '</li><li>' + t("tk_b2") + '</li><li>' + t("tk_b3") + '</li></ul>' +
      '<p class="muted">' + t("tk_pay_at_gate") + '</p>' +
      (configured
        ? '<button type="button" class="btn" id="tk-start">' + t("tk_start") + '</button>'
        : '<p class="note">' + t("tk_not_yet") + '</p>') +
    '</section>' +
    gettingHereCard();
  const start = document.getElementById("tk-start");
  if (start) start.addEventListener("click", () => {
    draft = { leadName: "", email: "", mobile: "", members: [{ name: "", type: "adult" }], news: false };
    step = "group"; render(); focusTop();
  });
}

function gettingHereCard() {
  return '<section class="card"><h2>' + t("tk_getting_h") + '</h2><p>' + t("tk_getting") + '</p>' +
    '<a class="btn alt" href="getting-here.html">' + t("tk_getting_btn") + '</a></section>';
}

function renderGroup() {
  const editing = !!draft.code;
  appEl.innerHTML =
    '<p class="step-label">' + t("tk_step", { n: 1 }) + (editing ? " · " + t("tk_editing") : "") + '</p>' +
    '<section class="card form-card">' +
      '<h2>' + t("tk_lead_h") + '</h2>' +
      field("tk-lead", t("tk_lead_name"), draft.leadName, "text", "name", true) +
      field("tk-email", t("tk_email"), draft.email, "email", "email", true) +
      field("tk-mobile", t("tk_mobile"), draft.mobile, "tel", "tel", false, t("tk_mobile_hint")) +
    '</section>' +
    '<section class="card form-card">' +
      '<h2>' + t("tk_who_h") + '</h2>' +
      '<p class="muted">' + t("tk_who_sub") + '</p>' +
      '<div id="tk-members">' + draft.members.map(memberRow).join("") + '</div>' +
      (draft.members.length < MAX_PEOPLE ? '<button type="button" class="btn alt" id="tk-add">＋ ' + t("tk_add") + '</button>' : '') +
      '<p class="note">' + t("tk_kids_note") + '</p>' +
    '</section>' +
    '<p class="form-error" id="tk-error" role="alert" hidden></p>' +
    '<div class="pad-x"><button type="button" class="btn" id="tk-next">' + t("tk_next") + '</button>' +
    '<button type="button" class="btn alt" id="tk-cancel">' + t("tk_cancel") + '</button></div>';

  // The first person is the lead adult, unless they type a different name
  const lead = document.getElementById("tk-lead");
  const first = appEl.querySelector('.member-name[data-i="0"]');
  lead.addEventListener("input", () => { if (!first.dataset.touched) first.value = lead.value; });
  first.addEventListener("input", () => { first.dataset.touched = "1"; });
  if (draft.members[0].name && draft.members[0].name !== draft.leadName) first.dataset.touched = "1";

  const add = document.getElementById("tk-add");
  if (add) add.addEventListener("click", () => {
    readGroup(); draft.members.push({ name: "", type: "adult" }); renderGroup();
    const inputs = appEl.querySelectorAll(".member-name"); inputs[inputs.length - 1].focus();
  });
  appEl.querySelectorAll("[data-remove]").forEach((b) => b.addEventListener("click", () => {
    readGroup(); draft.members.splice(Number(b.dataset.remove), 1); renderGroup();
  }));
  document.getElementById("tk-next").addEventListener("click", () => {
    readGroup();
    const problem = checkGroup();
    if (problem) return showError(problem);
    step = "declare"; render(); focusTop();
  });
  document.getElementById("tk-cancel").addEventListener("click", () => {
    draft = null; step = saved ? "tickets" : "intro"; render(); focusTop();
  });
}

function field(id, label, value, type, auto, required, hint) {
  return '<label class="field" for="' + id + '">' + label + (required ? ' <span aria-hidden="true">*</span>' : '') + '</label>' +
    (hint ? '<p class="field-hint" id="' + id + '-hint">' + hint + '</p>' : '') +
    '<input class="input" id="' + id + '" type="' + type + '" autocomplete="' + auto + '" value="' + esc(value) + '"' +
    (required ? ' required aria-required="true"' : '') + (hint ? ' aria-describedby="' + id + '-hint"' : '') + '>';
}

function memberRow(m, i) {
  return '<div class="member-row">' +
    '<label class="visually-hidden" for="tk-m' + i + '">' + t("tk_person_n", { n: i + 1 }) + '</label>' +
    '<input class="input member-name" id="tk-m' + i + '" data-i="' + i + '" placeholder="' + esc(t("tk_full_name")) + '" value="' + esc(m.name) + '" autocomplete="off">' +
    '<label class="visually-hidden" for="tk-t' + i + '">' + t("tk_ticket_type") + '</label>' +
    '<select class="input member-type" id="tk-t' + i + '" data-i="' + i + '">' +
      TYPES.map((k) => '<option value="' + k + '"' + (m.type === k ? " selected" : "") + '>' + typeLabel(k) + '</option>').join("") +
    '</select>' +
    (i ? '<button type="button" class="icon-btn" data-remove="' + i + '" aria-label="' + esc(t("tk_remove", { name: m.name || t("tk_person_n", { n: i + 1 }) })) + '">✕</button>'
       : '<span class="icon-btn-space" aria-hidden="true"></span>') +
  '</div>';
}

function readGroup() {
  draft.leadName = document.getElementById("tk-lead").value.trim();
  draft.email = document.getElementById("tk-email").value.trim();
  draft.mobile = document.getElementById("tk-mobile").value.trim();
  draft.members = Array.from(appEl.querySelectorAll(".member-row")).map((row) => ({
    name: row.querySelector(".member-name").value.trim(),
    type: row.querySelector(".member-type").value
  }));
}

function checkGroup() {
  if (draft.leadName.length < 2) return "tk_err_lead";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email)) return "tk_err_email";
  if (draft.members.some((m) => m.name.length < 2)) return "tk_err_names";
  if (!draft.members.some((m) => m.type === "adult")) return "tk_err_adult";
  return null;
}

function showError(key) {
  const el = document.getElementById("tk-error");
  el.textContent = t(key);
  el.hidden = false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderDeclare() {
  const hasKids = draft.members.some((m) => m.type !== "adult");
  const rules = [];
  for (let n = 1; TRANSLATIONS["rule_" + n]; n++) rules.push(t("rule_" + n));
  appEl.innerHTML =
    '<p class="step-label">' + t("tk_step", { n: 2 }) + ' · ' + t("tk_decl_for", { n: draft.members.length }) + '</p>' +
    '<section class="card">' +
      '<h2>' + t("tk_decl_h") + '</h2>' +
      '<ol class="rules-list">' + rules.map((r) => '<li>' + r + '</li>').join("") + '</ol>' +
      '<p class="muted"><b>' + t("tk_who_h") + ':</b> ' + draft.members.map((m) => esc(m.name) + ' (' + typeLabel(m.type) + ')').join(", ") + '</p>' +
      '<label class="accept-row"><input type="checkbox" id="tk-agree"><span>' + t("tk_decl_agree") + '</span></label>' +
      (hasKids ? '<label class="accept-row"><input type="checkbox" id="tk-kids"><span>' + t("tk_decl_kids") + '</span></label>' : '') +
      '<label class="field" for="tk-sign">' + t("tk_sign") + ' <span aria-hidden="true">*</span></label>' +
      '<p class="field-hint" id="tk-sign-hint">' + t("tk_sign_hint") + '</p>' +
      '<input class="input signature" id="tk-sign" autocomplete="name" aria-describedby="tk-sign-hint" value="' + esc(draft.signedName || "") + '">' +
      '<label class="check-row"><input type="checkbox" id="tk-news"' + (draft.news ? " checked" : "") + '><span>' + t("tk_news") + '</span></label>' +
      '<p class="note">' + t("tk_privacy") + '</p>' +
    '</section>' +
    '<p class="form-error" id="tk-error" role="alert" hidden></p>' +
    '<div class="pad-x"><button type="button" class="btn" id="tk-submit">' + (draft.code ? t("tk_save") : t("tk_register")) + '</button>' +
    '<button type="button" class="btn alt" id="tk-back">' + t("tk_back") + '</button></div>';

  document.getElementById("tk-back").addEventListener("click", () => { readDeclare(); step = "group"; render(); focusTop(); });
  document.getElementById("tk-submit").addEventListener("click", submit);
}

function readDeclare() {
  draft.signedName = document.getElementById("tk-sign").value.trim();
  draft.news = document.getElementById("tk-news").checked;
}

async function submit() {
  if (busy) return;
  readDeclare();
  const agree = document.getElementById("tk-agree").checked;
  const kidsBox = document.getElementById("tk-kids");
  if (!agree || (kidsBox && !kidsBox.checked)) return showError("tk_err_agree");
  if (draft.signedName.length < 2) return showError("tk_err_sign");

  busy = true;
  const btn = document.getElementById("tk-submit");
  btn.disabled = true;
  btn.textContent = t("tk_saving");
  try {
    const { F, db, auth } = await firebase();
    const record = {
      uid: auth.currentUser.uid,
      leadName: draft.leadName,
      email: draft.email,
      mobile: draft.mobile,
      members: draft.members.map((m, i) => ({ n: i + 1, name: m.name, type: m.type })),
      agreed: true,
      childrenAgreed: !!kidsBox,
      signedName: draft.signedName,
      rulesVersion: SAFETY_RULES_VERSION,
      lang: currentLang || "cy",
      news: draft.news,
      updatedAt: F.serverTimestamp()
    };
    let code = draft.code;
    if (code) {
      // Editing: change everything except when it was first made
      await F.updateDoc(F.doc(db, "registrations", code), Object.assign({}, record));
      record.createdAt = draft.createdAt;
    } else {
      // Try a few random codes in case one is already taken
      for (let tries = 0; tries < 5; tries++) {
        code = newCode();
        try {
          await F.setDoc(F.doc(db, "registrations", code), Object.assign({}, record, { createdAt: F.serverTimestamp() }));
          record.createdAt = Date.now();
          break;
        } catch (e) {
          if (tries === 4 || e.code !== "permission-denied") throw e;
        }
      }
    }
    saved = {
      code: code, leadName: record.leadName, email: record.email, mobile: record.mobile,
      members: record.members, news: record.news, signedName: record.signedName,
      createdAt: record.createdAt
    };
    saveLocal(saved);
    draft = null;
    step = "tickets";
    render();
    focusTop();
  } catch (e) {
    console.error(e);
    busy = false;
    btn.disabled = false;
    btn.textContent = draft.code ? t("tk_save") : t("tk_register");
    showError(navigator.onLine === false ? "tk_err_offline" : "tk_err_save");
    return;
  }
  busy = false;
}

function renderTickets() {
  const counts = { adult: 0, child: 0, under5: 0 };
  saved.members.forEach((m) => counts[m.type]++);
  const breakdown = TYPES.filter((k) => counts[k]).map((k) => counts[k] + " × " + typeLabel(k)).join(" · ");
  appEl.innerHTML =
    '<section class="group-summary">' +
      '<p class="group-code"><span>' + t("tk_group_code") + '</span><b>' + esc(saved.code) + '</b></p>' +
      '<p>' + t("tk_people", { n: saved.members.length }) + ' · ' + breakdown + '</p>' +
      '<p>' + esc(saved.leadName) + ' · ' + t("tk_date") + '</p>' +
    '</section>' +
    '<p class="done-note">✓ ' + t("tk_decl_done", { name: esc(saved.signedName || saved.leadName) }) + '</p>' +
    '<section class="card pay-card"><h2>💷 ' + t("tk_pay_h") + '</h2><p>' + t("tk_pay_note") + '</p><p class="muted">' + t("tk_pay_at_gate") + '</p></section>' +
    '<p class="swipe-hint" aria-hidden="true">' + t("tk_swipe") + ' →</p>' +
    '<div class="ticket-list" role="list">' + saved.members.map(ticketCard).join("") + '</div>' +
    '<section class="card"><h2>' + t("tk_keep_h") + '</h2><p>' + t("tk_keep") + '</p></section>' +
    '<div class="pad-x ticket-actions">' +
      '<button type="button" class="btn alt" id="tk-edit">✏️ ' + t("tk_edit") + '</button>' +
      '<button type="button" class="btn alt" id="tk-delete">' + t("tk_delete") + '</button>' +
    '</div>' +
    gettingHereCard();

  document.getElementById("tk-edit").addEventListener("click", () => {
    draft = {
      code: saved.code, createdAt: saved.createdAt, leadName: saved.leadName, email: saved.email,
      mobile: saved.mobile || "", news: !!saved.news, signedName: "",
      members: saved.members.map((m) => ({ name: m.name, type: m.type }))
    };
    step = "group"; render(); focusTop();
  });
  document.getElementById("tk-delete").addEventListener("click", cancelRegistration);
}

function ticketCard(m) {
  return '<article class="ticket" role="listitem" aria-label="' + esc(t("tk_ticket_for", { name: m.name })) + '">' +
    '<div class="ticket-top"><img src="images/logo.png" alt="" width="96" height="48">' +
      '<p class="ticket-name">' + esc(m.name) + '</p><p class="ticket-type">' + typeLabel(m.type) + '</p></div>' +
    '<div class="ticket-qr" role="img" aria-label="' + esc(t("tk_qr_label", { n: ticketNumber(saved.code, m.n) })) + '">' + qrSvg(qrText(saved.code, m.n)) + '</div>' +
    '<p class="ticket-number">' + ticketNumber(saved.code, m.n) + '</p>' +
    '<p class="ticket-state">' + (m.type === "under5" ? t("tk_free_entry") : t("tk_pay_gate_short")) + '</p>' +
  '</article>';
}

async function cancelRegistration() {
  if (!confirm(t("tk_delete_q"))) return;
  try {
    const { F, db } = await firebase();
    await F.deleteDoc(F.doc(db, "registrations", saved.code));
  } catch (e) {
    console.error(e);
    // If this phone can't delete it (e.g. it was registered on another phone) keep the tickets
    if (e.code !== "not-found") { alert(t("tk_err_delete")); return; }
  }
  saved = null;
  saveLocal(null);
  step = "intro";
  render();
  focusTop();
}

function focusTop() {
  const h = document.querySelector(".page-title");
  if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  window.scrollTo({ top: 0 });
}


/* ---------- Start ---------- */
step = saved ? "tickets" : "intro";
render();

// Words change when the visitor switches language (keep what they've typed)
document.addEventListener("languagechange", () => {
  if (step === "group") readGroup();
  if (step === "declare") readDeclare();
  render();
});

// Quietly check the registration still exists in Firebase (it might have
// been cancelled from another phone or by an organiser)
if (saved && configured && navigator.onLine !== false) {
  firebase().then(async ({ F, db }) => {
    try {
      const snap = await F.getDoc(F.doc(db, "registrations", saved.code));
      if (!snap.exists()) { saved = null; saveLocal(null); if (step === "tickets") { step = "intro"; render(); } }
    } catch (e) { /* no signal or not this phone's – keep showing the saved tickets */ }
  }).catch(() => {});
}
