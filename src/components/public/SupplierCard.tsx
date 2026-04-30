import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { VerifiedBadge } from "@/components/public/VerifiedBadge";
import { cn } from "@/lib/utils";

type SupplierCardProps = {
  href: string;
  businessName: string;
  baseCity: string;
  firstPhotoUrl: string | null;
  verifiedLabel: string;
  viewLabel: string;
  className?: string;
};

/**
 * Supplier grid card. Image-led (4/3 portfolio hero), info footer with the
 * business name, verified trust marker, city, and a trailing affordance.
 *
 * Image treatment:
 *   - Has photo: object-cover, subtle 1.03 hover scale over 300ms
 *   - No photo: warm neutral-100 placeholder with 2-letter initials in
 *     brand navy — stays on-brand without falling back to a gradient
 */
export function SupplierCard({
  href,
  businessName,
  baseCity,
  firstPhotoUrl,
  verifiedLabel,
  viewLabel,
  className,
}: SupplierCardProps) {
  const initials = businessName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .toUpperCase();

  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 ease-out",
        "hover:border-brand-navy-500/30 hover:shadow-brand-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500 focus-visible:ring-offset-2",
        className,
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
        {firstPhotoUrl ? (
          <Image
            src={firstPhotoUrl}
            alt={businessName}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="text-4xl font-black italic tracking-tight text-brand-navy-900/20">
              {initials || "S"}
            </span>
          </div>
        )}
        {/* Verified pill floats over the top-end corner of the image */}
        <div className="absolute end-3 top-3">
          <VerifiedBadge
            label={verifiedLabel}
            className="shadow-brand-sm backdrop-blur"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold tracking-tight text-brand-navy-900">
            {businessName}
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden />
            {baseCity}
          </p>
        </div>

        <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-brand-cobalt-500 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5">
          {viewLabel}
          <ArrowRight
            className="size-4 rtl:-scale-x-100"
            aria-hidden
          />
        </span>
      </div>
    </Link>
  );
}
