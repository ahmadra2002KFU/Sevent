/**
 * Renders a chronological evidence list for a dispute. Reused by the
 * organizer/supplier dispute pages and by the admin detail page.
 *
 * The list is server-rendered. File rows surface a download link that
 * points at a per-row Server Action returning a signed URL — never a raw
 * storage URL, because the bucket is private.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  type SupportedLocale,
  fmtDateTime,
} from "@/lib/domain/formatDate";
import type { DisputeEvidenceRow } from "@/lib/domain/disputes";
import { DisputeEvidenceFileLink } from "./DisputeEvidenceFileLink";

export type EvidenceWithAuthor = DisputeEvidenceRow & {
  authorName: string;
  authorRoleLabel: string | null;
};

export type EvidenceListProps = {
  evidence: EvidenceWithAuthor[];
  locale: SupportedLocale;
  labels: {
    empty: string;
    visibleToOther: string;
    private: string;
    submittedBy: string;
    downloadFile: string;
  };
  /**
   * Server Action that returns a signed URL for a stored evidence file.
   * Called by the (client) download button when the user clicks it.
   */
  getSignedUrl: (
    evidenceId: string,
  ) => Promise<
    | { status: "success"; url: string }
    | { status: "error"; message: string }
  >;
};

export function EvidenceList({
  evidence,
  locale,
  labels,
  getSignedUrl,
}: EvidenceListProps) {
  if (evidence.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{labels.empty}</p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {evidence.map((ev) => (
        <li key={ev.id}>
          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {labels.submittedBy}:{" "}
                  <span className="font-medium text-foreground">
                    {ev.authorName}
                  </span>
                  {ev.authorRoleLabel ? (
                    <span> · {ev.authorRoleLabel}</span>
                  ) : null}
                </span>
                <span>·</span>
                <span>{fmtDateTime(ev.created_at, locale)}</span>
                <Badge variant={ev.visible_to_other_party ? "secondary" : "outline"}>
                  {ev.visible_to_other_party
                    ? labels.visibleToOther
                    : labels.private}
                </Badge>
              </div>
              {ev.kind === "note" ? (
                <p className="whitespace-pre-line text-sm text-foreground">
                  {ev.text_note ?? ""}
                </p>
              ) : ev.file_path ? (
                <DisputeEvidenceFileLink
                  evidenceId={ev.id}
                  fileName={ev.file_path.split("/").pop() ?? "file"}
                  label={labels.downloadFile}
                  getSignedUrl={getSignedUrl}
                />
              ) : null}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
