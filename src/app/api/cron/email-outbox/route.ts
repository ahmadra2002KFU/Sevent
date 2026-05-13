/**
 * Cron-driven email outbox drain.
 *
 *   POST /api/cron/email-outbox
 *   GET  /api/cron/email-outbox   (alias — some schedulers only emit GET)
 *
 * Pulls a batch of pending `public.email_outbox` rows and tries to send them
 * via Resend. Concrete behaviour lives in `drainEmailOutbox`
 * (src/lib/notifications/worker.ts). This handler is the thin HTTP wrapper
 * with auth + JSON-shaping.
 *
 * Auth model:
 *
 *   - When CRON_SECRET is configured, the caller MUST send a matching
 *     `x-cron-secret` header. Missing or wrong value → 401.
 *   - When CRON_SECRET is NOT configured, the route still answers (so local
 *     dev `curl` works against `supabase start`), but logs a warning so it's
 *     obvious in deployed environments. The expectation is that production
 *     always sets CRON_SECRET.
 *
 * This is a service-role action — we never see a user token here. The drain
 * worker is the only thing reading/writing email_outbox.
 */

import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { drainEmailOutbox } from "@/lib/notifications/worker";

export const dynamic = "force-dynamic";

const HEADER_NAME = "x-cron-secret";

function authorize(req: NextRequest): { ok: true } | { ok: false; status: number } {
  const expected = process.env.CRON_SECRET ?? "";
  const provided = req.headers.get(HEADER_NAME) ?? "";
  if (!expected) {
    console.warn(
      "[cron/email-outbox] CRON_SECRET not configured; allowing request",
    );
    return { ok: true };
  }
  if (provided !== expected) {
    return { ok: false, status: 401 };
  }
  return { ok: true };
}

async function handle(req: NextRequest) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: auth.status },
    );
  }

  try {
    const supabase = createSupabaseServiceRoleClient();
    const summary = await drainEmailOutbox(supabase);
    return NextResponse.json({ ok: true, summary }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/email-outbox] drain threw", { message });
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
