import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Inbox, MailPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar as arLocale, enUS as enLocale } from "date-fns/locale";

import { requireAccess } from "@/lib/auth/access";
import {
  listThreadsForAdmin,
  type AdminThreadFilters,
  type ThreadRow,
} from "@/lib/messaging/threads";
import type { AppRole } from "@/lib/supabase/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { cn } from "@/lib/utils";

import { ThreadStatusBadge } from "./_components/ThreadStatusBadge";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const STATUS_KEYS = ["all", "new", "triaged", "resolved"] as const;
type StatusFilter = (typeof STATUS_KEYS)[number];

const ROLE_KEYS = ["all", "supplier", "organizer", "admin", "agency"] as const;
type RoleFilter = (typeof ROLE_KEYS)[number];

const UNREAD_KEYS = ["all", "only"] as const;
type UnreadFilter = (typeof UNREAD_KEYS)[number];

function parseStatus(raw: string | undefined): StatusFilter {
  const v = (raw ?? "all").toLowerCase();
  return (STATUS_KEYS as readonly string[]).includes(v)
    ? (v as StatusFilter)
    : "all";
}

function parseRole(raw: string | undefined): RoleFilter {
  const v = (raw ?? "all").toLowerCase();
  return (ROLE_KEYS as readonly string[]).includes(v)
    ? (v as RoleFilter)
    : "all";
}

