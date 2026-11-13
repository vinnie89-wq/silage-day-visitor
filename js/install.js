/* =========================================================
   "Add to your Home Screen" tip (home page)
   ---------------------------------------------------------
   Opened from a Home Screen icon, the app runs full-screen –
   no web address bar – like a normal app.

   • Android (Chrome, Edge, Samsung): a one-tap Install button,
     using the browser's own install prompt.
   • iPhone / iPad: there's no install button, so it
     shows the two steps (Share → Add to Home Screen).
   • Not shown if it's already installed, or once the visitor
     has closed it.
   The app's name, icon and colours are in manifest.webmanifest.
   ========================================================= */

(function () {
  const KEY = "silageday-install-tip-closed";
  const spot = document.getElementById("install-tip");
  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (!spot || standalone) return;
  try { if (localStorage.getItem(KEY)) return; } catch (e) { return; }

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  let deferredPrompt = null;

  function close() {
    try { localStorage.setItem(KEY, "1"); } catch (e) {}
    spot.hidden = true;
    spot.innerHTML = "";
  }

  function show(mode) {
    spot.hidden = false;
    spot.innerHTML =
      '<button type="button" class="install-close" data-i18n-attr="aria-label:inst_close" aria-label="' + t("inst_close") + '">✕</button>' +
      '<img src="images/icon-192.png" alt="" width="56" height="56">' +
      '<div><h2 data-i18n="inst_h">' + t("inst_h") + '</h2>' +
      '<p data-i18n="inst_why">' + t("inst_why") + '</p>' +
      (mode === "prompt"
        ? '<button type="button" class="btn" id="install-btn" data-i18n="inst_btn">' + t("inst_btn") + '</button>'
        : '<p class="install-steps" data-i18n="inst_ios">' + t("inst_ios") + '</p>') +
      '</div>';
    spot.querySelector(".install-close").addEventListener("click", close);
    const btn = document.getElementById("install-btn");
    if (btn) btn.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (choice.outcome === "accepted") close();
    });
  }

  // Android & desktop Chrome/Edge tell us when installing is possible
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    show("prompt");
  });
  window.addEventListener("appinstalled", close);

  if (isIOS) show("ios"); // Safari, and Chrome/Edge on iOS 16.4+, all use Share → Add to Home Screen
})();
