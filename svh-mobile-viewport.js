/**
 * SVH Mobile Viewport Override for Framer
 * Site-wide fix for small viewport height (SVH) on mobile devices.
 * Handles Safari (native SVH) vs Chromium (JavaScript fallback) differently.
 * Desktop: no-op. Mobile only.
 */
(function () {
  "use strict";

  function isMobile() {
    if (typeof window === "undefined") return false;
    return (
      window.innerWidth < 768 ||
      ("ontouchstart" in window && window.innerWidth < 1024) ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      )
    );
  }

  function isChromium() {
    const ua = navigator.userAgent;
    return /CriOS|FxiOS|Edg|Chromium|Chrome/i.test(ua);
  }

  function isSafari() {
    if (isChromium()) return false;
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isMacSafari =
      navigator.vendor === "Apple Computer, Inc." && ua.includes("Safari");
    return isIOS || isMacSafari;
  }

  if (!isMobile()) return;

  const isSafariBrowser = isSafari();
  const isChromiumBrowser = isChromium();

  if (isSafariBrowser) {
    const style = document.createElement("style");
    style.textContent = `
      @supports (height: 100svh) {
        html, body, body.framer-body, [data-framer-page] {
          min-height: 100svh !important;
          height: auto !important;
        }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
    return;
  }

  if (isChromiumBrowser) {
    function setSvhFallback() {
      const h =
        (window.visualViewport && window.visualViewport.height) ||
        window.innerHeight;
      document.documentElement.style.setProperty(
        "--svh-fallback",
        Math.round(h) + "px"
      );
    }

    setSvhFallback();

    window.addEventListener("resize", setSvhFallback);
    window.addEventListener("orientationchange", function () {
      setTimeout(setSvhFallback, 100);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", setSvhFallback);
    }

    const style = document.createElement("style");
    style.textContent = `
      html, body, body.framer-body, [data-framer-page] {
        min-height: var(--svh-fallback, 100vh) !important;
        height: auto !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }
})();
