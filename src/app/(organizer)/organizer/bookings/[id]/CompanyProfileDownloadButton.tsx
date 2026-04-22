"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCompanyProfileUrlAction } from "./actions";

export type CompanyProfileDownloadButtonProps = {
  bookingId: string;
  labels: {
    download: string;
    errorGeneric: string;
    notReady: string;
  };
  className?: string;
};

/**
 * Fetches a short-lived signed URL for the supplier's company-profile PDF
 * and opens it in a new tab. We intentionally do not render this button
 * when the booking is not yet in an accepted state — the page already
 * gates visibility — but we still defensively surface the server's
 * `not_ready` / `missing` errors inline so a stale render doesn't fail
 * silently for the organizer.
 */
export function CompanyProfileDownloadButton({
  bookingId,
  labels,
  className,
}: CompanyProfileDownloadButtonProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const result = await getCompanyProfileUrlAction(bookingId);
      if (result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
        return;
      }
      if (result.error === "not_ready") {
        setMessage(labels.notReady);
      } else {
        setMessage(labels.errorGeneric);
      }
    });
  }

  return (
    <div className={cn("flex flex-col items-start gap-1.5", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
      >
        <Download className="size-4" aria-hidden />
        {labels.download}
      </Button>
      {message ? (
        <p className="text-xs text-semantic-danger-500" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export default CompanyProfileDownloadButton;
