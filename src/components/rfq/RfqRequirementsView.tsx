/**
 * Shared presenter for an RFQ's `requirements_jsonb` payload.
 *
 * Every RFQ-surface route (organizer wizard review, organizer/supplier/admin
 * RFQ detail, marketplace opportunity) used to render the requirements blob in
 * its own ad-hoc way — most dumped raw enum slugs (`buffet`, `indoor`,
 * `halal_only`) or even raw JSON. This component is the single source of truth:
 * it parses the discriminated-union `RfqExtension` and renders a consistent,
 * fully-localized `<dl>` field list — both the field *labels*
 * (`rfqRequirements.field.*`) and the enum *values* (`requirementValues.*`).
 *
 * Server-component only — it awaits `getTranslations()`. Call sites supply
 * their own card/section chrome; this renders just the field list (or a
 * localized fallback line when the payload is missing/unrecognized). The
 * client-side wizard review block shares the row-building logic via
 * `buildRfqRequirementRows` (see `requirementRows.tsx`).
 */

import { getTranslations } from "next-intl/server";
import { RfqExtension } from "@/lib/domain/rfq";
import { buildRfqRequirementRows } from "./requirementRows";

export async function RfqRequirementsView({
  payload,
  className,
}: {
  /** Raw `requirements_jsonb` value straight off the `rfqs` row. */
  payload: unknown;
  /** Optional class override for the wrapping `<dl>`. */
  className?: string;
}) {
  const t = await getTranslations("rfqRequirements");
  const tValues = await getTranslations("requirementValues");

  const parsed = RfqExtension.safeParse(payload);
  if (!parsed.success) {
    const empty = !payload || typeof payload !== "object";
    return (
      <p className="text-sm text-muted-foreground">
        {empty ? t("noStructuredRequirements") : t("unknownKind")}
      </p>
    );
  }

  const rows = buildRfqRequirementRows(parsed.data, t, tValues);

  return (
    <dl
      className={
        className ?? "grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2"
      }
    >
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-0.5">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {row.label}
          </dt>
          <dd className="text-sm text-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
