# Sevent — Weekly Progress Report

**Project:** Sevent — the Saudi event marketplace
**Reporting window:** Weeks 1–6 (three two-week sprints)
**Status:** 3 of 6 sprints complete. Roughly **50% of the pilot system** is built.
**Next window:** Sprint 4 — pricing & booking acceptance.
**Pilot target:** ~Mid-July 2026, with 20–30 friendly Riyadh/Jeddah suppliers.

---

## 1. What Sevent is, in one paragraph

Sevent replaces the old "tender" pattern for the Saudi event industry. One organizer sends **one** request; the platform routes it to the best 3–5 verified suppliers, tracks every step (request → quote → acceptance → confirmation → contract → review), and keeps a full audit trail. Payments stay **off-platform** in the pilot — the system records the state, generates a legally-consistent contract PDF, and sends notifications.

---

## 2. The system at a glance

Four actors, one platform:

| Actor | What they do |
|---|---|
| **Organizer** | Posts events, sends RFQs, compares quotes, accepts one, reviews the supplier afterwards. |
| **Supplier** | Gets verified by admin, publishes a profile + catalog + pricing, receives RFQs, sends quotes, confirms bookings, reviews the organizer. |
| **Admin** | Verifies suppliers, resolves disputes, has a read-only view over everything. |
| **Public visitor** | Browses approved suppliers by category and city (no login needed). |

The platform itself enforces the rules: only one booking per timeslot, quotes are immutable once sent, contracts are generated from the exact accepted quote, reviews only publish under the right conditions.

---

## 3. Key decisions (locked)

| Area | Decision | Why it matters |
|---|---|---|
| Hosting | **Self-hosted** on our Ubuntu box | Full control over data, lower ongoing cost. |
| Payments | **Off-platform** in the pilot (bank transfer) | Skips the long regulatory/VAT path for now; we come back to this after pilot. |
| Money | All amounts stored as **integer halalas** (no decimals, no rounding drift) | One cent is never lost anywhere in the system. |
| Contracts | Generated **from the quote**, not re-typed | Contract and quote can never disagree. |
| Language | **English-first**, Arabic wiring in place | Full Arabic translation pass deferred to v1.1 without rework. |
| Timeline | **6 sprints × 2 weeks** = 12 weeks to pilot | Half of the plan is already delivered. |
| Scope discipline | **Locked cut list** (see §8) | Keeps the pilot shippable on time. |

---

## 4. What's delivered so far

### ✅ Sprint 1 — Foundations (Weeks 1–2)
- All four roles (organizer, supplier, admin, public) can sign up and sign in.
- The full database of the system is designed, built, and protected so each user sees only what they're allowed to.
- Nightly backups and a documented restore procedure are in place.
- The booking lifecycle, dispute flow, and review flow are diagrammed and agreed.

### ✅ Sprint 2 — Supplier side (Weeks 3–4)
- Suppliers can complete a **3-step onboarding wizard** (business info → documents → location & capacity).
- Admins have a **verification queue** to approve or reject suppliers with a note; approval sends a branded email.
- Suppliers can build their **catalog** (packages, prices, 5 types of pricing rules) and a **public profile page** visible to the world.
- Suppliers can manage their **calendar** with manual unavailable blocks.
- 25 pilot-ready supplier profiles seeded across Riyadh and Jeddah (12/13 split).

### ✅ Sprint 3 — Organizer side + matching (Weeks 5–6)
- Public browsing: **category index** + **city filter** + **supplier profile pages**.
- Organizer dashboard with event and RFQ summaries.
- **Event creator** + **RFQ wizard** (4 steps): pick event → fill category-specific details → review auto-matched shortlist → send with a deadline (24/48/72 h).
- **Auto-match engine** live: filters out unqualified/unavailable suppliers, then ranks the top 5 with human-readable reasons.
- Supplier **RFQ inbox** with live countdown and decline action.

---

## 5. Core workflows (how the system runs end-to-end)

### 5.1 The main flow — request to contract

