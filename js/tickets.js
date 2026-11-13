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
   Each person keeps the same number even if the group is changed
   later, so a ticket that's been shared never points at someone else.

   PAID: when the gate takes payment, the organiser app adds the
   person's number to the "paid" list in  checkins/{group code}.
   This page listens for that and turns the ticket green straight
   away – on the lead adult's phone and on any phone a ticket was
   sent to. The last known state is kept on the phone for no-signal.

   SHARING: the lead adult can send one ticket (or all of them) to
   someone arriving separately. The link carries just the group code,
   name and ticket type after a # – which never leaves the phone it's
   opened on – and the other phone saves the ticket for itself.

   Who can see a registration: only the phone that made it, and
   the organisers (see firebase/firestore.rules).
   ========================================================= */

const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
const STORE_KEY = "silageday-registration";
const SHARED_KEY = "silageday-shared-tickets"; // tickets other people have sent to this phone
const PAID_KEY = "silageday-paid";              // last known paid list for each group code
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
  // Tickets someone else sent to this phone go at the top
  if (loadShared().length) appEl.insertAdjacentHTML("afterbegin", sharedSection());
  bindShared();
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
  draft.members = Array.from(appEl.querySelectorAll(".member-row")).map((row, i) => ({
    n: draft.members[i] && draft.members[i].n,  // keep each person's ticket number
    name: row.querySelector(".member-name").value.trim(),
    type: row.querySelector(".member-type").value
  }));
}

// Give new people the next unused number; existing people keep theirs.
// Numbers are never reused (lastN remembers the highest ever given),
// so a removed person's shared ticket can't end up meaning someone new.
function numberMembers(members, lastN) {
  let next = members.reduce((max, m) => Math.max(max, m.n || 0), lastN || 0);
  return members.map((m) => ({ n: m.n || ++next, name: m.name, type: m.type }));
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
      members: numberMembers(draft.members, draft.lastN),
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
      lastN: Math.max(draft.lastN || 0, ...record.members.map((m) => m.n)),
      createdAt: record.createdAt
    };
    saveLocal(saved);
    watchPayments();
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
    payCard() +
    '<p class="swipe-hint" aria-hidden="true">' + t("tk_swipe") + ' →</p>' +
    '<div class="ticket-list" role="list">' + saved.members.map((m) => ticketCard(m, saved.code, true)).join("") + '</div>' +
    (saved.members.length > 1 ? '<div class="pad-x"><button type="button" class="btn alt" id="tk-share-all">📤 ' + t("tk_share_all") + '</button></div>' : '') +
    '<p class="share-status" id="tk-share-status" role="status" hidden></p>' +
    '<section class="card"><h2>' + t("tk_keep_h") + '</h2><p>' + t("tk_keep") + '</p></section>' +
    '<div class="pad-x ticket-actions">' +
      '<button type="button" class="btn alt" id="tk-edit">✏️ ' + t("tk_edit") + '</button>' +
      '<button type="button" class="btn alt" id="tk-delete">' + t("tk_delete") + '</button>' +
    '</div>' +
    sharedSection() +
    gettingHereCard();

  appEl.querySelectorAll("[data-share]").forEach((b) => b.addEventListener("click", () => {
    const m = saved.members.find((x) => x.n === Number(b.dataset.share));
    shareTickets([m], t("tk_share_text_one", { name: m.name }));
  }));
  const all = document.getElementById("tk-share-all");
  if (all) all.addEventListener("click", () => shareTickets(saved.members, t("tk_share_text_all")));
  bindShared();

  document.getElementById("tk-edit").addEventListener("click", () => {
    draft = {
      code: saved.code, createdAt: saved.createdAt, leadName: saved.leadName, email: saved.email,
      lastN: saved.lastN || Math.max(...saved.members.map((m) => m.n)),
      mobile: saved.mobile || "", news: !!saved.news, signedName: "",
      members: saved.members.map((m) => ({ n: m.n, name: m.name, type: m.type }))
    };
    step = "group"; render(); focusTop();
  });
  document.getElementById("tk-delete").addEventListener("click", cancelRegistration);
}

/* ---------- Paid or not ---------- */
function loadPaid() {
  try { return JSON.parse(localStorage.getItem(PAID_KEY) || "{}"); } catch (e) { return {}; }
}
function isPaid(code, n) {
  const list = loadPaid()[code];
  return Array.isArray(list) && list.includes(n);
}
function ticketState(m, code) {
  if (isPaid(code, m.n)) return '<p class="ticket-state paid">✓ ' + t("tk_paid") + '</p>';
  return '<p class="ticket-state">' + (m.type === "under5" ? t("tk_free_entry") : t("tk_pay_gate_short")) + '</p>';
}

