# Sevent — Planning Q&A Log

Date: 2026-04-15
Context: Planning session with user before first-stage MVP build of the Sevent (Saudi event) marketplace. User runs a Next.js project, will self-host on Ubuntu, and has 3 research docs in `Docs/` informing strategy. Payments for pilot are **off-platform via bank transfer**; platform records state but does not yet integrate Tap/escrow/ZATCA.

---

## Batch 1 — Scope & market foundations

| Question | Answer |
|---|---|
| Geographic scope of pilot | **Nationwide Saudi Arabia** (but see Batch 2 — pilot concentrated in Riyadh + Jeddah) |
| Languages at launch | **English first, then translate to Arabic**. Build English-first but architecture must support Arabic/RTL later |
| Event-service categories in pilot | **All categories we can support** — Venues/halls, Catering & F&B, Photography & videography, Decor/flowers/stage, and more |
| Primary buyer persona | **Corporate / SMEs, Government / semi-gov entities, Event-planning agencies** (B2C individuals deferred) |

## Batch 2 — Pilot scope & milestone

| Question | Answer |
|---|---|
| What the pilot must demonstrate | **Clickable demo + supplier-side SaaS MVP**; payments supported externally via bank transfer |
| Target timeline | **2-3 months (MVP)** |
| Pilot geography | **Riyadh + Jeddah** |
| Pilot suppliers | ~200 friendly suppliers available; **20-30 to be contacted for pilot** |

## Batch 3 — Tech stack & infrastructure

| Question | Answer |
|---|---|
| Next.js architecture | **App Router + Server Actions** |
| Database / BaaS | **Self-hosted Supabase (recommended by Claude)** — Postgres + Auth + Storage + Studio via Docker Compose on own Ubuntu server |
| Hosting | **User's own Ubuntu server** initially; migrate to AWS later |
| Maps & geocoding | **Google Maps Platform** (Place Autocomplete, Distance Matrix) |

## Batch 4 — Auth, identity & verification

| Question | Answer |
|---|---|
| Login methods in MVP | **Email + password** (Nafath / phone OTP deferred) |
| Supplier verification scope | **Manual review of uploaded documents** by admin |
| Supplier types | **Registered companies (with CR) + Freelancers/individuals (with national ID) + Foreign/expat-run businesses** |
| User roles from day one | **Organizer/buyer + Supplier/vendor + Platform admin + Agency (organizer acting for client)** |

## Batch 5 — Search, discovery & supplier profiles

| Question | Answer |
|---|---|
| Organizer discovery mechanisms | **Search + filters (category, city, price, rating, date) + Browse by category pages**; AI/semantic search deferred |
| Supplier profile must-haves | **Team, certifications, GEA/CR docs, languages, capacity + Portfolio media (photos + videos) + Services catalog with base prices / price ranges** |
| RFQ form structure | **Hybrid (Claude recommended): universal core fields + optional category-specific section** |
| RFQ routing | **Hybrid: auto-match + let organizer add/remove suppliers** |

## Batch 6 — Pricing engine depth

| Question | Answer |
|---|---|
| Pricing engine depth | **Rule-based price builder AND free-form quote** — supplier can auto-generate from rules, then edit / add details |
| Pricing variables required | **All four: Volume/qty tiers + Distance/travel fees + Date surcharges (weekends, peak, holidays) + Duration multipliers (hourly/daily/weekly)** |
| Pre-RFQ price transparency | **Yes — show "from" prices or auto-estimates on supplier profiles** |
| Dynamic platform-wide multipliers (Uber-style) | **Suppliers fully control their rules — platform only suggests** |

## Batch 7 — Quotations, comparison & booking commitment

| Question | Answer |
|---|---|
| Required quote fields | **Line items + unit prices + totals, Travel/setup/teardown fees, Deposit %, payment schedule, cancellation terms, expiry date, Inclusions/exclusions** |
| Quote comparison UI | **Both side-by-side table and card view, toggleable** |
| Commitment boundary | **Organizer accepts quote → supplier must confirm → booked** (two-sided acceptance) |
| Supplier calendar | **Full calendar with blocked dates; bookings auto-block** |

## Batch 8 — Messaging, notifications & contracts

| Question | Answer |
|---|---|
| In-platform chat | **Show supplier contact info directly after RFQ** (note: high disintermediation risk — acceptable in pilot since payments are off-platform anyway; must revisit when real escrow ships) |
| Notification channels | **Email (transactional) + In-app / web push** (SMS/WhatsApp deferred) |
| Digital contract | **Auto-generated PDF from accepted quote + terms — click-to-agree** |
| Cancellation policy | **Platform-wide single policy** |

## Batch 9 — Reviews, disputes & admin

| Question | Answer |
|---|---|
| Review system | **Two-way, double-blind, verified-booking only** (hidden until both submit or 14-day window closes) |
| Rating dimensions | **Overall star + Value for money + Punctuality + Professionalism** |
| Admin dashboard features | **Supplier verification review queue + RFQ/booking monitoring + Category/taxonomy/content management** |
| Dispute resolution | **Structured in-app form + admin workspace** |

## Batch 10 — Cultural, taxonomy, SaaS tools, brand

| Question | Answer |
|---|---|
| Gender segregation features | **Skip in pilot, add later** |
| Service category structure | **2-level: parent category → subcategory** (e.g. Photography → Wedding / Corporate / Product) |
| Supplier SaaS toolbox | **Dashboard (RFQs + bookings) + Calendar + Quote templates + Performance analytics (views, response rate, win rate)** |
| Brand assets | **Name: Sevent.** Palette: `#006C35` Saudi green (primary), `#C8993A` gold (distinctive accent), `#1E9A5B` secondary green (helpers), `#0B1E12` dark bg (luxury), `#F0FAF4` light bg (content), white |

## Batch 11 — Public pages, metrics, dev workflow

| Question | Answer |
|---|---|
| Public / SEO pages | **Landing page + category pages (SEO-friendly) + Supplier profile pages public & indexable**; organizer flows behind login |
| Pilot success metrics | **Suppliers onboarded + active suppliers + RFQs sent + quote-response rate + quote-to-booking conversion** |
| Task management | **Skip formal task tracking for pilot** |
| Repo state | **Greenfield — empty except `Docs/`** |

---

## Key derived principles for the build

1. **Payments external for MVP** — platform records booking state, generates PDF contract, but money moves by bank transfer between organizer and supplier. No Tap, no escrow, no ZATCA e-invoicing in v1.
2. **English-first with i18n scaffolding** — use `next-intl` from day one so Arabic/RTL can be added without refactor.
3. **Supply-side SaaS is the moat** — calendar, dashboard, quote templates, analytics must feel useful on day one even without customer demand.
4. **Hybrid RFQ routing** — auto-match 3-5 suppliers; organizer can edit the list.
5. **Rule-based pricing engine with free-form override** — must support qty tiers, distance (Google Distance Matrix), date surcharges, duration multipliers; supplier always retains edit rights.
6. **Two-sided acceptance commitment** — organizer accepts quote → supplier confirms → booking is locked and calendar blocks automatically.
7. **Verified-booking double-blind reviews** with 4 rating dimensions.
8. **Admin workspace** from day one for verification approvals, RFQ/booking monitoring, dispute mediation, and taxonomy management.
9. **Known deferred items** (documented as follow-ups): Tap Payments integration, Wathq API, Nafath ID, ZATCA FATOORAH, Arabic/RTL UI, gender-segregation features, SMS/WhatsApp, in-app chat, Google Calendar sync, dynamic platform-wide multipliers, GEA permit integration, incremental payment authorizations for change orders.