```
Organizer posts Event
      │
      ▼
RFQ Wizard ──▶ Auto-match engine picks top 5 suppliers
      │             (filters: approved · available · in-region · has capacity)
      ▼
Organizer adjusts shortlist (remove/add) ──▶ Sends RFQ with deadline
      │
      ▼
Suppliers see RFQ in their inbox with countdown
      │
      ▼
[Sprint 4] Each supplier sends a priced Quote   ──▶ Immutable snapshot taken
      │
      ▼
[Sprint 4] Organizer compares quotes → Accepts one
      │                                          ┐
      ▼                                          │  At the moment of acceptance, the
Booking state = "awaiting supplier" (48h)        │  slot is soft-held. Two organizers
      │                                          │  cannot accept the same slot.
      ▼                                          ┘
[Sprint 5] Supplier confirms (or auto-cancels at 48h)
      │
      ▼
[Sprint 5] Contract PDF generated from the accepted Quote
      │        Both parties receive it by email and in-app.
      ▼
Event happens
      │
      ▼
[Sprint 5] 14-day review window opens
      │     Both parties submit → auto-publish.
      │     Dispute opened? → reviews held until admin resolves.
      ▼
Closed.
```

### 5.2 Supplier publication flow (live today)

```
Sign up → Onboarding (3 steps) → Documents uploaded → "pending"
      ↓
Admin reviews docs → Approve / Reject → Email notification
      ↓
Supplier publishes profile + catalog + pricing rules
      ↓
Profile goes live publicly; eligible for auto-match.
```

### 5.3 Built-in controls

| Control | Effect |
|---|---|
| Role-based access on every screen | An organizer cannot reach supplier/admin areas, and vice versa. |
| Supplier self-approval blocked | Only an admin can change a supplier's verification status. |
| Slot conflict guard | A booking cannot be created on a slot that's already soft-held or confirmed. |
| Immutable quote snapshots | Once a quote is sent, it cannot be silently edited. |
| Contract = Quote | The contract PDF is generated from the accepted quote — they cannot disagree. |
| Cross-supplier privacy | Supplier A cannot read Supplier B's RFQs, documents, or calendar. |
| Nightly backups + documented restore | Recoverability verified. |

---

## 6. Status & health

| Check | State |
|---|---|
| Code quality checks | ✅ Green |
| Automated tests (matching + pricing math) | ✅ 16 tests passing |
| Live end-to-end walk (local environment) | ⏳ Pending — needs Docker booted once on your machine |
| Production deploy | ◻ Sprint 6 deliverable |

---

## 7. Risks & watch-items

1. **Docker/infra friction on the dev machine** — harmless but blocks the end-to-end demo until the local environment is booted once.
2. **Pricing engine edge cases (next sprint)** — if the math surfaces many exceptions, we pause UI and refine the model before moving on. Budget built in.
3. **Supplier dry-run late in the project** may reveal usability blockers. 3 days of Sprint 6 are reserved for emergency polish only.
4. **Self-hosted ops load.** If it starts eating time late in Sprint 1/2, managed hosting is the agreed fallback. Not needed so far.

---

## 8. What's deliberately NOT in the pilot (cut list)

To protect the 12-week timeline: drag/drop calendars, quote templates library, supplier KPI widgets, admin metrics UI, taxonomy admin UI, web push notifications, dual view toggles, advanced public filters (date/rating/price), video uploads, full Arabic translation pass, SEO sitemap. All deferred to v1.1.

---

## 9. Roadmap — next three sprints

| Sprint | Window | Theme | Outcome for the business |
|---|---|---|---|
| **4** | Weeks 7–8 | Pricing engine, quotes, acceptance | Suppliers send real priced quotes; organizer can accept one; slot is locked transactionally. |
| **5** | Weeks 9–10 | Confirm, contract PDF, reviews, disputes | Full loop closed: confirmation → contract → reviews → disputes. |
| **6** | Weeks 11–12 | Hardening & pilot readiness | Production deploy, backup drill, accessibility pass, 2–3 friendly suppliers onboarded for real. |

**Pilot-ready target:** mid-July 2026.

---

## 10. One-line summary

> Half of the pilot is built. Supplier side is end-to-end. Organizer side can create events, send RFQs, and receive auto-matched shortlists. Next six weeks add pricing, quote acceptance, confirmation, contracts, reviews, and production deployment.

---

_Prepared 2026-04-16._
