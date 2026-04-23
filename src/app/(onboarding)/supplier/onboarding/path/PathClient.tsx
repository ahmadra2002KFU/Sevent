"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, User } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { PathCard } from "@/components/supplier/onboarding/PathCard";
import { setLegalTypeAction } from "./actions";

export type PathClientLabels = {
  eyebrow: string;
  title: string;
  sub: string;
  needsTitle: string;
  etaPrefix: string;
  etaSuffix: string;
  cta: string;
  back: string;
  freelancer: {
    title: string;
    desc: string;
    steps: string[];
    eta: string;
  };
  company: {
    title: string;
    desc: string;
    steps: string[];
    eta: string;
    tag: string;
  };
};

type PathValue = "freelancer" | "company";

export function PathClient({ labels }: { labels: PathClientLabels }) {
  const router = useRouter();
  // Mockup defaults the company card to active so the gold verified badge
  // reads immediately on first paint. User can toggle before continuing.
  const [active, setActive] = useState<PathValue>("company");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    setError(null);
    startTransition(async () => {
      const result = await setLegalTypeAction({ legal_type: active });
      if (!result.ok) {
        setError(result.message ?? "Something went wrong");
        return;
      }
      router.replace("/supplier/onboarding");
    });
  }

  return (
    <div className="mx-auto w-full max-w-[880px] px-4 pt-8 md:pt-10">
      <div className="pb-8 pt-5 text-center">
        <div className="inline-block rounded-full bg-brand-cobalt-100 px-3 py-[5px] text-[12px] font-bold text-brand-cobalt-500">
          {labels.eyebrow}
        </div>
        <h1 className="mt-4 text-[28px] font-extrabold tracking-tight text-brand-navy-900 md:text-[34px]">
          {labels.title}
        </h1>
        <p className="mx-auto mt-2.5 max-w-[560px] text-[15px] leading-relaxed text-neutral-600">
          {labels.sub}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <PathCard
          title={labels.freelancer.title}
          desc={labels.freelancer.desc}
          icon={User}
          steps={labels.freelancer.steps}
          eta={labels.freelancer.eta}
          active={active === "freelancer"}
          needsTitle={labels.needsTitle}
          etaPrefix={labels.etaPrefix}
          etaSuffix={labels.etaSuffix}
          onClick={() => setActive("freelancer")}
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
          etaSuffix={labels.etaSuffix}
          onClick={() => setActive("company")}
        />
      </div>

      {error ? (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto mt-6 max-w-sm rounded-lg border border-semantic-danger-500/40 bg-semantic-danger-500/5 px-4 py-2.5 text-center text-[12.5px] text-semantic-danger-500"
        >
          {error}
        </motion.div>
      ) : null}

      <div className="mt-8 flex items-center justify-center gap-3">
        <button
          type="button"
          disabled
          className="px-6 py-3 text-[14px] text-neutral-400 disabled:cursor-not-allowed"
        >
          {labels.back}
        </button>
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
          {labels.cta}
          <ChevronRight className="size-4 rtl:rotate-180" strokeWidth={2} />
        </motion.button>
      </div>
    </div>
  );
}
