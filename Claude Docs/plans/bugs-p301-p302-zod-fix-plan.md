# Bug Fix Plan — P3-01, P3-02, UX-ZOD

**Date:** 2026-04-22
**Mode:** Investigation only (no edits made)
**Scope:** `src/app/(supplier)/supplier/catalog/**`, `src/app/(supplier)/supplier/calendar/**`, `src/app/(onboarding)/supplier/onboarding/**`, `src/lib/domain/{availability,onboarding}.ts`

---

## Section 1 — P3-01: supplier catalog Delete button unresponsive

### 1.1 Root cause

The Delete button is correctly wired. The onClick handler, the server action, the access-control gate, and the translation keys all exist and are properly connected. The "unresponsive" behaviour comes from two compounding factors that make the delete path fragile:

1. **`window.confirm()` in an automated browser.** The test that produced this report was run by an AI browser agent (`Antigravity`, Chromium-based). Per the HTML spec and CDP defaults, browser automation auto-dismisses `window.confirm` dialogs as `false` unless a handler is explicitly installed. Because `onClick` returns early when `window.confirm(...)` returns false, the automated click does nothing visible. A real human clicking OK in the confirm would complete the delete — so P3-01 is a test-surface bug for automation but a UX/a11y issue in general (blocking `confirm()` is bad on mobile and inaccessible to screen readers).
2. **No shared `AlertDialog` primitive yet.** A comment in `src/app/(admin)/admin/verifications/_components/SupplierActions.tsx:69` explicitly notes: *"AlertDialog (which is not yet part of the shared primitive set)."* There is no `src/components/ui/alert-dialog.tsx`, so every destructive action in the codebase falls back to `window.confirm`.

The wiring itself (file:line) is correct:

- `src/app/(supplier)/supplier/catalog/catalog-client.tsx:236-256`

```tsx
<Button
  type="button"
  variant="ghost"
  size="icon-sm"
  disabled={isPending}
  onClick={() => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(t("confirmDeletePackage"))
    )
      return;
    startTransition(async () => {
      const r = await deletePackageAction(p.id);
      handleResult(r, t("deletedPackage"));
    });
  }}
  className="text-semantic-danger-500 hover:bg-semantic-danger-100/40"
  aria-label={t("delete")}
>
  <Trash2 />
</Button>
```

- `src/app/(supplier)/supplier/catalog/actions.ts:190-206` — `deletePackageAction(packageId)` exists, is correctly gated by `requireAccess("supplier.catalog")`, and the translation keys (`confirmDeletePackage`, `deletedPackage`, `delete`) all exist in both `src/messages/en.json` and `src/messages/ar.json` (lines 685, 682, etc.).

