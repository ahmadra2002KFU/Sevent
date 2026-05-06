/**
 * Polling endpoint for the threaded messaging UI.
 *
 * GET /api/messaging/threads/[id]?since=<iso>
 *
 * Returns the count of feedback_messages with `created_at > since` plus the
 * most-recent `created_at` we saw, so the client can advance its local
 * `since` watermark and avoid re-querying the same range on the next tick.
 *
 * Auth:
 *   - Admin role: full access.
 *   - Any other authenticated role: must own the thread (the explicit
 *     `user_id` filter is enforced in code; the underlying RLS policies
 *     duplicate this guard at the DB layer for any user-scoped reads).
 *
 * Caching:
 *   - `Cache-Control: private, no-store` so neither browsers nor any
 *     intermediary caches the response. The page is `force-dynamic` and the
 *     answer changes on every new message.
 */

import { NextResponse, type NextRequest } from "next/server";

import { requireRole } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["admin", "supplier", "organizer", "agency"] as const;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return new NextResponse(null, { status: 400 });
  }
  const sinceParam = req.nextUrl.searchParams.get("since") ?? null;
  if (sinceParam && Number.isNaN(Date.parse(sinceParam))) {
    return new NextResponse(null, { status: 400 });
  }
  const since = sinceParam ?? new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const gate = await requireRole([...ALLOWED_ROLES]);
  if (gate.status !== "ok") {
    return new NextResponse(null, {
      status: gate.status === "unauthenticated" ? 401 : 403,
    });
  }

  // Ownership check for non-admins.
  if (gate.role !== "admin") {
    const { data: ownerCheck, error: checkErr } = await gate.admin
      .from("app_feedback")
      .select("id")
      .eq("id", id)
      .eq("user_id", gate.user.id)
      .limit(1);
    if (checkErr) {
      return new NextResponse(null, { status: 500 });
    }
    if (!ownerCheck || ownerCheck.length === 0) {
      return new NextResponse(null, { status: 404 });
    }
  }

  // Cheap count + latest-timestamp query.
  const { count, error: countErr } = await gate.admin
    .from("feedback_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", id)
    .gt("created_at", since);
  if (countErr) {
    return new NextResponse(null, { status: 500 });
  }

  let latestAt: string | null = null;
  if ((count ?? 0) > 0) {
    const { data: latestRow, error: latestErr } = await gate.admin
      .from("feedback_messages")
      .select("created_at")
      .eq("thread_id", id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (latestErr) {
      return new NextResponse(null, { status: 500 });
    }
    latestAt = (latestRow ?? [])[0]?.created_at ?? null;
  }

  return NextResponse.json(
    { count: count ?? 0, latest_at: latestAt },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
