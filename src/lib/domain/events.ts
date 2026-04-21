/**
 * Sevent events domain — shape + Zod schema for the organizer event CRUD form.
 *
 * Event rows live in the `events` table (migration 0002). Monetary budget values
 * are stored as `bigint halalas` in the DB; the form accepts SAR strings/numbers
 * and delegates conversion to `src/lib/domain/money.ts` at the engine boundary.
 *
 * After the 2026-04-21 taxonomy pass:
 *   * `event_type` is one of the 5 market-segment slugs from `segments.ts`
 *     (was a 7-value enum mixing wedding/corporate/government/etc).
 *   * `city` is a KSA city slug from `cities.ts` (was title-case strings).
 */

import { z } from "zod";
import { MARKET_SEGMENT_SLUGS, type MarketSegmentSlug } from "./segments";
import { CITY_SLUGS } from "./cities";

// =============================================================================
// Enumerations — re-exports so existing call sites don't break.
// =============================================================================

export const EVENT_TYPES = MARKET_SEGMENT_SLUGS;
export type EventType = MarketSegmentSlug;

export const CITY_OPTIONS = CITY_SLUGS;
export type CityOption = string;

// =============================================================================
// Form schema
// =============================================================================

/**
 * Validation schema for the organizer-facing event form. Dates are ISO strings
 * (datetime-local inputs serialize well to ISO via `new Date(...).toISOString()`
 * upstream). Budget fields accept string or number (HTML form inputs always
 * produce strings); Lane 3 converts them to halalas via `sarToHalalas`.
 */
const EVENT_TYPE_TUPLE = EVENT_TYPES as unknown as readonly [EventType, ...EventType[]];
const CITY_TUPLE = CITY_OPTIONS as unknown as readonly [string, ...string[]];

export const EventFormInput = z
  .object({
    event_type: z.enum(EVENT_TYPE_TUPLE),
    city: z.enum(CITY_TUPLE),
    client_name: z.string().trim().max(120).optional(),
    venue_address: z.string().trim().min(3).max(500),
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime(),
    guest_count: z.coerce.number().int().min(1).max(100000).optional(),
    budget_min_sar: z.union([z.string(), z.number()]).optional(),
    budget_max_sar: z.union([z.string(), z.number()]).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .superRefine((val, ctx) => {
    if (new Date(val.ends_at).getTime() <= new Date(val.starts_at).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ends_at"],
        message: "ends_at must be after starts_at",
      });
    }

    const parseBudget = (v: string | number | undefined): number | null => {
      if (v === undefined || v === null || v === "") return null;
      const n = typeof v === "string" ? Number(v) : v;
      if (!Number.isFinite(n)) return Number.NaN;
      return n;
    };

    const min = parseBudget(val.budget_min_sar);
    const max = parseBudget(val.budget_max_sar);

    if (min !== null && (Number.isNaN(min) || min < 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["budget_min_sar"],
        message: "budget_min_sar must be a non-negative number",
      });
    }
    if (max !== null && (Number.isNaN(max) || max < 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["budget_max_sar"],
        message: "budget_max_sar must be a non-negative number",
      });
    }

    if (
      min !== null &&
      max !== null &&
      !Number.isNaN(min) &&
      !Number.isNaN(max) &&
      max < min
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["budget_max_sar"],
        message: "budget_max_sar must be greater than or equal to budget_min_sar",
      });
    }
  });

export type EventFormInput = z.infer<typeof EventFormInput>;

// =============================================================================
// Row shape (mirrors public.events columns)
// =============================================================================

export type EventRow = {
  id: string;
  organizer_id: string;
  client_name: string | null;
  event_type: EventType;
  city: string;
  venue_address: string | null;
  venue_location: unknown | null; // PostGIS geography(point, 4326)
  starts_at: string;
  ends_at: string;
  guest_count: number | null;
  budget_range_min_halalas: number | null;
  budget_range_max_halalas: number | null;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
