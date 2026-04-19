/**
 * Removes every stress-seed supplier created by `seed-stress-riyadh.ts`.
 *
 * Strategy: find auth users whose email starts with `rstress-` and ends with
 * `@sevent.dev`, then `auth.admin.deleteUser(id)` each. FK cascades
 * (auth.users → profiles → suppliers → supplier_categories / packages /
 * pricing_rules / availability_blocks) handle the rest.
 *
 * Caveat: `bookings` + `quotes` hold ON DELETE RESTRICT to suppliers/profiles.
 * If a stress supplier accidentally got booked/quoted during testing, their
 * delete will fail with a clear message — pick them out manually if that
 * happens (or `supabase db reset && pnpm seed` for a clean slate).
 *
 * Run: pnpm seed:stress:clean
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "[stress-clean] Missing env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
  );
  process.exit(1);
}

const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PREFIX = "rstress-";
const SUFFIX = "@sevent.dev";

async function collectStressUsers(): Promise<Array<{ id: string; email: string }>> {
  const result: Array<{ id: string; email: string }> = [];
  let page = 1;
  while (true) {
    const { data, error } = await supa.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const u of data.users) {
      const email = (u.email ?? "").toLowerCase();
      if (email.startsWith(PREFIX) && email.endsWith(SUFFIX)) {
        result.push({ id: u.id, email });
      }
    }
    if (data.users.length < 1000) break;
    page += 1;
  }
  return result;
}

async function main() {
  const users = await collectStressUsers();
  console.log(`[stress-clean] Found ${users.length} stress users to delete.`);

  let ok = 0;
  const failures: Array<{ email: string; error: string }> = [];
  for (const u of users) {
    const { error } = await supa.auth.admin.deleteUser(u.id);
    if (error) {
      failures.push({ email: u.email, error: error.message });
    } else {
      ok += 1;
    }
  }

  console.log(`[stress-clean] Deleted ${ok}/${users.length}`);
  if (failures.length > 0) {
    console.warn(`[stress-clean] ${failures.length} failed (likely blocked by booking/quote FKs):`);
    for (const f of failures) {
      console.warn(`  - ${f.email}: ${f.error}`);
    }
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[stress-clean] FAILED:", err);
  process.exit(1);
});
