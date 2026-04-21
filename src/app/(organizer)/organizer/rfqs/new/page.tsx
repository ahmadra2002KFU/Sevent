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
 * Wizard state lives in `useReducer`; the current step is persisted to the URL
 * via `?step=N` so browser back/forward stays in sync.
 *
 * VISUAL RESTYLE (Lane 2): chrome rebuilt on shadcn primitives (Card, Button,
 * Select, RadioGroup, Alert, PageHeader, StatusPill). The reducer + server
 * action contract is unchanged.
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
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Send,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/ui-ext/StatusPill";
import { cn } from "@/lib/utils";
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
      if (state.manualAdds.some((s) => s.id === action.supplier.id))
        return state;
      return {
        ...state,
        manualAdds: [...state.manualAdds, action.supplier],
      };
    }
    case "removeManual":
      return {
        ...state,
        manualAdds: state.manualAdds.filter(
          (s) => s.id !== action.supplier_id,
        ),
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

function parseStepParam(raw: string | null): WizardStep {
  const n = raw ? Number.parseInt(raw, 10) : 1;
  if (n === 1 || n === 2 || n === 3 || n === 4) return n;
  return 1;
}

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
        const preselect = searchParams.get("event_id");
        if (preselect && evts.some((e) => e.id === preselect)) {
          dispatch({ type: "setEvent", event_id: preselect });
        }
        const stepParam = parseStepParam(searchParams.get("step"));
        if (stepParam !== 1) {
          dispatch({ type: "goto", step: stepParam });
        }
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync state.step → URL ?step=N (without adding new history entries per step
  // click — use router.replace).
  useEffect(() => {
    const current = parseStepParam(searchParams.get("step"));
    if (current === state.step) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", String(state.step));
    router.replace(`/organizer/rfqs/new?${params.toString()}`, {
      scroll: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  const parents = categories?.parents ?? [];
  const childrenForSelected: CategoryOption[] = useMemo(() => {
    if (!state.category_id || !categories) return [];
    return categories.children.filter(
      (c) => c.parent_id === state.category_id,
    );
  }, [categories, state.category_id]);

  const autoMatchVisible = state.matches.filter(
    (m) => !state.removedMatches.has(m.supplier_id),
  );
  const shortlistSize = autoMatchVisible.length + state.manualAdds.length;

  const gotoStep = useCallback((step: WizardStep) => {
    dispatch({ type: "goto", step });
  }, []);

  const advanceToMatches = useCallback(() => {
    if (!state.event_id || !state.category_id || !state.subcategory_id) return;
    startMatchTransition(async () => {
      const result = await previewAutoMatchAction({
        event_id: state.event_id,
        category_id: state.category_id,
        subcategory_id: state.subcategory_id,
      });
      if (result.ok) {
        dispatch({
          type: "setMatches",
          matches: result.matches,
          matchingOffline: false,
        });
      } else if (result.error === "matching_offline") {
        dispatch({
          type: "setMatches",
          matches: [],
          matchingOffline: true,
        });
      } else {
        dispatch({
          type: "setMatches",
          matches: [],
          matchingOffline: false,
        });
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
  const selectedParent =
    parents.find((p) => p.id === state.category_id) ?? null;
  const selectedSub =
    categories?.children.find((c) => c.id === state.subcategory_id) ?? null;

  const canLeaveStep1 =
    !!state.event_id && !!state.category_id && !!state.subcategory_id;

  return (
    <section className="flex flex-col gap-6">
      <Header stepLabel={state.step} />
      <Stepper current={state.step} onGoto={gotoStep} />

      <div aria-live="polite" className="min-h-0">
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
          <Step2 selectedSub={selectedSub} state={state} dispatch={dispatch} />
        ) : null}

        {state.step === 3 ? (
          <Step3
            loading={loadingMatches}
            matchingOffline={state.matchingOffline}
            matches={autoMatchVisible}
            manualAdds={state.manualAdds}
            onRemoveMatch={(id) =>
              dispatch({ type: "removeMatch", supplier_id: id })
            }
            onAddManual={(s) =>
              dispatch({ type: "addManual", supplier: s })
            }
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
      </div>

      <WizardFooter
        step={state.step}
        canLeaveStep1={canLeaveStep1}
        loadingMatches={loadingMatches}
        shortlistSize={shortlistSize}
        gotoStep={gotoStep}
        advanceToMatches={advanceToMatches}
      />
    </section>
  );
}

function Header({ stepLabel }: { stepLabel: WizardStep }) {
  return (
    <header className="flex flex-col gap-1">
      <p className="text-xs font-medium uppercase tracking-wide text-brand-cobalt-500">
        Step {stepLabel} of 4
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-brand-navy-900 sm:text-3xl">
        New RFQ
      </h1>
      <p className="text-sm text-muted-foreground">
        Send a request for quote to a curated shortlist of suppliers.
      </p>
    </header>
  );
}

function Stepper({
  current,
  onGoto,
}: {
  current: WizardStep;
  onGoto: (s: WizardStep) => void;
}) {
  const items: Array<{ step: WizardStep; label: string }> = [
    { step: 1, label: "Event & category" },
    { step: 2, label: "Requirements" },
    { step: 3, label: "Shortlist" },
    { step: 4, label: "Review & send" },
  ];

  return (
    <ol
      className="flex flex-wrap gap-2 rounded-xl border bg-card p-2"
      aria-label="Wizard steps"
    >
      {items.map(({ step, label }) => {
        const active = step === current;
        const done = step < current;
        const clickable = done;
        return (
          <li key={step} className="flex-1">
            <button
              type="button"
              onClick={clickable ? () => onGoto(step) : undefined}
              disabled={!clickable}
              aria-current={active ? "step" : undefined}
              className={cn(
                "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-sm transition-colors",
                active && "bg-brand-cobalt-500 text-white",
                done &&
                  "bg-semantic-success-100 text-semantic-success-500 hover:bg-semantic-success-100/80 cursor-pointer",
                !active && !done && "text-muted-foreground cursor-default",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  active && "border-white bg-white text-brand-cobalt-500",
                  done &&
                    "border-semantic-success-500 bg-semantic-success-500 text-white",
                  !active &&
                    !done &&
                    "border-border bg-card text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3" aria-hidden /> : step}
              </span>
              <span className="truncate font-medium">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function WizardFooter({
  step,
  canLeaveStep1,
  loadingMatches,
  shortlistSize,
  gotoStep,
  advanceToMatches,
}: {
  step: WizardStep;
  canLeaveStep1: boolean;
  loadingMatches: boolean;
  shortlistSize: number;
  gotoStep: (s: WizardStep) => void;
  advanceToMatches: () => void;
}) {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
      <div>
        {step > 1 ? (
          <Button
            variant="outline"
            size="lg"
            onClick={() => gotoStep((step - 1) as WizardStep)}
          >
            <ArrowLeft className="rtl:rotate-180" aria-hidden />
            Back
          </Button>
        ) : (
          <Button variant="outline" size="lg" asChild>
            <Link href="/organizer/rfqs">Cancel</Link>
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {step === 1 ? (
          <Button
            size="lg"
            disabled={!canLeaveStep1}
            onClick={() => gotoStep(2)}
          >
            Next
            <ArrowRight className="rtl:rotate-180" aria-hidden />
          </Button>
        ) : null}
        {step === 2 ? (
          <Button
            size="lg"
            onClick={advanceToMatches}
            disabled={loadingMatches}
          >
            {loadingMatches ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Matching…
              </>
            ) : (
              <>
                Next
                <ArrowRight className="rtl:rotate-180" aria-hidden />
              </>
            )}
          </Button>
        ) : null}
        {step === 3 ? (
          <Button
            size="lg"
            onClick={() => gotoStep(4)}
            disabled={shortlistSize < 1 || shortlistSize > 10}
          >
            Next ({shortlistSize}/10)
            <ArrowRight className="rtl:rotate-180" aria-hidden />
          </Button>
        ) : null}
      </div>
    </footer>
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
    <Card>
      <CardContent className="flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight text-brand-navy-900">
            Event & category
          </h2>
          <p className="text-sm text-muted-foreground">
            Pick which event this is for and what you are sourcing.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Event</Label>
          {events === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have no events yet.{" "}
              <Link
                href="/organizer/events/new"
                className="font-medium text-brand-cobalt-500 hover:underline"
              >
                Create one
              </Link>{" "}
              first.
            </p>
          ) : (
            <Select
              value={state.event_id ?? undefined}
              onValueChange={(v) =>
                dispatch({ type: "setEvent", event_id: v })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an event" />
              </SelectTrigger>
              <SelectContent>
                {events.map((evt) => (
                  <SelectItem key={evt.id} value={evt.id}>
                    {evt.event_type}
                    {evt.client_name ? ` · ${evt.client_name}` : ""} ·{" "}
                    {evt.city} · {evt.starts_at.slice(0, 10)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Category</Label>
            <Select
              value={state.category_id ?? undefined}
              onValueChange={(v) =>
                dispatch({ type: "setCategory", category_id: v })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {parents.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Subcategory</Label>
            <Select
              value={state.subcategory_id ?? undefined}
              disabled={!state.category_id}
              onValueChange={(v) => {
                if (!v) {
                  dispatch({
                    type: "setSubcategory",
                    subcategory_id: "",
                    autoKind: "generic",
                  });
                  return;
                }
                const parent = parents.find(
                  (p) => p.id === state.category_id,
                );
                const parentSlug = parent?.slug;
                const autoKind = kindFromParentSlug(parentSlug);
                dispatch({
                  type: "setSubcategory",
                  subcategory_id: v,
                  autoKind,
                });
                void allChildren;
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a subcategory" />
              </SelectTrigger>
              <SelectContent>
                {subcategoryOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
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
  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight text-brand-navy-900">
            Requirements
          </h2>
          <p className="text-xs text-muted-foreground">
            {selectedSub
              ? `${selectedSub.name_en} · form auto-selected by category`
              : "Form auto-selected by category"}
          </p>
        </div>
        <RfqExtensionForm
          kind={state.kind}
          value={state.requirements}
          onChange={(next) =>
            dispatch({ type: "setRequirements", value: next })
          }
        />
      </CardContent>
    </Card>
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
    <Card>
      <CardContent className="flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight text-brand-navy-900">
            Shortlist
          </h2>
          <p className="text-sm text-muted-foreground">
            We suggested a few — tweak the shortlist before sending.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Running auto-match…
          </div>
        ) : matchingOffline ? (
          <Alert variant="default">
            <AlertCircle aria-hidden />
            <AlertTitle>Auto-match offline</AlertTitle>
            <AlertDescription>
              You can still build the shortlist manually below.
            </AlertDescription>
          </Alert>
        ) : null}

        <ShortlistEditor
          matches={matches}
          manualAdds={manualAdds}
          onRemoveMatch={onRemoveMatch}
          onAddManual={onAddManual}
          onRemoveManual={onRemoveManual}
          onSearchSuppliers={onSearchSuppliers}
        />
      </CardContent>
    </Card>
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
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-tight text-brand-navy-900">
              Review & send
            </h2>
            <p className="text-sm text-muted-foreground">
              Final check. You can edit anything before sending.
            </p>
          </div>

          <ReviewSection title="Event">
            {selectedEvent ? (
              <p className="text-sm">
                {selectedEvent.event_type}
                {selectedEvent.client_name
                  ? ` · ${selectedEvent.client_name}`
                  : ""}
                {" · "}
                {selectedEvent.city}
                {" · "}
                {selectedEvent.starts_at.slice(0, 10)}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </ReviewSection>

          <ReviewSection title="Category">
            <p className="text-sm">
              {selectedParent?.name_en ?? "—"}
              {selectedSub ? ` · ${selectedSub.name_en}` : ""}
            </p>
          </ReviewSection>

          <ReviewSection title={`Requirements (${state.kind})`}>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {reqEntries.map(([k, v]) => (
                <div key={k} className="flex flex-col">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
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
          </ReviewSection>

          <ReviewSection title={`Shortlist (${shortlist.length})`}>
            {shortlist.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No suppliers selected.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {shortlist.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2"
                  >
                    <span>{s.business_name}</span>
                    <StatusPill
                      status={s.source === "auto_match" ? "quoted" : "pending"}
                      label={
                        s.source === "auto_match"
                          ? "Auto match"
                          : "Organizer picked"
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </ReviewSection>

          <div className="flex flex-col gap-3">
            <Label className="text-sm font-medium">Response deadline</Label>
            <RadioGroup
              value={String(state.responseDeadlineHours)}
              onValueChange={(v) =>
                dispatch({
                  type: "setDeadline",
                  hours: Number(v) as 24 | 48 | 72,
                })
              }
              className="grid gap-3 sm:grid-cols-3"
            >
              {([24, 48, 72] as const).map((h) => (
                <label
                  key={h}
                  htmlFor={`deadline-${h}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-brand-cobalt-500/40",
                    state.responseDeadlineHours === h &&
                      "border-brand-cobalt-500 bg-brand-cobalt-100/40",
                  )}
                >
                  <RadioGroupItem
                    id={`deadline-${h}`}
                    value={String(h)}
                    className="mt-0.5"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      Within {h} hours
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {h === 24
                        ? "Tight window — best for urgent RFQs."
                        : h === 48
                          ? "Balanced default."
                          : "Roomy — good for complex RFQs."}
                    </span>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden />
              <AlertTitle>Could not send RFQ</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <Button
              size="lg"
              disabled={!canSend || sending}
              onClick={onSend}
            >
              {sending ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                <>
                  <Send aria-hidden />
                  Send RFQ
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}
