"use client";

import { Link as LinkIcon } from "lucide-react";

export type ImportWebsiteCardProps = {
  labels: {
    title: string;
    subtitle: string;
    placeholder: string;
  };
  value: string;
  onChange: (next: string) => void;
  inputId?: string;
  error?: string | null;
};

/**
 * "Add a link to your profile" card. Sits at the top of the supplier
 * onboarding wizard step 1. The URL the supplier types here is persisted to
 * `suppliers.website_url` and rendered on their public profile.
 */
export function ImportWebsiteCard({
  labels,
  value,
  onChange,
  inputId,
  error,
}: ImportWebsiteCardProps) {
  return (
    <div
      className="relative rounded-xl border border-dashed p-3.5"
      style={{
        borderColor: "rgb(30 123 216 / 0.55)",
        background: "rgb(220 235 251 / 0.55)",
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-white text-brand-cobalt-500">
          <LinkIcon className="size-[18px]" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <label
            htmlFor={inputId}
            className="block text-[13.5px] font-bold text-brand-navy-900"
          >
            {labels.title}
          </label>
          <p className="mt-0.5 text-xs text-neutral-600">{labels.subtitle}</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <input
            id={inputId}
            type="url"
            inputMode="url"
            autoComplete="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={labels.placeholder}
            className="w-full min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-brand-cobalt-500 focus:ring-2 focus:ring-brand-cobalt-500/25 sm:w-[220px] sm:flex-none"
          />
        </div>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-semantic-danger-500">{error}</p>
      ) : null}
    </div>
  );
}
