"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Check, ChevronRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

type TourItem = {
  title: string;
  description: string;
  done: boolean;
  href: string;
};

export type FirstRunDashboardCardProps = {
  labels: {
    heading: string;
    subtitle: string;
    items: TourItem[];
  };
  className?: string;
};

/**
 * "Quick tour" card shown on the freshly-approved supplier dashboard.
 * Each row links to an onboarding destination; completed rows
 * tint green, todo rows tint neutral, and the chevron nudges on hover.
 */
export function FirstRunDashboardCard({
  labels,
  className,
}: FirstRunDashboardCardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-neutral-200 bg-white p-5",
        className,
      )}
    >
      <h3 className="text-[15px] font-bold text-brand-navy-900">
        {labels.heading}
      </h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-600">
        {labels.subtitle}
      </p>

      <ul className="mt-3.5 grid gap-2.5">
        {labels.items.map((item, i) => (
          <motion.li
            key={`${item.title}-${i}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.08 + i * 0.06,
              type: "spring",
              stiffness: 260,
              damping: 28,
            }}
          >
            <Link
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500 focus-visible:ring-offset-2",
                item.done
                  ? "bg-semantic-success-100 hover:bg-semantic-success-100/80"
                  : "bg-neutral-100 hover:bg-neutral-200/60",
              )}
            >
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white",
                  item.done ? "text-semantic-success-500" : "text-neutral-600",
                )}
                aria-hidden
              >
                {item.done ? (
                  <Check className="h-[15px] w-[15px]" strokeWidth={3} />
                ) : (
                  <Eye className="h-[14px] w-[14px]" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold text-brand-navy-900">
                  {item.title}
                </div>
                <div className="mt-0.5 truncate text-[11.5px] text-neutral-600">
                  {item.description}
                </div>
              </div>

              <motion.div
                whileHover={{ x: -4 }}
                transition={{ type: "spring", stiffness: 400, damping: 24 }}
                className="text-neutral-600 group-hover:text-brand-cobalt-500"
                aria-hidden
              >
                <ChevronRight className="h-[14px] w-[14px] rtl:rotate-180" />
              </motion.div>
            </Link>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}

export default FirstRunDashboardCard;
