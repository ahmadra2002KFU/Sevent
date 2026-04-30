"use client";

import Image from "next/image";
import { useState } from "react";
import { FileText } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "radix-ui";
import { cn } from "@/lib/utils";

type GalleryItem = {
  id: string;
  kind: "photo" | "document";
  public_url: string;
  title: string | null;
};

type GalleryGridProps = {
  items: GalleryItem[];
  businessName: string;
  dialogTitle: string;
  className?: string;
};

/**
 * Responsive masonry-ish portfolio grid. First tile spans 2 columns and 2 rows
 * on large screens so the portfolio has a clear focal piece. Photo tiles open a
 * lightbox via shadcn Dialog; document tiles open the PDF in a new tab so the
 * browser's native viewer can render it (an in-page <iframe> would be blocked
 * by the storage host's `X-Frame-Options`).
 */
export function GalleryGrid({
  items,
  businessName,
  dialogTitle,
  className,
}: GalleryGridProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const active = activeIndex !== null ? items[activeIndex] : null;

  return (
    <>
      <ul
        className={cn(
          "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
          className,
        )}
      >
        {items.map((item, index) => (
          <li
            key={item.id}
            className={cn(
              "overflow-hidden rounded-xl border border-border bg-neutral-100",
              index === 0 && "lg:col-span-2 lg:row-span-2",
            )}
          >
            {item.kind === "photo" ? (
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                className="group relative block aspect-square w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500 focus-visible:ring-offset-2 lg:aspect-auto lg:h-full"
                aria-label={item.title ?? businessName}
              >
                <Image
                  src={item.public_url}
                  alt={item.title ?? businessName}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                  className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
                />
                <span
                  aria-hidden
                  className="absolute inset-0 bg-brand-navy-900/0 transition-colors duration-200 group-hover:bg-brand-navy-900/10"
                />
              </button>
            ) : (
              <a
                href={item.public_url}
                target="_blank"
                rel="noreferrer"
                className="group relative flex aspect-square w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-neutral-50 to-neutral-200 p-4 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500 focus-visible:ring-offset-2 lg:aspect-auto lg:h-full"
                aria-label={item.title ?? businessName}
              >
                <FileText
                  className="size-12 text-brand-navy-700 transition-transform duration-200 group-hover:scale-110"
                  aria-hidden
                />
                <span className="line-clamp-2 text-sm font-medium text-foreground">
                  {item.title ?? "PDF"}
                </span>
                <span className="rounded-full bg-brand-navy-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  PDF
                </span>
              </a>
            )}
          </li>
        ))}
      </ul>

      <Dialog
        open={active !== null && active.kind === "photo"}
        onOpenChange={(next) => {
          if (!next) setActiveIndex(null);
        }}
      >
        <DialogContent
          showCloseButton
          className="max-w-5xl border-none bg-brand-navy-900/95 p-0 text-white sm:max-w-5xl"
        >
          <VisuallyHidden.Root>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </VisuallyHidden.Root>
          {active && active.kind === "photo" ? (
            <div className="relative aspect-[4/3] w-full">
              <Image
                src={active.public_url}
                alt={active.title ?? businessName}
                fill
                sizes="95vw"
                className="object-contain"
              />
              {active.title ? (
                <p className="absolute inset-x-0 bottom-0 bg-brand-navy-900/80 p-4 text-center text-sm text-white/90">
                  {active.title}
                </p>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
