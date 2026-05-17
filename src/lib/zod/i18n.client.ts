/**
 * Client-side Zod v4 locale wiring.
 *
 * Browsers have no `AsyncLocalStorage` and no request concurrency — a tab
 * always has one active locale. So we keep the original behaviour: install
 * a per-locale bundled error map via Zod's process-global `z.config`. The
 * `ZodLocaleBootstrap` component re-calls this on every locale change, which
 * is safe because there's nothing concurrent to race.
 *
 * IMPORTANT: do NOT import this from server code — server code uses
 * `./i18n.server` which sets up a request-scoped dispatcher and would be
 * overwritten by this client-style global mutation.
 */
import { z } from "zod";
import { ar, en } from "zod/v4/locales";
import type { ZodLocale } from "./i18n";

const FACTORIES = { ar, en } as const;

/**
 * Installs the bundled error map for the given locale on Zod's
 * process-global config. Safe to call multiple times — Zod resolves the
 * latest registered map for subsequent parses.
 */
export function registerZodLocaleGlobal(locale: ZodLocale): void {
  const factory = FACTORIES[locale] ?? FACTORIES.en;
  z.config({ localeError: factory().localeError });
}
