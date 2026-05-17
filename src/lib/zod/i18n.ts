/**
 * Zod v4 locale wiring — universal entry point.
 *
 * Re-exports the right implementation for the runtime, with hard guarantees:
 *
 *  - **Server** (`*.server`) installs ONE process-global error map at module
 *    load that dispatches per-call to the locale stored in `AsyncLocalStorage`.
 *    Each request calls {@link enterRequestLocale} once during
 *    `getRequestConfig`; the value propagates via `enterWith` to every
 *    descendant async operation (RSC render, server action, fetch handler).
 *    Two concurrent requests with different locales can no longer race
 *    because there is no per-request mutation of shared state.
 *
 *  - **Client** (`*.client`) keeps the original behavior: a `useEffect`
 *    keyed on `useLocale()` calls {@link registerZodLocaleGlobal}, which
 *    mutates a single in-tab variable. Browser tabs only have one active
 *    locale at a time so there is no concurrency to race.
 *
 * This file is the shared surface. Server-only callers (`src/i18n/request.ts`)
 * should import from `./i18n.server` to access `enterRequestLocale` directly;
 * client callers (`ZodLocaleBootstrap.tsx`) should import from `./i18n.client`.
 *
 * Per-field custom keys (`.min(2, { message: "i18n.key" })`) still take
 * priority — Zod's resolution order is `customError > localeError`.
 */
export type ZodLocale = "ar" | "en";
