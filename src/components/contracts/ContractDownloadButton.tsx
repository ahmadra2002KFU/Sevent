"use client";

import { useState, useTransition } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GetUrlResult =
  | { url: string }
  | { error: "not_found" | "not_ready" | "missing" | "sign_failed" };

export type ContractDownloadButtonProps = {
  bookingId: string;
  /** Role-scoped server action that returns a signed URL for the caller. */
  getUrl: (bookingId: string) => Promise<GetUrlResult>;
  labels: {
    download: string;
    errorGeneric: string;
    notReady: string;
    missing: string;
  };
  className?: string;
};

/**
 * Click-to-download for the booking contract PDF. Identical pattern to
 * `<CompanyProfileDownloadButton>`: server action mints a 1h signed URL
 * on demand, the button opens it in a new tab.
 */
export function ContractDownloadButton({
  bookingId,
  getUrl,
  labels,
  className,
}: ContractDownloadButtonProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const result = await getUrl(bookingId);
      if ("url" in result) {
        window.open(result.url, "_blank", "noopener,noreferrer");
        return;
      }
      if (result.error === "not_ready") {
        setMessage(labels.notReady);
      } else if (result.error === "missing") {
        setMessage(labels.missing);
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
        <FileText className="size-4" aria-hidden />
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

export default ContractDownloadButton;
