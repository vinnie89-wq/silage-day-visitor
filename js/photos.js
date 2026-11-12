/* =========================================================
   Photos page – share your photos, see everyone else's
   ---------------------------------------------------------
   How it works:
   1. A visitor picks photos and ticks the consent box.
   2. Each photo is shrunk ON THE PHONE (which also strips out
      hidden data such as the GPS position it was taken at) and
      saved to the Firebase database as "pending".
   3. An organiser checks it on approve.html. Approved photos
      are copied to the "gallery", which everyone can see.
      Nothing appears publicly until an organiser approves it.

   The photos are kept in Firestore (Firebase's database) as
   small JPEG pictures, so this runs on Firebase's free Spark
   plan with no card needed. Settings: js/firebase-config.js.
   Who can do what: firebase/firestore.rules.
   ========================================================= */

const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
const MAX_PHOTOS_AT_ONCE = 10;
const MAX_PER_DAY = 30;             // per phone – a gentle limit against floods
const FULL_SIZE = 1280;             // longest side in pixels for the big picture
const THUMB_SIZE = 400;             // and for the gallery thumbnail
const FULL_LIMIT = 850000;          // characters – keeps each photo under Firestore's 1 MB limit
const THUMB_LIMIT = 110000;
const PAGE = 24;                    // photos loaded at a time (each one counts as a database "read")

const $ = (id) => document.getElementById(id);
const uploadCard = $("upload-card");
const input = $("photo-input");
const chosenEl = $("chosen");
const consent = $("photo-consent");
const sendBtn = $("photo-send");
const statusEl = $("upload-status");
const gallery = $("gallery");
const galleryEmpty = $("gallery-empty");
const moreBtn = $("gallery-more");
const lightbox = $("lightbox");
const lightboxImg = $("lightbox-img");
const lightboxLoading = $("lightbox-loading");

let chosen = [];       // the files the visitor picked
let fb = null;         // the Firebase tools, once loaded
let lastShown = null;  // for "Show more"

function say(key, values) {
  statusEl.hidden = !key;
  statusEl.textContent = key ? t(key, values) : "";
}

const configured = typeof FIREBASE_CONFIG !== "undefined" && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId;


/* ---------- Not set up yet? ---------- */
if (!configured) {
  uploadCard.innerHTML = '<h2 data-i18n="photos_add"></h2><p data-i18n="photos_not_yet"></p>';
  galleryEmpty.hidden = false;
  galleryEmpty.setAttribute("data-i18n", "photos_none_yet");
  applyLanguage();
} else {
  start();
}


/* ---------- Start Firebase ---------- */
async function start() {
  try {
    const [appMod, authMod, fsMod] = await Promise.all([
      import(SDK + "firebase-app.js"),
      import(SDK + "firebase-auth.js"),
      import(SDK + "firebase-firestore.js")
    ]);
    const app = appMod.initializeApp(FIREBASE_CONFIG);
    fb = { auth: authMod.getAuth(app), db: fsMod.getFirestore(app), A: authMod, F: fsMod };
    loadGallery();
  } catch (e) {
    console.error(e);
    galleryEmpty.hidden = false;
    galleryEmpty.textContent = t("photos_offline");
  }
}


/* ---------- Choosing photos ---------- */
input.addEventListener("change", function () {
  chosen = Array.from(input.files)
    .filter((f) => f.type.startsWith("image/") && f.size < 25e6)
    .slice(0, MAX_PHOTOS_AT_ONCE);
  chosenEl.hidden = chosen.length === 0;
  chosenEl.innerHTML = chosen.map((f) =>
    '<img src="' + URL.createObjectURL(f) + '" alt="">').join("") +
    '<p>' + t("photos_chosen", { n: chosen.length }) +
    (input.files.length > MAX_PHOTOS_AT_ONCE ? " " + t("photos_max", { n: MAX_PHOTOS_AT_ONCE }) : "") + '</p>';
  say("");
  updateSendButton();
});
consent.addEventListener("change", updateSendButton);

function updateSendButton() {
  sendBtn.disabled = !(chosen.length && consent.checked);
}


