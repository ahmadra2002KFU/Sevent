import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/supabase/server";
import {
  STORAGE_BUCKETS,
  assertPathBelongsToSupplier,
  createSignedPreviewUrl,
} from "@/lib/supabase/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const gate = await requireRole("admin");
  if (gate.status !== "ok") {
    return new NextResponse(null, {
      status: gate.status === "unauthenticated" ? 401 : 403,
    });
  }
  const { admin } = gate;

  const { data, error } = await admin
    .from("suppliers")
    .select("logo_path")
    .eq("id", id)
    .maybeSingle();
  if (error || !data?.logo_path) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    assertPathBelongsToSupplier(data.logo_path, id);
  } catch {
    return new NextResponse(null, { status: 404 });
  }

  let signedUrl: string;
  try {
    signedUrl = await createSignedPreviewUrl(
      admin,
      STORAGE_BUCKETS.logos,
      data.logo_path,
    );
  } catch {
    return new NextResponse(null, { status: 502 });
  }

  return NextResponse.redirect(signedUrl, {
    status: 307,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
