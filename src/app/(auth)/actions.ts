"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2).max(120),
  role: z.enum(["organizer", "supplier", "agency"]),
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
  const { email, password, fullName, role, language } = parsed.data;
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, full_name: fullName, language },
      emailRedirectTo: `${process.env.APP_URL ?? "http://localhost:3000"}/sign-in`,
    },
  });
  if (error) return { ok: false, error: error.message };

  // Email confirmations are enabled locally. Land the user on sign-in with a flag.
  redirect(`/sign-in?confirm=1&role=${role}`);
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
  const userId = data.user?.id;
  let target = parsed.data.next ?? "/";
  if (!parsed.data.next && userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    const role = profile?.role ?? "organizer";
    const byRole: Record<string, string> = {
      organizer: "/organizer/dashboard",
      supplier: "/supplier/dashboard",
      admin: "/admin/dashboard",
      agency: "/organizer/dashboard",
    };
    target = byRole[role] ?? "/";
  }

  redirect(target);
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
