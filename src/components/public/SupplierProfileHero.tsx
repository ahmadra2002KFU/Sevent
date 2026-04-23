import Image from "next/image";
import { MapPin, Languages, Globe2 } from "lucide-react";
import { VerifiedBadge } from "@/components/public/VerifiedBadge";
import { Badge } from "@/components/ui/badge";
import type { SupportedLocale } from "@/lib/domain/formatDate";

type SupplierProfileHeroProps = {
  businessName: string;
  bio: string | null;
  baseCity: string;
  serviceAreaCities: string[];
  servesAllKsa: boolean;
  languages: string[];
  heroImageUrl: string | null;
  logoUrl?: string | null;
  subcategories: Array<{
    id: string;
    name_en: string;
    name_ar: string | null;
    parent_name_en: string | null;
    parent_name_ar: string | null;
  }>;
  locale: SupportedLocale;
  verifiedLabel: string;
  baseCityLabel: string;
  serviceAreaLabel: string;
  servesAllKsaLabel: string;
  languagesLabel: string;
};

/** Two-letter initials extracted from a supplier's business name. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Profile hero. Two-layer layout:
 *   1. A wide banner photo (16/5 aspect) using the first portfolio image —
 *      falls back to a warm navy textured band when no media is uploaded.
 *   2. An "identity card" that overlaps the bottom of the banner, carrying
 *      the business name, verified pill, city/language meta, and the bio.
 *
 * The identity card floats over the banner with a -translate-y-12, giving
 * the profile a layered, magazine-like open rather than a flat header.
 */
export function SupplierProfileHero({
  businessName,
  bio,
  baseCity,
  serviceAreaCities,
  servesAllKsa,
  languages,
  heroImageUrl,
  logoUrl = null,
  subcategories,
  locale,
  verifiedLabel,
  baseCityLabel,
  serviceAreaLabel,
  servesAllKsaLabel,
  languagesLabel,
}: SupplierProfileHeroProps) {
  const initials = getInitials(businessName);
  const isAr = locale === "ar";
  return (
    <section className="flex flex-col">
      {/* Banner */}
      <div className="relative h-48 w-full overflow-hidden rounded-2xl bg-brand-navy-900 sm:h-64 md:h-72">
        {heroImageUrl ? (
          <>
            <Image
              src={heroImageUrl}
              alt={businessName}
              fill
              unoptimized
              sizes="100vw"
              className="object-cover"
              priority
            />
            {/* Ink wash to keep the card float legible */}
            <div
              aria-hidden
              className="absolute inset-0 bg-brand-navy-900/50"
            />
          </>
        ) : (
          <>
            <div
              aria-hidden
              className="absolute -end-24 top-1/2 size-[32rem] -translate-y-1/2 skew-x-12 bg-brand-navy-700/70"
            />
            <div
              aria-hidden
              className="absolute -end-8 top-1/2 size-[24rem] -translate-y-1/2 skew-x-12 bg-brand-cobalt-500/20"
            />
          </>
        )}
      </div>

      {/* Identity card — overlaps banner */}
      <div className="relative -mt-16 px-4 sm:px-6">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-brand-md sm:p-8">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                {/* Logo / initials block — 80px square. Uses logical
                    properties (`ms-*`/`me-*` inherited via gap) so the
                    logo naturally sits at the inline-start in both LTR and
                    RTL layouts. */}
                {logoUrl ? (
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-border bg-card shadow-brand-sm">
                    <Image
                      src={logoUrl}
                      alt={`${businessName} logo`}
                      fill
                      unoptimized
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div
                    aria-hidden
                    className="flex size-20 shrink-0 items-center justify-center rounded-xl border border-border bg-neutral-100 text-2xl font-semibold text-brand-navy-900"
                  >
                    {initials}
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight text-brand-navy-900 sm:text-3xl">
                      {businessName}
                    </h1>
                    <VerifiedBadge label={verifiedLabel} />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5" aria-hidden />
                      {baseCityLabel}: <span className="font-medium text-foreground">{baseCity}</span>
                    </span>
                    {servesAllKsa ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Globe2 className="size-3.5" aria-hidden />
                        <span className="font-medium text-foreground">
                          {servesAllKsaLabel}
                        </span>
                      </span>
                    ) : serviceAreaCities.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Globe2 className="size-3.5" aria-hidden />
                        {serviceAreaLabel}:{" "}
                        <span className="font-medium text-foreground">
                          {serviceAreaCities.join(", ")}
                        </span>
                      </span>
                    ) : null}
                    {languages.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Languages className="size-3.5" aria-hidden />
                        {languagesLabel}:{" "}
                        <span className="font-medium text-foreground">
                          {languages.join(", ")}
                        </span>
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {bio ? (
              <p className="max-w-3xl text-sm leading-relaxed text-foreground">
                {bio}
              </p>
            ) : null}

            {subcategories.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {subcategories.map((s) => {
                  const parent = isAr
                    ? s.parent_name_ar ?? s.parent_name_en
                    : s.parent_name_en;
                  const name = isAr ? s.name_ar ?? s.name_en : s.name_en;
                  return (
                    <Badge
                      key={s.id}
                      variant="secondary"
                      className="bg-neutral-100 font-medium text-brand-navy-900"
                    >
                      {parent ? `${parent} · ` : ""}
                      {name}
                    </Badge>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
