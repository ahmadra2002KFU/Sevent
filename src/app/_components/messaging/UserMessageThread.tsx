import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { ar as arLocale, enUS as enLocale } from "date-fns/locale";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getThreadForViewer } from "@/lib/messaging/threads";
import { markThreadReadAsUser } from "@/lib/messaging/read";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui-ext/PageHeader";

import { ThreadMessageList } from "./ThreadMessageList";
import { ThreadPoll } from "./ThreadPoll";
import { UserReplyComposer } from "./UserReplyComposer";

export type UserMessageThreadProps = {
  admin: SupabaseClient;
  user_id: string;
  role: "organizer" | "supplier";
  thread_id: string;
};

export async function UserMessageThread(props: UserMessageThreadProps) {
  const tCommon = await getTranslations("messaging");
  const tThread = await getTranslations("messaging.thread");
  const tComposer = await getTranslations("messaging.composer");
  const tStatus = await getTranslations("messaging.status");
  const locale = await getLocale();
  const dfnsLocale = locale === "ar" ? arLocale : enLocale;

  const result = await getThreadForViewer({
    admin: props.admin,
    thread_id: props.thread_id,
    viewer: { kind: "owner", user_id: props.user_id },
    messageLimit: 200,
  });
  if (!result.ok) {
    if (result.code === "not_found" || result.code === "forbidden") notFound();
    redirect(`/${props.role}/messages`);
  }
  const { thread, messages } = result;

  if (thread.read_at_user === null) {
    await markThreadReadAsUser({ admin: props.admin, thread_id: props.thread_id });
  }

  const closed = thread.closed_at !== null;
  const subject =
    thread.subject?.trim() ||
    thread.message.split("\n")[0]?.slice(0, 120) ||
    tThread("noSubject");

  let statusLabel = tStatus("new");
  if (closed) statusLabel = tStatus("closed");
  else if (thread.status === "triaged") statusLabel = tStatus("triaged");
  else if (thread.status === "resolved") statusLabel = tStatus("resolved");

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ms-2">
          <Link href={`/${props.role}/messages`}>
            <ArrowLeft className="me-1 size-4" />
            {tCommon("back")}
          </Link>
        </Button>
      </div>

      <PageHeader
        title={subject}
        description={statusLabel}
      />

      {closed ? (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {tThread("closedNotice")}
        </div>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <ThreadMessageList
            messages={messages}
            viewer="owner"
            locale={dfnsLocale}
            labels={{
              you: tCommon("you"),
              admin: tCommon("admin"),
              edited: tCommon("edited"),
              senderRole: {
                supplier: props.role === "supplier" ? tCommon("you") : "Supplier",
                organizer: props.role === "organizer" ? tCommon("you") : "Organizer",
                admin: tCommon("admin"),
                agency: "Agency",
              },
            }}
          />
        </CardContent>
      </Card>

      <UserReplyComposer
        thread_id={thread.id}
        disabled={closed}
        placeholder={tComposer("placeholder")}
        sendLabel={tComposer("send")}
        sendingLabel={tComposer("sending")}
        errorLabel={tComposer("error")}
        errorClosedLabel={tComposer("errorClosed")}
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
