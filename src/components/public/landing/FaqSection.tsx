"use client";

import { useState, useId } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MessageCircle, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FaqItem = {
  q: string;
  a: string;
};

type FaqSectionProps = {
  id?: string;
  eyebrow: string;
  heading: string;
  lede: string;
  contact: string;
  items: ReadonlyArray<FaqItem>;
};

/**
 * Two-column FAQ. Section intro on the start side, accordion list on the end
 * side. Accordion panels animate on open/close with a spring; a "+" icon
 * rotates to "x" when expanded. First item is open by default for affordance.
 */
export function FaqSection({
  id,
  eyebrow,
  heading,
  lede,
  contact,
  items,
}: FaqSectionProps) {
  const [openIdx, setOpenIdx] = useState<number>(0);

  return (
    <section
      aria-labelledby={id}
      className="bg-neutral-50 py-20 sm:py-24"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="grid gap-14 md:grid-cols-[1fr_1.4fr] md:items-start md:gap-16">
          <div className="flex flex-col gap-4">
            <span className="inline-flex items-center gap-2 self-start text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-cobalt-500">
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-accent-gold-500"
              />
              {eyebrow}
            </span>
            <h2
              id={id}
              className="text-3xl font-extrabold tracking-tight text-brand-navy-900 sm:text-[2.125rem]"
            >
              {heading}
            </h2>
            <p className="max-w-md text-base leading-relaxed text-neutral-600">
              {lede}
            </p>
            <div className="mt-3">
              <Button asChild variant="outline" size="lg">
                <Link href="mailto:support@sevent.sa">
                  <MessageCircle className="size-4" aria-hidden />
                  {contact}
                </Link>
              </Button>
            </div>
          </div>

          <ul className="flex flex-col gap-2.5">
            {items.map((item, idx) => (
              <FaqRow
                key={item.q}
                item={item}
                isOpen={openIdx === idx}
                onToggle={() => setOpenIdx((prev) => (prev === idx ? -1 : idx))}
              />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function FaqRow({
  item,
  isOpen,
  onToggle,
}: {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const contentId = useId();
  return (
    <li
      className={cn(
        "rounded-[0.75rem] border border-border bg-card transition-colors duration-200",
        isOpen && "border-brand-cobalt-500/30 shadow-brand",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start"
      >
        <span className="text-[15px] font-bold text-brand-navy-900">
          {item.q}
        </span>
        <motion.span
          aria-hidden
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          className={cn(
            "inline-flex size-7 flex-shrink-0 items-center justify-center rounded-full transition-colors duration-200",
            isOpen
              ? "bg-brand-cobalt-500 text-white"
              : "bg-neutral-100 text-brand-navy-900",
          )}
        >
          <Plus className="size-3.5" strokeWidth={2.5} aria-hidden />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            key="content"
            id={contentId}
            role="region"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { type: "spring", stiffness: 260, damping: 30 },
              opacity: { duration: 0.18 },
            }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-5 text-[15px] leading-relaxed text-neutral-600">
              {item.a}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}
