/* install.js — calm Install Tool Dude button (Chrome/Edge one-tap) and a short iOS guide.
   Listens for beforeinstallprompt as soon as this file runs, so the event is not missed. */
(function () {
  var deferred = null;
  var IOS_DISMISS = "td-ios-guide-dismissed";
  var BAR_DISMISS = "td-install-bar-dismissed";

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    render();
  });

  window.addEventListener("appinstalled", function () {
    deferred = null;
    hideAll();
  });

  function isInstalled() {
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
    if (navigator.standalone === true) return true;
    return false;
  }

  function wantsInstall() {
    try { return new URLSearchParams(location.search).has("install"); }
    catch (e) { return /(?:^|[?&])install(?:&|=|$)/.test(location.search || ""); }
  }

  function isIos() {
    var ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
    return false;
  }

  function stored(key) {
    try { return localStorage.getItem(key) === "1"; }
    catch (e) { return false; }
  }

  function store(key) {
    try { localStorage.setItem(key, "1"); }
    catch (e) {}
  }

  function $(id) { return document.getElementById(id); }

  function hideAll() {
    if ($("tdInstall")) $("tdInstall").hidden = true;
    if ($("tdIosGuide")) $("tdIosGuide").hidden = true;
  }

  function shareSvg() {
    return '<svg class="td-share-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
      '<path fill="currentColor" d="M8 1.2l2.8 2.8-.9.9L8.6 3.6V10H7.4V3.6L6.1 4.9l-.9-.9L8 1.2z"/>' +
      '<path fill="currentColor" d="M3.5 6.2h2V7.4h-2v6.2h7v-6.2h-2V6.2h2c.8 0 1.5.7 1.5 1.5v5.9c0 .8-.7 1.5-1.5 1.5h-7c-.8 0-1.5-.7-1.5-1.5V7.7c0-.8.7-1.5 1.5-1.5z"/>' +
      "</svg>";
  }

  function ensureUi() {
    if ($("tdInstallRoot")) return;
    var host = document.createElement("div");
    host.id = "tdInstallRoot";
    host.innerHTML =
      '<div id="tdInstall" class="td-install" hidden>' +
        '<div class="td-install-row">' +
          '<button type="button" id="tdInstallBtn" class="td-install-btn">Install Tool Dude</button>' +
          '<button type="button" id="tdInstallClose" class="td-install-close" aria-label="Close">Close</button>' +
        "</div>" +
        '<p id="tdInstallNote" class="td-install-note" hidden>If you use Chrome or Edge, tap Install Tool Dude when it appears, or use the install icon in the address bar.</p>' +
      "</div>" +
      '<div id="tdIosGuide" class="td-ios-guide" hidden>' +
        '<p class="td-ios-title">Install Tool Dude</p>' +
        "<ol>" +
          "<li>Tap the Share icon " + shareSvg() + "</li>" +
          "<li>Tap Add to Home Screen</li>" +
        "</ol>" +
        '<button type="button" id="tdIosDismiss" class="td-install-close">Close</button>' +
      "</div>";

    var header = document.querySelector("header");
    if (header && header.parentNode) header.parentNode.insertBefore(host, header.nextSibling);
    else if (document.body) document.body.insertBefore(host, document.body.firstChild);

    $("tdInstallBtn").addEventListener("click", onInstallClick);
    $("tdInstallClose").addEventListener("click", function () {
      store(BAR_DISMISS);
      $("tdInstall").hidden = true;
    });
    $("tdIosDismiss").addEventListener("click", function () {
      store(IOS_DISMISS);
      $("tdIosGuide").hidden = true;
    });
  }

  function onInstallClick() {
    if (!deferred || typeof deferred.prompt !== "function") return;
    var ev = deferred;
    deferred = null;
    ev.prompt();
    var choice = ev.userChoice;
    if (choice && typeof choice.then === "function") {
      choice.then(function () { render(); }).catch(function () { render(); });
    } else {
      render();
    }
  }

  function render() {
    if (!document.body) return;
    ensureUi();
    if (isInstalled()) { hideAll(); return; }

    var focus = wantsInstall();
    var bar = $("tdInstall");
    var guide = $("tdIosGuide");
    var btn = $("tdInstallBtn");
    var note = $("tdInstallNote");
    var close = $("tdInstallClose");
    bar.classList.toggle("td-install-focus", focus);
    guide.classList.toggle("td-install-focus", focus);

    if (isIos()) {
      bar.hidden = true;
      guide.hidden = !focus && stored(IOS_DISMISS);
      return;
    }

    guide.hidden = true;
    if (deferred) {
      if (!focus && stored(BAR_DISMISS)) { bar.hidden = true; return; }
      bar.hidden = false;
      btn.hidden = false;
      close.hidden = false;
      note.hidden = true;
      return;
    }
    if (focus) {
      bar.hidden = false;
      btn.hidden = true;
      close.hidden = true;
      note.hidden = false;
      return;
    }
    bar.hidden = true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