// The "Pay at the gate" card on your own tickets: all paid, part paid or none
function payCard() {
  const toPay = saved.members.filter((m) => m.type !== "under5");
  const paid = toPay.filter((m) => isPaid(saved.code, m.n));
  if (toPay.length && paid.length === toPay.length) {
    return '<section class="card pay-card all-paid"><h2>✓ ' + t("tk_all_paid_h") + '</h2><p>' + t("tk_all_paid") + '</p></section>';
  }
  if (paid.length) {
    const still = toPay.filter((m) => !isPaid(saved.code, m.n));
    return '<section class="card pay-card"><h2>💷 ' + t("tk_part_paid_h") + '</h2>' +
      '<p><b>' + t("tk_paid_for") + ':</b> ' + paid.map((m) => esc(m.name)).join(", ") + '</p>' +
      '<p><b>' + t("tk_still_to_pay") + ':</b> ' + still.map((m) => esc(m.name)).join(", ") + '</p>' +
      '<p class="muted">' + t("tk_part_paid_note") + '</p></section>';
  }
  return '<section class="card pay-card"><h2>💷 ' + t("tk_pay_h") + '</h2><p>' + t("tk_pay_note") + '</p><p class="muted">' + t("tk_pay_at_gate") + '</p></section>';
}

// Listen to the gate's paid list for every group with tickets on this phone
let watching = {};
function watchPayments() {
  if (!configured || navigator.onLine === false) return;
  const codes = new Set();
  if (saved) codes.add(saved.code);
  loadShared().forEach((x) => codes.add(x.code));
  if (!codes.size) return;
  firebase().then(({ F, db }) => {
    codes.forEach((code) => {
      if (watching[code]) return;
      watching[code] = F.onSnapshot(F.doc(db, "checkins", code), (snap) => {
        const all = loadPaid();
        const list = snap.exists() && Array.isArray(snap.data().paid) ? snap.data().paid.filter(Number.isInteger) : [];
        if (JSON.stringify(all[code] || []) === JSON.stringify(list)) return;
        all[code] = list;
        try { localStorage.setItem(PAID_KEY, JSON.stringify(all)); } catch (e) {}
        if (step === "tickets" || step === "intro") render();
      }, () => { /* no signal – keep the last known state */ });
    });
  }).catch(() => {});
}

