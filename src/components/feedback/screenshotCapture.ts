// Lazy-loaded viewport capture helper.
//
// html2canvas is ~50 KB gzipped — we dynamic-import it on first call so the
// bundle hit only lands when the user actually submits with the "include
// screenshot" checkbox ticked. Returns null on any failure (offline, dialog
// quirk, oversized DOM) so the action can proceed without a screenshot
// rather than blocking submission.
//
// Output: JPEG blob, max 1600px wide, quality 0.75. That keeps a typical
// laptop viewport under ~250 KB and well within the 3 MB bucket cap.

const MAX_WIDTH = 1600;
const JPEG_QUALITY = 0.75;

export async function captureViewportScreenshot(): Promise<Blob | null> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  try {
    // Dynamic import — keeps html2canvas out of the layout bundle.
    const mod = await import("html2canvas");
    const html2canvas = mod.default;

    const canvas = await html2canvas(document.body, {
      logging: false,
      useCORS: true,
      backgroundColor: "#ffffff",
      // Skip Radix portals + anything we mark as non-capturable. The feedback
      // dialog itself is rendered inside a Radix portal so this elides the
      // backdrop overlay + dialog content from the capture, leaving the
      // page underneath.
      ignoreElements: (el: Element) => {
        if (el.hasAttribute?.("data-feedback-skip-capture")) return true;
        if (el.getAttribute?.("role") === "dialog") return true;
        if (el.getAttribute?.("data-slot") === "dialog-overlay") return true;
        if (el.hasAttribute?.("data-radix-popper-content-wrapper")) return true;
        return false;
      },
      // Cap rendering DPI at 2× — 3× retina on a long page can OOM the
      // canvas. JPEG compression below absorbs most of the quality cost.
      scale: Math.min(window.devicePixelRatio || 1, 2),
    });

    // Downscale to MAX_WIDTH if needed. Avoids shipping 3000-px-wide PNGs
    // for organizers on 4K external monitors.
    let out: HTMLCanvasElement = canvas;
    if (canvas.width > MAX_WIDTH) {
      const scale = MAX_WIDTH / canvas.width;
      out = document.createElement("canvas");
      out.width = Math.round(canvas.width * scale);
      out.height = Math.round(canvas.height * scale);
      const ctx = out.getContext("2d");
      if (!ctx) return null;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(canvas, 0, 0, out.width, out.height);
    }

    return await new Promise<Blob | null>((resolve) => {
      out.toBlob((blob) => resolve(blob), "image/jpeg", JPEG_QUALITY);
    });
  } catch {
    return null;
  }
}
