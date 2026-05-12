"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type GetSignedUrl = (
  evidenceId: string,
) => Promise<
  | { status: "success"; url: string }
  | { status: "error"; message: string }
>;

export type DisputeEvidenceFileLinkProps = {
  evidenceId: string;
  fileName: string;
  label: string;
  getSignedUrl: GetSignedUrl;
};

/**
 * Client-side download button. Calls the per-row Server Action on click,
 * receives a signed URL, opens it in a new tab. Keeps the private bucket's
 * RLS in force — the URL is short-lived (1h).
 */
export function DisputeEvidenceFileLink({
  evidenceId,
  fileName,
  label,
  getSignedUrl,
}: DisputeEvidenceFileLinkProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await getSignedUrl(evidenceId);
      if (result.status === "success") {
        window.open(result.url, "_blank", "noopener,noreferrer");
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClick}
          disabled={pending}
        >
          <Download aria-hidden />
          {label}
        </Button>
        <span className="text-xs text-muted-foreground">{fileName}</span>
      </div>
      {error ? (
        <p className="text-xs text-semantic-danger-500">{error}</p>
      ) : null}
    </div>
  );
}
