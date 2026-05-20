"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  Building2,
  ChevronRight,
  Loader2,
  Mail,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { PathCard } from "@/components/supplier/onboarding/PathCard";
import { markAsIndividualAction } from "./actions";

export type ChoicePathLabels = {
  title: string;
  desc: string;
  steps: string[];
  eta: string;
  tag?: string;
};

export type ChoiceClientLabels = {
  title: string;
  sub: string;
  needsTitle: string;
  etaPrefix: string;
  continueCta: string;
  continueLoading: string;
  individual: ChoicePathLabels;
  company: ChoicePathLabels;
  invited: ChoicePathLabels;
  invite: {
    pasteLabel: string;
    pastePlaceholder: string;
    pasteCta: string;
    pasteError: string;
    help: string;
  };
};

type ChoiceValue = "individual" | "company" | "invited";

/**
 * Post-signup path picker for organizers, rendered inside the focused
 * `(onboarding)` shell. Mirrors the supplier path picker (`PathClient`) and
 * reuses `PathCard` so the two funnels share one visual language.
 *
 * Select-then-continue:
 *   - individual → markAsIndividualAction (flips legal_type, redirects to dash)
 *   - company    → /organizer/onboarding/company (the creation form)
 *   - invited    → reveals an inline panel to paste the invite link from the
 *                  email; we validate it's a same-origin /invite/organizer URL
 *                  and route to the existing hardened accept page (no backend).
 */
export function ChoiceClient({
  labels,
  initialError = null,
}: {
  labels: ChoiceClientLabels;
  initialError?: string | null;
}) {
  const router = useRouter();
  const [active, setActive] = useState<ChoiceValue>("company");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(initialError);
  const [inviteLink, setInviteLink] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  function handleContinue() {
    setError(null);
    if (active === "company") {
      router.push("/organizer/onboarding/company");
      return;
    }
    // individual — server action flips legal_type then redirects to dashboard.
    startTransition(async () => {
      await markAsIndividualAction();
    });
  }

  function handleOpenInvite() {
    setInviteError(null);
    const raw = inviteLink.trim();
    if (!raw) {
      setInviteError(labels.invite.pasteError);
      return;
    }
    try {
      // Accept either a full URL or a bare path. Resolve against the current
      // origin and require it to STAY on this origin and under the invite
      // route — the invite page itself does all auth + token verification.
      const parsed = new URL(raw, window.location.origin);
      const sameOrigin = parsed.origin === window.location.origin;
      const isInvitePath = parsed.pathname.startsWith("/invite/organizer/");
      if (!sameOrigin || !isInvitePath) {
        setInviteError(labels.invite.pasteError);
        return;
      }
      router.push(`${parsed.pathname}${parsed.search}`);
    } catch {
      setInviteError(labels.invite.pasteError);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[980px] px-4 pt-8 md:pt-10">
      <div className="pb-8 pt-2 text-center">
        <h1 className="text-[28px] font-extrabold tracking-tight text-brand-navy-900 md:text-[34px]">
          {labels.title}
        </h1>
        <p className="mx-auto mt-2.5 max-w-[560px] text-[15px] leading-relaxed text-neutral-600">
          {labels.sub}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <PathCard
          title={labels.individual.title}
          desc={labels.individual.desc}
          icon={UserRound}
          steps={labels.individual.steps}
          eta={labels.individual.eta}
          active={active === "individual"}
          needsTitle={labels.needsTitle}
          etaPrefix={labels.etaPrefix}
          onClick={() => setActive("individual")}
        />
        <PathCard
          title={labels.company.title}
          desc={labels.company.desc}
          icon={Building2}
          steps={labels.company.steps}
          eta={labels.company.eta}
          active={active === "company"}
          tag={labels.company.tag}
          needsTitle={labels.needsTitle}
          etaPrefix={labels.etaPrefix}
          onClick={() => setActive("company")}
        />
        <PathCard
          title={labels.invited.title}
          desc={labels.invited.desc}
          icon={Mail}
          steps={labels.invited.steps}
          eta={labels.invited.eta}
          active={active === "invited"}
          needsTitle={labels.needsTitle}
          etaPrefix={labels.etaPrefix}
          onClick={() => setActive("invited")}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {active === "invited" ? (
          <motion.div
            key="invite-panel"
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="mx-auto mt-7 max-w-xl rounded-[14px] border border-neutral-200 bg-white p-6 shadow-brand-sm">
              <label
                htmlFor="invite-link"
                className="mb-1.5 block text-sm font-semibold text-brand-navy-900"
              >
                {labels.invite.pasteLabel}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="invite-link"
                  type="url"
                  inputMode="url"
                  dir="ltr"
                  value={inviteLink}
                  onChange={(e) => {
                    setInviteLink(e.target.value);
                    if (inviteError) setInviteError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleOpenInvite();
                    }
                  }}
                  placeholder={labels.invite.pastePlaceholder}
                  aria-invalid={Boolean(inviteError)}
                  className="flex-1"
                />
                <motion.button
                  type="button"
                  onClick={handleOpenInvite}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] bg-brand-navy-900 px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-brand-navy-700"
                >
                  {labels.invite.pasteCta}
                  <ChevronRight className="size-4 rtl:rotate-180" strokeWidth={2} />
                </motion.button>
              </div>
              <AnimatePresence>
                {inviteError ? (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="mt-2 text-[12.5px] text-semantic-danger-500"
                  >
                    {inviteError}
                  </motion.p>
                ) : null}
              </AnimatePresence>
              <p className="mt-3 text-[12.5px] leading-relaxed text-neutral-600">
                {labels.invite.help}
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="continue"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <AnimatePresence>
              {error ? (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mx-auto mt-6 max-w-sm rounded-lg border border-semantic-danger-500/40 bg-semantic-danger-500/5 px-4 py-2.5 text-center text-[12.5px] text-semantic-danger-500"
                >
                  {error}
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="mt-8 flex items-center justify-center">
              <motion.button
                type="button"
                onClick={handleContinue}
                disabled={pending}
                whileHover={pending ? undefined : { y: -1 }}
                whileTap={pending ? undefined : { scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-[10px] bg-brand-navy-900 px-7 py-3 text-[14.5px] font-bold text-white shadow-brand-md transition",
                  "hover:bg-brand-navy-700",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                )}
              >
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    {labels.continueLoading}
                  </>
                ) : (
                  <>
                    {labels.continueCta}
                    <ChevronRight
                      className="size-4 rtl:rotate-180"
                      strokeWidth={2}
                    />
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
