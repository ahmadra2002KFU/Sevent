"use client";

/**
 * "اضافة بند" dialog on the event detail page. A بند is a single line-item
 * that publishes one auto-marketplace RFQ tied to this event. Per-بند fields
 * are intentionally minimal (subcategory + optional notes) — the same shape
 * used on the event-creation form. Server action `addBandAction` performs the
 * RLS-gated insert and revalidates the detail path so the new RFQ appears
 * inline without a manual refresh.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addBandAction } from "../actions";
import {
  listCategoriesAction,
  type CategoriesBundle,
  type CategoryOption,
} from "../../rfqs/actions";

type Props = {
  eventId: string;
  triggerLabel: string;
  variant?: "default" | "outline";
};

export function AddBandDialog({ eventId, triggerLabel, variant = "default" }: Props) {
  const t = useTranslations("organizer.eventForm.bunood");
  const locale = useLocale();
  const isAr = locale === "ar";
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [subcategoryId, setSubcategoryId] = useState("");
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState(1);
  const [categories, setCategories] = useState<CategoriesBundle | null>(null);
  const [isPending, startTransition] = useTransition();

  // Lazy-load categories the first time the dialog opens. The RFQ wizard
  // already loads them on its own page; we don't want to pay that cost on
  // every event detail render for organizers who never click "اضافة بند".
  useEffect(() => {
    if (!open || categories !== null) return;
    let cancelled = false;
    listCategoriesAction()
      .then((cats) => {
        if (!cancelled) setCategories(cats);
      })
      .catch(() => {
        if (!cancelled) setCategories({ parents: [], children: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [open, categories]);

  const subcategoryGroups = useMemo(() => {
    if (!categories) return [];
    return categories.parents
      .map((parent) => ({
        parent,
        children: categories.children
          .filter((c: CategoryOption) => c.parent_id === parent.id)
          .sort((a, b) => a.sort_order - b.sort_order),
      }))
      .filter((g) => g.children.length > 0);
  }, [categories]);

  const reset = () => {
    setSubcategoryId("");
    setNotes("");
    setQty(1);
  };

  const handleSubmit = () => {
    if (!subcategoryId) return;
    startTransition(async () => {
      const result = await addBandAction({
        event_id: eventId,
        subcategory_id: subcategoryId,
        notes: notes.trim() ? notes.trim() : undefined,
        qty,
      });
      if (result.ok) {
        toast.success(t("bandSavedToast"));
        reset();
        setOpen(false);
        router.refresh();
      } else {
        toast.error(t("bandFailedToast"), {
          description: result.error,
        });
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg" variant={variant}>
          <Plus aria-hidden />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add_band_subcategory">
              {t("subcategoryLabel")}
              <span className="text-destructive" aria-hidden>
                *
              </span>
            </Label>
            <select
              id="add_band_subcategory"
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              disabled={categories === null}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="" disabled>
                {categories === null
                  ? t("loadingCategories")
                  : t("subcategoryPlaceholder")}
              </option>
              {subcategoryGroups.map((group) => (
                <optgroup
                  key={group.parent.id}
                  label={isAr ? group.parent.name_ar : group.parent.name_en}
                >
                  {group.children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {isAr ? child.name_ar : child.name_en}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add_band_qty">{t("qtyLabel")}</Label>
            <Input
              id="add_band_qty"
              type="number"
              min={1}
              max={999}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add_band_notes">{t("notesLabel")}</Label>
            <Input
              id="add_band_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notesPlaceholder")}
              maxLength={2000}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              {t("dialogCancel")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!subcategoryId || isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                {t("dialogSaving")}
              </>
            ) : (
              t("dialogSubmit")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
