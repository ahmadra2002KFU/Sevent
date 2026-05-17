> **Document status (2026-05-17):** Outdated. Locale and template conventions mostly landed, but delivery now uses durable `email_outbox` worker plumbing instead of only direct sends beside notifications.

# Email Architecture — Sevent

How we structure, localize, and ship transactional email via Resend.

## Sending stack

- **Provider:** Resend (`resend@^6.11.0` already in `package.json`).
- **Wrapper:** `src/lib/notifications/email.ts` — `sendEmail({to, subject, react, text?})`.
- **Component library:** `@react-email/components` + `@react-email/render` (already installed).
- **Local dev:** when `RESEND_API_KEY` is unset, `sendEmail` renders the React component to HTML and dumps it to the terminal — a real Resend account is **not** required for local development.
- **Failure contract (Sprint 2 lane 3):** if Resend throws or returns an error, `sendEmail` returns `{ ok: false, error }` and **callers MUST NOT roll back DB writes**. The in-app `notifications` row is the source of truth; email is best-effort.

### Env vars

| Var | Where set | Notes |
|---|---|---|
| `RESEND_API_KEY` | `.env.local` (dev), production secrets | Absent in dev → console-mode fallback |
| `RESEND_FROM_EMAIL` | optional | Defaults to `Sevent <no-reply@sevent.local>` |
| `APP_URL` | always | Used to build CTA URLs inside templates |

## Locale strategy (AR / EN)

Every template ships in both Arabic and English.

- **User language is captured at signup** in `public.profiles.language` (`en` | `ar`) — see `supabase/migrations/20260420000000_extensions_and_profiles.sql:91`. The signup action sets it from the active locale (`src/app/(auth)/actions.ts:54,70-75`).
- **Template signature:** every template component takes a `locale: "en" | "ar"` prop. The component switches strings, direction (`<Html dir={...}>`) and font stack inside; we **do not** ship two separate `.en.tsx` / `.ar.tsx` files (it duplicates JSX and drifts).

  ```tsx
  type Props = { locale: "en" | "ar"; businessName: string; appUrl: string };
  export default function SupplierApproved({ locale, businessName, appUrl }: Props) { … }
  ```

- **Strings live in a sibling `.strings.ts`** so copy edits don't churn the JSX:

  ```ts
  // SupplierApproved.strings.ts
  export const strings = {
    en: { preview: (n: string) => `${n} is verified on Sevent`, ... },
    ar: { preview: (n: string) => `تم التحقق من ${n} على سيڤنت`, ... },
  } as const;
  ```

- **Caller responsibility:** trigger sites read `profiles.language` for the recipient and pass it in:

  ```ts
  const { data: profile } = await supabase
    .from("profiles").select("language").eq("id", recipientUserId).single();
  await sendEmail({
    to,
    subject: subject[profile?.language ?? "en"],
    react: <SupplierApproved locale={profile?.language ?? "en"} … />,
  });
  ```

- **RTL** — Arabic templates set `<Html dir="rtl" lang="ar">` and use Cairo / Tajawal font stack with safe email-client fallbacks. React Email renders to inline-styled HTML, so direction has to be set on `<Html>` *and* on text containers (Outlook strips top-level `dir` on some clients).

## Brand tokens

Inherit from existing templates so we have a single visual language:

```ts
const SEVENT_GREEN = "#006C35";  // primary CTA, headings
const SEVENT_GOLD  = "#C8993A";  // category eyebrow, accents
const SEVENT_DARK  = "#0B1E12";  // body text
const SEVENT_BG    = "#F0FAF4";  // outer body bg
const REJECT_RED   = "#9F1A1A";  // rejection / destructive accents only
```

These should move into `src/lib/notifications/templates/_brand.ts` so all future templates import them rather than re-declaring.

## Folder convention (proposed)

