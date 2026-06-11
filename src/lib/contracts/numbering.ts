/**
 * Human-readable contract / project identifiers.
 *
 * Both numbers are DERIVED deterministically from the existing UUID primary
 * keys (plus a year prefix), not stored in a new column or sequence. That
 * keeps re-renders idempotent (the same booking always yields the same
 * contract number) and avoids a migration + backfill for what is only a
 * human-citeable document label. The first 8 hex characters of a v4 UUID
 * carry 32 bits of entropy — collision risk across a single marketplace's
 * yearly volume is negligible, and uniqueness is anchored by the full UUID
 * anyway (this string is a label, not a key).
 */

/** First 8 hex chars of a UUID (dashes stripped), upper-cased. */
function shortId(uuid: string): string {
  const hex = uuid.replace(/[^0-9a-fA-F]/g, "");
  return (hex.slice(0, 8) || "00000000").toUpperCase();
}

/** Four-digit year from an ISO timestamp; "0000" if unparseable. */
function yearOf(dateIso: string | null | undefined): string {
  if (!dateIso) return "0000";
  const year = new Date(dateIso).getUTCFullYear();
  return Number.isFinite(year) ? String(year) : "0000";
}

/**
 * Contract / Purchase-Order number, e.g. `SEV-PO-2026-1A2B3C4D`.
 * `dateIso` should be the booking's confirmation timestamp (fall back to its
 * creation timestamp at the call site).
 */
export function contractNumber(
  bookingId: string,
  dateIso: string | null | undefined,
): string {
  return `SEV-PO-${yearOf(dateIso)}-${shortId(bookingId)}`;
}

/**
 * Project number, e.g. `SEV-PRJ-9F8E7D6C`. Derived from the event UUID; no
 * year prefix because an event/project spans a single engagement.
 */
export function projectNumber(eventId: string): string {
  return `SEV-PRJ-${shortId(eventId)}`;
}
