"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical } from "lucide-react";
import { ACCENT_PALETTE } from "@/lib/domain/taxonomy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui-ext/HelperText";
import { cn } from "@/lib/utils";
import {
  updateProfileCustomizationAction,
  type UpdateProfileCustomizationState,
} from "./actions";

type SectionKey = "bio" | "packages" | "portfolio" | "reviews";

const SECTION_KEYS: readonly SectionKey[] = [
  "bio",
  "packages",
  "portfolio",
  "reviews",
];

export type ProfileCustomizerProps = {
  initialAccentColor: string;
  initialSectionOrder: string[];
};

/**
 * Client editor for accent color + profile section order.
 *
 * Design notes:
 * - Keeps a dirty-state check so the Save button disables when no changes
 *   have been made vs. the last persisted snapshot. After a successful save
 *   we advance the "saved" snapshot so subsequent no-op clicks stay disabled.
 * - Drag-drop uses pointer-level positions so RTL layouts work without any
 *   axis flipping. The keyboard sensor provides a11y parity.
 * - We post a single server action that updates both columns atomically —
 *   halving round-trips vs. two parallel actions and keeping the success
 *   toast logic simple.
 */
// The server action re-resolves the supplier row from the authenticated
// session on save, so the client does not need to know the supplier_id —
// trusting a client-provided id would be an auth-bypass risk.
export function ProfileCustomizer({
  initialAccentColor,
  initialSectionOrder,
}: ProfileCustomizerProps) {
  const t = useTranslations("supplier.profile.customizer");
  const locale = useLocale();

  const safeInitialOrder = useMemo<SectionKey[]>(
    () => sanitizeSectionOrder(initialSectionOrder),
    [initialSectionOrder],
  );

  const [accentColor, setAccentColor] = useState<string>(initialAccentColor);
  const [sectionOrder, setSectionOrder] =
    useState<SectionKey[]>(safeInitialOrder);

  // "Baseline" snapshot — what the DB currently holds. Dirty-state = current
  // UI state differing from this snapshot. After a successful save we update
  // the baseline to the just-saved values so the Save button disables again.
  const [savedAccent, setSavedAccent] = useState<string>(initialAccentColor);
  const [savedOrder, setSavedOrder] = useState<SectionKey[]>(safeInitialOrder);

  const [state, formAction, isPending] = useActionState<
    UpdateProfileCustomizationState | undefined,
    FormData
  >(updateProfileCustomizationAction, undefined);

  // Keep a ref to the form so the accent swatch / drag handlers can submit
  // without a mouse click on the Save button (but for now the button is the
  // only submit path; the ref is reserved for future "auto-save on blur").
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      setSavedAccent(accentColor);
      setSavedOrder(sectionOrder);
    }
    // We intentionally depend only on `state` so success propagates once per
    // server response; accentColor/sectionOrder are snapshot-read above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const isDirty =
    accentColor !== savedAccent || !arrayEqual(sectionOrder, savedOrder);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require a small drag distance so clicks on the row don't trigger a
      // drag. 6px is the @dnd-kit recommended threshold for touch + mouse.
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sectionOrder.indexOf(active.id as SectionKey);
    const newIndex = sectionOrder.indexOf(over.id as SectionKey);
    if (oldIndex === -1 || newIndex === -1) return;
    setSectionOrder((prev) => arrayMove(prev, oldIndex, newIndex));
  }

  const saveLabel = isPending
    ? t("saving")
    : state?.ok && !isDirty
      ? t("saved")
      : !isDirty
        ? t("noChanges")
        : t("save");

  const errorMessage = !state || state.ok ? null : resolveErrorMessage(state, t);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-6"
      aria-busy={isPending}
    >
      <input type="hidden" name="accent_color" value={accentColor} />
      <input
        type="hidden"
        name="section_order"
        value={JSON.stringify(sectionOrder)}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("accentColor.heading")}</CardTitle>
          <HelperText>{t("accentColor.helper")}</HelperText>
        </CardHeader>
        <CardContent>
          <fieldset>
            <legend className="sr-only">{t("accentColor.heading")}</legend>
            <ul
              className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-12"
              role="radiogroup"
              aria-label={t("accentColor.heading")}
            >
              {ACCENT_PALETTE.map((swatch) => {
                const isSelected = accentColor === swatch.hex;
                const label =
                  locale === "ar" ? swatch.name_ar : swatch.name_en;
                return (
                  <li key={swatch.slug} className="flex flex-col items-center">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={label}
                      title={label}
                      onClick={() => setAccentColor(swatch.hex)}
                      className={cn(
                        "relative flex size-11 min-h-11 min-w-11 items-center justify-center rounded-full transition-[transform,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring",
                        isSelected
                          ? "ring-2 ring-offset-2 ring-foreground scale-105"
                          : "ring-1 ring-inset ring-black/10 hover:scale-105",
                      )}
                      style={{ backgroundColor: swatch.hex }}
                    >
                      {isSelected ? (
                        <Check
                          className="size-5 text-white drop-shadow"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                    <span className="mt-1 line-clamp-1 text-center text-[11px] text-muted-foreground">
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sections.heading")}</CardTitle>
          <HelperText>{t("sections.helper")}</HelperText>
        </CardHeader>
        <CardContent>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sectionOrder}
              strategy={verticalListSortingStrategy}
            >
              <ul className="flex flex-col gap-2">
                {sectionOrder.map((key) => (
                  <SortableSectionRow
                    key={key}
                    id={key}
                    title={t(`sections.${key}`)}
                    description={t(`sections.drag.${key}Description`)}
                    handleLabel={t("sections.dragHandle")}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        {errorMessage ? (
          <p
            className="text-sm text-destructive sm:mr-auto"
            role="alert"
            aria-live="polite"
          >
            {errorMessage}
          </p>
        ) : state?.ok && !isDirty ? (
          <p
            className="text-sm text-emerald-700 sm:mr-auto"
            role="status"
            aria-live="polite"
          >
            {t("saved")}
          </p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          disabled={!isDirty || isPending}
          className="min-h-11"
        >
          {saveLabel}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Sortable row
// ---------------------------------------------------------------------------

function SortableSectionRow({
  id,
  title,
  description,
  handleLabel,
}: {
  id: SectionKey;
  title: string;
  description: string;
  handleLabel: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card p-3 sm:p-4",
        isDragging && "z-10 shadow-lg ring-2 ring-primary/40",
      )}
    >
      <button
        type="button"
        aria-label={handleLabel}
        className="flex size-11 min-h-11 min-w-11 cursor-grab items-center justify-center rounded-lg text-muted-foreground hover:bg-muted active:cursor-grabbing touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-5" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeSectionOrder(input: string[]): SectionKey[] {
  const allowed = new Set<SectionKey>(SECTION_KEYS);
  const seen = new Set<SectionKey>();
  const out: SectionKey[] = [];
  for (const raw of input) {
    if (allowed.has(raw as SectionKey) && !seen.has(raw as SectionKey)) {
      out.push(raw as SectionKey);
      seen.add(raw as SectionKey);
    }
  }
  // Back-fill any missing keys in canonical order so we always render four
  // rows even if the DB row drifted.
  for (const key of SECTION_KEYS) {
    if (!seen.has(key)) out.push(key);
  }
  return out.slice(0, SECTION_KEYS.length);
}

function arrayEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

function resolveErrorMessage(
  state: UpdateProfileCustomizationState,
  t: (key: string) => string,
): string {
  switch (state.code) {
    case "invalid_accent":
      return t("error.invalidAccent");
    case "invalid_order":
      return t("error.invalidOrder");
    default:
      return t("error.generic");
  }
}
