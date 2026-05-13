/**
 * Shared brand tokens for transactional email templates.
 *
 * Sourced from src/app/globals.css (the live app brand). Every value here
 * is a verbatim hex from the @theme block so email visuals match the
 * product surface. Templates import `BRAND.colors.<token>` and never
 * hard-code hex.
 *
 * If any of the placeholder values below are updated (postal address,
 * support email, logo URL), grep for the constant name to find every
 * template that needs reflowing.
 */

export const BRAND = {
  // Domain / URLs
  apex: "seventsa.com",
  marketingUrl: "https://seventsa.com",
  privacyUrl: "https://seventsa.com/privacy",
  termsUrl: "https://seventsa.com/terms",

  // Contact
  supportEmail: "support@seventsa.com",
  // TODO: replace with the CR-registered Riyadh address before going live.
  postalAddress: {
    en: "Sevent — Riyadh, Kingdom of Saudi Arabia",
    ar: "سيڤنت — الرياض، المملكة العربية السعودية",
  },

  // Visual identity — mirrors globals.css :theme block.
  colors: {
    // Primary brand (cobalt + navy)
    cobalt: "#1e7bd8",
    cobaltSoft: "#dcebfb",
    navy: "#0f2e5c",
    navyMid: "#1c3f73",

    // Accent — use sparingly (eyebrow label, gold deadline highlights).
    gold: "#c8993a",
    goldSoft: "#f6ebce",

    // Neutrals
    bg: "#fafaf7",
    card: "#ffffff",
    fg: "#1a1a18",
    muted: "#6b6b64",
    mutedSoft: "#a9a9a1",
    border: "#e7e6df",
    borderSoft: "#f4f4ef",

    // Semantic
    success: "#1e9a5b",
    successSoft: "#d8f1e3",
    warning: "#d89423",
    warningSoft: "#faebd3",
    danger: "#c4353c",
    dangerSoft: "#f6d7d9",
  },

  // Logo — Next.js serves public/logo.png at this absolute URL once the
  // marketing site is live. Until then, the preview script post-processes
  // rendered HTML to rewrite this to `./logo.png` so previews render the
  // real mark locally.
  logoUrl: "https://seventsa.com/logo.png",

  // Font stacks. Custom faces don't load reliably across email clients
  // (Outlook strips webfont <link>). The brand name leads; the cascade
  // falls through to system faces that read well in each script.
  fonts: {
    en: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    ar: "'Almarai', 'Segoe UI', Tahoma, Arial, sans-serif",
  },

  // Layout tokens shared across templates.
  layout: {
    cardMaxWidth: 600,
    cardRadius: 12,
    cardPadding: 40,
    bodyPaddingY: 32,
    buttonRadius: 8,
  },
} as const;

/** Brand name in each locale — Arabic spelling per `Claude Docs/email-templates/architecture.md`. */
export const BRAND_NAME = {
  en: "Sevent",
  ar: "سيڤنت",
} as const;
