"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Camera, MessageSquarePlus, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { captureViewportScreenshot } from "./screenshotCapture";

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
  // Default-on for bug, off otherwise. The user can override via the checkbox
  // — `screenshotTouchedRef` tracks whether they have, so changing the
  // category later doesn't clobber their explicit choice.
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const screenshotTouchedRef = useRef(false);
  const [capturing, setCapturing] = useState(false);
  const [state, formAction, pending] = useActionState(
    submitFeedbackAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const { getSnapshot } = useConsoleErrorBuffer();

  // Sync screenshot default to category until the user explicitly toggles it.
  useEffect(() => {
    if (!screenshotTouchedRef.current) {
      setIncludeScreenshot(category === "bug");
    }
  }, [category]);

  // Reset everything when the dialog closes (incl. via Send success).
  useEffect(() => {
    if (!open) {
      screenshotTouchedRef.current = false;
    }
  }, [open]);

  // Allow other UI (e.g. the user-menu "Send feedback" item shown on mobile,
  // where the floating pill is hidden) to open this dialog without prop
  // drilling. Single owner stays here so the console-error buffer and dialog
  // state aren't duplicated.
  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("sevent:open-feedback", onOpen);
    return () => window.removeEventListener("sevent:open-feedback", onOpen);
  }, []);

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

  /**
   * Build the FormData manually rather than letting the form's `action=`
   * attribute serialize. We need to (a) fill in client-only context fields
   * (URL, viewport, …) and (b) optionally append a Blob screenshot — neither
   * of which fits the static <form> serialization. Calling `formAction(fd)`
   * directly is fully supported by useActionState.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formRef.current) return;

    const fd = new FormData(formRef.current);
    const ctx = gatherClientContext();
    fd.set("page_url", ctx.page_url ?? "");
    fd.set("locale", ctx.locale ?? "");
    fd.set("viewport_w", ctx.viewport_w?.toString() ?? "");
    fd.set("viewport_h", ctx.viewport_h?.toString() ?? "");
    fd.set("user_agent", ctx.user_agent ?? "");
    fd.set("console_errors", getSnapshot());

    if (includeScreenshot) {
      setCapturing(true);
      const blob = await captureViewportScreenshot();
      setCapturing(false);
      if (blob) {
        fd.set("screenshot", blob, "screenshot.jpg");
      }
      // If capture failed silently, we proceed without a screenshot rather
      // than blocking the whole submission. Action is no-op for the field.
    }

    // Wrap in startTransition: we awaited above, so we're outside React's
    // automatic transition boundary. Without this, isPending won't flip and
    // React 19 warns. (The capture-time pending UX is handled separately by
    // the local `capturing` state above.)
    startTransition(() => {
      formAction(fd);
    });
  }

  const trimmed = message.trim();
  const busy = pending || capturing;
  const canSubmit = !busy && trimmed.length > 0;
  const buttonLabel = capturing
    ? t("modal.capturing")
    : pending
      ? t("modal.submitting")
      : t("modal.submit");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
        aria-label={t("pill.ariaLabel")}
        // Skip the pill itself from html2canvas capture so it doesn't appear
        // in the user's screenshot (it'd be visually distracting).
        data-feedback-skip-capture=""
        className={cn(
          // Hidden on mobile — on small viewports the pill overlapped sticky
          // form actions like "Save event". The user-menu's "Send feedback"
          // entry covers the mobile path; pill returns at md+ where there's
          // room beside content.
          "fixed bottom-4 z-40 hidden items-center gap-2 rounded-full md:inline-flex",
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
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
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

          <label className="flex cursor-pointer items-start gap-2.5 rounded-md border bg-muted/30 px-3 py-2.5">
            <Checkbox
              checked={includeScreenshot}
              onCheckedChange={(value) => {
                screenshotTouchedRef.current = true;
                setIncludeScreenshot(value === true);
              }}
              className="mt-0.5"
              aria-describedby="feedback-screenshot-hint"
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                <Camera className="size-3.5" aria-hidden />
                {t("modal.includeScreenshot")}
              </span>
              <span
                id="feedback-screenshot-hint"
                className="text-[12px] text-neutral-500"
              >
                {t("modal.screenshotHint")}
              </span>
            </div>
          </label>

          {/* Hidden inputs for context fields. Values are populated in
              handleSubmit before formAction is called. */}
          <input type="hidden" name="page_url" />
          <input type="hidden" name="locale" />
          <input type="hidden" name="viewport_w" />
          <input type="hidden" name="viewport_h" />
          <input type="hidden" name="user_agent" />
          <input type="hidden" name="console_errors" />

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
              <Button type="button" variant="outline" disabled={busy}>
                {t("modal.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!canSubmit}>
              <Send className="size-4" aria-hidden />
              {buttonLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
