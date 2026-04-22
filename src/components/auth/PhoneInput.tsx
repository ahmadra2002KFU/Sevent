"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type PhoneInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "prefix"
> & {
  countryCode?: string;
  invalid?: boolean;
  onValueChange?: (digitsOnly: string) => void;
};

/**
 * Saudi mobile number input with a visible `+966` prefix block on the logical
 * start. We enforce the shape locally:
 *   - numeric-only (strips anything else on every keystroke)
 *   - max 9 digits
 *   - first digit must be `5` (the initial `5` is preserved; other leading
 *     digits are dropped so users who start typing `05…` end up with `5…`)
 *
 * `onValueChange` fires with just the 9-digit payload (no prefix). The native
 * `onChange` still fires too, so React Hook Form's `register` keeps working
 * when consumers use it.
 */
export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  function PhoneInput(
    {
      className,
      countryCode = "+966",
      invalid,
      onChange,
      onValueChange,
      ...rest
    },
    ref,
  ) {
    return (
      <div
        className={cn(
          "flex items-center rounded-lg border bg-background transition-colors",
          invalid
            ? "border-semantic-danger-500/60 focus-within:border-semantic-danger-500"
            : "border-input focus-within:border-brand-cobalt-500 focus-within:ring-2 focus-within:ring-brand-cobalt-500/20",
          className,
        )}
      >
        <span
          aria-hidden
          className="flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground"
          style={{
            direction: "ltr",
            borderInlineEnd: "1px solid var(--input)",
          }}
        >
          <span aria-hidden>🇸🇦</span>
          <span>{countryCode}</span>
        </span>
        <input
          ref={ref}
          type="tel"
          inputMode="numeric"
          pattern="5[0-9]{8}"
          maxLength={9}
          autoComplete="tel-national"
          dir="ltr"
          className="w-full bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
          onChange={(e) => {
            const raw = e.target.value;
            // Keep digits only, cap at 9, force leading digit to be `5`.
            let digits = raw.replace(/\D+/g, "").slice(0, 9);
            if (digits.length > 0 && digits[0] !== "5") {
              const idx = digits.indexOf("5");
              digits = idx === -1 ? "" : digits.slice(idx).slice(0, 9);
            }
            if (digits !== raw) e.target.value = digits;
            onValueChange?.(digits);
            onChange?.(e);
          }}
          {...rest}
        />
      </div>
    );
  },
);

export default PhoneInput;
