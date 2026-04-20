"use client";

/**
 * Lane 3 · Sprint 3 — RFQ creation wizard.
 *
 * Four-step client state machine:
 *   1. Pick event + category (parent → subcategory cascading selects).
 *      If `?event_id=<id>` is present on mount, preselect.
 *   2. Requirements extension — derives `kind` from the subcategory's parent
 *      slug using the Lane 1 contract (venues/catering/photography/generic).
 *   3. Auto-match preview + shortlist editor.
 *   4. Review + send (deadline 24/48/72h, default 24h).
 *
 * Wizard state lives entirely in `useReducer`; no URL sync except step 1's
 * `?event_id` prefill. All DB/mutation work is routed through the sibling
 * server actions in ./actions.ts.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  RfqExtensionForm,
  defaultExtensionFor,
} from "@/components/rfq/extensions";
import {
  ShortlistEditor,
  type ShortlistSupplier,
} from "@/components/rfq/ShortlistEditor";
import type { RfqExtension, RfqExtensionKind } from "@/lib/domain/rfq";
import type { MatchResult } from "@/lib/domain/matching/autoMatch";
import {
  listCategoriesAction,
  listMyEventsAction,
  previewAutoMatchAction,
  searchApprovedSuppliersAction,
  sendRfqAction,
  type CategoriesBundle,
  type CategoryOption,
  type OrganizerEventSummary,
} from "../actions";

function kindFromParentSlug(slug: string | undefined): RfqExtensionKind {
  if (slug === "venues") return "venues";
  if (slug === "catering") return "catering";
  if (slug === "photography") return "photography";
  return "generic";
}

type WizardStep = 1 | 2 | 3 | 4;

type WizardState = {
  step: WizardStep;
  event_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  kind: RfqExtensionKind;
  kindOverridden: boolean;
  requirements: RfqExtension;
  matches: MatchResult[];
  removedMatches: Set<string>;
  manualAdds: ShortlistSupplier[];
  responseDeadlineHours: 24 | 48 | 72;
  matchingOffline: boolean;
};

type WizardAction =
  | { type: "setEvent"; event_id: string }
  | { type: "setCategory"; category_id: string }
  | { type: "setSubcategory"; subcategory_id: string; autoKind: RfqExtensionKind }
  | { type: "overrideKind"; kind: RfqExtensionKind }
  | { type: "setRequirements"; value: RfqExtension }
  | {
      type: "setMatches";
      matches: MatchResult[];
      matchingOffline: boolean;
    }
  | { type: "removeMatch"; supplier_id: string }
  | { type: "addManual"; supplier: ShortlistSupplier }
  | { type: "removeManual"; supplier_id: string }
  | { type: "setDeadline"; hours: 24 | 48 | 72 }
  | { type: "goto"; step: WizardStep };

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "setEvent":
      return { ...state, event_id: action.event_id };
    case "setCategory":
      return {
        ...state,
        category_id: action.category_id,
        subcategory_id: null,
      };
    case "setSubcategory": {
      const nextKind = state.kindOverridden ? state.kind : action.autoKind;
      const needsReset =
        !state.kindOverridden && state.kind !== action.autoKind;
      return {
        ...state,
        subcategory_id: action.subcategory_id,
        kind: nextKind,
        requirements: needsReset
          ? defaultExtensionFor(action.autoKind)
          : state.requirements,
      };
    }
    case "overrideKind":
      return {
        ...state,
        kind: action.kind,
        kindOverridden: true,
        requirements: defaultExtensionFor(action.kind),
      };
    case "setRequirements":
      return { ...state, requirements: action.value };
    case "setMatches":
      return {
        ...state,
        matches: action.matches,
        removedMatches: new Set<string>(),
        matchingOffline: action.matchingOffline,
      };
    case "removeMatch": {
      const next = new Set(state.removedMatches);
      next.add(action.supplier_id);
      return { ...state, removedMatches: next };
    }
    case "addManual": {
      if (state.manualAdds.some((s) => s.id === action.supplier.id)) return state;
      return {
        ...state,
        manualAdds: [...state.manualAdds, action.supplier],
      };
    }
    case "removeManual":
      return {
        ...state,
        manualAdds: state.manualAdds.filter((s) => s.id !== action.supplier_id),
      };
    case "setDeadline":
      return { ...state, responseDeadlineHours: action.hours };
    case "goto":
      return { ...state, step: action.step };
    default:
      return state;
  }
}

const INITIAL_STATE: WizardState = {
  step: 1,
  event_id: null,
  category_id: null,
  subcategory_id: null,
  kind: "generic",
  kindOverridden: false,
  requirements: defaultExtensionFor("generic"),
  matches: [],
  removedMatches: new Set<string>(),
  manualAdds: [],
  responseDeadlineHours: 24,
  matchingOffline: false,
};

export default function NewRfqWizardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [events, setEvents] = useState<OrganizerEventSummary[] | null>(null);
  const [categories, setCategories] = useState<CategoriesBundle | null>(null);
  const [loadingMatches, startMatchTransition] = useTransition();
  const [sending, startSendTransition] = useTransition();
  const [sendError, setSendError] = useState<string | null>(null);

  // Prefetch events + categories on mount.
  useEffect(() => {
    let cancelled = false;
    Promise.all([listMyEventsAction(), listCategoriesAction()]).then(
      ([evts, cats]) => {
        if (cancelled) return;
        setEvents(evts);
        setCategories(cats);
        // If ?event_id=<id> is in the URL and matches a real event, preselect.
        const preselect = searchParams.get("event_id");
        if (preselect && evts.some((e) => e.id === preselect)) {
          dispatch({ type: "setEvent", event_id: preselect });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const parents = categories?.parents ?? [];
  const childrenForSelected: CategoryOption[] = useMemo(() => {
    if (!state.category_id || !categories) return [];
    return categories.children.filter((c) => c.parent_id === state.category_id);
  }, [categories, state.category_id]);

  const autoMatchVisible = state.matches.filter(
    (m) => !state.removedMatches.has(m.supplier_id),
  );
  const shortlistSize = autoMatchVisible.length + state.manualAdds.length;

  const gotoStep = useCallback(
    (step: WizardStep) => {
      dispatch({ type: "goto", step });
    },
    [],
  );

  const advanceToMatches = useCallback(() => {
    if (!state.event_id || !state.category_id || !state.subcategory_id) return;
    startMatchTransition(async () => {
      const result = await previewAutoMatchAction({
        event_id: state.event_id,
        category_id: state.category_id,
        subcategory_id: state.subcategory_id,
      });
      if (result.ok) {
        dispatch({ type: "setMatches", matches: result.matches, matchingOffline: false });
      } else if (result.error === "matching_offline") {
        dispatch({ type: "setMatches", matches: [], matchingOffline: true });
      } else {
        dispatch({ type: "setMatches", matches: [], matchingOffline: false });
      }
      dispatch({ type: "goto", step: 3 });
    });
  }, [state.event_id, state.category_id, state.subcategory_id]);

  const handleSearchSuppliers = useCallback(
    async (q: string): Promise<ShortlistSupplier[]> => {
      if (!state.subcategory_id) return [];
      const hits = await searchApprovedSuppliersAction({
        subcategory_id: state.subcategory_id,
        q,
      });
      return hits.map((h) => ({
        id: h.id,
        business_name: h.business_name,
        base_city: h.base_city,
        slug: h.slug,
        out_of_subcategory: !h.in_subcategory,
      }));
    },
    [state.subcategory_id],
  );

  const handleSend = useCallback(() => {
    setSendError(null);
    if (
      !state.event_id ||
      !state.category_id ||
      !state.subcategory_id ||
      shortlistSize < 1 ||
      shortlistSize > 10
    )
      return;

    const shortlist: Array<{
      supplier_id: string;
      source: "auto_match" | "organizer_picked";
    }> = [
      ...autoMatchVisible.map((m) => ({
        supplier_id: m.supplier_id,
        source: "auto_match" as const,
      })),
      ...state.manualAdds.map((s) => ({
        supplier_id: s.id,
        source: "organizer_picked" as const,
      })),
    ];

    startSendTransition(async () => {
      const result = await sendRfqAction({
        event_id: state.event_id,
        category_id: state.category_id,
        subcategory_id: state.subcategory_id,
        requirements: state.requirements,
        response_deadline_hours: state.responseDeadlineHours,
        shortlist,
      });
      if (result.ok) {
        router.push(`/organizer/rfqs/${result.rfq_id}`);
      } else {
        setSendError(result.error);
      }
    });
  }, [
    state.event_id,
    state.category_id,
    state.subcategory_id,
    state.requirements,
    state.responseDeadlineHours,
    state.manualAdds,
    autoMatchVisible,
    shortlistSize,
    router,
  ]);

  const selectedEvent = events?.find((e) => e.id === state.event_id) ?? null;
  const selectedParent = parents.find((p) => p.id === state.category_id) ?? null;
  const selectedSub =
    categories?.children.find((c) => c.id === state.subcategory_id) ?? null;

  const canLeaveStep1 =
    !!state.event_id && !!state.category_id && !!state.subcategory_id;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">New RFQ</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Step {state.step} of 4
        </p>
      </header>

      <StepTabs current={state.step} onGoto={gotoStep} />

      {state.step === 1 ? (
        <Step1
          events={events}
          parents={parents}
          subcategoryOptions={childrenForSelected}
          allChildren={categories?.children ?? []}
          state={state}
          dispatch={dispatch}
        />
      ) : null}

      {state.step === 2 ? (
        <Step2
          selectedSub={selectedSub}
          state={state}
          dispatch={dispatch}
        />
      ) : null}

      {state.step === 3 ? (
        <Step3
          loading={loadingMatches}
          matchingOffline={state.matchingOffline}
          matches={autoMatchVisible}
          manualAdds={state.manualAdds}
          onRemoveMatch={(id) => dispatch({ type: "removeMatch", supplier_id: id })}
          onAddManual={(s) => dispatch({ type: "addManual", supplier: s })}
          onRemoveManual={(id) =>
            dispatch({ type: "removeManual", supplier_id: id })
          }
          onSearchSuppliers={handleSearchSuppliers}
        />
      ) : null}

      {state.step === 4 ? (
        <Step4
          state={state}
          dispatch={dispatch}
          selectedEvent={selectedEvent}
          selectedParent={selectedParent}
          selectedSub={selectedSub}
          shortlist={[
            ...autoMatchVisible.map((m) => ({
              id: m.supplier_id,
              business_name: m.business_name,
              source: "auto_match" as const,
            })),
            ...state.manualAdds.map((s) => ({
              id: s.id,
              business_name: s.business_name,
              source: "organizer_picked" as const,
            })),
          ]}
          sending={sending}
          onSend={handleSend}
          error={sendError}
        />
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4">
        <div>
          {state.step > 1 ? (
            <button
              type="button"
              onClick={() =>
                gotoStep((state.step - 1) as WizardStep)
              }
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
            >
              Back
            </button>
          ) : (
            <Link
              href="/organizer/rfqs"
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
            >
              Cancel
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          {state.step === 1 ? (
            <button
              type="button"
              disabled={!canLeaveStep1}
              onClick={() => gotoStep(2)}
              className="rounded-md bg-[var(--color-primary,#111)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Next
            </button>
          ) : null}
          {state.step === 2 ? (
            <button
              type="button"
              onClick={advanceToMatches}
              disabled={loadingMatches}
              className="rounded-md bg-[var(--color-primary,#111)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {loadingMatches ? "Matching…" : "Next"}
            </button>
          ) : null}
          {state.step === 3 ? (
            <button
              type="button"
              onClick={() => gotoStep(4)}
              disabled={shortlistSize < 1 || shortlistSize > 10}
              className="rounded-md bg-[var(--color-primary,#111)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Next ({shortlistSize}/10)
            </button>
          ) : null}
        </div>
      </footer>
    </section>
  );
}

function StepTabs({
  current,
  onGoto,
}: {
  current: WizardStep;
  onGoto: (s: WizardStep) => void;
}) {
  const labels: Array<{ step: WizardStep; label: string }> = [
    { step: 1, label: "Event & category" },
    { step: 2, label: "Requirements" },
    { step: 3, label: "Shortlist" },
    { step: 4, label: "Review & send" },
  ];
  return (
    <ol className="flex flex-wrap gap-2">
      {labels.map(({ step, label }) => {
        const active = step === current;
        const clickable = step < current;
        return (
          <li key={step}>
            <button
              type="button"
              onClick={clickable ? () => onGoto(step) : undefined}
              disabled={!clickable}
              className={
                "rounded-full px-3 py-1 text-xs font-medium " +
                (active
                  ? "bg-[var(--color-primary,#111)] text-white"
                  : clickable
                    ? "border border-[var(--color-border)] bg-white hover:bg-[var(--color-muted)]"
                    : "border border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)] cursor-default")
              }
            >
              {step}. {label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Step1({
  events,
  parents,
  subcategoryOptions,
  allChildren,
  state,
  dispatch,
}: {
  events: OrganizerEventSummary[] | null;
  parents: CategoryOption[];
  subcategoryOptions: CategoryOption[];
  allChildren: CategoryOption[];
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}) {
  return (
    <div className="flex flex-col gap-5 rounded-lg border border-[var(--color-border)] bg-white p-5">
      <Field label="Event">
        {events === null ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            You have no events yet.{" "}
            <Link
              href="/organizer/events/new"
              className="text-[var(--color-sevent-green,#0a7)] hover:underline"
            >
              Create one
            </Link>
            {" "}first.
          </p>
        ) : (
          <select
            value={state.event_id ?? ""}
            onChange={(e) =>
              dispatch({ type: "setEvent", event_id: e.target.value })
            }
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {events.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.event_type}
                {evt.client_name ? ` · ${evt.client_name}` : ""} · {evt.city} ·{" "}
                {evt.starts_at.slice(0, 10)}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field label="Category">
        <select
          value={state.category_id ?? ""}
          onChange={(e) =>
            dispatch({ type: "setCategory", category_id: e.target.value })
          }
          className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        >
          <option value="">—</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name_en}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Subcategory">
        <select
          value={state.subcategory_id ?? ""}
          onChange={(e) => {
            const subId = e.target.value;
            if (!subId) {
              dispatch({ type: "setSubcategory", subcategory_id: "", autoKind: "generic" });
              return;
            }
            const parent = parents.find((p) => p.id === state.category_id);
            const sub = allChildren.find((c) => c.id === subId);
            const parentSlug = parent?.slug;
            const autoKind = kindFromParentSlug(parentSlug);
            dispatch({
              type: "setSubcategory",
              subcategory_id: subId,
              autoKind,
            });
            void sub; // autoKind already captured
          }}
          className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          disabled={!state.category_id}
        >
          <option value="">—</option>
          {subcategoryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_en}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function Step2({
  selectedSub,
  state,
  dispatch,
}: {
  selectedSub: CategoryOption | null;
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}) {
  // Extension kind is derived from the selected subcategory in Step 1 — do
  // NOT let the organizer override it here. Allowing a free override meant a
  // photography RFQ could be sent with a catering payload (Sprint 3 audit
  // #10). Subcategories that don't have a dedicated form fall back to the
  // `generic` renderer automatically via RfqExtensionForm.
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[var(--color-border)] bg-white p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Requirements</h2>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {selectedSub
            ? `${selectedSub.name_en} · form auto-selected by category`
            : "Form auto-selected by category"}
        </p>
      </div>

      <RfqExtensionForm
        kind={state.kind}
        value={state.requirements}
        onChange={(next) => dispatch({ type: "setRequirements", value: next })}
      />
    </div>
  );
}

function Step3({
  loading,
  matchingOffline,
  matches,
  manualAdds,
  onRemoveMatch,
  onAddManual,
  onRemoveManual,
  onSearchSuppliers,
}: {
  loading: boolean;
  matchingOffline: boolean;
  matches: MatchResult[];
  manualAdds: ShortlistSupplier[];
  onRemoveMatch: (id: string) => void;
  onAddManual: (s: ShortlistSupplier) => void;
  onRemoveManual: (id: string) => void;
  onSearchSuppliers: (q: string) => Promise<ShortlistSupplier[]>;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[var(--color-border)] bg-white p-5">
      {loading ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Running auto-match…
        </p>
      ) : matchingOffline ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Auto-match is unavailable right now. You can still build the shortlist
          manually below.
        </p>
      ) : null}

      <ShortlistEditor
        matches={matches}
        manualAdds={manualAdds}
        onRemoveMatch={onRemoveMatch}
        onAddManual={onAddManual}
        onRemoveManual={onRemoveManual}
        onSearchSuppliers={onSearchSuppliers}
      />
    </div>
  );
}

function Step4({
  state,
  dispatch,
  selectedEvent,
  selectedParent,
  selectedSub,
  shortlist,
  sending,
  onSend,
  error,
}: {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  selectedEvent: OrganizerEventSummary | null;
  selectedParent: CategoryOption | null;
  selectedSub: CategoryOption | null;
  shortlist: Array<{
    id: string;
    business_name: string;
    source: "auto_match" | "organizer_picked";
  }>;
  sending: boolean;
  onSend: () => void;
  error: string | null;
}) {
  const reqEntries = Object.entries(state.requirements).filter(
    ([k]) => k !== "kind",
  );
  const canSend = shortlist.length >= 1 && shortlist.length <= 10;

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-[var(--color-border)] bg-white p-5">
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Event
        </h2>
        {selectedEvent ? (
          <p className="text-sm">
            {selectedEvent.event_type}
            {selectedEvent.client_name ? ` · ${selectedEvent.client_name}` : ""}
            {" · "}
            {selectedEvent.city}
            {" · "}
            {selectedEvent.starts_at.slice(0, 10)}
          </p>
        ) : (
          <p className="text-sm text-[var(--color-muted-foreground)]">—</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Category
        </h2>
        <p className="text-sm">
          {selectedParent?.name_en ?? "—"}
          {selectedSub ? ` · ${selectedSub.name_en}` : ""}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Requirements ({state.kind})
        </h2>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {reqEntries.map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <dt className="text-xs text-[var(--color-muted-foreground)]">{k}</dt>
              <dd className="text-sm">
                {Array.isArray(v)
                  ? v.join(", ") || "—"
                  : typeof v === "boolean"
                    ? v
                      ? "Yes"
                      : "No"
                    : v === null || v === undefined || v === ""
                      ? "—"
                      : String(v)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Shortlist ({shortlist.length})
        </h2>
        {shortlist.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            No suppliers selected.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {shortlist.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <span>{s.business_name}</span>
                <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-muted)] px-2 py-0.5 text-xs">
                  {s.source === "auto_match" ? "Auto match" : "Organizer picked"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Response deadline</span>
          <select
            value={state.responseDeadlineHours}
            onChange={(e) =>
              dispatch({
                type: "setDeadline",
                hours: Number(e.target.value) as 24 | 48 | 72,
              })
            }
            className="w-full max-w-xs rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          >
            <option value={24}>Within 24 hours</option>
            <option value={48}>Within 48 hours</option>
            <option value={72}>Within 72 hours</option>
          </select>
        </label>
      </section>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canSend || sending}
          onClick={onSend}
          className="rounded-md bg-[var(--color-primary,#111)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send RFQ"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
