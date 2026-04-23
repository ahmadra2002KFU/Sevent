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
import { useTranslations } from "next-intl";
import { format, parseISO } from "date-fns";
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import { ManualBlockInput } from "@/lib/domain/availability";
import type { AvailabilityBlockRow } from "@/lib/supabase/types";
import {
  createManualBlockAction,
  deleteManualBlockAction,
  updateManualBlockAction,
  type CalendarActionResult,
} from "./actions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/ui-ext/EmptyState";

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

export function BlockList({ blocks, labels, initialError }: Props) {
  const t = useTranslations("supplier.calendar");
  const tCommon = useTranslations("common");
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

  // Pass the datetime-local strings straight through — the Zod schema
  // transform normalises them to full UTC ISO on the server side.
  const onSubmit = handleSubmit((values) => {
    const payload = {
      starts_at: values.starts_at,
      ends_at: values.ends_at,
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
    setServerError(null);
    startTransition(async () => {
      const result = await deleteManualBlockAction(id);
      if (!result.ok) setServerError(result.error);
    });
  };

  /**
   * Translates validation error keys produced by the availability schema
   * (e.g. `invalid_datetime_format`) into localised strings. Falls back to
   * the raw message if the key is not registered under `errors.*`.
   */
  const mapError = (msg: string | undefined): string => {
    if (!msg) return "";
    try {
      return t(`errors.${msg}` as never);
    } catch {
      return msg;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b">
        <CardTitle>{labels.heading}</CardTitle>
        <Button type="button" size="sm" onClick={openForNew}>
          <Plus />
          {labels.newBlock}
        </Button>
      </CardHeader>
      <CardContent className="pt-6">
        {serverError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}

        {blocks.length === 0 ? (
          <EmptyState icon={CalendarDays} title={labels.noBlocks} />
        ) : (
          <ul className="divide-y divide-border">
            {blocks.map((b) => {
              const canEdit = b.reason === "manual_block";
              return (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <p className="font-medium text-foreground">
                    {format(parseISO(b.starts_at), "PPp")}
                    {" → "}
                    {format(parseISO(b.ends_at), "PPp")}
                  </p>
                  {canEdit ? (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openForEdit(b)}
                        aria-label={labels.edit}
                      >
                        <Pencil />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={isPending}
                            className="text-semantic-danger-500 hover:bg-semantic-danger-100/40"
                            aria-label={labels.delete}
                          >
                            <Trash2 />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {tCommon("confirmDialogTitle")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {labels.confirmDelete}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              {tCommon("confirmCancel")}
                            </AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(b.id)}>
                              {tCommon("confirmConfirm")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <Dialog open={formOpen} onOpenChange={(open) => (open ? null : closeForm())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? labels.formTitleEdit : labels.formTitleNew}
            </DialogTitle>
            <DialogDescription>{labels.heading}</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="block-starts">{labels.starts}</Label>
                <Input
                  id="block-starts"
                  type="datetime-local"
                  {...register("starts_at")}
                  required
                />
                {errors.starts_at ? (
                  <span className="text-xs text-semantic-danger-500">
                    {mapError(errors.starts_at.message)}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="block-ends">{labels.ends}</Label>
                <Input
                  id="block-ends"
                  type="datetime-local"
                  {...register("ends_at")}
                  required
                />
                {errors.ends_at ? (
                  <span className="text-xs text-semantic-danger-500">
                    {mapError(errors.ends_at.message)}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="block-notes">{labels.notes}</Label>
              <Textarea
                id="block-notes"
                {...register("notes")}
                maxLength={500}
                rows={2}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {labels.cancel}
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? labels.saving : labels.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
