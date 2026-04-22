"use client";

import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, ImageIcon, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProfilePreviewProps = {
  name?: string;
  bio?: string;
  cityLabel?: string;
  categories?: string[];
  logoUrl?: string | null;
  verified?: boolean;
  /** Overrides the cobalt end-stop of the hero gradient. */
  accentColor?: string;
  placeholders: {
    name: string;
    bio: string;
    city: string;
    noCategories: string;
    responseLabel: string;
    bookingsLabel: string;
    ratingLabel: string;
  };
};

/**
 * Live, i18n-agnostic "public profile" preview card.
 * Empty fields render placeholder strings in italic neutral-400.
 */
export function ProfilePreview({
  name,
  bio,
  cityLabel,
  categories = [],
  logoUrl,
  verified = false,
  accentColor,
  placeholders,
}: ProfilePreviewProps) {
  const hasName = Boolean(name && name.trim().length > 0);
  const hasBio = Boolean(bio && bio.trim().length > 0);
  const hasCity = Boolean(cityLabel && cityLabel.trim().length > 0);
  const shown = categories.slice(0, 4);

  const heroGradient = accentColor
    ? `linear-gradient(135deg, var(--color-brand-navy-900, #0f2e5c) 0%, ${accentColor} 110%)`
    : undefined;

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-brand-sm">
      {/* Hero band */}
      <div
        className={cn(
          "relative h-[76px] overflow-hidden",
          !heroGradient && "bg-gradient-to-br from-brand-navy-900 to-brand-cobalt-500",
        )}
        style={heroGradient ? { background: heroGradient } : undefined}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 80% -20%, rgba(246,235,206,.35), transparent 55%)",
          }}
        />
      </div>

      <div className="relative -mt-[30px] px-4 pb-4">
        {/* Logo frame */}
        <div className="flex size-[60px] items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-white shadow-brand-sm">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-neutral-100 text-neutral-400">
              <ImageIcon className="size-[22px]" strokeWidth={1.8} />
            </div>
          )}
        </div>

        {/* Name + verified */}
        <div className="mt-2.5 flex items-center gap-1.5">
          <div
            className={cn(
              "text-base font-extrabold leading-tight",
              hasName ? "text-neutral-900" : "italic text-neutral-400",
            )}
          >
            {hasName ? name : placeholders.name}
          </div>
          {verified ? (
            <span
              aria-label="verified"
              className="inline-flex text-accent-gold-500"
            >
              <BadgeCheck className="size-4" strokeWidth={2.2} />
            </span>
          ) : null}
        </div>

        {/* City */}
        <div
          className={cn(
            "mt-0.5 flex items-center gap-1.5 text-[12.5px]",
            hasCity ? "text-neutral-600" : "italic text-neutral-400",
          )}
        >
          <MapPin className="size-[13px]" strokeWidth={1.8} />
          <span>{hasCity ? cityLabel : placeholders.city}</span>
        </div>

        {/* Bio */}
        <div
          className={cn(
            "mt-2.5 min-h-10 text-[12.5px] leading-relaxed",
            hasBio ? "text-neutral-600" : "italic text-neutral-400",
          )}
        >
          {hasBio ? bio : placeholders.bio}
        </div>

        {/* Category chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <AnimatePresence mode="popLayout" initial={false}>
            {shown.length > 0 ? (
              shown.map((c) => (
                <motion.span
                  key={c}
                  layout
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 28 }}
                  className="rounded-xl bg-brand-cobalt-100 px-2.5 py-[3px] text-[11px] font-semibold text-brand-cobalt-500"
                >
                  {c}
                </motion.span>
              ))
            ) : (
              <motion.span
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[11px] italic text-neutral-400"
              >
                {placeholders.noCategories}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Mini stats */}
        <div className="mt-3.5 grid grid-cols-3 gap-1.5 border-t border-neutral-200 pt-3.5">
          {[
            { label: placeholders.responseLabel, value: "4h" },
            { label: placeholders.bookingsLabel, value: "—" },
            { label: placeholders.ratingLabel, value: "—" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-[13px] font-bold text-neutral-900">{s.value}</div>
              <div className="mt-0.5 text-[10.5px] text-neutral-600">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
