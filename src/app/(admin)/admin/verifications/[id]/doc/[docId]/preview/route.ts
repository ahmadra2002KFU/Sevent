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
  ctx: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await ctx.params;

  const gate = await requireRole("admin");
  if (gate.status !== "ok") {
    return new NextResponse(null, {
      status: gate.status === "unauthenticated" ? 401 : 403,
    });
  }
  const { admin } = gate;

  const { data, error } = await admin
    .from("supplier_docs")
    .select("supplier_id, file_path")
    .eq("id", docId)
    .maybeSingle();
  if (error || !data || data.supplier_id !== id) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    assertPathBelongsToSupplier(data.file_path, id);
  } catch {
    return new NextResponse(null, { status: 404 });
  }

  let signedUrl: string;
  try {
    signedUrl = await createSignedPreviewUrl(
      admin,
      STORAGE_BUCKETS.docs,
      data.file_path,
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
