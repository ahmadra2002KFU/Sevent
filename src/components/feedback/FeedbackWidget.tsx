"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { MessageSquarePlus, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  submitFeedbackAction,
  type FeedbackCategory,
  type SubmitFeedbackState,
} from "@/app/_actions/feedback";
import { gatherClientContext } from "./feedbackContext";
import { useConsoleErrorBuffer } from "./useConsoleErrorBuffer";

const MESSAGE_MAX_LENGTH = 5000;
const CATEGORIES: FeedbackCategory[] = [
  "bug",
  "feature",
  "confusing",
  "praise",
  "other",
];

const initialState: SubmitFeedbackState = { ok: false };

/**
 * Floating "Feedback" pill mounted in every authenticated layout. Opens a
 * Radix Dialog containing a small form (category + message), and on submit
 * auto-attaches page context (URL, locale, viewport, UA) and the recent
 * console-error ring buffer for triage.
 *
 * Owns nothing role-specific — same UX for supplier / organizer / admin /
 * onboarding suppliers. The auth gate is enforced server-side in
 * `submitFeedbackAction` via requireAccess('feedback.submit').
 */
export function FeedbackWidget() {
  const t = useTranslations("feedback");
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [state, formAction, pending] = useActionState(
    submitFeedbackAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const { getSnapshot } = useConsoleErrorBuffer();

  // On successful submit: close dialog, reset fields, and fire a toast.
  // Track the last `ok` we acted on so re-renders don't re-fire the toast.
  const lastHandledRef = useRef<SubmitFeedbackState | null>(null);
  useEffect(() => {
    if (state === lastHandledRef.current) return;
    if (state.ok) {
      lastHandledRef.current = state;
      toast.success(t("toast.thanks"));
      setOpen(false);
      setMessage("");
      setCategory("bug");
    }
  }, [state, t]);

  // Snapshot client context the moment the form is submitted, so hidden
  // inputs reflect the page the user was actually on (not the page at
  // dialog-open time, in case they navigated mid-flow — unlikely but cheap
  // to do right). Invoked from onSubmit before the form data is read.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const ctx = gatherClientContext();
    setHidden(form, "page_url", ctx.page_url);
    setHidden(form, "locale", ctx.locale);
    setHidden(form, "viewport_w", ctx.viewport_w?.toString() ?? null);
    setHidden(form, "viewport_h", ctx.viewport_h?.toString() ?? null);
    setHidden(form, "user_agent", ctx.user_agent);
    setHidden(form, "console_errors", getSnapshot() || null);
  }

  const trimmed = message.trim();
  const canSubmit = !pending && trimmed.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
        aria-label={t("pill.ariaLabel")}
        className={cn(
          "fixed bottom-4 z-40 inline-flex items-center gap-2 rounded-full",
          "bg-brand-navy-900 text-white shadow-brand-md",
          "px-4 py-2.5 text-[13px] font-semibold",
          "hover:bg-brand-navy-700 transition-colors",
          "print:hidden",
          // RTL-aware: bottom-right LTR, bottom-left RTL.
          "end-4",
        )}
      >
        <MessageSquarePlus className="size-4" strokeWidth={2.25} aria-hidden />
        {t("pill.label")}
      </motion.button>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("modal.title")}</DialogTitle>
          <DialogDescription>{t("modal.description")}</DialogDescription>
        </DialogHeader>
        <form
          ref={formRef}
          action={formAction}
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          {/* Hidden inputs: filled in by handleSubmit just before POST. */}
          <input type="hidden" name="page_url" />
          <input type="hidden" name="locale" />
          <input type="hidden" name="viewport_w" />
          <input type="hidden" name="viewport_h" />
          <input type="hidden" name="user_agent" />
          <input type="hidden" name="console_errors" />

          <div className="flex flex-col gap-2">
            <Label htmlFor="feedback-category">{t("modal.category")}</Label>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as FeedbackCategory)}
            >
              <SelectTrigger id="feedback-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {t(`modal.categoryOptions.${cat}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="category" value={category} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="feedback-message">{t("modal.message")}</Label>
            <Textarea
              id="feedback-message"
              name="message"
              rows={5}
              maxLength={MESSAGE_MAX_LENGTH}
              required
              autoFocus
              placeholder={t("modal.messagePlaceholder")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="text-[12px] text-neutral-500">
              {t("modal.contextHint")}
            </p>
          </div>

          {state.ok === false && state.code && state.code !== "unauthenticated" ? (
            <p
              role="alert"
              className="rounded-md border border-semantic-danger-500/30 bg-semantic-danger-500/5 px-3 py-2 text-[12.5px] text-semantic-danger-500"
            >
              {state.message ?? t("modal.errorGeneric")}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t("modal.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!canSubmit}>
              <Send className="size-4" aria-hidden />
              {pending ? t("modal.submitting") : t("modal.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function setHidden(
  form: HTMLFormElement,
  name: string,
  value: string | null | undefined,
) {
  const el = form.elements.namedItem(name) as HTMLInputElement | null;
  if (el) el.value = value ?? "";
}
