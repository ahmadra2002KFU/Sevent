"use client";

import { AnimatePresence, motion } from "motion/react";
import { Link as LinkIcon, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type ImportWebsiteCardProps = {
  labels: {
    title: string;
    subtitle: string;
    placeholder: string;
    cta: string;
    comingSoon: string;
  };
};

/**
 * Dashed-border "import from website" card. On CTA click,
 * reveals an inline "coming soon" toast for 3 seconds.
 */
export function ImportWebsiteCard({ labels }: ImportWebsiteCardProps) {
  const [url, setUrl] = useState("");
  const [toast, setToast] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function handleImport() {
    setToast(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(false), 3000);
  }

  return (
    <div
      className="relative rounded-xl border border-dashed p-3.5"
      style={{
        borderColor: "rgb(30 123 216 / 0.55)",
        background: "rgb(220 235 251 / 0.55)",
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-white text-brand-cobalt-500">
          <LinkIcon className="size-[18px]" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-bold text-brand-navy-900">
            {labels.title}
          </div>
          <div className="mt-0.5 text-xs text-neutral-600">
            {labels.subtitle}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={labels.placeholder}
            className="w-[180px] rounded-md border border-neutral-200 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-brand-cobalt-500 focus:ring-2 focus:ring-brand-cobalt-500/25"
          />
          <button
            type="button"
            onClick={handleImport}
            className="rounded-md bg-brand-navy-900 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-navy-700"
          >
            {labels.cta}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {toast ? (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            role="status"
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-brand-cobalt-500 px-3 py-1.5 text-xs font-semibold text-white shadow-brand-sm"
          >
            <Sparkles className="size-3.5" strokeWidth={2} />
            {labels.comingSoon}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
