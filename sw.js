/* =========================================================
   Offline helper ("service worker")
   ---------------------------------------------------------
   Keeps a copy of the app's pages, styles, scripts and pictures
   on the phone, so the app – and especially the TICKETS – still
   opens if there's no signal at the gate.

   • Pages: always try the internet first (so changes show up
     straight away), and use the saved copy only when offline.
   • Styles, scripts and pictures: use the saved copy if there is
     one (they're versioned with ?v=…, so a change makes a new
     copy), otherwise fetch and save.
   • Anything from other websites (Firebase, YouTube) and videos
     are left alone.

   If you add a new page, add it to PAGES below.
   ========================================================= */

const CACHE = "silageday-v4";
const PAGES = [
  "./", "index.html", "tickets.html", "timetable.html", "safety.html",
  "map.html", "photos.html", "getting-here.html", "news.html", "raffle.html", "sponsors.html",
  "images/logo.png", "images/site-map.svg", "images/icon-192.png", "manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PAGES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.includes("/videos/")) return;

  if (req.mode === "navigate") {
    // Pages: internet first, saved copy if offline
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true })
          .then((hit) => hit || caches.match("index.html")))
    );
    return;
  }

  // Styles, scripts, pictures: saved copy first
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
      }
      return res;
    }))
  );
});
