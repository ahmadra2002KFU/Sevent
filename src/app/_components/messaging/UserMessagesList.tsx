import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ar as arLocale, enUS as enLocale } from "date-fns/locale";
import { formatDistanceToNow } from "date-fns";
import { Inbox, MailPlus } from "lucide-react";

import { listThreadsForUser, type ThreadRow } from "@/lib/messaging/threads";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { cn } from "@/lib/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

export type UserRoleSlug = "organizer" | "supplier";

export type UserMessagesListProps = {
  admin: SupabaseClient;
  user_id: string;
  role: UserRoleSlug;
  page?: number;
  unreadOnly?: boolean;
};

const PAGE_SIZE = 25;

export async function UserMessagesList(props: UserMessagesListProps) {
  const t = await getTranslations("messaging");
  const tPag = await getTranslations("pagination");
  const locale = await getLocale();
  const dfnsLocale = locale === "ar" ? arLocale : enLocale;

  const page = Math.max(1, props.page ?? 1);
  const { rows, totalCount, totalPages } = await listThreadsForUser({
    admin: props.admin,
    user_id: props.user_id,
    page,
    pageSize: PAGE_SIZE,
    unreadOnly: props.unreadOnly,
  });

  const basePath = `/${props.role}/messages`;
  const newPath = `${basePath}/new`;

  const headerActions = (
    <Button asChild size="sm">
      <Link href={newPath}>
        <MailPlus className="me-1 size-4" />
        {t("newThread")}
      </Link>
    </Button>
  );

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t("title")} actions={headerActions} />

      {rows.length === 0 ? (
        <EmptyState icon={Inbox} title={t("empty")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <UserThreadListItem
              key={row.id}
              row={row}
              basePath={basePath}
              dfnsLocale={dfnsLocale}
              t={{
                noSubject: t("thread.noSubject"),
                statusNew: t("status.new"),
                statusTriaged: t("status.triaged"),
                statusResolved: t("status.resolved"),
                statusClosed: t("status.closed"),
              }}
            />
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between gap-3 text-sm"
        >
          {page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`${basePath}?page=${page - 1}`}>{tPag("previous")}</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            {tPag("pageOf", { page, totalPages })} · {totalCount}
          </span>
          {page < totalPages ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`${basePath}?page=${page + 1}`}>{tPag("next")}</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}

function UserThreadListItem({
  row,
  basePath,
  dfnsLocale,
  t,
}: {
  row: ThreadRow;
  basePath: string;
  dfnsLocale: typeof arLocale;
  t: {
    noSubject: string;
    statusNew: string;
    statusTriaged: string;
    statusResolved: string;
    statusClosed: string;
  };
}) {
  const unread = row.read_at_user === null;
  const subjectText =
    row.subject?.trim() || row.message.split("\n")[0] || t.noSubject;
  const snippetText = row.message.replace(/\s+/g, " ").slice(0, 160);

  let relative = "";
  try {
    relative = formatDistanceToNow(new Date(row.last_message_at), {
      addSuffix: true,
      locale: dfnsLocale,
    });
  } catch {
    relative = row.last_message_at;
  }

  let statusLabel = t.statusNew;
  if (row.closed_at) statusLabel = t.statusClosed;
  else if (row.status === "triaged") statusLabel = t.statusTriaged;
  else if (row.status === "resolved") statusLabel = t.statusResolved;

  return (
    <li>
      <Link
        href={`${basePath}/${row.id}`}
        className={cn(
          "block rounded-lg border border-border p-4 transition-colors",
          unread
            ? "ring-brand-cobalt-500/40 bg-brand-cobalt-100/30"
            : "bg-card hover:bg-muted/50",
        )}
      >
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              {unread ? (
                <span
                  aria-hidden
                  className="inline-block size-2 shrink-0 rounded-full bg-brand-cobalt-500"
                />
              ) : null}
              <span className="font-medium text-foreground">{subjectText}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {statusLabel}
              </span>
            </div>
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {snippetText}
            </p>
            <time
              dateTime={row.last_message_at}
              className="text-xs text-muted-foreground"
            >
              {relative}
            </time>
          </div>
        </div>
      </Link>
    </li>
  );
}
