import { formatDistanceToNow, format } from "date-fns";
import type { Locale } from "date-fns";

import type { MessageRow } from "@/lib/messaging/threads";
import { cn } from "@/lib/utils";

export type ThreadMessageListProps = {
  messages: MessageRow[];
  /**
   * The viewer's role:
   *   - "admin"  → admin bubbles align end (right in LTR / left in RTL).
   *                Other-party bubbles align start.
   *   - "owner"  → user's own bubbles align end. Admin bubbles align start.
   */
  viewer: "admin" | "owner";
  locale: Locale;
  labels: {
    you: string;
    admin: string;
    edited: string;
    senderRole: Record<string, string>;
  };
};

/**
 * Renders the message log. Logical alignment classes (`text-start`,
 * `self-start`/`self-end`) ensure RTL flips automatically.
 */
export function ThreadMessageList({
  messages,
  viewer,
  locale,
  labels,
}: ThreadMessageListProps) {
  return (
    <ol className="flex flex-col gap-3">
      {messages.map((m) => {
        const isMe =
          (viewer === "admin" && m.sender_role === "admin") ||
          (viewer === "owner" && m.sender_role !== "admin");

        const senderLabel = isMe
          ? labels.you
          : m.sender_role === "admin"
            ? labels.admin
            : (labels.senderRole[m.sender_role] ?? m.sender_role);

        let relative = "";
        let absolute = "";
        try {
          relative = formatDistanceToNow(new Date(m.created_at), {
            addSuffix: true,
            locale,
          });
          absolute = format(new Date(m.created_at), "PPpp", { locale });
        } catch {
          relative = m.created_at;
          absolute = m.created_at;
        }

        return (
          <li
            key={m.id}
            className={cn(
              "flex w-full",
              isMe ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "flex max-w-[80%] flex-col gap-1 rounded-lg border px-3 py-2",
                isMe
                  ? "border-brand-cobalt-500/40 bg-brand-cobalt-100/40"
                  : "border-border bg-card",
              )}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {senderLabel}
                </span>
                <span aria-hidden>·</span>
                <time dateTime={m.created_at} title={absolute}>
                  {relative}
                </time>
                {m.edited_at ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="italic">{labels.edited}</span>
                  </>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {m.body}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
