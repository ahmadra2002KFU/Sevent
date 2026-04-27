"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import {
  updateFeedbackStatusAction,
  type FeedbackStatus,
  type UpdateFeedbackStatusState,
} from "@/app/_actions/feedback";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { StatusPill, type StatusPillStatus } from "@/components/ui-ext/StatusPill";
import { cn } from "@/lib/utils";

export type FeedbackRowData = {
  id: string;
  role: string;
  category: string;
  message: string;
  page_url: string | null;
  locale: string | null;
  viewport_w: number | null;
  viewport_h: number | null;
  user_agent: string | null;
  console_errors: unknown;
  status: FeedbackStatus;
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  user_email: string | null;
  // Server-resolved short-lived signed URL (1h). Null when the row has no
  // attached screenshot. Refreshes on next page load if it expires.
  screenshot_url: string | null;
};

const initialState: UpdateFeedbackStatusState = { ok: false };

const STATUS_PILL: Record<FeedbackStatus, StatusPillStatus> = {
  new: "pending",
  triaged: "awaiting_supplier",
  resolved: "completed",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export function FeedbackRow({ row }: { row: FeedbackRowData }) {
  const t = useTranslations("admin.feedback");
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<FeedbackStatus>(row.status);
  const [notes, setNotes] = useState(row.admin_notes ?? "");
  const [state, formAction, pending] = useActionState(
    updateFeedbackStatusAction,
    initialState,
  );

  // Re-sync when the server-provided row changes (e.g. after revalidation).
  useEffect(() => {
    setStatus(row.status);
    setNotes(row.admin_notes ?? "");
  }, [row.status, row.admin_notes]);

  const dirty = status !== row.status || notes !== (row.admin_notes ?? "");
  const messagePreview = truncate(row.message.replace(/\s+/g, " "), 90);
  const pagePreview = row.page_url ? truncatePageUrl(row.page_url) : null;
  const consolePretty = formatConsoleErrors(row.console_errors);

  return (
    <>
      <TableRow
        onClick={() => setExpanded((v) => !v)}
        className="cursor-pointer"
        aria-expanded={expanded}
      >
        <TableCell className="text-muted-foreground">
          {formatDate(row.created_at)}
        </TableCell>
        <TableCell className="text-muted-foreground">
          {row.user_email ?? <span className="italic">—</span>}
        </TableCell>
        <TableCell>
          <span className="text-xs uppercase tracking-wide text-neutral-500">
            {row.role}
          </span>
        </TableCell>
        <TableCell>
          <span className="rounded-full bg-brand-cobalt-100 px-2 py-0.5 text-[11px] font-semibold text-brand-cobalt-500">
            {t(`filters.category.${row.category}`)}
          </span>
        </TableCell>
        <TableCell className="max-w-[280px]">
          <div className="flex flex-col">
            {pagePreview ? (
              <code className="truncate text-xs text-muted-foreground">
                {pagePreview}
              </code>
            ) : null}
            <span className="truncate text-sm text-foreground">
              {messagePreview}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <StatusPill
            status={STATUS_PILL[row.status]}
            label={t(`filters.status.${row.status}`)}
          />
        </TableCell>
        <TableCell className="text-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            aria-label={expanded ? t("row.collapse") : t("row.expand")}
          >
            {expanded ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </Button>
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={7} className="p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  {t("row.messageHeading")}
                </h4>
                <p className="whitespace-pre-wrap rounded-md border bg-background px-3 py-2 text-sm">
                  {row.message}
                </p>
                <dl className="mt-1 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                  {row.page_url ? (
                    <>
                      <dt>{t("row.meta.page")}</dt>
                      <dd className="break-all">
                        <a
                          href={row.page_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-brand-cobalt-500 hover:underline"
                        >
                          {row.page_url}
                          <ExternalLink className="size-3" aria-hidden />
                        </a>
                      </dd>
                    </>
                  ) : null}
                  {row.locale ? (
                    <>
                      <dt>{t("row.meta.locale")}</dt>
                      <dd>{row.locale}</dd>
                    </>
                  ) : null}
                  {row.viewport_w && row.viewport_h ? (
                    <>
                      <dt>{t("row.meta.viewport")}</dt>
                      <dd className="tabular-nums">
                        {row.viewport_w} × {row.viewport_h}
                      </dd>
                    </>
                  ) : null}
                  {row.user_agent ? (
                    <>
                      <dt>{t("row.meta.userAgent")}</dt>
                      <dd className="break-all font-mono text-[11px]">
                        {row.user_agent}
                      </dd>
                    </>
                  ) : null}
                  {row.resolved_at ? (
                    <>
                      <dt>{t("row.meta.resolvedAt")}</dt>
                      <dd>{formatDate(row.resolved_at)}</dd>
                    </>
                  ) : null}
                </dl>
                {row.screenshot_url ? (
                  <div className="mt-2 flex flex-col gap-1.5">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                      {t("row.screenshotHeading")}
                    </h4>
                    {/* Inline preview only — admins are expected to view, not
                        download. The signed URL expires after 1h; on reload
                        the server regenerates a fresh one. */}
                    <a
                      href={row.screenshot_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden rounded-md border bg-background"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element --
                          can't use next/image with a remote signed URL whose
                          host is the local supabase storage proxy. */}
                      <img
                        src={row.screenshot_url}
                        alt={t("row.screenshotHeading")}
                        loading="lazy"
                        className="h-auto w-full"
                      />
                    </a>
                  </div>
                ) : null}
                {consolePretty ? (
                  <details className="mt-2 rounded-md border bg-background">
                    <summary className="cursor-pointer px-3 py-2 text-[12px] font-medium text-muted-foreground">
                      {t("row.consoleHeading")}
                    </summary>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all px-3 pb-3 pt-1 text-[11px] leading-relaxed text-foreground">
                      {consolePretty}
                    </pre>
                  </details>
                ) : null}
              </div>

              <form action={formAction} className="flex flex-col gap-3">
                <input type="hidden" name="id" value={row.id} />
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500"
                    htmlFor={`status-${row.id}`}
                  >
                    {t("columns.status")}
                  </label>
                  <Select
                    value={status}
                    onValueChange={(v) => setStatus(v as FeedbackStatus)}
                  >
                    <SelectTrigger id={`status-${row.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">
                        {t("filters.status.new")}
                      </SelectItem>
                      <SelectItem value="triaged">
                        {t("filters.status.triaged")}
                      </SelectItem>
                      <SelectItem value="resolved">
                        {t("filters.status.resolved")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="status" value={status} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500"
                    htmlFor={`notes-${row.id}`}
                  >
                    {t("row.notesLabel")}
                  </label>
                  <Textarea
                    id={`notes-${row.id}`}
                    name="admin_notes"
                    rows={4}
                    maxLength={2000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t("row.notesPlaceholder")}
                  />
                </div>

                {state.ok === false && state.code ? (
                  <p
                    role="alert"
                    className="rounded-md border border-semantic-danger-500/30 bg-semantic-danger-500/5 px-3 py-2 text-[12.5px] text-semantic-danger-500"
                  >
                    {state.message ?? t("row.errorSave")}
                  </p>
                ) : null}

                <div className="flex items-center justify-end gap-2">
                  {state.ok ? (
                    <span
                      className={cn(
                        "text-[12px] text-semantic-success-500",
                        dirty ? "opacity-0" : "opacity-100",
                      )}
                    >
                      {t("row.saved")}
                    </span>
                  ) : null}
                  <Button type="submit" size="sm" disabled={pending || !dirty}>
                    {pending ? t("row.saving") : t("row.saveStatus")}
                  </Button>
                </div>
              </form>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function truncatePageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search}`;
    return path.length > 60 ? `${path.slice(0, 59)}…` : path;
  } catch {
    return url.length > 60 ? `${url.slice(0, 59)}…` : url;
  }
}

function formatConsoleErrors(value: unknown): string | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    try {
      return value
        .map((entry) => {
          if (
            entry &&
            typeof entry === "object" &&
            "ts" in entry &&
            "msg" in entry
          ) {
            const e = entry as { ts: string; level?: string; msg: string };
            return `[${e.ts}] ${e.level ?? "error"}: ${e.msg}`;
          }
          return JSON.stringify(entry);
        })
        .join("\n");
    } catch {
      return JSON.stringify(value);
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
