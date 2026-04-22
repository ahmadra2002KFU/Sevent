"use client";

import Link from "next/link";
import { forwardRef, type InputHTMLAttributes } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type TermsCheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "children"
> & {
  /** Full sentence including the two inline-link phrases verbatim. */
  text: string;
  /** Exact substring inside `text` that should render as the Terms link. */
  termsLinkText: string;
  /** Exact substring inside `text` that should render as the Privacy link. */
  privacyLinkText: string;
  termsHref?: string;
  privacyHref?: string;
};

/**
 * Consent checkbox for the supplier sign-up flow. The label string arrives as
 * one sentence from translations; we split it on the two inline-link phrases
 * (`termsLinkText`, `privacyLinkText`) and render them as real anchors to the
 * stub T&C and Privacy pages. Keeping the splitter here (instead of using
 * `t.rich()`) means the translation JSON stays a flat string — the coverage
 * guardrail and reviewers don't have to reason about placeholder tags.
 *
 * Forwards the native input ref + change handler so React Hook Form's
 * `register("termsAccepted")` plus `z.literal(true)` validates correctly.
 */
export const TermsCheckbox = forwardRef<HTMLInputElement, TermsCheckboxProps>(
  function TermsCheckbox(
    {
      text,
      termsLinkText,
      privacyLinkText,
      termsHref = "/terms",
      privacyHref = "/privacy",
      className,
      checked,
      defaultChecked,
      ...rest
    },
    ref,
  ) {
    const termsIdx = text.indexOf(termsLinkText);
    const privacyIdx = text.indexOf(privacyLinkText);

    // If either phrase isn't found verbatim (shouldn't happen in normal use),
    // gracefully fall back to rendering the raw string alongside two trailing
    // anchors so the consent is still reachable.
    const canSplit =
      termsIdx >= 0 &&
      privacyIdx >= 0 &&
      termsIdx + termsLinkText.length <= privacyIdx;

    let before = "";
    let middle = "";
    let after = "";
    if (canSplit) {
      before = text.slice(0, termsIdx);
      middle = text.slice(termsIdx + termsLinkText.length, privacyIdx);
      after = text.slice(privacyIdx + privacyLinkText.length);
    }

    const linkClass =
      "font-medium text-brand-cobalt-500 underline-offset-2 hover:underline";

    return (
      <label
        className={cn(
          "flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-muted-foreground",
          className,
        )}
      >
        <span className="relative mt-0.5 inline-flex h-[18px] w-[18px] shrink-0">
          <input
            ref={ref}
            type="checkbox"
            checked={checked}
            defaultChecked={defaultChecked}
            className="peer h-[18px] w-[18px] cursor-pointer appearance-none rounded border-2 border-brand-cobalt-500 bg-white transition-colors checked:bg-brand-cobalt-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500/30"
            {...rest}
          />
          <Check
            aria-hidden
            className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white opacity-0 peer-checked:opacity-100"
            strokeWidth={3}
          />
        </span>

        <span>
          {canSplit ? (
            <>
              {before}
              <Link
                href={termsHref}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                {termsLinkText}
              </Link>
              {middle}
              <Link
                href={privacyHref}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                {privacyLinkText}
              </Link>
              {after}
            </>
          ) : (
            <>
              {text}{" "}
              <Link
                href={termsHref}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                {termsLinkText}
              </Link>
              {" · "}
              <Link
                href={privacyHref}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                {privacyLinkText}
              </Link>
            </>
          )}
        </span>
      </label>
    );
  },
);

export default TermsCheckbox;
