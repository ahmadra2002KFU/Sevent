/**
 * Transactional email wrapper around Resend.
 *
 * Behaviour summary (Phase 0 hardening of the original lane-3 contract):
 *
 *  - In `development`, when `RESEND_API_KEY` is unset, the email is rendered
 *    to HTML and a one-line summary is logged to stdout. No recipient address,
 *    no HTML preview — both used to leak to staging/preview logs.
 *  - In every other NODE_ENV, a missing key is a HARD failure. We refuse to
 *    return `{ ok: true }` while no mail leaves; dashboards stay honest.
 *  - `RESEND_DEV_REDIRECT_TO` rewrites every `to:` to that address before the
 *    send. Lets a developer point at a real Resend key without spamming pilot
 *    users.
 *  - Resend SDK errors are returned as `{ ok: false, error }`. Callers MUST
 *    NOT roll back DB writes on email failure (per Sprint 2 lane 3 contract).
 *  - All config reads go through the Zod-validated `env`. If `env` is `null`
 *    (any required var is missing or malformed), we refuse to send so the
 *    fault surfaces immediately instead of silently bypassing validation.
 */

import { render } from "@react-email/render";
import { Resend } from "resend";
import { env } from "@/lib/env";
import type { ReactElement } from "react";

export type SendEmailParams = {
  to: string;
  subject: string;
  react: ReactElement;
  /** Optional plain-text fallback. If omitted, Resend derives one from HTML. */
  text?: string;
};

export type SendEmailResult =
  | { ok: true; id: string | null; mode: "resend" | "console" }
  | { ok: false; error: string };

const DEFAULT_FROM = "Sevent <notifications@seventsa.com>";

function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

function resolveFrom(): string {
  return env?.RESEND_FROM_EMAIL ?? DEFAULT_FROM;
}

function redactEmail(addr: string): string {
  const at = addr.indexOf("@");
  return at >= 0 ? `***@${addr.slice(at + 1)}` : "***";
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  // Validated env only. A null `env` means Zod rejected something — refuse to
  // send rather than fall through to raw process.env (which would silently
  // bypass validation).
  if (!env) {
    console.error("[notifications/email] env validation failed; refusing to send");
    return { ok: false, error: "env validation failed" };
  }

  const apiKey = env.RESEND_API_KEY;
  const devRedirect = env.RESEND_DEV_REDIRECT_TO;

  // Render first so both branches share the same payload.
  let html: string;
  try {
    html = await render(params.react);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[notifications/email] render failed", {
      to: isDev() ? params.to : redactEmail(params.to),
      message,
    });
    return { ok: false, error: `render failed: ${message}` };
  }

  // Console-mode fallback is ONLY for development. Production with a missing
  // key must hard-fail so dashboards reflect reality.
  if (!apiKey) {
    if (!isDev()) {
      console.error(
        "[notifications/email] RESEND_API_KEY missing in non-development env; refusing to send",
      );
      return {
        ok: false,
        error: "RESEND_API_KEY is required outside development",
      };
    }
    console.info("[notifications/email] (console-mode)", {
      to: params.to,
      subject: params.subject,
      from: resolveFrom(),
      htmlBytes: html.length,
    });
    return { ok: true, id: null, mode: "console" };
  }

  // Apply the dev-redirect AFTER the apiKey check so we never burn a real send
  // when there's no key. When set, every `to:` becomes this address; the
  // caller-supplied `to:` is preserved in the subject as a debug hint.
  const actualTo = devRedirect ?? params.to;
  const subject = devRedirect
    ? `[dev:${params.to}] ${params.subject}`
    : params.subject;

  const resend = new Resend(apiKey);
  try {
    // Resend SDK contract: returns `{ data, error }` for API errors (4xx/5xx)
    // and DOES NOT throw — so check `error` explicitly. Network-level errors
    // (DNS / ECONNRESET) DO throw, which is why the try/catch stays.
    const { data, error } = await resend.emails.send({
      from: resolveFrom(),
      to: actualTo,
      subject,
      html,
      ...(params.text ? { text: params.text } : {}),
    });
    if (error) {
      console.error("[notifications/email] resend api error", {
        to: isDev() ? actualTo : redactEmail(actualTo),
        error: error.message ?? String(error),
      });
      return { ok: false, error: error.message ?? String(error) };
    }
    return { ok: true, id: data?.id ?? null, mode: "resend" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[notifications/email] resend threw", {
      to: isDev() ? actualTo : redactEmail(actualTo),
      message,
    });
    return { ok: false, error: message };
  }
}
