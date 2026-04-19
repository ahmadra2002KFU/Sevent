"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createSupabaseServiceRoleClient,
  requireRole,
} from "@/lib/supabase/server";
import { sendEmail } from "@/lib/notifications/email";
import { createNotification } from "@/lib/notifications/inApp";
import SupplierApproved from "@/lib/notifications/templates/SupplierApproved";
import SupplierRejected from "@/lib/notifications/templates/SupplierRejected";
import { env } from "@/lib/env";
import type { ActionState } from "./action-state";

const supplierIdSchema = z.string().uuid();
const docIdSchema = z.string().uuid();
const notesSchema = z
  .string()
  .trim()
  .min(1, "Provide a short note for the supplier.")
  .max(2000, "Notes must be 2000 characters or fewer.");

type AdminContext = {
  adminId: string;
  serviceClient: Awaited<ReturnType<typeof createSupabaseServiceRoleClient>>;
};

async function requireAdmin(): Promise<AdminContext | { error: string }> {
  const gate = await requireRole("admin");
  if (gate.status === "unauthenticated") return { error: "Not authenticated." };
  if (gate.status === "forbidden") return { error: "Admin role required." };
  return { adminId: gate.user.id, serviceClient: gate.admin };
}

type SupplierContact = {
  supplierId: string;
  businessName: string;
  profileId: string;
  email: string | null;
};

async function loadSupplierContact(
  serviceClient: Awaited<ReturnType<typeof createSupabaseServiceRoleClient>>,
  supplierId: string,
): Promise<SupplierContact | { error: string }> {
  const { data, error } = await serviceClient
    .from("suppliers")
    .select("id, business_name, profile_id")
    .eq("id", supplierId)
    .maybeSingle();
  if (error) return { error: `Failed to load supplier: ${error.message}` };
  if (!data) return { error: "Supplier not found." };

  // Email lives in auth.users; fetch via service-role admin API so we don't
  // need an explicit join policy.
  let email: string | null = null;
  try {
    const resp = await serviceClient.auth.admin.getUserById(data.profile_id);
    email = resp?.data?.user?.email ?? null;
  } catch {
    email = null;
  }

  return {
    supplierId: data.id,
    businessName: data.business_name,
    profileId: data.profile_id,
    email,
  };
}

function appUrl(): string {
  return env?.APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";
}

function revalidateAll(supplierId?: string) {
  revalidatePath("/admin/verifications");
  if (supplierId) revalidatePath(`/admin/verifications/${supplierId}`);
}

// ---------------------------------------------------------------------------
// Per-doc actions
// ---------------------------------------------------------------------------

export async function approveDocAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const docIdRaw = formData.get("doc_id");
  const supplierIdRaw = formData.get("supplier_id");
  const docParse = docIdSchema.safeParse(docIdRaw);
  if (!docParse.success) {
    return { status: "error", message: "Invalid document id." };
  }

  const ctx = await requireAdmin();
  if ("error" in ctx) return { status: "error", message: ctx.error };

  const { error } = await ctx.serviceClient
    .from("supplier_docs")
    .update({
      status: "approved",
      reviewed_by: ctx.adminId,
      reviewed_at: new Date().toISOString(),
      notes: null,
    })
    .eq("id", docParse.data);
  if (error) return { status: "error", message: error.message };

  if (typeof supplierIdRaw === "string") {
    const supplierParse = supplierIdSchema.safeParse(supplierIdRaw);
    revalidateAll(supplierParse.success ? supplierParse.data : undefined);
  } else {
    revalidateAll();
  }
  return { status: "success", message: "Document approved." };
}

export async function rejectDocAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const docParse = docIdSchema.safeParse(formData.get("doc_id"));
  if (!docParse.success) {
    return { status: "error", message: "Invalid document id." };
  }
  const notesParse = notesSchema.safeParse(formData.get("notes") ?? "");
  if (!notesParse.success) {
    return { status: "error", message: notesParse.error.issues[0]?.message ?? "Invalid notes." };
  }

  const ctx = await requireAdmin();
  if ("error" in ctx) return { status: "error", message: ctx.error };

  const { error } = await ctx.serviceClient
    .from("supplier_docs")
    .update({
      status: "rejected",
      reviewed_by: ctx.adminId,
      reviewed_at: new Date().toISOString(),
      notes: notesParse.data,
    })
    .eq("id", docParse.data);
  if (error) return { status: "error", message: error.message };

  const supplierIdRaw = formData.get("supplier_id");
  if (typeof supplierIdRaw === "string") {
    const supplierParse = supplierIdSchema.safeParse(supplierIdRaw);
    revalidateAll(supplierParse.success ? supplierParse.data : undefined);
  } else {
    revalidateAll();
  }
  return { status: "success", message: "Document rejected." };
}

// ---------------------------------------------------------------------------
// Supplier-level actions
// ---------------------------------------------------------------------------

