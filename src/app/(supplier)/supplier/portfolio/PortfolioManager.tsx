"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useTranslations } from "next-intl";
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
import {
  ExternalLink,
  FileText,
  GripVertical,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HelperText } from "@/components/ui-ext/HelperText";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { cn } from "@/lib/utils";
import {
  deletePortfolioItem,
  reorderPortfolio,
  updatePortfolioTitle,
  uploadPortfolioItems,
} from "./actions";

export type PortfolioItem = {
  id: string;
  kind: "photo" | "document";
  public_url: string;
  file_path: string;
  title: string | null;
  sort_order: number;
};

type PortfolioManagerProps = {
  initialItems: PortfolioItem[];
};

const ACCEPT_ATTR = "image/png,image/jpeg,image/webp,application/pdf";
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const PDF_MAX_BYTES = 25 * 1024 * 1024;
const MAX_PER_BATCH = 10;
const MAX_PER_SUPPLIER = 50;

function fileExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

function isAcceptedMime(file: File): boolean {
  if (
    file.type === "image/png" ||
    file.type === "image/jpeg" ||
    file.type === "image/webp" ||
    file.type === "application/pdf"
  ) {
    return true;
  }
  // Some platforms (Safari, drag from older sources) report empty mime; fall
  // back to the extension so we don't reject obviously-valid files.
  if (file.type === "") {
    const ext = fileExtension(file.name);
    return ["png", "jpg", "jpeg", "webp", "pdf"].includes(ext);
  }
  return false;
}

function sizeCapForMime(mime: string, name: string): number {
  if (mime === "application/pdf") return PDF_MAX_BYTES;
  if (mime === "") {
    const ext = fileExtension(name);
    if (ext === "pdf") return PDF_MAX_BYTES;
  }
  return IMAGE_MAX_BYTES;
}

