# Claude Docs — Index

This folder is the documentation, planning, and deliverables hub for the Sevent platform. It is organized by **purpose**, not by date.

## Layout

```
Claude Docs/
├── README.md                           ← you are here
│
├── plan.md                             ← top-level project plan (load-bearing)
├── runbook.md                          ← deploy / backup / restore (load-bearing)
├── state-machines.md                   ← booking / dispute / review flows (load-bearing)
├── pricing-examples.md                 ← deterministic pricing test cases (load-bearing)
├── stress-seed-riyadh-100.md           ← stress-seed dataset notes (load-bearing)
├── i18n-locale-aware-rendering-sweep.md ← i18n sweep findings (load-bearing)
├── mockup-source/                      ← original JSX design mockups (load-bearing)
│
├── deliverables/      ← anything sent to humans (boss, team, leadership)
│   ├── weekly-reports/
│   ├── replies/
│   └── decks/
│
├── sessions/          ← chronological session logs, progress, Q&A
├── plans/             ← forward-looking plans, sprints, fix-plans, roadmap
├── specs/             ← stable specifications (design tokens, taxonomy, access-control, workflows)
├── features/          ← feature-specific docs (e.g. supplier-onboarding)
├── runbooks/          ← operational runbooks (deployment, e2e walkthroughs)
├── scripts/           ← scripts that generate deliverables (.docx / .pptx builders)
├── mockups/           ← extracted mockups (HTML/JSX) — see also mockup-source/
└── research/          ← upstream business research (Claude / ChatGPT / Gemini)
```

## Anchored files (at the root)

The 6 markdown files and `mockup-source/` at the root are **referenced by production code, configuration, or migrations**. Moving them would force edits across `src/`, `eslint.config.mjs`, `scripts/seed-stress-riyadh.ts`, `supabase/migrations/`, `docker-compose.prod.yml`, and the project root `README.md`. They stay at the root.

| File / folder | Referenced by |
|---|---|
| `plan.md` | `supabase/migrations/20260421000000_taxonomy_profile_polish.sql` |
| `runbook.md` | root `README.md`, `docker-compose.prod.yml` |
| `state-machines.md` | `src/lib/domain/pricing/rules.ts`, `src/lib/domain/matching/autoMatch.ts` |
| `pricing-examples.md` | `src/lib/domain/money.ts`, `src/lib/domain/pricing/{rules,engine,__tests__/engine.test}.ts` |
| `stress-seed-riyadh-100.md` | `scripts/seed-stress-riyadh.ts` |
| `i18n-locale-aware-rendering-sweep.md` | `eslint.config.mjs` (excluded path) |
| `mockup-source/` | `src/components/auth/SupplierSignupHero.tsx`, `src/components/supplier/onboarding/{BioField,ResumeCard,PathCard}.tsx` |

If you ever rename one of these, search-and-replace its old path across the whole repo first.

## Where to put new docs

| If it is… | Put it in… |
|---|---|
| A weekly report, leadership update, or any document sent outside the team | `deliverables/weekly-reports/` (prefix filename with date `YYYY-MM-DD-`) |
| An email reply rendered as `.docx` | `deliverables/replies/` |
| A presentation (`.pptx`) | `deliverables/decks/` |
| A daily session log or QA conversation | `sessions/` (prefix `YYYY-MM-DD-`) |
| A forward-looking plan, sprint breakdown, fix plan, roadmap | `plans/` |
| A stable specification (a thing that defines how something works) | `specs/` |
| A doc tied to one feature (onboarding, RFQ/RFP, …) | `features/<feature-name>/` |
| An operational runbook (deploy, e2e walkthrough, ops procedure) | `runbooks/` |
| A node script that builds a deliverable | `scripts/` |
| Upstream research (Claude / ChatGPT / Gemini exploratory dumps) | `research/` |

## Filename conventions

- **Dated artifacts** (sessions, weekly reports, replies): prefix `YYYY-MM-DD-` so chronological sort works.
- **Stable specs**: short kebab-case names, no date prefix.
- **Feature-grouped docs**: collapse the feature name out of the filename — e.g. `features/supplier-onboarding/redesign.md`, not `features/supplier-onboarding/supplier-onboarding-redesign.md`.

## Cross-references

Most cross-references inside docs use the form `Claude Docs/<path>` (relative to the repo root). The reorg updated the high-traffic anchored files; some older session logs still contain stale paths — those are historical context and are not load-bearing.

## Things that are NOT here

- Memory files (auto-memory across conversations) live at `C:\Users\Ahmad\.claude\projects\D--Mufeed-Sevent-Code\memory\`.
- Approved plans (Codex / plan-mode) live at `C:\Users\Ahmad\.claude\plans\`.
- Source code lives in `src/`, migrations in `supabase/migrations/`, scripts in `scripts/`. The `scripts/` subfolder *here* is for documentation-deliverable builders only.
