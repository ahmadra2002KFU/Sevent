/**
 * Direct service-role helpers for Playwright tests.
 *
 * These do NOT call into src/ — they mint a separate Supabase admin client
 * from env vars so the test process owns its own pool. Use sparingly: only
 * for fixture setup (create users, approve suppliers, fast-forward event
 * timestamps) and for invoking the lifecycle cron functions on demand.
 *
 * Real user actions should be driven through the UI to actually exercise
 * the app under test.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "e2e/helpers/db.ts: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
      "must be set in the shell that launches Playwright (export from .env.local).",
  );
}

export const admin: SupabaseClient = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function createOrganizerUser(opts: {
  email: string;
  password: string;
  fullName: string;
}): Promise<{ profileId: string }> {
  const { data, error } = await admin.auth.admin.createUser({
    email: opts.email,
    password: opts.password,
    email_confirm: true,
    user_metadata: {
      role: "organizer",
      full_name: opts.fullName,
    },
  });
  if (error || !data.user) {
    throw new Error(`createOrganizerUser failed: ${error?.message ?? "no user"}`);
  }
  return { profileId: data.user.id };
}

export async function createSupplierUserAndProfile(opts: {
  email: string;
  password: string;
  businessName: string;
  slug: string;
}): Promise<{ profileId: string; supplierId: string }> {
  const { data, error } = await admin.auth.admin.createUser({
    email: opts.email,
    password: opts.password,
    email_confirm: true,
    user_metadata: { role: "supplier" },
  });
  if (error || !data.user) {
    throw new Error(`createSupplierUserAndProfile failed: ${error?.message}`);
  }
  const profileId = data.user.id;

  const { data: supplierRow, error: insertErr } = await admin
    .from("suppliers")
    .insert({
      profile_id: profileId,
      business_name: opts.businessName,
      slug: opts.slug,
      legal_type: "company",
      verification_status: "approved",
      is_published: true,
      base_city: "riyadh",
      service_area_cities: ["riyadh"],
      languages: ["en", "ar"],
    })
    .select("id")
    .single();
  if (insertErr || !supplierRow) {
    throw new Error(`supplier insert failed: ${insertErr?.message}`);
  }
  return { profileId, supplierId: (supplierRow as { id: string }).id };
}

export async function deleteUserByEmail(email: string): Promise<void> {
  const { data } = await admin.auth.admin.listUsers();
  const target = data.users.find((u) => u.email === email);
  if (!target) return;
  await admin.auth.admin.deleteUser(target.id);
}

/**
 * Fast-forwards an event's ends_at into the past, then runs the
 * auto_mark_completed() cron function directly. Returns the count.
 */
export async function fastForwardEventAndMarkCompleted(opts: {
  eventId: string;
  endedHoursAgo: number;
}): Promise<{ completed: number }> {
  const endsAt = new Date(
    Date.now() - opts.endedHoursAgo * 60 * 60 * 1000,
  ).toISOString();
  const startsAt = new Date(
    Date.now() - (opts.endedHoursAgo + 4) * 60 * 60 * 1000,
  ).toISOString();
  const { error: updErr } = await admin
    .from("events")
    .update({ starts_at: startsAt, ends_at: endsAt })
    .eq("id", opts.eventId);
  if (updErr) throw new Error(`event time fast-forward failed: ${updErr.message}`);

  const { data, error } = await admin.rpc("auto_mark_completed");
  if (error) throw new Error(`auto_mark_completed failed: ${error.message}`);
  return { completed: (data as number) ?? 0 };
}

/**
 * Triggers the publish_pending_reviews cron function directly. Tests use
 * this instead of waiting for the hourly schedule.
 */
export async function tickPublishReviews(): Promise<{ published: number }> {
  const { data, error } = await admin.rpc("publish_pending_reviews");
  if (error)
    throw new Error(`publish_pending_reviews failed: ${error.message}`);
  return { published: (data as number) ?? 0 };
}
