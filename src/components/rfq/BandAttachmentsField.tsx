"use client";

/**
 * BandAttachmentsField — multi-file upload control for a single بند.
 *
 * Each بند on the organizer event form (and the AddBandDialog) can carry
 * several images/documents. This control owns the local File[] for ONE بند
 * and reports changes upward via `onChange`; the parent threads the files into
 * the FormData submit (keyed by بند index) where the server re-validates and
 * uploads them to the `rfq-attachments` bucket.
 *
 * Client-side validation here is UX-only — the server action
 * (uploadBandAttachments) is authoritative. We enforce the per-بند cheap
 * checks (count + per-file size + MIME kind) so users get instant feedback;
 * the cross-بند total-bytes budget is server-enforced (it can't be known from
 * a single field).
 *
 * Visual language mirrors src/components/supplier/onboarding/UploadChip.tsx
 * (dashed idle button, filled success chips) but this is a distinct MULTI-file
 * control. Logical-property / text-start classes keep it correct under RTL.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_PER_BAND,
  kindForMime,
  maxBytesForKind,
} from "@/lib/domain/attachments";
import { cn } from "@/lib/utils";

export type BandAttachmentsFieldProps = {
  files: File[];
  onChange: (next: File[]) => void;
  idPrefix: string;
  disabled?: boolean;
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const n = bytes / 1024 ** i;
  return `${n >= 10 || i === 0 ? n.toFixed(0) : n.toFixed(1)} ${units[i]}`;
}

export function BandAttachmentsField({
  files,
  onChange,
  idPrefix,
  disabled,
}: BandAttachmentsFieldProps) {
  const t = useTranslations("organizer.eventForm.bunood");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputId = `${idPrefix}-file-input`;
  const labelId = `${idPrefix}-attachments-label`;
  const hintId = `${idPrefix}-attachments-hint`;

  // Object URLs for image thumbnails. Derived purely from `files` via useMemo
  // (a fresh map every time the file set changes), and revoked by the matching
  // effect cleanup — so removing/replacing a file or unmounting frees its
  // blob: URL with no leaks, no ref-in-render, and no setState-in-effect.
  const previews = useMemo(() => {
    const map = new Map<File, string>();
    for (const file of files) {
      if (kindForMime(file.type) === "image") {
        map.set(file, URL.createObjectURL(file));
      }
    }
    return map;
  }, [files]);

  useEffect(() => {
    return () => {
      for (const url of previews.values()) URL.revokeObjectURL(url);
    };
  }, [previews]);

  function openPicker() {
    inputRef.current?.click();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    // Reset immediately so picking the same file after a removal re-fires change.
    e.target.value = "";
    if (picked.length === 0) return;

    const accepted: File[] = [];
    let nextError: string | null = null;
    let runningCount = files.length;

    for (const file of picked) {
      const kind = kindForMime(file.type);
      if (kind === null) {
        nextError = t("fileTypeNotAllowed");
        continue;
      }
      if (file.size > maxBytesForKind(kind)) {
        nextError = t("fileTooLarge");
        continue;
      }
      if (runningCount >= ATTACHMENT_MAX_PER_BAND) {
        nextError = t("tooManyFiles");
        continue;
      }
      accepted.push(file);
      runningCount += 1;
    }

    setError(nextError);
    if (accepted.length > 0) onChange([...files, ...accepted]);
  }

  function removeAt(idx: number) {
    setError(null);
    onChange(files.filter((_, i) => i !== idx));
  }

  const atLimit = files.length >= ATTACHMENT_MAX_PER_BAND;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span
          id={labelId}
          className="text-[13px] font-semibold text-brand-navy-900"
        >
          {t("attachmentsLabel")}
        </span>
        <span id={hintId} className="text-xs text-muted-foreground">
          {t("attachmentsHint")}
        </span>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept={ATTACHMENT_ACCEPT}
        onChange={handleChange}
        disabled={disabled}
        className="sr-only"
        aria-labelledby={labelId}
        aria-describedby={hintId}
      />

      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, idx) => {
            const kind = kindForMime(file.type);
            const previewUrl = previews.get(file) ?? null;
            return (
              <li
                key={`${file.name}-${file.size}-${idx}`}
                className="flex items-center gap-2.5 rounded-lg border border-semantic-success-500 bg-semantic-success-100 ps-2 pe-1.5 py-1.5"
              >
                <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white">
                  {kind === "image" && previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <FileText
                      className="size-[18px] text-brand-navy-900"
                      strokeWidth={1.8}
                      aria-hidden
                    />
                  )}
                </div>
                <div className="flex min-w-0 max-w-[12rem] flex-col text-start">
                  <span className="truncate text-[13px] font-semibold text-neutral-900">
                    {file.name}
                  </span>
                  <span className="text-[11px] text-neutral-600">
                    {formatBytes(file.size)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeAt(idx)}
                  disabled={disabled}
                  aria-label={t("removeFile")}
                  title={t("removeFile")}
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-white hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 disabled:opacity-50"
                >
                  <X className="size-4" strokeWidth={2} aria-hidden />
                  <span className="sr-only">{t("removeFile")}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {!atLimit ? (
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          className={cn(
            "inline-flex w-fit items-center gap-2 rounded-lg border-[1.5px] border-dashed border-neutral-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-brand-navy-900 transition",
            "hover:border-brand-cobalt-500/60 hover:bg-brand-cobalt-100/30",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <Paperclip className="size-4 text-brand-cobalt-500" strokeWidth={1.9} aria-hidden />
          {t("addFiles")}
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
