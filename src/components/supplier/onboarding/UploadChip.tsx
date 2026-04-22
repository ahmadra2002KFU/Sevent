"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, FileText, ImageIcon, Upload } from "lucide-react";
import { useId, useRef } from "react";
import { cn } from "@/lib/utils";

export type UploadChipStatus = "idle" | "uploaded" | "verified";

export type UploadChipProps = {
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  /** For image previews, render the thumbnail in the icon frame. */
  previewUrl?: string | null;
  kind: "image" | "pdf";
  /** Derived display state; "verified" adds the green "verified" sub-line. */
  status?: UploadChipStatus;
  optional?: boolean;
  onPick: (f: File | null) => void;
  labels: {
    optional: string;
    replace: string;
    click: string;
    orDrag: string;
    verified: string;
  };
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const n = bytes / 1024 ** i;
  return `${n >= 10 || i === 0 ? n.toFixed(0) : n.toFixed(1)} ${units[i]}`;
}

/**
 * Upload chip with two visual states:
 *  - idle    → dashed neutral border, upload icon, instructional text
 *  - uploaded/verified → success-green border + bg, file preview, replace button
 */
export function UploadChip({
  label,
  hint,
  accept,
  file,
  previewUrl,
  kind,
  status,
  optional,
  onPick,
  labels,
}: UploadChipProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const effectiveStatus: UploadChipStatus =
    status ?? (file ? "uploaded" : "idle");
  const isFilled = effectiveStatus !== "idle";
  const isVerified = effectiveStatus === "verified";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    onPick(f);
  }

  function openPicker() {
    inputRef.current?.click();
  }

  return (
    <div>
      <label
        htmlFor={inputId}
        className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-brand-navy-900"
      >
        {label}
        {optional ? (
          <span className="text-[11px] font-medium text-neutral-400">
            ({labels.optional})
          </span>
        ) : null}
      </label>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="sr-only"
      />

      <AnimatePresence mode="wait" initial={false}>
        {isFilled && file ? (
          <motion.div
            key="filled"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 rounded-lg border border-semantic-success-500 bg-semantic-success-100 px-3.5 py-3"
          >
            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
              {kind === "image" && previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : kind === "image" ? (
                <ImageIcon
                  className="size-[22px] text-brand-cobalt-500"
                  strokeWidth={1.8}
                />
              ) : (
                <FileText
                  className="size-5 text-brand-navy-900"
                  strokeWidth={1.8}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-semibold text-neutral-900">
                {file.name}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-600">
                <span>{formatBytes(file.size)}</span>
                {isVerified ? (
                  <span className="inline-flex items-center gap-1 text-semantic-success-500">
                    <CheckCircle2 className="size-3" strokeWidth={2.2} />
                    {labels.verified}
                  </span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={openPicker}
              className="rounded-md px-2 py-1 text-[12.5px] font-semibold text-neutral-600 transition hover:bg-white hover:text-brand-navy-900"
            >
              {labels.replace}
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="idle"
            type="button"
            onClick={openPicker}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "flex w-full items-center gap-3.5 rounded-lg border-[1.5px] border-dashed border-neutral-200 bg-white px-4 py-5 text-start transition",
              "hover:border-brand-cobalt-500/60 hover:bg-brand-cobalt-100/30",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500",
            )}
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
              <Upload className="size-[22px]" strokeWidth={1.8} />
            </div>
            <div className="flex-1">
              <div className="text-[13.5px] text-brand-navy-900">
                <span className="font-bold text-brand-cobalt-500">
                  {labels.click}
                </span>{" "}
                {labels.orDrag}
              </div>
              <div className="mt-1 text-xs text-neutral-600">{hint}</div>
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
