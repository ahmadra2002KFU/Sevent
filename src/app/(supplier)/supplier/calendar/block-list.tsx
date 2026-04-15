"use client";

/**
 * Manual-block list + add/edit form. Only `reason='manual_block'` rows are
 * editable or deletable; the parent server component filters the list to
 * that reason, but we still hide buttons defensively in case future callers
 * pass the full window.
 */

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { ManualBlockInput } from "@/lib/domain/availability";
import type { AvailabilityBlockRow } from "@/lib/supabase/types";
import {
  createManualBlockAction,
  deleteManualBlockAction,
  updateManualBlockAction,
  type CalendarActionResult,
} from "./actions";

type FormValues = {
  id?: string;
  starts_at: string;
  ends_at: string;
  notes?: string;
};

export type BlockListLabels = {
  heading: string;
  noBlocks: string;
  newBlock: string;
  edit: string;
  delete: string;
  cancel: string;
  save: string;
  saving: string;
  confirmDelete: string;
  starts: string;
  ends: string;
  notes: string;
  conflict: string;
  formTitleNew: string;
  formTitleEdit: string;
};

type Props = {
  blocks: AvailabilityBlockRow[];
  labels: BlockListLabels;
  /** Optional initial error shown above the form on first render. */
  initialError?: string;
};

/**
 * Converts an ISO timestamp to the `YYYY-MM-DDTHH:mm` shape accepted by
 * `<input type="datetime-local">`. Uses the user's local timezone to match
 * what the datetime-local control expects to display.
 */
function toLocalInput(iso: string): string {
  const d = parseISO(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/**
 * Converts the datetime-local input value back to a UTC ISO string, which
 * Postgres `timestamptz` happily accepts. The browser supplies the value in
 * local time (no zone); `new Date(...)` interprets it as local, so toISOString
 * produces the correct UTC instant.
 */
function toIso(local: string): string {
  if (!local) return local;
  return new Date(local).toISOString();
}

export function BlockList({ blocks, labels, initialError }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(
    initialError ?? null,
  );
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(ManualBlockInput),
    defaultValues: { starts_at: "", ends_at: "", notes: "" },
  });

  const openForNew = () => {
    setEditingId(null);
    setServerError(null);
    reset({ starts_at: "", ends_at: "", notes: "" });
    setFormOpen(true);
  };

  const openForEdit = (block: AvailabilityBlockRow) => {
    // Defensive: only manual_block rows are editable.
    if (block.reason !== "manual_block") return;
    setEditingId(block.id);
    setServerError(null);
    reset({
      id: block.id,
      starts_at: toLocalInput(block.starts_at),
      ends_at: toLocalInput(block.ends_at),
      notes: "",
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setServerError(null);
  };

  const onSubmit = handleSubmit((values) => {
    const payload = {
      starts_at: toIso(values.starts_at),
      ends_at: toIso(values.ends_at),
      notes: values.notes?.trim() ? values.notes.trim() : undefined,
    };
    startTransition(async () => {
      const result: CalendarActionResult = editingId
        ? await updateManualBlockAction(editingId, payload)
        : await createManualBlockAction(payload);
      if (result.ok) {
        closeForm();
      } else {
        setServerError(result.error);
      }
    });
  });

  const onDelete = (id: string) => {
    if (typeof window !== "undefined" && !window.confirm(labels.confirmDelete)) {
      return;
    }
    setServerError(null);
    startTransition(async () => {
      const result = await deleteManualBlockAction(id);
      if (!result.ok) setServerError(result.error);
    });
  };

  return (
    <section
      aria-label={labels.heading}
      className="rounded-xl border border-[var(--color-border)] bg-white p-4 sm:p-6"
    >
      <header className="flex items-center justify-between pb-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {labels.heading}
        </h2>
        {!formOpen ? (
          <button
            type="button"
            onClick={openForNew}
            className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
          >
            {labels.newBlock}
          </button>
        ) : null}
      </header>

      {serverError ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {serverError}
        </div>
      ) : null}

      {formOpen ? (
        <form onSubmit={onSubmit} className="mb-6 flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-4">
          <p className="text-sm font-medium">
            {editingId ? labels.formTitleEdit : labels.formTitleNew}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{labels.starts}</span>
              <input
                type="datetime-local"
                {...register("starts_at")}
                required
                className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              />
              {errors.starts_at ? (
                <span className="text-xs text-red-600">
                  {errors.starts_at.message}
                </span>
              ) : null}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{labels.ends}</span>
              <input
                type="datetime-local"
                {...register("ends_at")}
                required
                className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              />
              {errors.ends_at ? (
                <span className="text-xs text-red-600">
                  {errors.ends_at.message}
                </span>
              ) : null}
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{labels.notes}</span>
            <textarea
              {...register("notes")}
              maxLength={500}
              rows={2}
              className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
          </label>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
            >
              {labels.cancel}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-60"
            >
              {isPending ? labels.saving : labels.save}
            </button>
          </div>
        </form>
      ) : null}

      {blocks.length === 0 ? (
        <p className="rounded-md bg-[var(--color-muted)]/40 p-4 text-sm text-[var(--color-muted-foreground)]">
          {labels.noBlocks}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {blocks.map((b) => {
            const canEdit = b.reason === "manual_block";
            return (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {format(parseISO(b.starts_at), "PPp")} →{" "}
                    {format(parseISO(b.ends_at), "PPp")}
                  </p>
                </div>
                {canEdit ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openForEdit(b)}
                      className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs hover:bg-[var(--color-muted)]"
                    >
                      {labels.edit}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(b.id)}
                      disabled={isPending}
                      className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      {labels.delete}
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
