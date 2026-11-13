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


/* ---------- 2. Timetable (timetable page) ----------
   The rows are built from PROGRAMME in programme.js, so the
   timetable and the map's "Live now" markers always agree.
   On the show day each row gets a "Live now" or "Starts in…"
   label. (Test before the day with ?time=14:40 on the address.) */
const timetableEl = document.getElementById("timetable");

function buildTimetable() {
  timetableEl.innerHTML = PROGRAMME.map(function (item) {
    return '<li class="slot' + (item.key ? ' key' : '') + '">' +
      '<div class="time">' + item.start + '</div>' +
      '<div class="what"><div class="title">' + t(item.title) + '</div>' +
      '<div class="where">' + t(item.where) + '</div></div>' +
    '</li>';
  }).join("");
}

function updateTimetable() {
  buildTimetable();
  const nowMins = showDayMinutes();
  if (nowMins === null) return; // not the show day

  timetableEl.querySelectorAll(".slot").forEach(function (row, i) {
    const status = slotStatus(PROGRAMME[i], nowMins);
    const title = row.querySelector(".title");
    if (status === "done") row.classList.add("done");
    if (status === "live" || status === "soon") {
      if (status === "live") row.classList.add("is-live");
      const pill = document.createElement("span");
      pill.className = "pill " + status;
      pill.textContent = status === "live" ? t("pill_live")
        : t("pill_soon", { n: toMinutes(PROGRAMME[i].start) - nowMins });
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
  if (typeof updateLiveMap === "function") updateLiveMap();
});


/* ---------- 3. Map zoom buttons (map page) ----------
   Zooming just makes the picture wider inside its scrolling box.
   We keep the same spot in the middle of the box as you zoom. */
const mapBox = document.getElementById("map-box");
const mapImg = document.getElementById("map-inner"); // the picture plus its markers, zoomed together
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

  // Zoom in on a spot (map units) and scroll it into the middle – used by "Show on map"
  window.zoomToSpot = function (x, y, minStep) {
    if (step < minStep) setZoom(minStep);
    mapBox.scrollLeft = (x / MAP_SIZE.width) * mapBox.scrollWidth - mapBox.clientWidth / 2;
    mapBox.scrollTop = (y / MAP_SIZE.height) * mapBox.scrollHeight - mapBox.clientHeight / 2;
  };

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


/* ---------- 4. "Live now" on the map (map page) ----------
   Puts a numbered marker on each demonstration field. On the
   show day the markers light up: red "LIVE" while a demo is
   running, amber when one starts within 30 minutes. The card
   above the map lists what's live and what's next.
   (Test before the day with ?time=14:40 on the address.) */
const liveCard = document.getElementById("live-now");
const markersEl = document.getElementById("map-markers");
const fieldInfo = document.getElementById("field-info");

function percent(value, total) { return (value / total * 100).toFixed(3) + "%"; }

function fieldName(n) { return t("field_" + n); }

// The programme items for one field
function itemsInField(n) {
  return PROGRAMME.filter(function (item) { return item.field === n; });
}

function updateLiveMap() {
  if (!liveCard || !markersEl) return;
  const nowMins = showDayMinutes();

  /* The markers */
  markersEl.innerHTML = "";
  Object.keys(FIELD_SPOTS).forEach(function (key) {
    const n = Number(key);
    const spot = FIELD_SPOTS[n];
    const items = itemsInField(n);
    let status = "";
    if (nowMins !== null) {
      if (items.some(function (i) { return slotStatus(i, nowMins) === "live"; })) status = "live";
      else if (items.some(function (i) { return slotStatus(i, nowMins) === "soon"; })) status = "soon";
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "field-marker" + (status ? " " + status : "") + (items.length ? "" : " quiet");
    btn.style.left = percent(spot.x, MAP_SIZE.width);
    btn.style.top = percent(spot.y, MAP_SIZE.height);
    btn.innerHTML = '<span class="num">' + n + '</span>' +
      (status === "live" ? '<span class="badge">' + t("map_live_badge") + '</span>' : "");
    btn.setAttribute("aria-label", fieldName(n) + (status === "live" ? " – " + t("pill_live") : status === "soon" ? " – " + t("map_soon_label") : ""));
    btn.addEventListener("click", function () { showFieldInfo(n); });
    markersEl.appendChild(btn);
  });

  /* The "Live now" card */
  if (nowMins === null) {
    liveCard.innerHTML = '<h2><span aria-hidden="true">🔴</span> ' + t("live_h") + '</h2>' +
      '<p class="live-empty">' + t("live_before_day") + '</p>';
    return;
  }
  const live = PROGRAMME.filter(function (i) { return i.field && slotStatus(i, nowMins) === "live"; });
  const next = PROGRAMME.filter(function (i) { return i.field && toMinutes(i.start) > nowMins; })[0];

  let html = '<h2><span aria-hidden="true">🔴</span> ' + t("live_h") +
    (isTestTime() ? ' <span class="test-time">' + t("live_test_time", { time: minutesToText(nowMins) }) + '</span>' : '') + '</h2>';
  if (live.length) {
    html += '<ul class="live-list">' + live.map(function (i) {
      return '<li><div><b>' + t(i.title) + '</b><span>' + fieldName(i.field) + ' · ' + t("live_until", { time: i.end }) + '</span></div>' +
        '<button type="button" class="btn alt small" data-show-field="' + i.field + '">' + t("show_on_map") + '</button></li>';
    }).join("") + '</ul>';
  } else {
    html += '<p class="live-empty">' + t("live_none") + '</p>';
  }
  if (next) {
    html += '<p class="live-next"><b>' + t("live_next") + ':</b> ' + t(next.title) + ' – ' + fieldName(next.field) + ', ' + next.start +
      ' <button type="button" class="link-btn" data-show-field="' + next.field + '">' + t("show_on_map") + '</button></p>';
  }
  liveCard.innerHTML = html;
  liveCard.querySelectorAll("[data-show-field]").forEach(function (b) {
    b.addEventListener("click", function () {
      const n = Number(b.dataset.showField);
      zoomToSpot(FIELD_SPOTS[n].x, FIELD_SPOTS[n].y, 2);
      showFieldInfo(n);
      document.getElementById("map-box").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
}

function minutesToText(m) { return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }

// Tap a field marker: what's on there today
function showFieldInfo(n) {
  if (!fieldInfo) return;
  const nowMins = showDayMinutes();
  const items = itemsInField(n);
  fieldInfo.hidden = false;
  fieldInfo.innerHTML = '<h2>' + fieldName(n) + '</h2>' + (items.length
    ? '<ul class="field-list">' + items.map(function (i) {
        const st = nowMins === null ? "" : slotStatus(i, nowMins);
        const pill = st === "live" ? ' <span class="pill live">' + t("pill_live") + '</span>'
                   : st === "soon" ? ' <span class="pill soon">' + t("pill_soon", { n: toMinutes(i.start) - nowMins }) + '</span>' : '';
        return '<li class="' + (st === "done" ? "done" : "") + '"><span class="time">' + i.start + '–' + i.end + '</span> ' + t(i.title) + pill + '</li>';
      }).join("") + '</ul>'
    : '<p>' + t("field_nothing") + '</p>');
}

if (liveCard) {
  updateLiveMap();
  setInterval(updateLiveMap, 60 * 1000); // refresh every minute
}


/* ---------- 5. "Where am I?" (map page) ----------
   Uses the phone's GPS to put a blue dot on the map. The
   position stays on the phone – it is never sent anywhere.
   The dot keeps following you until you leave the page.
   (Test away from the site with ?lat=51.8072&lon=-4.9968) */
const locateBtn = document.getElementById("locate-btn");
const meDot = document.getElementById("me-dot");
const meAccuracy = document.getElementById("me-accuracy");
const mapMessage = document.getElementById("map-message");
let watchId = null;
let firstFix = true;

function showMapMessage(text) {
  mapMessage.textContent = text;
  mapMessage.hidden = !text;
}

function placeMe(lat, lon, accuracyMetres) {
  const spot = gpsToMap(lat, lon);
  const margin = 40; // a little leeway around the edge of the map
  if (spot.x < -margin || spot.x > MAP_SIZE.width + margin || spot.y < -margin || spot.y > MAP_SIZE.height + margin) {
    meDot.hidden = true;
    const km = kmBetween(lat, lon, SITE_CENTRE.lat, SITE_CENTRE.lon);
    showMapMessage(t("loc_far", { d: km < 10 ? km.toFixed(1) : Math.round(km) }));
    return;
  }
  meDot.hidden = false;
  meDot.style.left = percent(Math.min(Math.max(spot.x, 0), MAP_SIZE.width), MAP_SIZE.width);
  meDot.style.top = percent(Math.min(Math.max(spot.y, 0), MAP_SIZE.height), MAP_SIZE.height);
  // The pale circle shows how sure the phone is (bigger = less sure)
  const radius = Math.min(Math.max(accuracyMetres || 0, 5), 300) * PIXELS_PER_METRE;
  meAccuracy.style.width = meAccuracy.style.height = percent(radius * 2, MAP_SIZE.width);
  showMapMessage(t("loc_here"));
  if (firstFix) { zoomToSpot(spot.x, spot.y, 1); firstFix = false; }
}

function locationError(err) {
  meDot.hidden = true;
  if (err && err.code === 1) showMapMessage(t("loc_denied"));
  else showMapMessage(t("loc_none"));
  locateBtn.setAttribute("aria-pressed", "false");
}

if (locateBtn && meDot) {
  locateBtn.setAttribute("aria-pressed", "false");
  locateBtn.addEventListener("click", function () {
    firstFix = true;
    // Testing: ?lat=…&lon=… pretends the phone is there
    const q = new URLSearchParams(location.search);
    if (q.get("lat") && q.get("lon")) {
      locateBtn.setAttribute("aria-pressed", "true");
      placeMe(parseFloat(q.get("lat")), parseFloat(q.get("lon")), 15);
      return;
    }
    if (!("geolocation" in navigator)) { locationError(); return; }
    showMapMessage(t("loc_finding"));
    locateBtn.setAttribute("aria-pressed", "true");
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = navigator.geolocation.watchPosition(
      function (pos) { placeMe(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy); },
      locationError,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  });
}


/* ---------- 6. Work offline ----------
   Saves the app on the phone so it (and the tickets) still opens
   with no signal. See sw.js. */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () { /* not supported here – the app still works online */ });
  });
}


/* ---------- 7. Preview mode (for the organising team) ----------
   Open any page with ?preview=1 on the address to get a slider in
   the header. Drag it to see the app as it will look at any time
   on the show day – the map's live markers, "Happening now" and
   the timetable all update as you drag. Visitors never see this.
   ?preview=0 (or the ✕ on the bar) switches it off. */
(function () {
  let on = false;
  try {
    const q = new URLSearchParams(location.search).get("preview");
    if (q === "1") sessionStorage.setItem("silageday-preview", "1");
    if (q === "0") { sessionStorage.removeItem("silageday-preview"); sessionStorage.removeItem("silageday-test-time"); }
    on = sessionStorage.getItem("silageday-preview") === "1";
  } catch (e) { return; }
  if (!on) return;

  const START = toMinutes("09:30"), END = toMinutes("17:30");
  const header = document.querySelector(".site-header");
  if (!header) return;
  const bar = document.createElement("div");
  bar.className = "preview-bar";
  bar.innerHTML =
    '<span class="preview-tag">' + t("pv_tag") + '</span>' +
    '<b class="preview-time" id="pv-time"></b>' +
    '<label class="visually-hidden" for="pv-slider">' + t("pv_label") + '</label>' +
    '<input type="range" id="pv-slider" min="' + START + '" max="' + END + '" step="5">' +
    '<button type="button" class="preview-close" id="pv-close" aria-label="' + t("pv_off") + '">✕</button>';
  header.appendChild(bar);

  const slider = document.getElementById("pv-slider");
  const timeEl = document.getElementById("pv-time");
  const current = showDayMinutes();
  slider.value = current === null ? toMinutes("10:45") : Math.min(Math.max(current, START), END);

  function apply() {
    const text = minutesToText(Number(slider.value));
    timeEl.textContent = text;
    slider.setAttribute("aria-valuetext", text);
    try { sessionStorage.setItem("silageday-test-time", text); } catch (e) {}
    if (typeof updateLiveMap === "function" && document.getElementById("live-now")) updateLiveMap();
    if (document.getElementById("timetable")) updateTimetable();
  }
  slider.addEventListener("input", apply);
  apply();

  document.getElementById("pv-close").addEventListener("click", function () {
    try { sessionStorage.removeItem("silageday-preview"); sessionStorage.removeItem("silageday-test-time"); } catch (e) {}
    location.href = location.pathname;
  });
})();
