"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { resolveAccessForUser } from "@/lib/auth/access";
import { sanitizeNextParam } from "@/lib/auth/nextParam";

// The `agency` role existed here historically but no sign-up surface has ever
// exposed it — agencies are onboarded out-of-band. Keeping it in the enum let
// a caller craft a form post that created agency accounts with no admin
// oversight, so it's intentionally dropped.
const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2).max(120),
  phone: z.string().regex(/^5\d{8}$/),
  role: z.enum(["organizer", "supplier"]),
  language: z.enum(["en", "ar"]).default("en"),
});

const signUpSupplierSchema = z.object({
  email: z.string().email(),
  phone: z.string().regex(/^5\d{8}$/),
  password: z.string().min(8),
  termsAccepted: z.literal(true),
  language: z.enum(["en", "ar"]).default("en"),
});

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

export type AuthState = {
  ok: boolean;
  error?: string;
};

export async function signUpAction(
  _prev: AuthState | undefined,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    role: formData.get("role"),
    language: formData.get("language") ?? "en",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { email, password, fullName, phone, role, language } = parsed.data;
  const canonicalPhone = `+966${phone}`;
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
        full_name: fullName,
        phone: canonicalPhone,
        language,
      },
      emailRedirectTo: `${process.env.APP_URL ?? "http://localhost:3000"}/sign-in`,
    },
  });
  if (error) return { ok: false, error: error.message };

  // Email confirmations are enabled locally. Land the user on sign-in with a flag.
  redirect(`/sign-in?confirm=1&role=${role}`);
}

/**
 * Supplier-only sign-up. Distinct from `signUpAction` because the supplier
 * flow captures phone (stamped onto `profiles.phone` by the auth trigger via
 * `raw_user_meta_data ->> 'phone'`) and requires explicit T&C consent which
 * we stamp as `profiles.terms_accepted_at`. `full_name` is intentionally
 * empty at this step — the wizard's Step 1 fills it in later as the
 * representative name (plan decision 3).
 */
export async function signUpSupplierAction(
  _prev: AuthState | undefined,
  formData: FormData,
): Promise<AuthState> {
  const terms = formData.get("termsAccepted");
  const parsed = signUpSupplierSchema.safeParse({
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    termsAccepted: terms === "true" || terms === "on",
    language: formData.get("language") ?? "en",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { email, phone, password, language } = parsed.data;
  const canonicalPhone = `+966${phone}`;

  const { data: signUp, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: "supplier",
        full_name: "",
        phone: canonicalPhone,
        language,
      },
      emailRedirectTo: `${process.env.APP_URL ?? "http://localhost:3000"}/sign-in`,
    },
  });
  if (error) return { ok: false, error: error.message };

  // The auth trigger at `supabase/migrations/20260420000000_extensions_and_profiles.sql:70-92`
  // creates the profiles row synchronously, so it's safe to stamp the consent
  // timestamp immediately after sign-up completes. Use the service-role client
  // because RLS would otherwise reject an un-authenticated write (the user
  // hasn't confirmed email yet, so there is no active session).
  const userId = signUp.user?.id;
  if (userId) {
    const admin = createSupabaseServiceRoleClient();
    await admin
      .from("profiles")
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq("id", userId);
  }

  redirect(`/sign-in?confirm=1&role=supplier`);
}

export async function signInAction(
  _prev: AuthState | undefined,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { ok: false, error: error.message };

  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id ?? null;

  // Single authorization source of truth — the resolver reads role +
  // supplier state and returns the correct landing URL + allowed prefixes.
  // `next` is sanitized against the decision's `allowedRoutePrefixes` so
  // a crafted URL can't redirect a supplier into /admin/* or off-origin.
  const decision = await resolveAccessForUser(userId);
  const safeNext = sanitizeNextParam(
    parsed.data.next ?? null,
    decision.allowedRoutePrefixes,
  );
  const target = safeNext ?? decision.bestDestination;

  redirect(target);
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

/**
 * Initiates Google OAuth via Supabase. Returns `{ url }` on success — the
 * client then redirects to Supabase's Google consent screen. If Google isn't
 * enabled in Supabase auth settings the action returns `{ error }` and the
 * caller shows a "قريباً" fallback.
 */
export async function startGoogleOAuthAction(
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  const role = ((formData.get("role") as string) ?? "organizer").toString();
  const supabase = await createSupabaseServerClient();
  const redirectTo = `${process.env.APP_URL ?? "http://localhost:3000"}/sign-in?oauth=1&role=${role}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data?.url) {
    return { error: error?.message ?? "OAUTH_UNAVAILABLE" };
  }
  return { url: data.url };
}