export function PortfolioManager({ initialItems }: PortfolioManagerProps) {
  const t = useTranslations("supplier.portfolio");

  const [items, setItems] = useState<PortfolioItem[]>(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isUploading, startUpload] = useTransition();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const ids = useMemo(() => items.map((i) => i.id), [items]);

  const validateBatch = useCallback(
    (files: File[]): { ok: true; files: File[] } | { ok: false; message: string } => {
      if (files.length === 0) {
        return { ok: false, message: t("validation.empty") };
      }
      if (files.length > MAX_PER_BATCH) {
        return {
          ok: false,
          message: t("validation.tooMany", { max: MAX_PER_BATCH }),
        };
      }
      if (items.length + files.length > MAX_PER_SUPPLIER) {
        return {
          ok: false,
          message: t("validation.totalCap", { max: MAX_PER_SUPPLIER }),
        };
      }
      for (const f of files) {
        if (!isAcceptedMime(f)) {
          return {
            ok: false,
            message: t("validation.unsupportedType", { name: f.name }),
          };
        }
        if (f.size > sizeCapForMime(f.type, f.name)) {
          return {
            ok: false,
            message: t("validation.tooLarge", { name: f.name }),
          };
        }
      }
      return { ok: true, files };
    },
    [items.length, t],
  );

  const submitFiles = useCallback(
    (files: File[]) => {
      setError(null);
      setInfo(null);
      const v = validateBatch(files);
      if (!v.ok) {
        setError(v.message);
        return;
      }
      const fd = new FormData();
      for (const f of v.files) fd.append("files", f);
      startUpload(async () => {
        const res = await uploadPortfolioItems(fd);
        if (!res.ok) {
          setError(res.message);
          return;
        }
        setInfo(t("info.uploaded", { count: v.files.length }));
        // Hard-refresh from the server-rendered route — easiest way to pick
        // up the freshly-inserted rows with their server-assigned ids and
        // sort_order. revalidatePath in the action handles cache; we just
        // re-mount via location.reload.
        window.location.reload();
      });
    },
    [t, validateBatch],
  );

  function handleFilesPicked(list: FileList | null) {
    if (!list) return;
    submitFiles(Array.from(list));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer?.files) {
      submitFiles(Array.from(e.dataTransfer.files));
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    setError(null);
    void (async () => {
      const res = await reorderPortfolio(next.map((i) => i.id));
      if (!res.ok) {
        // Roll back optimistic order on server failure.
        setItems(items);
        setError(t("errors.reorderFailed", { message: res.message }));
      }
    })();
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t("item.confirmDelete"))) return;
    setPendingDeleteId(id);
    setError(null);
    const res = await deletePortfolioItem(id);
    setPendingDeleteId(null);
    if (!res.ok) {
      setError(t("errors.deleteFailed", { message: res.message }));
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("upload.heading")}</CardTitle>
          <HelperText>
            {t("upload.helper", {
              imageMb: IMAGE_MAX_BYTES / (1024 * 1024),
              pdfMb: PDF_MAX_BYTES / (1024 * 1024),
              max: MAX_PER_BATCH,
            })}
          </HelperText>
        </CardHeader>
        <CardContent>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-muted/30 p-8 text-center transition-colors",
              dragActive
                ? "border-brand-cobalt-500 bg-brand-cobalt-50"
                : "border-border",
              isUploading && "pointer-events-none opacity-60",
            )}
          >
            <UploadCloud className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium text-foreground">
              {t("upload.cta")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("upload.types")}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTR}
              multiple
              className="sr-only"
              onChange={(e) => handleFilesPicked(e.target.files)}
              disabled={isUploading}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {t("upload.uploading")}
                </>
              ) : (
                t("upload.browse")
              )}
            </Button>
          </label>

          {error ? (
            <p
              role="alert"
              className="mt-3 text-sm text-semantic-danger-500"
            >
              {error}
            </p>
          ) : null}
          {info && !error ? (
            <p className="mt-3 text-sm text-semantic-success-500">{info}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("list.heading")}</CardTitle>
          <HelperText>{t("list.helper")}</HelperText>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={t("empty.title")}
              description={t("empty.description")}
            />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={ids}
                strategy={verticalListSortingStrategy}
              >
                <ul className="flex flex-col gap-3">
                  {items.map((item) => (
                    <SortableRow
                      key={item.id}
                      item={item}
                      pendingDelete={pendingDeleteId === item.id}
                      onDelete={() => handleDelete(item.id)}
                      onTitleSaved={(title) =>
                        setItems((prev) =>
                          prev.map((p) =>
                            p.id === item.id ? { ...p, title } : p,
                          ),
                        )
                      }
                      onTitleError={(message) =>
                        setError(t("errors.titleFailed", { message }))
                      }
                      labels={{
                        dragHandle: t("item.dragHandle"),
                        titlePlaceholder: t("item.titlePlaceholder"),
                        save: t("item.saveTitle"),
                        saving: t("item.saving"),
                        saved: t("item.saved"),
                        deleteLabel: t("item.delete"),
                        openLabel:
                          item.kind === "document"
                            ? t("item.openPdf")
                            : t("item.openImage"),
                        documentTag: t("item.documentTag"),
                      }}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type SortableRowProps = {
  item: PortfolioItem;
  pendingDelete: boolean;
  onDelete: () => void;
  onTitleSaved: (title: string | null) => void;
  onTitleError: (message: string) => void;
  labels: {
    dragHandle: string;
    titlePlaceholder: string;
    save: string;
    saving: string;
    saved: string;
    deleteLabel: string;
    openLabel: string;
    documentTag: string;
  };
};

function SortableRow({
  item,
  pendingDelete,
  onDelete,
  onTitleSaved,
  onTitleError,
  labels,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [titleDraft, setTitleDraft] = useState(item.title ?? "");
  const [titleSaved, setTitleSaved] = useState(item.title ?? "");
  const [isSaving, startSave] = useTransition();
  const [savedFlash, setSavedFlash] = useState(false);

  const dirty = titleDraft.trim() !== (titleSaved ?? "");

  function handleSave() {
    if (!dirty || isSaving) return;
    const next = titleDraft.trim() === "" ? null : titleDraft.trim();
    startSave(async () => {
      const res = await updatePortfolioTitle(item.id, next);
      if (!res.ok) {
        onTitleError(res.message);
        return;
      }
      setTitleSaved(next ?? "");
      onTitleSaved(next);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1200);
    });
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center",
        isDragging && "opacity-70 shadow-lg",
      )}
    >
      <button
        type="button"
        aria-label={labels.dragHandle}
        className="flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>

      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
        {item.kind === "photo" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.public_url}
            alt={item.title ?? ""}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <FileText className="size-6" aria-hidden />
            <span className="text-[10px] font-semibold uppercase">PDF</span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <Input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            placeholder={labels.titlePlaceholder}
            maxLength={120}
            className="h-9"
          />
          <Button
            type="button"
            size="sm"
            variant={dirty ? "default" : "outline"}
            onClick={handleSave}
            disabled={!dirty || isSaving}
          >
            {isSaving
              ? labels.saving
              : savedFlash
                ? labels.saved
                : labels.save}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {item.kind === "document" ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
              {labels.documentTag}
            </span>
          ) : null}
          <a
            href={item.public_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-foreground underline-offset-2 hover:underline"
          >
            {labels.openLabel}
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onDelete}
        disabled={pendingDelete}
        className="shrink-0 text-semantic-danger-500"
      >
        {pendingDelete ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Trash2 className="size-4" aria-hidden />
        )}
        <span className="ms-1 hidden sm:inline">{labels.deleteLabel}</span>
      </Button>
    </li>
  );
}
