/**
 * Wix Velo page code for hosting the GYS Smart Form in an HTML iFrame element.
 *
 * This is the PARENT side of the bridge implemented in `src/utils/embed.js`.
 * Paste it into the page's code panel in the Wix Editor (Dev Mode / Velo on).
 *
 * Setup in the Wix Editor:
 *   1. Add Elements -> Embed & Social -> Embed a Widget (HTML iFrame).
 *   2. Set its source to the deployed form URL. Optionally append
 *      `?parentOrigin=https://www.yoursite.com` so the form targets your origin.
 *   3. Give the HTML element the ID `html1` (or update HTML_ID below).
 *   4. Recommended: select the HTML element and enable "Auto-resize"/"Expand to
 *      fit content" if shown. To push elements below it, also give the section
 *      that contains it an ID and set SECTION_ID below.
 *
 * Notes:
 *   - Classic Wix Editor: an HTML iFrame "floats" and may not push down the
 *     elements below it. Setting the height of BOTH the iFrame and its section
 *     is the most reliable workaround.
 *   - Wix Studio: prefer a Custom Element over an HTML iFrame if you need the
 *     content to push the page layout reliably; the same messages still apply.
 */

import wixWindowFrontend from "wix-window-frontend";

const HTML_ID = "#html1";
const SECTION_ID = ""; // e.g. "#section1" — leave empty to skip section resizing.
const EMBED_SOURCE = "gys-embed";

// Minimum height so the frame never collapses while the form is loading.
const MIN_HEIGHT = 400;

$w.onReady(() => {
  const htmlEl = $w(HTML_ID);

  htmlEl.onMessage((event) => {
    const data = event.data || {};
    if (data.source !== EMBED_SOURCE) return;

    if (data.type === "resize" && typeof data.height === "number") {
      const height = Math.max(Math.round(data.height), MIN_HEIGHT);
      htmlEl.height = height;
      if (SECTION_ID) {
        $w(SECTION_ID).height = height;
      }
    }

    if (data.type === "scrollToTop") {
      // Scroll the Wix page so the top of the form is in view.
      htmlEl.scrollTo().catch(() => {
        wixWindowFrontend.scrollTo(0, 0);
      });
    }
  });
});
