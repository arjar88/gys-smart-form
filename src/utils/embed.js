/**
 * Bridge for running this form inside an iframe (e.g. embedded in Wix).
 *
 * The form lives in a sandboxed iframe and cannot resize the iframe or scroll
 * the host page on its own. Instead it posts messages to the parent window, and
 * the host page (Wix Velo page code) listens and performs the resize/scroll.
 *
 * All messages share the same shape so the host can filter reliably:
 *   { source: "gys-embed", type: "resize", height: <number> }
 *   { source: "gys-embed", type: "scrollToTop" }
 */

export const EMBED_SOURCE = "gys-embed";

let resizeObserver = null;
let mutationObserver = null;
let rafId = 0;
let lastSentHeight = 0;

/**
 * Enable verbose console logging by adding `?embedDebug=1` to the form URL or
 * setting `window.GYS_EMBED_DEBUG = true`. Useful for diagnosing the Wix bridge
 * from the live site without shipping noisy logs to everyone.
 */
function isDebug() {
  if (window.GYS_EMBED_DEBUG) return true;
  try {
    return new URLSearchParams(window.location.search).get("embedDebug") === "1";
  } catch {
    return false;
  }
}

function debugLog(...args) {
  if (isDebug()) console.log("[gys-embed]", ...args);
}

function isEmbedded() {
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin access throws, which itself means we're embedded.
    return true;
  }
}

/**
 * The parent origin to target with postMessage. Using a specific origin is more
 * secure than "*". Configure it via a global or a `?parentOrigin=` query param,
 * e.g. set `window.GYS_EMBED_PARENT_ORIGIN = "https://www.yoursite.com"`.
 */
function getParentOrigin() {
  if (typeof window.GYS_EMBED_PARENT_ORIGIN === "string") {
    return window.GYS_EMBED_PARENT_ORIGIN;
  }
  try {
    const fromQuery = new URLSearchParams(window.location.search).get(
      "parentOrigin"
    );
    if (fromQuery) return fromQuery;
  } catch {
    /* ignore */
  }
  return "*";
}

function postToParent(message) {
  if (!isEmbedded()) return;
  const payload = { source: EMBED_SOURCE, ...message };
  debugLog("postMessage ->", getParentOrigin(), payload);
  window.parent.postMessage(payload, getParentOrigin());
}

/**
 * Measure the true content height, independent of any min-height the iframe
 * imposes. We sum the in-flow children of #root (skipping fixed/absolute
 * overlays like modals) and use their lowest bottom edge.
 */
function measureContentHeight() {
  const root = document.getElementById("root");
  let height = 0;

  if (root) {
    for (const child of root.children) {
      const style = window.getComputedStyle(child);
      if (style.position === "fixed" || style.position === "absolute") continue;
      const bottom = child.getBoundingClientRect().bottom;
      if (bottom > height) height = bottom;
    }
  }

  if (!height) {
    height = document.documentElement.scrollHeight;
  }

  return Math.ceil(height);
}

/** Measure and report the current content height (only when it changed). */
export function reportHeight() {
  if (!isEmbedded()) return;
  const height = measureContentHeight();
  if (height > 0 && height !== lastSentHeight) {
    lastSentHeight = height;
    postToParent({ type: "resize", height });
  }
}

function scheduleReport() {
  if (rafId) return;
  rafId = window.requestAnimationFrame(() => {
    rafId = 0;
    reportHeight();
  });
}

/** Ask the host page to scroll to the top of the embedded frame. */
export function scrollParentToTop() {
  postToParent({ type: "scrollToTop" });
}

/**
 * Start watching for content-size changes and reporting them to the host.
 * Returns a cleanup function. No-op (other than cleanup) when not embedded.
 */
export function initEmbedBridge() {
  if (!isEmbedded()) {
    debugLog("not embedded (top-level window); bridge inactive");
    return () => {};
  }

  debugLog("bridge active; parent origin =", getParentOrigin());
  scheduleReport();

  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(scheduleReport);
    resizeObserver.observe(document.documentElement);
  }

  const root = document.getElementById("root");
  if (root && typeof MutationObserver !== "undefined") {
    mutationObserver = new MutationObserver(scheduleReport);
    mutationObserver.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  }

  window.addEventListener("resize", scheduleReport);
  window.addEventListener("load", scheduleReport);
  // Re-measure once web fonts settle, since they change layout height.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scheduleReport).catch(() => {});
  }

  return () => {
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();
    resizeObserver = null;
    mutationObserver = null;
    window.removeEventListener("resize", scheduleReport);
    window.removeEventListener("load", scheduleReport);
  };
}
