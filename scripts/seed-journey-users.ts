/**
 * Seed the four accounts used by the company-organizer journey test.
 *
 *   owner@journey.test         (will create the company)
 *   teammate1@journey.test     (admin invite recipient)
 *   teammate2@journey.test     (member invite recipient)
 *   teammate3@journey.test     (member invite recipient)
 *
 * All pre-confirmed (email_confirmed_at=now) so the browser flow can sign in
 * immediately without the verification-link hop. Run via:
 *   pnpm tsx scripts/seed-journey-users.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("[seed-journey] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS = [
  { email: "owner@journey.test", fullName: "Journey Owner" },
  { email: "teammate1@journey.test", fullName: "Journey Teammate 1" },
  { email: "teammate2@journey.test", fullName: "Journey Teammate 2" },
  { email: "teammate3@journey.test", fullName: "Journey Teammate 3" },
];

const PASSWORD = "JourneyPass123!";

async function findUser(email: string): Promise<string | null> {
  let page = 1;
  while (true) {
    const { data, error } = await supa.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    if (!data?.users || data.users.length === 0) return null;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function upsertUser(email: string, fullName: string) {
  const existing = await findUser(email);
  if (existing) {
    console.log(`[seed-journey] ${email}: already exists (${existing}) — skip create`);
    // ensure password works in case it drifted
    await supa.auth.admin.updateUserById(existing, { password: PASSWORD, email_confirm: true });
    await supa
      .from("profiles")
      .update({ role: "organizer", full_name: fullName })
      .eq("id", existing);
    return existing;
  }
  const { data, error } = await supa.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: "organizer" },
  });
  if (error || !data.user) {
    console.error(`[seed-journey] ${email}: create failed`, error);
    process.exit(1);
  }
  // The on_auth_user_created trigger creates the profile; nudge role + name.
  await supa
    .from("profiles")
    .update({ role: "organizer", full_name: fullName })
    .eq("id", data.user.id);
  console.log(`[seed-journey] ${email}: created ${data.user.id}`);
  return data.user.id;
}

async function main() {
  for (const u of USERS) {
    await upsertUser(u.email, u.fullName);
  }
  console.log("[seed-journey] done");
}

main().catch((err) => {
  console.error("[seed-journey] failed", err);
  process.exit(1);
});
