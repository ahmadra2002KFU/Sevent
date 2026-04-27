"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
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
import { Check, GripVertical, Pencil } from "lucide-react";
import { ACCENT_PALETTE } from "@/lib/domain/taxonomy";
import { SUPPLIER_BIO_MAX_LENGTH } from "@/lib/domain/onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui-ext/HelperText";
import { cn } from "@/lib/utils";
import {
  updateBioAction,
  updateProfileCustomizationAction,
  type UpdateBioState,
  type UpdateProfileCustomizationState,
} from "./actions";

type SectionKey = "bio" | "packages" | "portfolio" | "reviews";

const SECTION_KEYS: readonly SectionKey[] = [
  "bio",
  "packages",
  "portfolio",
  "reviews",
];

// Edit destinations for the per-row Edit button. Bio is special-cased
// (handled inline) and not in this map. Reviews has no edit destination.
//
// Portfolio doesn't have a dedicated route — the editor is a tab on this
// same page (see `ProfilePageTabs`). The `?tab=portfolio` link is resolved
// relative to /supplier/profile by next/link and switches the URL-driven
// tab without a full navigation.
const SECTION_EDIT_HREF: Partial<Record<SectionKey, string>> = {
  packages: "/supplier/catalog",
  portfolio: "?tab=portfolio",
};

