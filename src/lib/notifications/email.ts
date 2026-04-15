/**
 * Transactional email wrapper around Resend.
 *
 * Lane 3 (Sprint 2) — Sevent.
 *
 * Behaviour:
 *  - If `RESEND_API_KEY` is unset (typical in local dev), the email is rendered
 *    to HTML and dumped to the console; the function resolves successfully so
 *    callers can flow through the happy path without a real Resend account.
 *  - If `RESEND_API_KEY` is set we delegate to Resend. Any failure is caught
 *    and returned as `{ ok: false, error }` — callers MUST NOT roll back DB
 *    writes on email failure (per Sprint 2 lane 3 contract).
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

const DEFAULT_FROM = "Sevent <no-reply@sevent.local>";

function isLocalAppUrl(): boolean {
  const url = env?.APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  try {
    const u = new URL(url);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return true;
  }
}

function resolveFrom(): string {
  return env?.RESEND_FROM_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = env?.RESEND_API_KEY ?? process.env.RESEND_API_KEY;

  // Render once so both branches share the same payload.
  let html: string;
  try {
    html = await render(params.react);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[notifications/email] render failed", { to: params.to, message });
    return { ok: false, error: `render failed: ${message}` };
  }

  // SMTP-less fallback: log to console so local dev (Inbucket-less) still
  // shows the rendered email contents in `pnpm dev` output.
  if (!apiKey || (isLocalAppUrl() && !apiKey)) {
    console.info("[notifications/email] (console-mode)", {
      to: params.to,
      subject: params.subject,
      from: resolveFrom(),
      htmlPreview: html.slice(0, 600),
    });
    return { ok: true, id: null, mode: "console" };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: resolveFrom(),
      to: params.to,
      subject: params.subject,
      html,
      ...(params.text ? { text: params.text } : {}),
    });
    if (error) {
      console.error("[notifications/email] resend api error", { to: params.to, error });
      return { ok: false, error: error.message ?? String(error) };
    }
    return { ok: true, id: data?.id ?? null, mode: "resend" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[notifications/email] resend threw", { to: params.to, message });
    return { ok: false, error: message };
  }
}
