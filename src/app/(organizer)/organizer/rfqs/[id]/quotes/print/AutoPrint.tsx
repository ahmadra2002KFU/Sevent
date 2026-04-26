"use client";

import { useEffect } from "react";

/**
 * Tiny client island: triggers the browser print dialog once after mount.
 * Used by `/organizer/rfqs/[id]/quotes/print` so the page can be opened in a
 * new tab and immediately offer "Save as PDF".
 *
 * Auto-print is gated behind `?auto=1` so the page can be revisited or shared
 * without forcing the print dialog. We also wait for `document.fonts.ready`
 * before printing so Arabic webfonts are loaded before the snapshot.
 */
export function AutoPrint() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auto") !== "1") return;

    let cancelled = false;
    const fontsReady =
      typeof document !== "undefined" && document.fonts?.ready
        ? document.fonts.ready
        : Promise.resolve();

    fontsReady.then(() => {
      if (cancelled) return;
      // Small defer so any pending layout (signed-URL <a>, images) settles.
      window.setTimeout(() => {
        if (!cancelled) window.print();
      }, 100);
    });

    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
