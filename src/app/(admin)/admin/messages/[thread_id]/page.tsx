import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ar as arLocale, enUS as enLocale } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";

import { requireAccess } from "@/lib/auth/access";
import {
  getThreadForViewer,
} from "@/lib/messaging/threads";
import { markThreadReadAsAdmin } from "@/lib/messaging/read";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui-ext/PageHeader";

import { ThreadMessageList } from "@/app/_components/messaging/ThreadMessageList";
import { ThreadPoll } from "@/app/_components/messaging/ThreadPoll";
import { ReplyComposer } from "../_components/ReplyComposer";
import { ThreadStatusBadge } from "../_components/ThreadStatusBadge";
import {
  closeAction,
  reopenAction,
  resolveAction,
  triageAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminThreadPage({
  params,
}: {
  params: Promise<{ thread_id: string }>;
}) {
  const { thread_id } = await params;
  const t = await getTranslations("admin.messages");
  const tCommon = await getTranslations("messaging");
  const locale = await getLocale();
  const dfnsLocale = locale === "ar" ? arLocale : enLocale;

  const gate = await requireAccess("messaging.admin.read");

  const result = await getThreadForViewer({
    admin: gate.admin,
    thread_id,
    viewer: { kind: "admin" },
    messageLimit: 200,
  });
  if (!result.ok) {
    if (result.code === "not_found") notFound();
    redirect("/admin/messages");
  }
  const { thread, messages } = result;

  // Mark read on view, but only when there's something unread (avoids a
  // write on every refresh). The bump trigger clears read_at_admin on every
  // non-admin message, so IS NULL is the canonical unread check.
  if (thread.read_at_admin === null) {
    await markThreadReadAsAdmin({ admin: gate.admin, thread_id });
  }

  // Resolve recipient email (best-effort).
  let recipientEmail: string | null = null;
  if (thread.user_id) {
    const r = await gate.admin.auth.admin.getUserById(thread.user_id);
    recipientEmail = r.data.user?.email ?? null;
  }

  const closed = thread.closed_at !== null;
  const subject =
    thread.subject?.trim() ||
    thread.message.split("\n")[0]?.slice(0, 120) ||
    t("thread.subjectPlaceholder");

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ms-2">
          <Link href="/admin/messages">
            <ArrowLeft className="me-1 size-4" />
            {t("thread.back")}
          </Link>
        </Button>
      </div>

      <PageHeader
        title={subject}
        description={
          recipientEmail
            ? `${t("thread.recipient")}: ${recipientEmail} · ${thread.role}`
            : `${t("thread.noEmail")} · ${thread.role}`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ThreadStatusBadge
              status={thread.status}
              closed={closed}
              labels={{
                new: t("filters.status.new"),
                triaged: t("filters.status.triaged"),
                resolved: t("filters.status.resolved"),
                closed: t("filters.status.closed"),
              }}
            />
            {closed ? (
              <form action={reopenAction}>
                <input type="hidden" name="thread_id" value={thread.id} />
                <Button type="submit" size="sm" variant="outline">
                  {t("actions.reopen")}
                </Button>
              </form>
            ) : (
              <>
                {thread.status === "new" ? (
                  <form action={triageAction}>
                    <input type="hidden" name="thread_id" value={thread.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      {t("actions.triage")}
                    </Button>
                  </form>
                ) : null}
                <form action={resolveAction}>
                  <input type="hidden" name="thread_id" value={thread.id} />
                  <Button type="submit" size="sm" variant="outline">
                    {t("actions.resolve")}
                  </Button>
                </form>
                <form action={closeAction}>
                  <input type="hidden" name="thread_id" value={thread.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    {t("actions.close")}
                  </Button>
                </form>
              </>
            )}
          </div>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <ThreadMessageList
            messages={messages}
            viewer="admin"
            locale={dfnsLocale}
            labels={{
              you: tCommon("you"),
              admin: tCommon("admin"),
              edited: tCommon("edited"),
              senderRole: {
                supplier: t("filters.role.supplier"),
                organizer: t("filters.role.organizer"),
                admin: t("filters.role.admin"),
                agency: t("filters.role.agency"),
              },
            }}
          />
        </CardContent>
      </Card>

      <ReplyComposer
        thread_id={thread.id}
        disabled={closed}
        disabledReason={t("reply.errorClosed")}
        placeholder={t("reply.placeholder")}
        sendLabel={t("reply.send")}
        sendingLabel={t("reply.sending")}
        errorLabel={t("reply.error")}
        errorClosedLabel={t("reply.errorClosed")}
      />

      <ThreadPoll
        thread_id={thread.id}
        initial_since={
          messages[messages.length - 1]?.created_at ?? thread.last_message_at
        }
      />
    </section>
  );
}
