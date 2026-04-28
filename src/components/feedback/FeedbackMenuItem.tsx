"use client";

import { MessageSquarePlus } from "lucide-react";
import { useLocale } from "next-intl";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

/**
 * Dropdown entry that opens the feedback dialog owned by FeedbackWidget.
 * Communicates via a window event so the dialog stays a single instance
 * (one console-error buffer, one Radix portal). Used in the user menu so
 * mobile users still have a path to feedback after the floating pill was
 * hidden below `md` to stop it overlapping sticky form actions.
 */
export function FeedbackMenuItem() {
  const locale = useLocale();
  const label = locale === "ar" ? "إرسال ملاحظات" : "Send feedback";
  return (
    <DropdownMenuItem
      onSelect={() => {
        window.dispatchEvent(new CustomEvent("sevent:open-feedback"));
      }}
      className="flex cursor-pointer items-center gap-2"
    >
      <MessageSquarePlus className="size-4" aria-hidden />
      {label}
    </DropdownMenuItem>
  );
}