export async function approveSupplierAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parse = supplierIdSchema.safeParse(formData.get("supplier_id"));
  if (!parse.success) {
    return { status: "error", message: "Invalid supplier id." };
  }
  const supplierId = parse.data;

  const ctx = await requireAdmin();
  if ("error" in ctx) return { status: "error", message: ctx.error };

  const contact = await loadSupplierContact(ctx.serviceClient, supplierId);
  if ("error" in contact) return { status: "error", message: contact.error };

  const nowIso = new Date().toISOString();

  // Promote any non-rejected docs to approved as part of the overall sign-off.
  const { error: docsErr } = await ctx.serviceClient
    .from("supplier_docs")
    .update({
      status: "approved",
      reviewed_by: ctx.adminId,
      reviewed_at: nowIso,
    })
    .eq("supplier_id", supplierId)
    .neq("status", "rejected");
  if (docsErr) {
    return { status: "error", message: `Doc update failed: ${docsErr.message}` };
  }

  // Flip the supplier verification + publish flag. The
  // `guard_supplier_verification` trigger lets this through because the call
  // is made via service-role on behalf of an admin we already verified.
  const { error: supplierErr } = await ctx.serviceClient
    .from("suppliers")
    .update({
      verification_status: "approved",
      verification_notes: null,
      verified_at: nowIso,
      verified_by: ctx.adminId,
      is_published: true,
    })
    .eq("id", supplierId);
  if (supplierErr) {
    return {
      status: "error",
      message: `Supplier flip failed: ${supplierErr.message}`,
    };
  }

  // Side-effects: email + in-app notification. Failures are logged but never
  // roll back the DB writes.
  let emailDelivery: "sent" | "console" | "failed" = "failed";
  if (contact.email) {
    const result = await sendEmail({
      to: contact.email,
      subject: `${contact.businessName} is verified on Sevent`,
      react: SupplierApproved({
        businessName: contact.businessName,
        appUrl: appUrl(),
      }),
    });
    if (result.ok) emailDelivery = result.mode === "resend" ? "sent" : "console";
  } else {
    console.warn(
      "[verifications/approve] supplier has no email; skipping send",
      { supplierId },
    );
  }

  await createNotification({
    supabase: ctx.serviceClient,
    user_id: contact.profileId,
    kind: "supplier.approved",
    payload: {
      supplier_id: supplierId,
      business_name: contact.businessName,
      verified_at: nowIso,
      verified_by: ctx.adminId,
      email_delivery: emailDelivery,
    },
  });

  revalidateAll(supplierId);
  return {
    status: "success",
    message: `${contact.businessName} approved and notified.`,
  };
}

export async function rejectSupplierAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parse = supplierIdSchema.safeParse(formData.get("supplier_id"));
  if (!parse.success) {
    return { status: "error", message: "Invalid supplier id." };
  }
  const notesParse = notesSchema.safeParse(formData.get("notes") ?? "");
  if (!notesParse.success) {
    return {
      status: "error",
      message: notesParse.error.issues[0]?.message ?? "Notes are required.",
    };
  }
  const supplierId = parse.data;
  const notes = notesParse.data;

  const ctx = await requireAdmin();
  if ("error" in ctx) return { status: "error", message: ctx.error };

  const contact = await loadSupplierContact(ctx.serviceClient, supplierId);
  if ("error" in contact) return { status: "error", message: contact.error };

  const nowIso = new Date().toISOString();

  // Mark every non-approved doc as rejected so the supplier sees a clean
  // resubmission target. (Already-approved docs stay approved.)
  const { error: docsErr } = await ctx.serviceClient
    .from("supplier_docs")
    .update({
      status: "rejected",
      reviewed_by: ctx.adminId,
      reviewed_at: nowIso,
      notes,
    })
    .eq("supplier_id", supplierId)
    .neq("status", "approved");
  if (docsErr) {
    return { status: "error", message: `Doc update failed: ${docsErr.message}` };
  }

  const { error: supplierErr } = await ctx.serviceClient
    .from("suppliers")
    .update({
      verification_status: "rejected",
      verification_notes: notes,
      verified_at: null,
      verified_by: ctx.adminId,
      is_published: false,
    })
    .eq("id", supplierId);
  if (supplierErr) {
    return {
      status: "error",
      message: `Supplier flip failed: ${supplierErr.message}`,
    };
  }

  let emailDelivery: "sent" | "console" | "failed" = "failed";
  if (contact.email) {
    const result = await sendEmail({
      to: contact.email,
      subject: `${contact.businessName} — verification needs follow-up`,
      react: SupplierRejected({
        businessName: contact.businessName,
        notes,
        appUrl: appUrl(),
      }),
    });
    if (result.ok) emailDelivery = result.mode === "resend" ? "sent" : "console";
  } else {
    console.warn(
      "[verifications/reject] supplier has no email; skipping send",
      { supplierId },
    );
  }

  await createNotification({
    supabase: ctx.serviceClient,
    user_id: contact.profileId,
    kind: "supplier.rejected",
    payload: {
      supplier_id: supplierId,
      business_name: contact.businessName,
      notes,
      rejected_at: nowIso,
      rejected_by: ctx.adminId,
      email_delivery: emailDelivery,
    },
  });

  revalidateAll(supplierId);
  return {
    status: "success",
    message: `${contact.businessName} rejected. Supplier notified.`,
  };
}