function parseUnread(raw: string | undefined): UnreadFilter {
  const v = (raw ?? "all").toLowerCase();
  return (UNREAD_KEYS as readonly string[]).includes(v)
    ? (v as UnreadFilter)
    : "all";
}

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function parseSearch(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim().slice(0, 200);
}

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    role?: string;
    unread?: string;
    page?: string;
    search?: string;
  }>;
}) {
  const t = await getTranslations("admin.messages");
  const tPag = await getTranslations("pagination");
  const locale = await getLocale();
  const dfnsLocale = locale === "ar" ? arLocale : enLocale;

  const params = await searchParams;
  const status = parseStatus(params.status);
  const role = parseRole(params.role);
  const unread = parseUnread(params.unread);
  const search = parseSearch(params.search);
  const page = parsePage(params.page);

  const { admin } = await requireAccess("messaging.admin.read");

  const filters: AdminThreadFilters = {
    status,
    role: role === "all" ? "all" : (role as AppRole),
    unreadOnly: unread === "only",
    search: search || undefined,
  };
  const { rows, totalCount, totalPages } = await listThreadsForAdmin({
    admin,
    filters,
    page,
    pageSize: PAGE_SIZE,
  });

  const userIds = Array.from(
    new Set(rows.map((r) => r.user_id).filter((v): v is string => v !== null)),
  );
  const userEmails = new Map<string, string | null>();
  if (userIds.length > 0) {
    const results = await Promise.all(
      userIds.map((id) => admin.auth.admin.getUserById(id)),
    );
    results.forEach((res, i) => {
      const id = userIds[i];
      userEmails.set(id, res.data.user?.email ?? null);
    });
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title={t("pageTitle")}
        description={t("pageDescription")}
        actions={
          <Button asChild size="sm">
            <Link href="/admin/messages/compose">
              <MailPlus className="me-1 size-4" />
              {t("compose")}
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        <FilterRow
          label={t("filters.status.label")}
          options={STATUS_KEYS.map((key) => ({
            key,
            href: buildHref({ status: key, role, unread, search, page: 1 }),
            label: t(`filters.status.${key}` as never),
            active: status === key,
          }))}
        />
        <FilterRow
          label={t("filters.role.label")}
          options={ROLE_KEYS.map((key) => ({
            key,
            href: buildHref({ status, role: key, unread, search, page: 1 }),
            label: t(`filters.role.${key}` as never),
            active: role === key,
          }))}
        />
        <FilterRow
          label={t("filters.unread.label")}
          options={UNREAD_KEYS.map((key) => ({
            key,
            href: buildHref({ status, role, unread: key, search, page: 1 }),
            label: t(`filters.unread.${key}` as never),
            active: unread === key,
          }))}
        />
        <SearchRow
          label={t("filters.search.label")}
          placeholder={t("filters.search.placeholder")}
          defaultValue={search}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Inbox} title={t("empty")} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.when")}</TableHead>
                  <TableHead>{t("columns.user")}</TableHead>
                  <TableHead>{t("columns.role")}</TableHead>
                  <TableHead>{t("columns.subject")}</TableHead>
                  <TableHead>{t("columns.status")}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t("columns.snippet")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <ThreadListRow
                    key={row.id}
                    row={row}
                    email={row.user_id ? (userEmails.get(row.user_id) ?? null) : null}
                    locale={dfnsLocale}
                    tNoSubject={t("row.noSubject")}
                    tNoEmail={t("row.noEmail")}
                    tUnread={t("row.unread")}
                    tStatusLabels={{
                      new: t("filters.status.new"),
                      triaged: t("filters.status.triaged"),
                      resolved: t("filters.status.resolved"),
                      closed: t("filters.status.closed"),
                    }}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {totalPages > 1 ? (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between gap-3 text-sm"
        >
          {page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={{
                  pathname: "/admin/messages",
                  query: cleanQuery({ status, role, unread, search, page: page - 1 }),
                }}
              >
                {tPag("previous")}
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            {tPag("pageOf", { page, totalPages })}
            {" · "}
            {totalCount}
          </span>
          {page < totalPages ? (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={{
                  pathname: "/admin/messages",
                  query: cleanQuery({ status, role, unread, search, page: page + 1 }),
                }}
              >
                {tPag("next")}
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}

function ThreadListRow({
  row,
  email,
  locale,
  tNoSubject,
  tNoEmail,
  tUnread,
  tStatusLabels,
}: {
  row: ThreadRow;
  email: string | null;
  locale: Locale;
  tNoSubject: string;
  tNoEmail: string;
  tUnread: string;
  tStatusLabels: Record<"new" | "triaged" | "resolved" | "closed", string>;
}) {
  const unread = row.read_at_admin === null;
  const subjectText = row.subject?.trim() || row.message.split("\n")[0] || tNoSubject;
  const snippetText = row.message.replace(/\s+/g, " ").slice(0, 140);
  let relative = "";
  try {
    relative = formatDistanceToNow(new Date(row.last_message_at), {
      addSuffix: true,
      locale,
    });
  } catch {
    relative = row.last_message_at;
  }

  return (
    <TableRow className={cn(unread ? "bg-brand-cobalt-100/30" : undefined)}>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        <Link
          href={`/admin/messages/${row.id}`}
          className="flex items-center gap-2 hover:underline"
        >
          {unread ? (
            <span
              aria-label={tUnread}
              className="inline-block size-2 shrink-0 rounded-full bg-brand-cobalt-500"
            />
          ) : null}
          <time dateTime={row.last_message_at}>{relative}</time>
        </Link>
      </TableCell>
      <TableCell className="text-sm">
        <Link href={`/admin/messages/${row.id}`} className="hover:underline">
          {email ?? tNoEmail}
        </Link>
      </TableCell>
      <TableCell className="text-sm capitalize text-muted-foreground">{row.role}</TableCell>
      <TableCell className="max-w-xs truncate text-sm font-medium">
        <Link href={`/admin/messages/${row.id}`} className="hover:underline">
          {subjectText}
        </Link>
      </TableCell>
      <TableCell>
        <ThreadStatusBadge
          status={row.status}
          closed={row.closed_at !== null}
          labels={tStatusLabels}
        />
      </TableCell>
      <TableCell className="hidden max-w-md truncate text-sm text-muted-foreground md:table-cell">
        {snippetText}
      </TableCell>
    </TableRow>
  );
}

type Locale = typeof arLocale;

function buildHref({
  status,
  role,
  unread,
  search,
  page,
}: {
  status: StatusFilter;
  role: RoleFilter;
  unread: UnreadFilter;
  search: string;
  page: number;
}): string {
  const params = new URLSearchParams(
    cleanQuery({ status, role, unread, search, page }) as Record<string, string>,
  );
  const qs = params.toString();
  return qs ? `/admin/messages?${qs}` : "/admin/messages";
}

function cleanQuery<T extends Record<string, string | number | undefined>>(
  q: T,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined) continue;
    if (k === "status" && v === "all") continue;
    if (k === "role" && v === "all") continue;
    if (k === "unread" && v === "all") continue;
    if (k === "search" && v === "") continue;
    if (k === "page" && (v === 1 || v === "1")) continue;
    out[k] = String(v);
  }
  return out;
}

type FilterOption = {
  key: string;
  href: string;
  label: string;
  active: boolean;
};

function FilterRow({
  label,
  options,
}: {
  label: string;
  options: FilterOption[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[12px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <nav
        aria-label={label}
        className="inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-1"
      >
        {options.map((opt) => (
          <Link
            key={opt.key}
            href={opt.href}
            aria-current={opt.active ? "page" : undefined}
            className={cn(
              "inline-flex h-7 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors",
              opt.active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function SearchRow({
  label,
  placeholder,
  defaultValue,
}: {
  label: string;
  placeholder: string;
  defaultValue: string;
}) {
  return (
    <form
      method="GET"
      action="/admin/messages"
      className="flex flex-wrap items-center gap-2"
    >
      <span className="text-[12px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <input
        type="search"
        name="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-8 flex-1 min-w-48 rounded-md border border-border bg-background px-2 text-sm"
      />
    </form>
  );
}
