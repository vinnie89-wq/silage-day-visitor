/* =========================================================
   The day's programme and where things are on the map
   ---------------------------------------------------------
   ONE list used by both the Timetable page and the Map's
   "Live now" markers – so change a time or a field here and
   both pages update together.

   Each item:
     start, end – "HH:MM" (24-hour clock)
     title      – the key for its words in translations.js
     where      – the key for "Field 9" etc. in translations.js
     field      – which field marker it lights up on the map
                  (null = not a demo field, e.g. the pay gate)
     key        – true for the big moments (gates open, close)
   ========================================================= */

const PROGRAMME = [
  { start: "10:00", end: "10:30", title: "slot_gates",    where: "slot_gates_w", field: null, key: true },
  { start: "10:30", end: "11:00", title: "slot_mowing",   where: "field_6",      field: 6 },
  { start: "11:10", end: "11:40", title: "slot_tedding",  where: "field_8",      field: 8 },
  { start: "11:50", end: "12:20", title: "slot_vraking",  where: "field_11",     field: 11 },
  { start: "13:10", end: "13:40", title: "slot_vharvest", where: "field_11",     field: 11 },
  { start: "14:30", end: "15:00", title: "slot_forage",   where: "field_9",      field: 9 },
  { start: "14:30", end: "15:00", title: "slot_buckrake", where: "field_10",     field: 10 },
  { start: "17:00", end: "17:30", title: "slot_close",    where: "slot_close_w", field: null, key: true }
];

// The show date – year, month (1–12), day
const SHOW_DATE = { year: 2027, month: 9, day: 11 };


/* ---------- Map positions ----------
   x and y are in the map picture's own units (it is 895 wide
   and 1316 tall) – the spot where each field's name starts.
   The marker is drawn just to the left of it (see .field-marker
   in style.css), so it never covers the words. */
const MAP_SIZE = { width: 895, height: 1316 };
const FIELD_SPOTS = {
  6:  { x: 213, y: 340 },
  7:  { x: 259, y: 485 },
  8:  { x: 494, y: 844 },
  9:  { x: 318, y: 911 },
  10: { x: 409, y: 1028 },
  11: { x: 428, y: 1156 }
};

/* Turning a phone's GPS position into a spot on the map.
   Worked out from the Marea field boundaries for the 2027 plan:
     x = 61945.4193 × longitude + 310000.1651
     y = −100188.0  × latitude  + 5191297.2576
   ⚠ CHECK ON SITE before the day: stand at a few known spots
   (pay gate, a field gate) and make sure the blue dot is right. */
const GEO = { x: [61945.4193, 0, 310000.1651], y: [0, -100188.0, 5191297.2576] };
const SITE_CENTRE = { lat: 51.807, lon: -4.9966 };
const PIXELS_PER_METRE = 0.9; // roughly, at this latitude – used for the accuracy circle

function gpsToMap(lat, lon) {
  return {
    x: GEO.x[0] * lon + GEO.x[1] * lat + GEO.x[2],
    y: GEO.y[0] * lon + GEO.y[1] * lat + GEO.y[2]
  };
}

// Straight-line distance in km between two GPS points (good enough for "you're 3 km away")
function kmBetween(lat1, lon1, lat2, lon2) {
  const kmPerDegLat = 111.2;
  const kmPerDegLon = 111.2 * Math.cos((lat1 + lat2) / 2 * Math.PI / 180);
  return Math.hypot((lat1 - lat2) * kmPerDegLat, (lon1 - lon2) * kmPerDegLon);
}


/* ---------- What time is it on the show day? ----------
   Returns minutes after midnight (e.g. 14:30 → 870) on the show
   day, or null on any other day.

   TESTING before the day: add ?time=14:40 to the address
   (e.g. map.html?time=14:40) to see the app as it would look
   at 14:40 on the day. ?time=off switches it back. */
function toMinutes(text) {
  const [hours, minutes] = text.split(":").map(Number);
  return hours * 60 + minutes;
}

function showDayMinutes() {
  try {
    const test = new URLSearchParams(location.search).get("time");
    if (test === "off") sessionStorage.removeItem("silageday-test-time");
    else if (test && /^\d{1,2}:\d{2}$/.test(test)) sessionStorage.setItem("silageday-test-time", test);
    const saved = sessionStorage.getItem("silageday-test-time");
    if (saved) return toMinutes(saved);
  } catch (e) { /* ignore */ }

  const now = new Date();
  const isShowDay = now.getFullYear() === SHOW_DATE.year &&
                    now.getMonth() + 1 === SHOW_DATE.month &&
                    now.getDate() === SHOW_DATE.day;
  return isShowDay ? now.getHours() * 60 + now.getMinutes() : null;
}

function isTestTime() {
  try { return !!sessionStorage.getItem("silageday-test-time"); } catch (e) { return false; }
}

// "live", "soon" (starts within 30 min), "done" or "later"
function slotStatus(item, nowMins) {
  const start = toMinutes(item.start), end = toMinutes(item.end);
  if (nowMins >= end) return "done";
  if (nowMins >= start) return "live";
  if (start - nowMins <= 30) return "soon";
  return "later";
}