export type ProfileCustomizerProps = {
  initialAccentColor: string;
  initialSectionOrder: string[];
  initialBio: string | null;
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
  initialBio,
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

  // Persisted bio (matches the DB) and inline-editor state. The bio editor
  // owns its own server action — the global Save button only commits accent +
  // section order, so dirty state stays comprehensible.
  const [savedBio, setSavedBio] = useState<string | null>(initialBio);
  const [bioEditing, setBioEditing] = useState(false);

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
                {sectionOrder.map((key) => {
                  const isBioRow = key === "bio";
                  const editHref = SECTION_EDIT_HREF[key];
                  const collapsedDescription = isBioRow
                    ? bioPreview(savedBio) ?? t("bio.emptyHelper")
                    : t(`sections.drag.${key}Description`);
                  return (
                    <SortableSectionRow
                      key={key}
                      id={key}
                      title={t(`sections.${key}`)}
                      description={collapsedDescription}
                      handleLabel={t("sections.dragHandle")}
                      editLabel={t("actions.edit")}
                      editHref={editHref}
                      onEditClick={isBioRow ? () => setBioEditing(true) : null}
                      dragDisabled={isBioRow && bioEditing}
                      bioEditor={
                        isBioRow && bioEditing ? (
                          <BioInlineEditor
                            initialBio={savedBio ?? ""}
                            onSaved={(next) => {
                              setSavedBio(next);
                              setBioEditing(false);
                            }}
                            onCancel={() => setBioEditing(false)}
                          />
                        ) : null
                      }
                    />
                  );
                })}
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
  editLabel,
  editHref,
  onEditClick,
  dragDisabled,
  bioEditor,
}: {
  id: SectionKey;
  title: string;
  description: string;
  handleLabel: string;
  editLabel: string;
  // For static-route rows (packages, portfolio). Bio uses onEditClick instead.
  editHref?: string;
  // For the bio row — toggles inline editor.
  onEditClick: (() => void) | null;
  dragDisabled: boolean;
  // Rendered below the row content when the bio editor is open.
  bioEditor: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: dragDisabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Reviews row has no edit affordance.
  const showEditButton = Boolean(editHref) || onEditClick !== null;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:p-4",
        isDragging && "z-10 shadow-lg ring-2 ring-primary/40",
      )}
    >
      <div className="flex items-center gap-3">
        {!dragDisabled ? (
          <button
            type="button"
            aria-label={handleLabel}
            className="flex size-11 min-h-11 min-w-11 cursor-grab items-center justify-center rounded-lg text-muted-foreground hover:bg-muted active:cursor-grabbing touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-5" aria-hidden />
          </button>
        ) : (
          <span className="flex size-11 min-h-11 min-w-11" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {description}
          </p>
        </div>
        {showEditButton ? (
          editHref ? (
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href={editHref}>
                <Pencil aria-hidden />
                {editLabel}
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={onEditClick ?? undefined}
            >
              <Pencil aria-hidden />
              {editLabel}
            </Button>
          )
        ) : null}
      </div>
      {bioEditor}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Inline bio editor
// ---------------------------------------------------------------------------

function BioInlineEditor({
  initialBio,
  onSaved,
  onCancel,
}: {
  initialBio: string;
  onSaved: (bio: string | null) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("supplier.profile.customizer");
  const [value, setValue] = useState(initialBio);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [state, formAction, isPending] = useActionState<
    UpdateBioState | undefined,
    FormData
  >(updateBioAction, undefined);

  // Autofocus when the editor mounts.
  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.setSelectionRange(
      textareaRef.current.value.length,
      textareaRef.current.value.length,
    );
  }, []);

  // After a successful save, hand the server-confirmed value back to the
  // parent so the collapsed-state preview shows the fresh bio. Reading from
  // `state.savedBio` (not local `value`) is intentional — the user could
  // keep typing during the action's round-trip; we trust what the server
  // actually persisted.
  useEffect(() => {
    if (state?.ok) {
      onSaved(state.savedBio ?? null);
    }
    // Only react to action state transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const charCount = value.length;
  const isTooLong = charCount > SUPPLIER_BIO_MAX_LENGTH;
  // Legacy: if the bio in the DB is already over the limit (could happen
  // for rows seeded before the cap was tightened), the user must shorten
  // before they can save anything. We surface a banner so the rejection
  // is intelligible — without it, clicking Save returns "too long" with
  // no obvious cause.
  const isLegacyOverLimit = initialBio.length > SUPPLIER_BIO_MAX_LENGTH;

  const errorMessage =
    !state || state.ok
      ? null
      : state.code === "invalid_bio"
        ? t("bio.errorTooLong", { max: SUPPLIER_BIO_MAX_LENGTH })
        : t("bio.errorGeneric");

  // Allow the textarea to display existing legacy content; the Save guard
  // will still block submission until the user trims under the cap.
  const textareaMaxLength = Math.max(
    SUPPLIER_BIO_MAX_LENGTH,
    initialBio.length,
  );

  // Submit via formAction(FormData) rather than wrapping in <form>: this
  // editor lives inside the outer ProfileCustomizer <form> (which owns the
  // global Save button for accent + order), and HTML forbids nested forms.
  function submitBio() {
    if (isTooLong || isPending) return;
    const fd = new FormData();
    fd.append("bio", value);
    formAction(fd);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl+Enter saves; Esc cancels — common editor conventions.
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      submitBio();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      {isLegacyOverLimit && charCount > SUPPLIER_BIO_MAX_LENGTH ? (
        <p
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          role="status"
        >
          {t("bio.errorTooLong", { max: SUPPLIER_BIO_MAX_LENGTH })}
        </p>
      ) : null}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={textareaMaxLength}
        rows={4}
        placeholder={t("bio.placeholder")}
        className="w-full resize-y rounded-md border border-input bg-background p-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{t("bio.hint", { max: SUPPLIER_BIO_MAX_LENGTH })}</span>
        <span
          className={cn(
            "tabular-nums",
            isTooLong && "font-semibold text-destructive",
          )}
        >
          {t("bio.counter", {
            count: charCount,
            max: SUPPLIER_BIO_MAX_LENGTH,
          })}
        </span>
      </div>
      {errorMessage ? (
        <p className="text-xs text-destructive" role="alert" aria-live="polite">
          {errorMessage}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={isPending}
        >
          {t("bio.cancel")}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={submitBio}
          disabled={isPending || isTooLong}
        >
          {isPending ? t("bio.saving") : t("bio.save")}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// First ~80 chars of the supplier's bio, used as the bio row's collapsed
// description so the supplier sees the live state at a glance. Returns null
// when the bio is empty so callers can fall back to the static helper.
function bioPreview(bio: string | null): string | null {
  if (!bio) return null;
  const trimmed = bio.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length <= 80) return trimmed;
  return `${trimmed.slice(0, 80)}…`;
}

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
