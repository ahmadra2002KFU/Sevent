// Pure helpers for building the auto-attached context that ships with every
// feedback submission. Keep this file dependency-free + side-effect-free so
// it stays cheap to import on every layout.

export type ClientFeedbackContext = {
  page_url: string | null;
  locale: "en" | "ar" | null;
  viewport_w: number | null;
  viewport_h: number | null;
  user_agent: string | null;
};

export function gatherClientContext(): ClientFeedbackContext {
  // Guard against SSR / build-time imports — `window` and `document` only
  // exist in the browser. The widget itself is "use client" but we still
  // call this defensively.
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      page_url: null,
      locale: null,
      viewport_w: null,
      viewport_h: null,
      user_agent: null,
    };
  }

  const htmlLang = document.documentElement.getAttribute("lang");
  const locale =
    htmlLang === "ar" ? "ar" : htmlLang === "en" ? "en" : null;

  return {
    page_url: window.location.href ?? null,
    locale,
    viewport_w: Math.max(1, Math.round(window.innerWidth)) || null,
    viewport_h: Math.max(1, Math.round(window.innerHeight)) || null,
    user_agent: window.navigator.userAgent?.slice(0, 500) ?? null,
  };
}