/* ---------- Shrinking a photo on the phone ----------
   Drawing it onto a canvas and saving as JPEG makes it much
   smaller AND throws away the hidden data (location, phone
   model) that photos carry. */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function shrink(img, longest, limit) {
  const scale = Math.min(1, longest / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  // Lower the quality step by step until it fits
  for (let q = 0.8; q >= 0.35; q -= 0.1) {
    const data = canvas.toDataURL("image/jpeg", q);
    if (data.length <= limit) return { data, w: canvas.width, h: canvas.height };
  }
  return null; // still too big (very unusual)
}


/* ---------- A gentle per-phone daily limit ---------- */
function sentToday() {
  try {
    const rec = JSON.parse(localStorage.getItem("silageday-photos-sent") || "{}");
    return rec.day === new Date().toDateString() ? rec.n : 0;
  } catch (e) { return 0; }
}
function addSent(n) {
  try { localStorage.setItem("silageday-photos-sent", JSON.stringify({ day: new Date().toDateString(), n: sentToday() + n })); } catch (e) {}
}


/* ---------- Sending ---------- */
sendBtn.addEventListener("click", async function () {
  if (!fb || !chosen.length || !consent.checked) return;
  if (sentToday() + chosen.length > MAX_PER_DAY) { say("photos_limit", { n: MAX_PER_DAY }); return; }

  sendBtn.disabled = true;
  input.disabled = true;
  const { A, F, auth, db } = fb;
  let sent = 0, failed = 0;
  try {
    // A quick anonymous sign-in – no account or details needed, it just
    // lets the security rules tell real visitors from robots
    if (!auth.currentUser) await A.signInAnonymously(auth);
    const uid = auth.currentUser.uid;

    for (let i = 0; i < chosen.length; i++) {
      say("photos_sending", { i: i + 1, n: chosen.length });
      try {
        const img = await loadImage(chosen[i]);
        const full = shrink(img, FULL_SIZE, FULL_LIMIT);
        const thumb = shrink(img, THUMB_SIZE, THUMB_LIMIT);
        if (!full || !thumb) throw new Error("too big");
        // The big picture and the "waiting for approval" entry are saved together
        const id = F.doc(F.collection(db, "pending")).id;
        const batch = F.writeBatch(db);
        batch.set(F.doc(db, "full", id), { image: full.data, uid });
        batch.set(F.doc(db, "pending", id), {
          thumb: thumb.data, w: full.w, h: full.h, uid,
          lang: currentLang || "cy", createdAt: F.serverTimestamp()
        });
        await batch.commit();
        sent++;
      } catch (e) {
        console.error(e);
        failed++;
      }
    }
  } catch (e) {
    console.error(e);
    failed = chosen.length - sent;
  }

  addSent(sent);
  if (failed && !sent) say("photos_failed");
  else if (failed) say("photos_some_failed", { n: sent, f: failed });
  else say("photos_thanks", { n: sent });

  // Reset for the next lot
  chosen = [];
  input.value = "";
  input.disabled = false;
  chosenEl.hidden = true;
  consent.checked = false;
  updateSendButton();
});


/* ---------- The gallery ---------- */
async function loadGallery(more) {
  const { F, db } = fb;
  try {
    const parts = [F.collection(db, "gallery"), F.orderBy("createdAt", "desc")];
    if (more && lastShown) parts.push(F.startAfter(lastShown));
    parts.push(F.limit(PAGE));
    const snap = await F.getDocs(F.query.apply(null, parts));
    if (!more) gallery.innerHTML = "";
    snap.forEach((d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "thumb";
      b.setAttribute("aria-label", t("photos_open"));
      b.innerHTML = '<img src="' + d.data().thumb + '" alt="" loading="lazy">';
      b.addEventListener("click", () => openPhoto(d.id, d.data().thumb, b));
      gallery.appendChild(b);
    });
    lastShown = snap.docs[snap.docs.length - 1] || lastShown;
    moreBtn.hidden = snap.size < PAGE;
    galleryEmpty.hidden = gallery.children.length > 0;
    galleryEmpty.textContent = t("photos_none_yet");
  } catch (e) {
    console.error(e);
    galleryEmpty.hidden = false;
    galleryEmpty.textContent = t("photos_offline");
  }
}
moreBtn.addEventListener("click", () => loadGallery(true));

// Words change when the visitor switches language
document.addEventListener("languagechange", () => {
  if (!galleryEmpty.hidden && configured) galleryEmpty.textContent = t("photos_none_yet");
});


/* ---------- Seeing a photo bigger ---------- */
let returnFocus = null;
async function openPhoto(id, thumb, fromButton) {
  returnFocus = fromButton;
  lightboxImg.src = thumb;          // show the small one straight away
  lightboxLoading.hidden = false;
  lightbox.hidden = false;
  $("lightbox-close").focus();
  try {
    const snap = await fb.F.getDoc(fb.F.doc(fb.db, "full", id));
    if (snap.exists() && !lightbox.hidden) lightboxImg.src = snap.data().image;
  } catch (e) { console.error(e); }
  lightboxLoading.hidden = true;
}
function closePhoto() {
  lightbox.hidden = true;
  lightboxImg.src = "";
  if (returnFocus) returnFocus.focus();
}
$("lightbox-close").addEventListener("click", closePhoto);
lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closePhoto(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !lightbox.hidden) closePhoto(); });
