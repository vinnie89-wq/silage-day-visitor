/* =========================================================
   Videos on the Photos page
   ---------------------------------------------------------
   Visitors share their videos on social media with the
   hashtag below. Organisers pick the best and add them here.

   TO ADD A YOUTUBE VIDEO:
     1. Open it on YouTube and press Share. The link looks like
        https://youtu.be/AbCdEfGhIjK  – the bit after the last /
        (AbCdEfGhIjK) is the video's ID.
     2. Add a line to VIDEOS below, e.g.
        { youtube: "AbCdEfGhIjK", title: { en: "Highlights 2027", cy: "Uchafbwyntiau 2027" } },

   TO ADD A VIDEO FILE kept in the videos/ folder (keep these
   short and small – under about 10 MB – as visitors may be on
   phone data):
        { file: "videos/my-clip.mp4", poster: "videos/my-clip.jpg", title: { en: "…", cy: "…" } },

   The newest goes at the top.
   ========================================================= */

const HASHTAG = "#SilageDay2027";

// Your social media pages – leave a link as "" to hide its button
const SOCIAL_LINKS = {
  facebook: "",
  instagram: "",
  tiktok: "",
  youtube: ""
};

const VIDEOS = [
  { file: "videos/save-the-date-2027.mp4", poster: "videos/save-the-date-2027-poster.jpg",
    title: { en: "Save the date – 11 September 2027", cy: "Cadwch y dyddiad – 11 Medi 2027" } }
];


/* ---------- Showing them (no need to change below here) ---------- */
(function () {
  const list = document.getElementById("video-list");
  const tagBox = document.getElementById("hashtag");
  const copyBtn = document.getElementById("hashtag-copy");
  const socialEl = document.getElementById("social-links");
  if (!list) return;

  tagBox.textContent = HASHTAG;
  copyBtn.addEventListener("click", function () {
    const done = function () {
      copyBtn.textContent = t("videos_copied");
      setTimeout(function () { copyBtn.textContent = t("videos_copy"); }, 2000);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(HASHTAG).then(done, function () {});
  });

  const names = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" };
  socialEl.innerHTML = Object.keys(SOCIAL_LINKS).filter(function (k) { return SOCIAL_LINKS[k]; })
    .map(function (k) { return '<a class="chip" href="' + SOCIAL_LINKS[k] + '" target="_blank" rel="noopener">' + names[k] + '</a>'; }).join("");
  socialEl.hidden = !socialEl.innerHTML;

  function title(v) { return (v.title && (v.title[currentLang] || v.title.en)) || ""; }

  function render() {
    list.innerHTML = "";
    VIDEOS.forEach(function (v) {
      const item = document.createElement("figure");
      item.className = "video-item";
      if (v.file) {
        // preload="none": nothing downloads until the visitor presses play
        item.innerHTML = '<video controls playsinline preload="none"' + (v.poster ? ' poster="' + v.poster + '"' : '') + ' src="' + v.file + '"></video>';
      } else if (v.youtube) {
        // Only a picture until tapped – YouTube itself loads (and uses data) only when they choose to watch
        const b = document.createElement("button");
        b.type = "button";
        b.className = "yt-start";
        b.setAttribute("aria-label", t("videos_play") + ": " + title(v));
        b.innerHTML = '<img src="https://i.ytimg.com/vi/' + v.youtube + '/hqdefault.jpg" alt="" loading="lazy"><span class="play" aria-hidden="true">▶</span>';
        b.addEventListener("click", function () {
          const f = document.createElement("iframe");
          f.src = "https://www.youtube-nocookie.com/embed/" + v.youtube + "?autoplay=1&rel=0";
          f.title = title(v);
          f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
          f.allowFullscreen = true;
          b.replaceWith(f);
        });
        item.appendChild(b);
      }
      const cap = document.createElement("figcaption");
      cap.textContent = title(v);
      item.appendChild(cap);
      list.appendChild(item);
    });
  }
  render();
  document.addEventListener("languagechange", function () {
    render();
    copyBtn.textContent = t("videos_copy");
  });
})();