function ticketCard(m, code, canShare) {
  const paid = isPaid(code, m.n);
  return '<article class="ticket' + (paid ? ' is-paid' : '') + '" role="listitem" aria-label="' + esc(t("tk_ticket_for", { name: m.name }) + (paid ? " – " + t("tk_paid") : "")) + '">' +
    (paid ? '<span class="paid-stamp" aria-hidden="true">' + t("tk_paid_stamp") + '</span>' : '') +
    '<div class="ticket-top"><img src="images/logo.png" alt="" width="96" height="48">' +
      '<p class="ticket-name">' + esc(m.name) + '</p><p class="ticket-type">' + typeLabel(m.type) + '</p></div>' +
    '<div class="ticket-qr" role="img" aria-label="' + esc(t("tk_qr_label", { n: ticketNumber(code, m.n) })) + '">' + qrSvg(qrText(code, m.n)) + '</div>' +
    '<p class="ticket-number">' + ticketNumber(code, m.n) + '</p>' +
    ticketState(m, code) +
    (canShare ? '<button type="button" class="ticket-share" data-share="' + m.n + '" aria-label="' + esc(t("tk_share_one_label", { name: m.name })) + '">📤 ' + t("tk_share_one") + '</button>' : '') +
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

/* ---------- Sharing tickets ---------- */
function toBase64Url(text) {
  return btoa(unescape(encodeURIComponent(text))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(text) {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  return decodeURIComponent(escape(atob(b64 + "===".slice((b64.length + 3) % 4))));
}

function shareLink(members) {
  const payload = { v: 1, c: saved.code, g: saved.leadName, t: members.map((m) => [m.n, m.name, m.type]) };
  return location.origin + location.pathname.replace(/[^/]*$/, "") + "tickets.html#share=" + toBase64Url(JSON.stringify(payload));
}

async function shareTickets(members, text) {
  const url = shareLink(members);
  const status = document.getElementById("tk-share-status");
  const say = (key) => { status.textContent = t(key); status.hidden = false; };
  // Phones: open the share sheet (WhatsApp, Messages, email…)
  if (navigator.share) {
    try { await navigator.share({ title: t("tk_share_title"), text: text, url: url }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  // Computers: copy the link instead
  try { await navigator.clipboard.writeText(text + " " + url); say("tk_share_copied"); }
  catch (e) { window.prompt(t("tk_share_copy_this"), url); }
}

function loadShared() {
  try { return JSON.parse(localStorage.getItem(SHARED_KEY) || "[]"); } catch (e) { return []; }
}
function saveShared(list) {
  try { localStorage.setItem(SHARED_KEY, JSON.stringify(list)); } catch (e) {}
}

// A link someone sent: #share=…  → offer to save the ticket(s) on this phone
function readShareLink() {
  const m = location.hash.match(/^#share=([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  try {
    const p = JSON.parse(fromBase64Url(m[1]));
    if (p.v !== 1 || !/^[A-Z2-9]{6}$/.test(p.c) || !Array.isArray(p.t)) return null;
    const tickets = p.t
      .filter((x) => Array.isArray(x) && Number.isInteger(x[0]) && typeof x[1] === "string" && TYPES.includes(x[2]))
      .slice(0, MAX_PEOPLE)
      .map((x) => ({ code: p.c, n: x[0], name: x[1].slice(0, 80), type: x[2], from: String(p.g || "").slice(0, 80) }));
    return tickets.length ? tickets : null;
  } catch (e) { return null; }
}

function showIncoming(tickets) {
  const own = saved && saved.code === tickets[0].code;
  appEl.innerHTML =
    '<section class="card incoming">' +
      '<h2>📥 ' + t(tickets.length > 1 ? "tk_in_h_many" : "tk_in_h_one", { n: tickets.length }) + '</h2>' +
      '<p>' + t("tk_in_from", { name: esc(tickets[0].from) }) + '</p>' +
      '<ul class="incoming-list">' + tickets.map((x) => '<li><b>' + esc(x.name) + '</b> – ' + typeLabel(x.type) + '</li>').join("") + '</ul>' +
      (own ? '<p class="note">' + t("tk_in_own") + '</p>' : '') +
      '<button type="button" class="btn" id="tk-in-save">' + t("tk_in_save") + '</button>' +
      '<button type="button" class="btn alt" id="tk-in-skip">' + t("tk_in_skip") + '</button>' +
    '</section>';
  const done = () => { history.replaceState(null, "", location.pathname + location.search); step = saved ? "tickets" : "intro"; render(); focusTop(); };
  document.getElementById("tk-in-save").addEventListener("click", () => {
    const list = loadShared().filter((x) => !tickets.some((y) => y.code === x.code && y.n === x.n));
    saveShared(tickets.concat(list));
    done();
    watchPayments();
  });
  document.getElementById("tk-in-skip").addEventListener("click", done);
}

// "Tickets shared with you" – shown on the tickets page and the intro
function sharedSection() {
  // Leave out any that are already this phone's own registration
  const list = loadShared().filter((x) => !(saved && saved.code === x.code));
  if (!list.length) return "";
  return '<section class="shared-section">' +
    '<h2 class="shared-h">📥 ' + t("tk_shared_h") + '</h2>' +
    '<p class="muted pad-x">' + t("tk_shared_note") + '</p>' +
    '<div class="ticket-list" role="list">' + list.map((x) => ticketCard(x, x.code, false)).join("") + '</div>' +
    '<div class="pad-x"><button type="button" class="link-btn" id="tk-shared-clear">' + t("tk_shared_remove") + '</button></div>' +
  '</section>';
}
function bindShared() {
  const clear = document.getElementById("tk-shared-clear");
  if (clear) clear.addEventListener("click", () => {
    if (!confirm(t("tk_shared_remove_q"))) return;
    saveShared([]);
    render();
  });
}

function focusTop() {
  const h = document.querySelector(".page-title");
  if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  window.scrollTo({ top: 0 });
}


/* ---------- Start ---------- */
step = saved ? "tickets" : "intro";
const incoming = readShareLink();
if (incoming) showIncoming(incoming); else render();

watchPayments();
window.addEventListener("online", watchPayments);

// A share link opened while the Tickets page is already open
window.addEventListener("hashchange", () => {
  const tickets = readShareLink();
  if (tickets) { showIncoming(tickets); focusTop(); }
});

// Words change when the visitor switches language (keep what they've typed)
document.addEventListener("languagechange", () => {
  if (readShareLink()) return showIncoming(readShareLink());
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
