import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, MailPlus, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar as arLocale, enUS as enLocale } from "date-fns/locale";

import { requireAccess } from "@/lib/auth/access";
import { listUsersForAdmin, type AdminUserRow } from "@/lib/admin/users";
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

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const ROLE_KEYS = ["all", "supplier", "organizer", "admin", "agency"] as const;
type RoleFilter = (typeof ROLE_KEYS)[number];

function parseRole(raw: string | undefined): RoleFilter {
  const v = (raw ?? "all").toLowerCase();
  return (ROLE_KEYS as readonly string[]).includes(v)
    ? (v as RoleFilter)
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

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; search?: string; page?: string }>;
}) {
  const t = await getTranslations("admin.users");
  const tPag = await getTranslations("pagination");
  const locale = await getLocale();
  const dfnsLocale = locale === "ar" ? arLocale : enLocale;

  const params = await searchParams;
  const role = parseRole(params.role);
  const search = parseSearch(params.search);
  const page = parsePage(params.page);

  const { admin } = await requireAccess("messaging.admin.read");

  const { rows, totalCount, totalPages } = await listUsersForAdmin({
    admin,
    role,
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <div className="flex flex-col gap-3">
        <FilterRow
          label={t("filters.role.label")}
          options={ROLE_KEYS.map((key) => ({
            key,
            href: buildHref({ role: key, search, page: 1 }),
            label: t(`filters.role.${key}` as never),
            active: role === key,
          }))}
        />
        <SearchRow
          label={t("filters.search.label")}
          placeholder={t("filters.search.placeholder")}
          defaultValue={search}
          role={role}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Users} title={t("empty")} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.user")}</TableHead>
                  <TableHead>{t("columns.role")}</TableHead>
                  <TableHead>{t("columns.joined")}</TableHead>
                  <TableHead>{t("columns.threads")}</TableHead>
                  <TableHead>{t("columns.lastActivity")}</TableHead>
                  <TableHead className="text-end">
                    {t("columns.action")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => (
                  <UserListRow
                    key={u.id}
                    user={u}
                    locale={dfnsLocale}
                    tNoName={t("row.noName")}
                    tNoEmail={t("row.noEmail")}
                    tNoActivity={t("row.noActivity")}
                    tThreadCount={(count: number) =>
                      t("row.threadCount", { count })
                    }
                    tUnread={(count: number) => t("row.unread", { count })}
                    tRole={(r: AppRole) => t(`filters.role.${r}` as never)}
                    tSendMessage={t("sendMessage")}
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
                  pathname: "/admin/users",
                  query: cleanQuery({ role, search, page: page - 1 }),
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
                  pathname: "/admin/users",
                  query: cleanQuery({ role, search, page: page + 1 }),
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

function UserListRow({
  user,
  locale,
  tNoName,
  tNoEmail,
  tNoActivity,
  tThreadCount,
  tUnread,
  tRole,
  tSendMessage,
}: {
  user: AdminUserRow;
  locale: typeof arLocale;
  tNoName: string;
  tNoEmail: string;
  tNoActivity: string;
  tThreadCount: (count: number) => string;
  tUnread: (count: number) => string;
  tRole: (role: AppRole) => string;
  tSendMessage: string;
}) {
  let lastActivity = tNoActivity;
  if (user.last_activity) {
    try {
      lastActivity = formatDistanceToNow(new Date(user.last_activity), {
        addSuffix: true,
        locale,
      });
    } catch {
      lastActivity = user.last_activity;
    }
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium text-foreground">
            {user.full_name?.trim() || tNoName}
          </span>
          <span className="text-xs text-muted-foreground">
            {user.email ?? tNoEmail}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {tRole(user.role)}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(user.created_at)}
      </TableCell>
      <TableCell className="text-sm">
        <div className="flex items-center gap-2">
          <span className="tabular-nums text-muted-foreground">
            {tThreadCount(user.thread_count)}
          </span>
          {user.unread_count > 0 ? (
            <span className="inline-flex items-center rounded-full bg-brand-cobalt-500 px-2 py-0.5 text-xs font-medium text-white">
              {tUnread(user.unread_count)}
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {lastActivity}
      </TableCell>
      <TableCell className="text-end">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/admin/messages/compose?user_id=${user.id}`}>
            <MailPlus aria-hidden className="me-1 size-4" />
            {tSendMessage}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

function buildHref({
  role,
  search,
  page,
}: {
  role: RoleFilter;
  search: string;
  page: number;
}): string {
  const params = new URLSearchParams(
    cleanQuery({ role, search, page }) as Record<string, string>,
  );
  const qs = params.toString();
  return qs ? `/admin/users?${qs}` : "/admin/users";
}

function cleanQuery<T extends Record<string, string | number | undefined>>(
  q: T,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined) continue;
    if (k === "role" && v === "all") continue;
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
  role,
}: {
  label: string;
  placeholder: string;
  defaultValue: string;
  role: RoleFilter;
}) {
  return (
    <form
      method="GET"
      action="/admin/users"
      className="flex flex-wrap items-center gap-2"
    >
      {/* Carry the active role filter through a search submit — a GET form
          only sends its own fields, so without this the role resets to all. */}
      {role !== "all" ? (
        <input type="hidden" name="role" value={role} />
      ) : null}
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
