/* =========================================================
   Pembrokeshire Silage Day – visitor app JavaScript
   Every page loads this one file. Each section below first
   checks whether its part of the page exists, so it only
   runs on the page that needs it.
   ========================================================= */

// The show date. Months in JavaScript count from 0, so 8 = September.
const SHOW_DAY = new Date(2027, 8, 11);


/* ---------- 1. Countdown (home page) ---------- */
const daysLeftEl = document.getElementById("days-left");
const countdownTextEl = document.getElementById("countdown-text");

function updateCountdown() {
  // Compare calendar days only (ignore the time of day)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.round((SHOW_DAY - today) / msPerDay);

  // t("key") comes from language.js and gives the words in the chosen language
  if (days > 1) {
    daysLeftEl.textContent = days;
    countdownTextEl.innerHTML = t("countdown_days");
  } else if (days === 1) {
    daysLeftEl.textContent = "1";
    countdownTextEl.innerHTML = t("countdown_one");
  } else if (days === 0) {
    daysLeftEl.textContent = "🚜";
    countdownTextEl.innerHTML = t("countdown_today");
  } else {
    daysLeftEl.textContent = "🌾";
    countdownTextEl.innerHTML = t("countdown_after");
  }
}


/* ---------- 2. Timetable "Live now" labels (timetable page) ----------
   Only does anything on the show day itself. Each row has
   data-start and data-end like "14:30". */
const timetableEl = document.getElementById("timetable");

// Turns "14:30" into minutes after midnight (870), which is easy to compare
function toMinutes(text) {
  const [hours, minutes] = text.split(":").map(Number);
  return hours * 60 + minutes;
}

function updateTimetable() {
  const now = new Date();
  const isShowDay = now.toDateString() === SHOW_DAY.toDateString();
  if (!isShowDay) return;

  const nowMins = now.getHours() * 60 + now.getMinutes();

  timetableEl.querySelectorAll(".slot").forEach(function (row) {
    const start = toMinutes(row.dataset.start);
    const end = toMinutes(row.dataset.end);
    const title = row.querySelector(".title");

    // Clear any label from last time, then work out the new one
    row.classList.remove("done", "is-live");
    const oldPill = title.querySelector(".pill");
    if (oldPill) oldPill.remove();

    let label = "";
    let kind = "";
    if (nowMins >= end) {
      row.classList.add("done");
    } else if (nowMins >= start) {
      row.classList.add("is-live");
      label = t("pill_live");
      kind = "live";
    } else if (start - nowMins <= 30) {
      label = t("pill_soon", { n: start - nowMins });
      kind = "soon";
    }

    if (label) {
      const pill = document.createElement("span");
      pill.className = "pill " + kind;
      pill.textContent = label;
      title.appendChild(pill);
    }
  });
}

if (timetableEl) {
  setInterval(updateTimetable, 60 * 1000); // check again every minute
}


/* ---------- Redo the language-dependent bits ----------
   language.js sends a "languagechange" message when the page
   is first filled in, and again whenever the visitor switches
   language. Each time, we redo the countdown and timetable labels. */
document.addEventListener("languagechange", function () {
  if (daysLeftEl && countdownTextEl) updateCountdown();
  if (timetableEl) updateTimetable();
});


/* ---------- 3. Map zoom buttons (map page) ----------
   Zooming just makes the picture wider inside its scrolling box.
   We keep the same spot in the middle of the box as you zoom. */
const mapBox = document.getElementById("map-box");
const mapImg = document.getElementById("site-map");
const zoomInBtn = document.getElementById("zoom-in");
const zoomOutBtn = document.getElementById("zoom-out");
const zoomLabel = document.getElementById("zoom-level");

if (mapBox && mapImg && zoomInBtn && zoomOutBtn) {
  const zoomSteps = [1, 1.5, 2, 3, 4];
  let step = 0;

  function setZoom(newStep) {
    // Remember which point is in the middle of the box (as a fraction)
    const centreX = (mapBox.scrollLeft + mapBox.clientWidth / 2) / mapBox.scrollWidth;
    const centreY = (mapBox.scrollTop + mapBox.clientHeight / 2) / mapBox.scrollHeight;

    step = Math.max(0, Math.min(zoomSteps.length - 1, newStep));
    const zoom = zoomSteps[step];
    mapImg.style.width = (zoom * 100) + "%";
    zoomLabel.textContent = Math.round(zoom * 100) + "%";

    // Scroll so the same point is back in the middle
    mapBox.scrollLeft = centreX * mapBox.scrollWidth - mapBox.clientWidth / 2;
    mapBox.scrollTop = centreY * mapBox.scrollHeight - mapBox.clientHeight / 2;

    zoomOutBtn.disabled = step === 0;
    zoomInBtn.disabled = step === zoomSteps.length - 1;
  }

  zoomInBtn.addEventListener("click", function () { setZoom(step + 1); });
  zoomOutBtn.addEventListener("click", function () { setZoom(step - 1); });

  // Drag the map with a mouse (phones and tablets can already swipe to scroll)
  let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
  mapBox.addEventListener("mousedown", function (e) {
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    startLeft = mapBox.scrollLeft; startTop = mapBox.scrollTop;
    e.preventDefault();
  });
  window.addEventListener("mousemove", function (e) {
    if (!dragging) return;
    mapBox.scrollLeft = startLeft - (e.clientX - startX);
    mapBox.scrollTop = startTop - (e.clientY - startY);
  });
  window.addEventListener("mouseup", function () { dragging = false; });

  setZoom(0);
}
