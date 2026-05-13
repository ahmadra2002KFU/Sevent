/**
 * Atomic recipient lookup: returns `{ email, locale }` for a profile id.
 *
 * The single sanctioned way to resolve a notification recipient. Callers MUST
 * NOT hand-roll `auth.admin.getUserById` + `profiles.language` SELECTs, because
 *
 *  1. the email lives in `auth.users` (only readable via the Admin API);
 *  2. the locale lives in `public.profiles.language`;
 *  3. forgetting either side has been the source of every English-to-AR-user
 *     regression we've seen so far.
 *
 * Always pass a service-role client — RLS on `profiles` would otherwise hide
 * other users' rows.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type RecipientLocale = "en" | "ar";

export type Recipient = {
  email: string | null;
  locale: RecipientLocale;
};

export async function resolveRecipientEmailAndLocale(
  admin: SupabaseClient,
  profileId: string,
): Promise<Recipient> {
  const [userResp, profileResp] = await Promise.all([
    admin.auth.admin.getUserById(profileId).catch(() => null),
    admin
      .from("profiles")
      .select("language")
      .eq("id", profileId)
      .maybeSingle(),
  ]);

  const email = userResp?.data?.user?.email ?? null;
  const raw = profileResp.data?.language;
  const locale: RecipientLocale = raw === "ar" ? "ar" : "en";

  return { email, locale };
}
