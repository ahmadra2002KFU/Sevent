/**
 * Server-side Zod v4 locale wiring.
 *
 * Installs ONE process-global error map at module load — a dispatcher that
 * resolves the active locale from a Node `AsyncLocalStorage` instance per
 * call. Each request calls {@link enterRequestLocale} once during
 * `getRequestConfig`; `AsyncLocalStorage.enterWith` propagates the locale to
 * every descendant async operation, so concurrent en/ar requests can no
 * longer race over a shared `z.config()` mutation.
 *
 * Importing this module from a client component would pull in
 * `node:async_hooks` and break the client bundle. Use `./i18n.client` from
 * client code instead — both files share the {@link ZodLocale} type via
 * `./i18n.ts`.
 */
import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import { ar, en } from "zod/v4/locales";
import type * as zErrors from "zod/v4/core";
import type { ZodLocale } from "./i18n";

const FACTORIES: Record<ZodLocale, () => { localeError: zErrors.$ZodErrorMap }> = {
  ar,
  en,
};

// Memoize the resolved error maps so we don't reinstantiate per parse.
const ERROR_MAPS: Record<ZodLocale, zErrors.$ZodErrorMap> = {
  ar: FACTORIES.ar().localeError,
  en: FACTORIES.en().localeError,
};

// Request-scoped store carrying the active locale. Each request calls
// `enterRequestLocale(locale)` once at setup; the value propagates to every
// descendant async operation (RSC render, server action, fetch handler), so
// the global `localeError` dispatcher can read it synchronously at parse-time
// without ever mutating a shared variable.
const localeStorage = new AsyncLocalStorage<ZodLocale>();

// Global Zod error map — installed ONCE on module load. Each call resolves
// the active request's locale and forwards to the matching bundled error
// map. No `z.config()` mutation per request → no concurrent-locale race.
const dispatchingLocaleError: zErrors.$ZodErrorMap = (issue) => {
  const locale = localeStorage.getStore() ?? "en";
  return ERROR_MAPS[locale](issue);
};

z.config({ localeError: dispatchingLocaleError });

/**
 * Sets the active locale for the current async context (and ALL descendant
 * async operations). Call once per request from `getRequestConfig`.
 *
 * Uses `AsyncLocalStorage.enterWith` rather than `run(cb)` because
 * `getRequestConfig` returns a config object — there is no callback for us
 * to wrap. `enterWith` mutates only the current async-frame's context
 * (Node-internal, not shared), so concurrent requests stay isolated.
 */
export function enterRequestLocale(locale: ZodLocale): void {
  localeStorage.enterWith(locale);
}

/**
 * Test-only: returns the currently-active locale, or `undefined` if no
 * request has established one yet. Useful for assertions in unit tests.
 *
 * @internal
 */
export function _peekRequestLocale(): ZodLocale | undefined {
  return localeStorage.getStore();
}
