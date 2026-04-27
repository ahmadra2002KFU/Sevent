import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Inbox } from "lucide-react";
import { requireAccess } from "@/lib/auth/access";
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
import { FeedbackRow, type FeedbackRowData } from "./_components/FeedbackRow";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const STATUS_KEYS = ["new", "triaged", "resolved", "all"] as const;
type StatusFilter = (typeof STATUS_KEYS)[number];

const ROLE_KEYS = [
  "all",
  "supplier",
  "organizer",
  "admin",
  "agency",
] as const;
type RoleFilter = (typeof ROLE_KEYS)[number];

const CATEGORY_KEYS = [
  "all",
  "bug",
  "feature",
  "confusing",
  "praise",
  "other",
] as const;
type CategoryFilter = (typeof CATEGORY_KEYS)[number];

function parseStatus(raw: string | undefined): StatusFilter {
  const v = (raw ?? "new").toLowerCase();
  return (STATUS_KEYS as readonly string[]).includes(v)
    ? (v as StatusFilter)
    : "new";
}

function parseRole(raw: string | undefined): RoleFilter {
  const v = (raw ?? "all").toLowerCase();
  return (ROLE_KEYS as readonly string[]).includes(v)
    ? (v as RoleFilter)
    : "all";
}

function parseCategory(raw: string | undefined): CategoryFilter {
  const v = (raw ?? "all").toLowerCase();
  return (CATEGORY_KEYS as readonly string[]).includes(v)
    ? (v as CategoryFilter)
    : "all";
}

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

type FeedbackQueryRow = {
  id: string;
  user_id: string | null;
  role: string;
  category: string;
  message: string;
  page_url: string | null;
  locale: string | null;
  viewport_w: number | null;
  viewport_h: number | null;
  user_agent: string | null;
  console_errors: unknown;
  status: "new" | "triaged" | "resolved";
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  screenshot_path: string | null;
};

const SCREENSHOT_BUCKET = "feedback-screenshots";
const SCREENSHOT_URL_TTL_SECONDS = 60 * 60; // 1 hour

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    role?: string;
    category?: string;
    page?: string;
  }>;
}) {
  const t = await getTranslations("admin.feedback");
  const tPag = await getTranslations("pagination");
  const params = await searchParams;
  const status = parseStatus(params.status);
  const role = parseRole(params.role);
  const category = parseCategory(params.category);
  const page = parsePage(params.page);

  // Gate redirects on deny — no need to handle the unauthenticated/forbidden
  // states inline since requireAccess() throws NEXT_REDIRECT.
  const { admin } = await requireAccess("feedback.admin.read");

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = admin
    .from("app_feedback")
    .select(
      "id, user_id, role, category, message, page_url, locale, viewport_w, viewport_h, user_agent, console_errors, status, admin_notes, resolved_at, created_at, screenshot_path",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status !== "all") query = query.eq("status", status);
  if (role !== "all") query = query.eq("role", role);
  if (category !== "all") query = query.eq("category", category);

  const { data, error, count } = await query;
  const rows: FeedbackQueryRow[] = (data as FeedbackQueryRow[] | null) ?? [];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Resolve submitter emails in a single follow-up. We hit auth.users via
  // the service-role admin client — no batch get-by-ids API on supabase-js,
  // so we do parallel one-shots. For PAGE_SIZE=25 that's fine.
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
      const email = res.data.user?.email ?? null;
      userEmails.set(id, email);
    });
  }

  // Generate one signed URL per row that has a screenshot. 1-hour TTL is
  // plenty for an admin to scroll the page; if it expires they reload.
  const screenshotPaths = rows
    .map((r) => r.screenshot_path)
    .filter((p): p is string => p !== null && p.length > 0);
  const screenshotUrls = new Map<string, string>();
  if (screenshotPaths.length > 0) {
    const signedResults = await Promise.all(
      screenshotPaths.map((path) =>
        admin.storage
          .from(SCREENSHOT_BUCKET)
          .createSignedUrl(path, SCREENSHOT_URL_TTL_SECONDS),
      ),
    );
    signedResults.forEach((res, i) => {
      const url = res.data?.signedUrl;
      if (url) screenshotUrls.set(screenshotPaths[i], url);
    });
  }

  const tableRows: FeedbackRowData[] = rows.map((r) => ({
    id: r.id,
    role: r.role,
    category: r.category,
    message: r.message,
    page_url: r.page_url,
    locale: r.locale,
    viewport_w: r.viewport_w,
    viewport_h: r.viewport_h,
    user_agent: r.user_agent,
    console_errors: r.console_errors,
    status: r.status,
    admin_notes: r.admin_notes,
    resolved_at: r.resolved_at,
    created_at: r.created_at,
    user_email: r.user_id ? (userEmails.get(r.user_id) ?? null) : null,
    screenshot_url: r.screenshot_path
      ? (screenshotUrls.get(r.screenshot_path) ?? null)
      : null,
  }));

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />

      {/* Filter rows: status / role / category. URL-driven Link groups so the
          page stays a server component and the filter state is shareable. */}
      <div className="flex flex-col gap-3">
        <FilterRow
          label={t("filters.status.label")}
          options={STATUS_KEYS.map((key) => ({
            key,
            href: buildHref({ status: key, role, category }),
            label: t(`filters.status.${key}`),
            active: status === key,
          }))}
        />
        <FilterRow
          label={t("filters.role.label")}
          options={ROLE_KEYS.map((key) => ({
            key,
            href: buildHref({ status, role: key, category }),
            label: t(`filters.role.${key}`),
            active: role === key,
          }))}
        />
        <FilterRow
          label={t("filters.category.label")}
          options={CATEGORY_KEYS.map((key) => ({
            key,
            href: buildHref({ status, role, category: key }),
            label: t(`filters.category.${key}`),
            active: category === key,
          }))}
        />
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-semantic-danger-500/30 bg-semantic-danger-100 px-3 py-2 text-sm text-semantic-danger-500"
        >
          {t("errorLoad")}: {error.message}
        </div>
      ) : null}

      {tableRows.length === 0 ? (
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
                  <TableHead>{t("columns.category")}</TableHead>
                  <TableHead>{t("columns.page")}</TableHead>
                  <TableHead>{t("columns.status")}</TableHead>
                  <TableHead className="text-end" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.map((row) => (
                  <FeedbackRow key={row.id} row={row} />
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
                  pathname: "/admin/feedback",
                  query: clean({ status, role, category, page: page - 1 }),
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
          </span>
          {page < totalPages ? (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={{
                  pathname: "/admin/feedback",
                  query: clean({ status, role, category, page: page + 1 }),
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

function buildHref({
  status,
  role,
  category,
}: {
  status: StatusFilter;
  role: RoleFilter;
  category: CategoryFilter;
}): string {
  const params = new URLSearchParams(
    clean({ status, role, category }) as Record<string, string>,
  );
  const qs = params.toString();
  return qs ? `/admin/feedback?${qs}` : "/admin/feedback";
}

// Drop default values so URLs stay short — `?status=new` is the implicit
// default; only carry filters that diverge.
function clean<T extends Record<string, string | number | undefined>>(
  q: T,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined) continue;
    if (k === "status" && v === "new") continue;
    if (k === "role" && v === "all") continue;
    if (k === "category" && v === "all") continue;
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
