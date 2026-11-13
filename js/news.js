/* =========================================================
   News and urgent alerts
   ---------------------------------------------------------
   Posts live in Firebase, in the "news" collection. Organisers
   write them in the Team hub app (silage-day-team, news.html) –
   and later from the
   organiser app, which will use exactly the same fields:

     titleEn, titleCy   the headline in English and Welsh
     bodyEn,  bodyCy    the text (plain text, new lines kept)
     urgent             true = pops up as a banner on every page
     publishAt          when it appears (can be in the future)
     hideAt             when it disappears (or null = never)
     createdAt, updatedAt, author
     images             up to 4 photo ids – each photo is its own
                        document in "newsImages" ({ data: "data:image/…" }),
                        fetched only when the post is shown
     youtube            a YouTube video id (shown as a picture until tapped)

   This file:
   • shows URGENT posts as a banner at the top of every page
     (each visitor can close it; it stays closed for them)
   • fills "Latest news" on the home page
   • fills the full list on news.html
   Scheduled posts appear by themselves when their time comes,
   even if the page is already open. The last news seen is kept
   on the phone, so it shows instantly and with no signal.
   ========================================================= */

(function () {
  const CACHE_KEY = "silageday-news";
  const DISMISSED_KEY = "silageday-news-dismissed";
  const URGENT_FOR_HOURS = 12;   // an urgent banner only shows for this long after it's published
  const latestEl = document.getElementById("latest-news");
  const listEl = document.getElementById("news-list");
  const onNewsPage = !!listEl;

  let posts = loadCache();       // [{ id, titleEn, titleCy, bodyEn, bodyCy, urgent, publishAt (ms), hideAt (ms|null), images, youtube }]
  const imageData = {};          // photo id → picture, once fetched

  function loadCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "[]"); } catch (e) { return []; }
  }
  function saveCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(posts)); } catch (e) {}
  }
  function dismissed() {
    try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"); } catch (e) { return []; }
  }
  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  // Words in the visitor's language, falling back to the other one
  function pick(post, field) {
    const cy = post[field + "Cy"], en = post[field + "En"];
    return (currentLang === "en" ? (en || cy) : (cy || en)) || "";
  }
  function paragraphs(text) {
    return esc(text).split(/\n{2,}/).map((p) => "<p>" + p.replace(/\n/g, "<br>") + "</p>").join("");
  }
  function when(ms) {
    const d = new Date(ms);
    return d.toLocaleDateString(currentLang === "en" ? "en-GB" : "cy-GB", { day: "numeric", month: "long", year: "numeric" }) +
      ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  // Published, not yet hidden – newest first
  function visible() {
    const now = Date.now();
    return posts
      .filter((p) => p.publishAt <= now && (!p.hideAt || p.hideAt > now))
      .sort((a, b) => b.publishAt - a.publishAt);
  }

  /* ---------- Drawing ---------- */
  // Only redraw the posts when something changed – so a video someone
  // is watching isn't interrupted by the 30-second check
  let lastDrawn = "";
  function render() {
    renderBanner();
    const key = currentLang + "|" + JSON.stringify(visible());
    if (key === lastDrawn) return;
    lastDrawn = key;
    if (latestEl) renderLatest();
    if (listEl) renderList();
  }

  // compact = the home page: just the first photo, no video
  function postHtml(p, headingTag, compact) {
    const imgs = (p.images || []).slice(0, compact ? 1 : 4);
    return '<article class="news-item' + (p.urgent ? " urgent" : "") + '">' +
      (p.urgent ? '<span class="news-urgent-tag">' + t("news_urgent") + '</span>' : '') +
      '<' + headingTag + ' class="news-title">' + esc(pick(p, "title")) + '</' + headingTag + '>' +
      '<p class="news-when">' + when(p.publishAt) + '</p>' +
      (imgs.length ? '<div class="news-photos' + (compact ? ' compact' : imgs.length > 1 ? ' grid' : '') + '">' +
        imgs.map((id) => '<img class="news-photo" data-img="' + esc(id) + '" alt="' + esc(pick(p, "title")) + '"' +
          (imageData[id] ? ' src="' + imageData[id] + '"' : '') + '>').join("") + '</div>' : '') +
      '<div class="news-body">' + paragraphs(pick(p, "body")) + '</div>' +
      (!compact && p.youtube ? '<figure class="video-item news-video"><button type="button" class="yt-start" data-yt="' + esc(p.youtube) + '" aria-label="' + esc(t("news_play")) + '">' +
        '<img src="https://i.ytimg.com/vi/' + esc(p.youtube) + '/hqdefault.jpg" alt="" loading="lazy"><span class="play" aria-hidden="true">▶</span></button></figure>' : '') +
    '</article>';
  }

  // Fetch the photos for the posts on screen (each one once), and start videos when tapped
  function hydrate(root) {
    if (!root) return;
    root.querySelectorAll("img[data-img]:not([src])").forEach((img) => {
      const id = img.dataset.img;
      if (imageData[id]) { img.src = imageData[id]; return; }
      if (!firebaseConfigured()) return;
      getFirebase().then(({ F, db }) => F.getDoc(F.doc(db, "newsImages", id))).then((snap) => {
        if (!snap.exists()) { img.remove(); return; }
        imageData[id] = snap.data().data;
        document.querySelectorAll('img[data-img="' + id + '"]').forEach((el) => el.src = imageData[id]);
      }).catch(() => {});
    });
    root.querySelectorAll("[data-yt]").forEach((b) => b.addEventListener("click", () => {
      const f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + b.dataset.yt + "?autoplay=1&rel=0";
      f.title = t("news_play");
      f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      f.allowFullscreen = true;
      b.replaceWith(f);
    }));
  }

  function renderLatest() {
    const list = visible().slice(0, 3);
    latestEl.innerHTML = '<h2>' + t("news_latest_h") + '</h2>' +
      (list.length ? list.map((p) => postHtml(p, "h3", true)).join("") : '<p class="muted">' + t("news_none") + '</p>') +
      '<a class="btn alt" href="news.html">' + t("news_all") + ' →</a>';
    hydrate(latestEl);
  }

  function renderList() {
    const list = visible();
    listEl.innerHTML = list.length ? list.map((p) => '<section class="card">' + postHtml(p, "h2") + '</section>').join("")
      : '<section class="card"><p>' + t("news_none") + '</p></section>';
    hydrate(listEl);
  }

  function renderBanner() {
    const old = document.getElementById("news-banner");
    if (old) old.remove();
    if (document.documentElement.classList.contains("gated")) return; // not over the welcome / safety screens
    const gone = dismissed();
    const now = Date.now();
    const alert = visible().find((p) => p.urgent && !gone.includes(p.id) && now - p.publishAt < URGENT_FOR_HOURS * 3600e3);
    if (!alert) return;
    const header = document.querySelector(".site-header");
    if (!header) return;
    const banner = document.createElement("div");
    banner.id = "news-banner";
    banner.className = "news-banner";
    banner.setAttribute("role", "alert");
    banner.innerHTML =
      '<div class="news-banner-text"><b>⚠ ' + esc(pick(alert, "title")) + '</b>' +
      (pick(alert, "body") ? '<span>' + esc(pick(alert, "body")).replace(/\n/g, " ") + '</span>' : '') + '</div>' +
      '<button type="button" class="news-banner-close" aria-label="' + esc(t("news_dismiss")) + '">✕</button>';
    banner.querySelector("button").addEventListener("click", () => {
      try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(gone.concat(alert.id).slice(-50))); } catch (e) {}
      banner.remove();
    });
    header.insertAdjacentElement("afterend", banner);
  }

  /* ---------- Listening for news ---------- */
  function toMs(v) { return v && typeof v.toMillis === "function" ? v.toMillis() : (typeof v === "number" ? v : null); }

  function listen() {
    if (!firebaseConfigured()) return;
    getFirebase().then(({ F, db }) => {
      // Newest first. Includes scheduled posts so they appear on time without reloading.
      const q = F.query(F.collection(db, "news"), F.orderBy("publishAt", "desc"), F.limit(onNewsPage ? 40 : 8));
      F.onSnapshot(q, (snap) => {
        posts = snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id, titleEn: x.titleEn || "", titleCy: x.titleCy || "", bodyEn: x.bodyEn || "", bodyCy: x.bodyCy || "",
            urgent: !!x.urgent, publishAt: toMs(x.publishAt) || 0, hideAt: toMs(x.hideAt),
            images: Array.isArray(x.images) ? x.images.slice(0, 4) : [],
            youtube: typeof x.youtube === "string" && /^[\w-]{6,20}$/.test(x.youtube) ? x.youtube : ""
          };
        });
        saveCache();
        render();
      }, () => { /* no signal – keep showing the saved news */ });
    }).catch(() => {});
  }

  render();
  // Re-check every 30 seconds so scheduled posts appear (and old ones go) on time
  setInterval(render, 30 * 1000);
  document.addEventListener("languagechange", render);
  // Show the banner once the welcome / safety screens are done
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  // Start listening a moment after the page has loaded, so it never slows the page down
  if (document.readyState === "complete") setTimeout(listen, 300);
  else window.addEventListener("load", () => setTimeout(listen, 300));
})();
