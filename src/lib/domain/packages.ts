/**
 * Zod schemas for the supplier packages CRUD form (Lane 2).
 * The form accepts SAR decimals from the user and converts to halalas via
 * `sarToHalalas` from `money.ts` at the server-action boundary. This module
 * exposes both the SAR-input shape (for the form) and the halalas row shape.
 */

import { z } from "zod";

export const PACKAGE_UNITS = [
  "event",
  "hour",
  "day",
  "person",
  "unit",
] as const;
export type PackageUnit = (typeof PACKAGE_UNITS)[number];

/** Form input shape — base_price is SAR decimal (e.g. "1500.00"). */
export const PackageFormInput = z
  .object({
    id: z.string().uuid().optional(),
    subcategory_id: z.string().uuid(),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000).optional(),
    base_price_sar: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "string" ? val.replace(/[,\s]/g, "") : String(val))),
    unit: z.enum(PACKAGE_UNITS),
    min_qty: z.coerce.number().int().min(1).default(1),
    max_qty: z.coerce.number().int().min(1).nullable().optional(),
    from_price_visible: z.coerce.boolean().default(true),
    is_active: z.coerce.boolean().default(true),
  })
  .refine(
    (data) => {
      const n = Number(data.base_price_sar);
      return Number.isFinite(n) && n >= 0;
    },
    { path: ["base_price_sar"], message: "Enter a valid non-negative SAR amount" },
  )
  .refine(
    (data) =>
      data.max_qty === null ||
      data.max_qty === undefined ||
      data.max_qty >= data.min_qty,
    { path: ["max_qty"], message: "max_qty must be >= min_qty" },
  );
export type PackageFormInput = z.infer<typeof PackageFormInput>;

/** Persisted row shape — halalas integer. */
export const PackageRow = z.object({
  id: z.string().uuid().optional(),
  supplier_id: z.string().uuid(),
  subcategory_id: z.string().uuid(),
  name: z.string().min(2).max(120),
  description: z.string().max(2000).nullable().optional(),
  base_price_halalas: z.number().int().nonnegative(),
  currency: z.literal("SAR").default("SAR"),
  unit: z.enum(PACKAGE_UNITS),
  min_qty: z.number().int().min(1),
  max_qty: z.number().int().min(1).nullable().optional(),
  from_price_visible: z.boolean(),
  is_active: z.boolean(),
});
export type PackageRow = z.infer<typeof PackageRow>;