Secondary suspect (lower confidence): after the preceding "New package" Save flow, Radix Dialog 1.4.3 is known to occasionally leave `pointer-events: none` on `<body>` after close (https://github.com/radix-ui/primitives/issues/2122). If the user clicks Delete while that inline style has not yet been cleared, the click is intercepted. This is rarer in practice but worth verifying with the Playwright MCP while repro-ing manually.

### 1.2 Proposed fix (one paragraph)

Replace `window.confirm(...)` destructive prompts with a shared `AlertDialog` primitive built on `radix-ui`'s `AlertDialog.Root / Trigger / Content / Action / Cancel`, living at `src/components/ui/alert-dialog.tsx`. Swap the inline `window.confirm(...) ; return;` in `catalog-client.tsx` (two call sites: package delete at line 241, rule delete at line 328) for the new component. Use existing translation keys (`confirmDeletePackage`, `confirmDeleteRule`, plus a new `confirmCancel`/`confirmConfirm` pair sourced from `supplier.catalog`). This makes destructive flows scriptable (Playwright / Antigravity can click the Confirm button) and accessible (focus trap, screen-reader label, ESC/overlay cancel), without regressing human UX. The same replacement should also be applied to `src/app/(supplier)/supplier/calendar/block-list.tsx:166`, which uses the identical `window.confirm` pattern.

### 1.3 Exact file:line list

| File | Line(s) | Action |
| --- | --- | --- |
| `src/components/ui/alert-dialog.tsx` | NEW | Add shadcn/Radix `AlertDialog` primitive |
| `src/app/(supplier)/supplier/catalog/catalog-client.tsx` | 241-251 (package delete) | Replace `window.confirm` → `AlertDialog` |
| `src/app/(supplier)/supplier/catalog/catalog-client.tsx` | 328-338 (supplier-wide rule delete) | Same |
| `src/app/(supplier)/supplier/catalog/catalog-client.tsx` | 361-371 (per-package rule delete) | Same |
| `src/app/(supplier)/supplier/calendar/block-list.tsx` | 165-174 (manual block delete) | Same (consistency fix; not strictly a P3-01 requirement) |
| `src/messages/{en,ar}.json` | namespace `supplier.catalog`, `supplier.calendar` | Add `confirmCancel`, `confirmConfirm` strings |

No changes needed in `src/app/(supplier)/supplier/catalog/actions.ts` — the server action is correct.

---

## Section 2 — P3-02: calendar datetime-local validation errors block save

### 2.1 Root cause

`src/lib/domain/availability.ts:9-24` uses a permissive validator that only checks `!Number.isNaN(Date.parse(v))`:

```ts
const isoDateTime = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: "invalid ISO date/time" });

export const ManualBlockInput = z
  .object({
    id: z.string().uuid().optional(),
    starts_at: isoDateTime,
    ends_at: isoDateTime,
    notes: z.string().max(500).optional(),
  })
  .refine((v) => Date.parse(v.ends_at) > Date.parse(v.starts_at), {
    path: ["ends_at"],
    message: "End must be after start",
  });
export type ManualBlockInput = z.infer<typeof ManualBlockInput>;
```

The form at `src/app/(supplier)/supplier/calendar/block-list.tsx:110-118` runs this schema as a **client-side react-hook-form resolver**:

```tsx
const {
  register,
  handleSubmit,
  reset,
  formState: { errors },
} = useForm<FormValues>({
  resolver: zodResolver(ManualBlockInput),
  defaultValues: { starts_at: "", ends_at: "", notes: "" },
});
```

The form fields are `<input type="datetime-local" {...register("starts_at")} required />` at lines 251-256 and 265-270. `datetime-local` inputs emit a string of shape `YYYY-MM-DDTHH:mm` (no seconds, no timezone — per the HTML spec).

Layered on top, the user submit handler at `src/app/(supplier)/supplier/calendar/block-list.tsx:147-163` converts those values to ISO strings via `toIso` BEFORE calling the server action:

```tsx
const onSubmit = handleSubmit((values) => {
  const payload = {
    starts_at: toIso(values.starts_at),
    ends_at: toIso(values.ends_at),
    notes: values.notes?.trim() ? values.notes.trim() : undefined,
  };
  ...
});
```

with `toIso` at line 97:

```tsx
function toIso(local: string): string {
  if (!local) return local;
  return new Date(local).toISOString();
}
```

**The validation mismatch:** `zodResolver(ManualBlockInput)` runs the schema on the RAW form values (`"2026-04-22T14:30"`) — NOT on the ISO-converted payload. It only happens to work on V8/Chromium because `Date.parse("2026-04-22T14:30")` is lenient there and returns a valid epoch. On spec-strict engines, or when the string contains Arabic-Indic digits (`٢٠٢٦-٠٤-٢٢T١٤:٣٠` → `Date.parse` returns `NaN`, verified), or when the user partially fills a field, the schema rejects with `"invalid ISO date/time"`. The server-side re-parse in `src/app/(supplier)/supplier/calendar/actions.ts:38` (`ManualBlockInput.safeParse(raw)`) uses the exact same schema but receives the already-converted ISO string, so the two halves validate against different shapes of data using the same schema. This is fragile by design — any upstream change to the form's value shape silently breaks validation.

There is also a secondary UX problem: the rejection message `"invalid ISO date/time"` is English and not translated, even in the Arabic UI.

### 2.2 Proposed fix

**Schema (preferred — stays correct end-to-end):** replace `isoDateTime` in `src/lib/domain/availability.ts:9-11` with a transform that accepts either the datetime-local short form or a full ISO string, normalises to full ISO, and fails with an i18n-ready key:

```ts
// Accepts YYYY-MM-DDTHH:mm, YYYY-MM-DDTHH:mm:ss, or full ISO with zone; emits ISO.
const LOCAL_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/;
const isoDateTime = z
  .string()
  .regex(LOCAL_DT, { message: "invalid_datetime_format" })
  .transform((v, ctx) => {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_datetime_value" });
      return z.NEVER;
    }
    return d.toISOString();
  });
```

Call sites (`block-list.tsx:148-151`, `actions.ts:60-61`) then stop needing the manual `toIso` helper — the schema does the conversion. The `.refine` comparing `ends_at > starts_at` still works because both fields are now normalised ISO.

**Form-side changes:**

- Delete `toIso` and `toLocalInput` helpers at `block-list.tsx:82-100` (no longer needed for submit; still needed for edit-prefill, so keep `toLocalInput` but rename clearly).
- Change `onSubmit` in `block-list.tsx:147-163` to pass raw form values directly to the action; the server schema now handles conversion.
- Replace the hard-coded English messages `"invalid ISO date/time"` and `"End must be after start"` with translation keys resolved at UI time via a shared helper (`t(`errors.${issue.message}`)` fallback pattern). Options: either `i`/`map` a small dictionary in `block-list.tsx` when rendering `errors.starts_at?.message`, or add a global Zod error map (see Section 3).

**Alternative (lighter touch, same net outcome):** keep the current `toIso` convert-then-submit pattern but either (a) call `ManualBlockInput.safeParse(payload)` manually in `onSubmit` AFTER converting (bypassing `zodResolver` entirely) or (b) remove `zodResolver` and rely on the server's response for errors. (a) duplicates logic, (b) gives worse UX. The schema-transform approach above is the clean fix.

### 2.3 Exact file:line list

| File | Line(s) | Change |
| --- | --- | --- |
| `src/lib/domain/availability.ts` | 9-24 | Replace `isoDateTime` with regex + transform; keep `.refine(ends > starts)` |
| `src/app/(supplier)/supplier/calendar/block-list.tsx` | 82-100 | Delete `toIso`; keep `toLocalInput` for edit prefill only |
| `src/app/(supplier)/supplier/calendar/block-list.tsx` | 147-163 | Pass raw form values to `createManualBlockAction` / `updateManualBlockAction` |
| `src/app/(supplier)/supplier/calendar/block-list.tsx` | 257-261, 271-275 | Translate `errors.starts_at?.message` / `errors.ends_at?.message` via i18n map |
| `src/messages/{en,ar}.json` | new namespace `errors` or `supplier.calendar.errors` | Add `invalid_datetime_format`, `invalid_datetime_value`, `ends_before_starts` |

No changes needed in `src/app/(supplier)/supplier/calendar/actions.ts` — it already delegates to `ManualBlockInput.safeParse` and will receive the transform result automatically.

---

## Section 3 — UX-ZOD: Step 1 / Step 2 Zod schemas ship English messages in an Arabic UI

### 3.1 Why Step 3 passes and Step 1/2 don't

- **Step 3** (`src/app/(onboarding)/supplier/onboarding/wizard.tsx:956-1027`) does NOT use `zodResolver`. Its `handleSubmit` is a plain event handler that calls `setError(t("iban.required"))` directly, pulling from the `supplier.onboarding` message bundle. That's why the UI shows `"شهادة الآيبان مطلوبة"` when the IBAN is missing — it's a translation key, not a Zod message.
- **Step 2** (`wizard.tsx:872-887`) uses the same manual pattern (`setError(t("step2RequireCategory"))` / `t("step2RequireSegment")`). Those translation keys exist at `src/messages/ar.json:519-520`. Step 2's Zod schema (`OnboardingStep2`) IS english-only, but because the schema is never used as a form resolver, users don't see its messages. The server action does surface them if an attacker bypasses the client UI, but the UX report didn't observe that path.
- **Step 1** (`wizard.tsx:452-471`) uses `resolver: zodResolver(OnboardingStep1Schema)`. react-hook-form wires `errors.<field>.message` directly from Zod's output, rendered raw at `wizard.tsx:539, 551, 571, 589, 598, 619`, etc. Hence users see Zod v4's default English strings (confirmed reproduction below).

Confirmed by running the schema in Node (`zod@4.3.6`):

```js
// empty representative_name
{ code: 'too_small', origin: 'string', path: ['representative_name'],
  message: 'Too small: expected string to have >=2 characters' }
// missing base_city
{ code: 'invalid_value', path: ['base_city'],
  message: 'Invalid option: expected one of "riyadh"|"jeddah"' }
```

These exactly match the strings quoted in `Claude Docs/features/supplier-onboarding/ux-report.md:25`.

### 3.2 Audit table

**Step 1** — `src/lib/domain/onboarding.ts:73-103`. Every validator listed; "Current message" is what Zod v4 emits today when no custom message is set.

| Schema | Field | Validator (line) | Current message | Proposed Arabic message (key) |
| --- | --- | --- | --- | --- |
| `OnboardingStep1` | `representative_name` | `z.string().trim().min(2).max(120)` (75) | `Too small: expected string to have >=2 characters` / `Too big: expected string to have <=120 characters` | `supplier.onboarding.errors.representative_name.min` / `.max` |
| `OnboardingStep1` | `business_name` | `z.string().trim().min(2).max(120)` (76) | same as above | `supplier.onboarding.errors.business_name.min` / `.max` |
| `OnboardingStep1` | `legal_type` | `z.enum(LEGAL_TYPES)` (77) | `Invalid option: expected one of "company"|"freelancer"|"foreign"` | `supplier.onboarding.errors.legal_type.required` |
| `OnboardingStep1` | `cr_number` | `z.string().trim().optional()` (78) | – (optional, no base error) | – (superRefine below covers the "company requires CR" case) |
| `OnboardingStep1` | `national_id` | `z.string().trim().optional()` (79) | – | – |
| `OnboardingStep1` | `bio` | `z.string().trim().max(2000).optional()` (80) | `Too big: expected string to have <=2000 characters` | `supplier.onboarding.errors.bio.max` |
| `OnboardingStep1` | `base_city` | `z.enum(CITY_TUPLE)` (81) | `Invalid option: expected one of ...` | `supplier.onboarding.errors.base_city.required` |
| `OnboardingStep1` | `service_area_cities` | `z.array(z.enum(CITY_TUPLE)).max(15, "Select at most 15 service-area cities").default([])` (82-85) | literal English from schema | `supplier.onboarding.errors.service_area_cities.max` |
| `OnboardingStep1` | `languages` | `z.array(z.enum(LANGUAGES)).min(1).default(["ar"])` (86) | `Too small: expected array to have >=1 items` (Zod v4 array variant) | `supplier.onboarding.errors.languages.min` |
| `OnboardingStep1` | `cr_number` (superRefine at 89-94) | – | `Commercial registration number is required for companies` (English, hard-coded) | `supplier.onboarding.errors.cr_number.required_company` |
| `OnboardingStep1` | `national_id` (superRefine at 96-101) | – | `National ID is required for freelancers` (English, hard-coded) | `supplier.onboarding.errors.national_id.required_freelancer` |

**Step 2** — `src/lib/domain/onboarding.ts:110-118`. None of these are currently surfaced to users (Step 2 form uses `t()` directly); they ARE surfaced if a non-JS caller hits the server action.

| Schema | Field | Validator | Current message | Proposed Arabic message (key) |
| --- | --- | --- | --- | --- |
| `OnboardingStep2` | `subcategory_ids` | `z.array(z.string().uuid()).min(1, "Pick at least one service").max(6, "Pick at most 6 categories")` | `"Pick at least one service"` / `"Pick at most 6 categories"` (literal English) | reuse existing `supplier.onboarding.step2RequireCategory`; add `supplier.onboarding.errors.subcategory_ids.max` |
| `OnboardingStep2` | `works_with_segments` | `z.array(z.enum(SEGMENT_TUPLE)).min(1, "Pick at least one market segment")` | `"Pick at least one market segment"` | reuse existing `supplier.onboarding.step2RequireSegment` |

**Step 3** — `src/lib/domain/onboarding.ts:128-133`. Form uses `t()` directly, no Zod messages visible. Schema's only surface is the server action error path where `FileLike.optional()` / `FileLike` can report `"Expected an uploaded file"` (line 66). That string IS still English but is only triggered by non-UI submissions.

| Schema | Field | Validator | Current message | Proposed Arabic message (key) |
| --- | --- | --- | --- | --- |
| `OnboardingStep3` | `logo_file` | `FileLike.optional()` | `"Expected an uploaded file"` | `supplier.onboarding.errors.logo_file.invalid` |
| `OnboardingStep3` | `iban_file` | `FileLike` (required) | `"Expected an uploaded file"` | `supplier.onboarding.iban.required` (REUSE existing — ar.json:530) |
| `OnboardingStep3` | `company_profile_file` | `FileLike.optional()` | `"Expected an uploaded file"` | `supplier.onboarding.errors.company_profile_file.invalid` |

### 3.3 Pattern choice: per-validator message vs global error map

The codebase has **no** `z.config({ localeError: ... })` call today (verified by grep across `src/`). next-intl is wired via `src/i18n/request.ts` and is read-only available in server and client contexts via `useTranslations` / `getTranslations`. Zod v4 ships a localised Arabic error map at `node_modules/zod/v4/locales/ar.js` (verified — covers `too_small`, `too_big`, `invalid_value`, `invalid_type`, `invalid_format`, etc., with messages like `"أصغر من اللازم: يفترض لـ string أن يكون >= 2"`).

Three candidate patterns, cheapest to strongest:

**(a) Per-`.min()` custom message with a translation key.** Each validator gets a short string key (e.g. `"onboarding.business_name.min"`); the form renders `t(errors.business_name?.message ?? "")` with a dictionary fallback. Tidy, explicit, but verbose — every `.min/.max/.enum/.refine` needs a key and the dictionary fans out across two JSON files.

**(b) Global Zod i18n error map, lazily installed per locale.** `z.config({ localeError: arLocale().localeError })` applied once in a client-side bootstrap (e.g. a tiny `src/lib/zod/i18n.ts` imported from a `providers.tsx` `useEffect`) plus the same thing on the server in `src/i18n/request.ts`. Zero per-field wiring; catches every schema in the codebase at once. Downside: Zod's built-in Arabic translations are generic ("أصغر من اللازم..."), not domain-aware ("يجب أن يكون اسم المسؤول حرفين على الأقل") — so UI quality is lower than (a).

**(c) Hybrid — global error map for coverage + custom messages for the ~10 highest-traffic fields.** Install Zod v4's `locales/ar.js` globally (catch-all) AND set `.min(2, { message: "onboarding.business_name.min" })` on the handful of fields the onboarding UX report flagged. Best of both.

Given the codebase already has distinct per-field labels in `messages/ar.json` (`representativeNameLabel`, `businessNameLabel`, `baseCityLabel`, `bioLabel`, etc., verified at lines 414, 423, 443, 648), pattern **(c)** is the pragmatic choice. The "next-intl sibling infra" that integrates cleanly:

- `src/i18n/request.ts:25-29` — extend to export the current locale for the Zod bootstrap.
- New file `src/lib/zod/i18n.ts` — `registerZodLocale(locale: "ar" | "en")` that imports Zod's bundled locale and calls `z.config({ localeError })`.
- Call it once from a root client provider (add to `src/app/layout.tsx` or an intl provider) and once in the server action entry points.
- Custom messages for onboarding fields live in `src/messages/{en,ar}.json` under a new `errors.*` namespace; the forms resolve them via a small `mapZodIssueToMessage(issue, t)` helper.

### 3.4 Scope flag

Fixing Step 1 alone (the only regression the UX report called out) closes UX-ZOD for the reported path. Extending the same fix to Step 2's schema messages (`"Pick at least one service"`, `"Pick at most 6 categories"`, `"Pick at least one market segment"`) is near-zero extra work and closes the server-action fallback. Step 3's schema messages are lower priority because the client UI never surfaces them.

---

## Section 4 — Estimated touch surface

### P3-01 (delete button)

| File | New / Modify | Notes |
| --- | --- | --- |
| `src/components/ui/alert-dialog.tsx` | NEW | Radix-based primitive, mirrors `dialog.tsx` style |
| `src/app/(supplier)/supplier/catalog/catalog-client.tsx` | modify | 3 `window.confirm` call sites (lines 241-251, 328-338, 361-371) |
| `src/app/(supplier)/supplier/calendar/block-list.tsx` | modify | 1 `window.confirm` call site (line 165-174) — consistency fix |
| `src/messages/en.json` / `src/messages/ar.json` | modify | Add `supplier.shared.confirmCancel`, `confirmConfirm` strings (or reuse existing `cancel` / `confirm` if present) |

### P3-02 (datetime-local)

| File | New / Modify | Notes |
| --- | --- | --- |
| `src/lib/domain/availability.ts` | modify | Replace `isoDateTime` with regex + transform; update `.refine` message to a key |
| `src/app/(supplier)/supplier/calendar/block-list.tsx` | modify | Remove `toIso`, update `onSubmit` to pass raw values, render errors via i18n map |
| `src/app/(supplier)/supplier/calendar/actions.ts` | no change | already schema-driven |
| `src/messages/en.json` / `src/messages/ar.json` | modify | Add `supplier.calendar.errors.{invalid_datetime_format, invalid_datetime_value, ends_before_starts}` |

### UX-ZOD

| File | New / Modify | Notes |
| --- | --- | --- |
| `src/lib/zod/i18n.ts` | NEW | `registerZodLocale(locale)` wrapping `z.config({ localeError: … })` |
| `src/i18n/request.ts` | modify | Call `registerZodLocale(locale)` during request bootstrap |
| `src/app/layout.tsx` or an intl client provider | modify | Call `registerZodLocale(locale)` on the client once |
| `src/lib/domain/onboarding.ts` | modify | Attach custom message keys to `OnboardingStep1` validators (representative_name, business_name, bio, base_city, service_area_cities, languages); same for `OnboardingStep2.subcategory_ids`, `.works_with_segments`; and the two `superRefine` branches (`cr_number.required_company`, `national_id.required_freelancer`) |
| `src/lib/domain/onboarding.ts` (line 66) | modify | Replace `FileLike` message `"Expected an uploaded file"` with a key |
| `src/app/(onboarding)/supplier/onboarding/wizard.tsx` | modify | Add a small `mapError(err)` helper rendered in place of `errors.<field>?.message` on Step 1; no change to Steps 2/3 (they already use `t()` manually) |
| `src/messages/en.json` / `src/messages/ar.json` | modify | Add `supplier.onboarding.errors.*` namespace populated per Section 3.2 table |
| `src/app/(onboarding)/supplier/onboarding/actions.ts` | no change | server error serialization stays the same; translated strings flow through the schema now |

### Cross-cutting total

- New files: 2 (`src/components/ui/alert-dialog.tsx`, `src/lib/zod/i18n.ts`)
- Modified files: 9 (1 catalog client, 1 calendar client, 1 availability domain, 1 onboarding domain, 1 onboarding wizard, 2 messages bundles, 1 i18n bootstrap, 1 root layout/provider)
- No server-action or DB schema changes required. All fixes stay in the presentation + domain-validation layer.

---

**Report end. No edits made to source. Report length: ~280 lines.**
