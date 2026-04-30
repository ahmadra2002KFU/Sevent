# Deploy Note — 2026-04-30 — Frontend perf & UX hardening

## Database / Supabase changes
**None.** No migrations, no RLS changes, no function/trigger changes, no storage bucket or policy changes, no seed data.

## Required production-only config change

`next.config.ts` was updated for local Supabase image optimization. Before deploying to production, **add the production Supabase storage host** to `images.remotePatterns` alongside the existing local entries:

```ts
images: {
  remotePatterns: [
    // Local (already in repo) — safe to leave for dev parity
    { protocol: 'http',  hostname: '127.0.0.1',  port: '54321', pathname: '/storage/v1/object/public/**' },
    { protocol: 'http',  hostname: 'localhost',  port: '54321', pathname: '/storage/v1/object/public/**' },
    // Add this for production:
    { protocol: 'https', hostname: '<prod-supabase-host>',       pathname: '/storage/v1/object/public/**' },
  ],
}
```

`<prod-supabase-host>` is the hostname of the production self-hosted Supabase storage endpoint. If `NEXT_PUBLIC_SUPABASE_URL` in production is e.g. `https://supabase.sevent.sa`, the hostname is `supabase.sevent.sa` (drop the protocol and any path).

**Why this matters:** without this entry, `next/image` will throw on every supplier card, gallery photo, and profile hero in production. Everything looks fine in dev because we whitelisted `127.0.0.1:54321` only.

## Code changes shipped this session

### Image optimization (LCP / bandwidth)
- `next.config.ts` — added `images.remotePatterns` for local Supabase.
- `src/components/public/SupplierProfileHero.tsx` — removed `unoptimized`.
- `src/components/public/SupplierCard.tsx` — removed `unoptimized`.
- `src/components/public/GalleryGrid.tsx` — removed `unoptimized`.

### Error boundaries (graceful failure)
- `src/components/status/StatusView.tsx` (new) — shared minimal error/not-found UI.
- `src/app/global-error.tsx` (new) — catastrophic-failure fallback, dependency-free inline styles.
- `src/app/(public)/error.tsx`, `(auth)/error.tsx`, `(organizer)/organizer/error.tsx`, `(supplier)/supplier/error.tsx`, `(admin)/admin/error.tsx` (new).

### Not-found pages
- `src/app/not-found.tsx` (new) — root fallback.
- `src/app/(public)/not-found.tsx` (new) — covers `notFound()` calls in `(public)/categories/[parent]` and `(public)/s/[slug]`.

### Loading skeletons (perceived speed)
- 17 new `loading.tsx` files across `(auth)`, `(organizer)`, `(supplier)`, `(admin)`, and `(public)` route segments. Match existing `Skeleton` vocabulary.

### Server-side waterfall fixes (latency)
- `src/app/(organizer)/organizer/events/[id]/page.tsx` — parallelized profile + RFQs after the event fetch. Saves ~1 round-trip on non-owner paths.
- `src/app/(organizer)/organizer/rfqs/[id]/quotes/[quoteId]/page.tsx` — grouped revision + RFP rows; grouped tech-proposal + RFP signed URLs. Saves ~2 round-trips.

## Verification before merge / deploy
- `pnpm typecheck` — clean.
- `pnpm lint` — 0 new errors. 3 pre-existing errors remain in `FeedbackWidget.tsx` and `verifications/[id]/page.tsx` (React Compiler `set-state-in-effect`); unchanged by this session.

## Post-deploy smoke checks
1. Open a public supplier page (`/s/<slug>`) and confirm hero image loads (no 500 from the image optimizer). View source for `<source srcset="... .webp">` to confirm optimization is on.
2. Trigger any failing query (e.g. visit a deleted RFQ) and confirm the `error.tsx` fallback renders with a Try-again button.
3. Visit an unknown slug (`/s/this-does-not-exist`) and confirm `(public)/not-found.tsx` renders, not the generic browser 404.

## Known follow-ups (not in this session)
- Add production hostname to `remotePatterns` (above).
- Pre-existing lint errors in `FeedbackWidget.tsx`:87,118 and `verifications/[id]/page.tsx`:84 — separate fix.
- Remaining audit items deferred (P2): `'use cache'` for taxonomy lookups, dynamic-import `motion/react` in non-critical routes, Suspense-wrap `NavLinks` / `MobileNavSheet` / `ProfilePageTabs`.
