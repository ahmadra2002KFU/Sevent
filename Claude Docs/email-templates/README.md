> **Document status (2026-05-17):** Outdated. The old “2 templates, English-only” baseline is superseded by the current locale-aware template set and outbox delivery path.

# Sevent — Transactional Emails

This folder is the source of truth for every transactional email the platform sends via **Resend**.

## What's in here

| File | Purpose |
|---|---|
| [`catalog.md`](./catalog.md) | The complete inventory of templates we need to build — grouped by role, with trigger, recipient, CTA, source-file evidence, and a one-line summary. **Start here.** |
| [`architecture.md`](./architecture.md) | Locale strategy (AR/EN), folder convention, brand tokens, Resend wiring decisions, gaps that block specific templates. |
| `templates/` (later) | Markdown drafts of body copy per template (one file per template, with both AR and EN side-by-side) — written **before** the React Email components. |

## Where the code lives

- Wrapper: [`src/lib/notifications/email.ts`](../../src/lib/notifications/email.ts) — `sendEmail({to, subject, react, text?})`. Console-mode fallback when `RESEND_API_KEY` is unset.
- Existing templates: [`src/lib/notifications/templates/`](../../src/lib/notifications/templates/) — currently `SupplierApproved.tsx` and `SupplierRejected.tsx` (English-only).
- In-app notification kinds: [`src/lib/notifications/inApp.ts`](../../src/lib/notifications/inApp.ts) — `NotificationKind` union; **every kind in this union deserves an email**, plus several events that don't have an in-app row yet.
- State diagrams: [`Claude Docs/state-machines.md`](../state-machines.md) — booking, review-publication, dispute lifecycle.

## Workflow

1. **Plan** — review `catalog.md` and decide which templates ship in this batch.
2. **Draft copy** — write AR + EN copy in `templates/<template-name>.md` (markdown is faster to iterate than JSX, and lets us review tone before any styling).
3. **Build component** — implement `<TemplateName>.tsx` in `src/lib/notifications/templates/` driven by a `locale: "en" | "ar"` prop.
4. **Wire trigger** — `await sendEmail(...)` next to the existing `await createNotification(...)` site (per Sprint 2 lane-3 contract: never roll back DB on email failure).
5. **Test** — local dev runs in console-mode (logs the rendered HTML to terminal); preview via React Email's dev server.

## Status

- Inventory complete: see `catalog.md` (~46 distinct templates → ~92 files with AR/EN pairs).
- Built: 2 of ~46 (`SupplierApproved`, `SupplierRejected` — both English-only; need Arabic twins).
- See `architecture.md` for the Supabase-auth-emails-via-Resend decision still pending.
