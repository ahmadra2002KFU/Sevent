/**
 * Shared presenter for an RFQ's per-بند attachments (organizer-uploaded images
 * + documents tracked in `rfq_attachments`).
 *
 * Every RFQ-detail surface (supplier invite, marketplace opportunity, organizer,
 * admin monitor) renders this right after `RfqRequirementsView` so the files the
 * organizer attached travel with the RFQ wherever it's viewed: images as a
 * responsive thumbnail grid (click opens full-size in a new tab), documents as a
 * list of download links.
 *
 * Server-component only — it awaits `getTranslations()`. Call sites supply their
 * own card/section chrome and are responsible for querying the rows + minting the
 * signed URLs (they already hold a service-role client and have resolved viewer
 * access before rendering). Attachments whose signed URL could not be minted are
 * skipped so a single storage hiccup never blanks the whole block.
 */

import { getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";
import type { RfqAttachmentRow } from "@/lib/domain/attachments";

export async function RfqAttachmentsView({
  attachments,
  signedUrls,
  className,
}: {
  /** Rows straight off `rfq_attachments` for this RFQ, ordered by created_at. */
  attachments: RfqAttachmentRow[];
  /** path → signed download URL. Built via `createSignedDownloadUrls`. */
  signedUrls: Map<string, string>;
  /** Optional class override for the wrapping container. */
  className?: string;
}) {
  const t = await getTranslations("rfqAttachments");

  if (attachments.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("none")}</p>;
  }

  // Only keep attachments we could actually sign — a missing URL means the
  // object is gone or the signing call partially failed; rendering a broken
  // <img>/link helps no one.
  const images = attachments.filter(
    (a) => a.kind === "image" && signedUrls.get(a.file_path),
  );
  const documents = attachments.filter(
    (a) => a.kind === "document" && signedUrls.get(a.file_path),
  );

  if (images.length === 0 && documents.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("none")}</p>;
  }

  return (
    <div className={className ?? "flex flex-col gap-6 text-start"}>
      {images.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("imagesHeading")}
          </h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {images.map((a) => {
              const url = signedUrls.get(a.file_path)!;
              return (
                <li key={a.id}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-lg border bg-muted transition-opacity hover:opacity-90"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={a.file_name}
                      loading="lazy"
                      className="aspect-square size-full object-cover"
                    />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {documents.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("documentsHeading")}
          </h3>
          <ul className="flex flex-col gap-2">
            {documents.map((a) => {
              const url = signedUrls.get(a.file_path)!;
              return (
                <li key={a.id}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-lg border bg-card p-2.5 text-sm transition-colors hover:bg-accent"
                  >
                    <FileText
                      className="size-4 shrink-0 text-brand-cobalt-500"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                      {a.file_name}
                    </span>
                    <span className="shrink-0 text-xs text-brand-cobalt-500">
                      {t("open")}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