```
src/lib/notifications/templates/
  _brand.ts                 # color/font tokens
  _shared/                  # Header, Footer, Button, BrandShell components
    BrandShell.tsx
    Footer.tsx
  auth/
    VerifyEmail.tsx
    VerifyEmail.strings.ts
    PasswordReset.tsx
    PasswordReset.strings.ts
    ...
  organizer/
    QuoteReceived.tsx
    QuoteReceived.strings.ts
    BookingCreated.tsx
    ...
  supplier/
    SupplierApproved.tsx        # already exists; refactor to locale-aware
    SupplierRejected.tsx        # already exists; refactor to locale-aware
    QuoteAccepted.tsx
    ...
  admin/
    PendingReviewQueue.tsx
    FeedbackReceived.tsx
    ...
```

Existing `SupplierApproved.tsx` / `SupplierRejected.tsx` move into `templates/supplier/` as part of the AR refactor.

## Wiring pattern

Every email is sent **next to** the existing `createNotification(...)` call, not before it. The in-app row is the durable record; email is the push channel. Pattern:

```ts
// inside a server action, after the DB write is committed
await createNotification({ supabase, user_id: recipient.id, kind: "quote.accepted", payload: {...} });

const { data: profile } = await supabase
  .from("profiles")
  .select("email, language, full_name")
  .eq("id", recipient.id)
  .single();

if (profile?.email) {
  await sendEmail({
    to: profile.email,
    subject: subjectFor("quote.accepted", profile.language ?? "en"),
    react: <QuoteAccepted locale={profile.language ?? "en"} {...payload} />,
  });
}
```

Failures from `sendEmail` are logged inside the wrapper; **do not** branch on the result to roll back DB writes.

## Open decisions

1. **Supabase auth emails (verify, password reset, magic link) — Resend or Supabase?**
   - Today they go via Supabase's built-in SMTP (Inbucket in dev). Two paths:
     - **(a) Customize Supabase templates** to point at our brand HTML. Simpler. Stays inside Supabase's flow.
     - **(b) Replace with Resend** via Supabase's `auth.users` webhook → our edge function calls `sendEmail`. More flexible, lets us use the same React Email components.
   - Recommendation: ship **(a)** for V1 (low risk, faster) and migrate to **(b)** when we want to fully unify branding/A/B test.

2. **Admin recipient address** — is `admin_supplier_pending_review` etc. sent to a single ops alias (`ops@sevent.sa`) or fanned-out to every admin user? Per-admin gives audit trail; alias gives less inbox noise. Suggest **alias** initially.

3. **Marketplace digest cadence (SU2)** — real-time email per matching opportunity = inbox spam. Suggest a **daily 8 AM Riyadh time** digest with up to N matched opportunities.

4. **Fallback email when `profiles.email` is null** — should never happen post-signup, but if it does the wrapper currently no-ops silently. Add a hard log + admin alert.

## Gaps that block specific templates

| Block | Templates blocked | What's needed |
|---|---|---|
| `pg_cron` not deployed | OR10, OR13, OR14, SU7, SU8, SU9, SU10 | Schedule worker per `state-machines.md:62-77` |
| Marketplace matcher not built | SU2 | Query: `supplier_categories` ↔ `rfqs.subcategory_id` (+ `city`) |
| Payment surface not built | X3, X4, X5 | Whole payment flow |
| Review surface not built | X6, X7 | Review submission UX + cron for reminder |
| Dispute surface not built | AD4 | Dispute UI + admin case page |
| Login event log not exposed | X1 | Either Supabase auth webhook or a custom `auth_events` table |

## Testing

- **Local preview:** add a `pnpm email:preview` script that boots `react-email dev` against the templates folder.
- **Snapshot tests:** render each template at both locales and snapshot the HTML; protects against accidental string drift.
- **Send-to-inbox dev mode:** when developer sets `RESEND_API_KEY` locally + `RESEND_DEV_REDIRECT_TO=arabaiah@mufeed.com`, all `to:` addresses are rewritten to that address (so we can preview in a real client without spamming users).
