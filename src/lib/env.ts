import { z } from "zod";

// Each segment of an email address (local part or domain label) cannot contain
// `<`, `>`, `@`, whitespace, or `.`. The final TLD label must also not end in
// `.`, which is why we anchor with a no-dot character class at the end.
const emailRe = /^[^<>@\s.]+(?:\.[^<>@\s.]+)*@(?:[^<>@\s.]+\.)+[^<>@\s.]+$/;
const nameWithEmailRe = /^.+<[^<>@\s.]+(?:\.[^<>@\s.]+)*@(?:[^<>@\s.]+\.)+[^<>@\s.]+>$/;

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),
  // Accept either "addr@domain" or "Display Name <addr@domain>". Rejects
  // trailing-dot TLDs (`a@b.co.`) and whitespace-prefixed names that the
  // looser pre-Phase-0 regex used to let through.
  RESEND_FROM_EMAIL: z
    .string()
    .min(1)
    .refine((v) => emailRe.test(v) || nameWithEmailRe.test(v), {
      message: "Must be 'addr@domain' or 'Name <addr@domain>'",
    })
    .optional(),
  // Dev safety net: when set, sendEmail() rewrites `to:` to this address so a
  // developer running locally with a prod key can't accidentally email real
  // users. See src/lib/notifications/email.ts.
  RESEND_DEV_REDIRECT_TO: z.string().email().optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
});

function readEnv() {
  return envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    RESEND_DEV_REDIRECT_TO: process.env.RESEND_DEV_REDIRECT_TO,
    APP_URL: process.env.APP_URL,
  });
}

const parsed = readEnv();

export const env = parsed.success ? parsed.data : null;
export const envError = parsed.success ? null : parsed.error.format();
