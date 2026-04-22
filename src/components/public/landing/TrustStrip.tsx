import { CreditCard, FileCheck2, ShieldCheck, Wallet } from "lucide-react";

type TrustStripProps = {
  label: string;
  marks: {
    gea: string;
    mada: string;
    zatca: string;
    sama: string;
  };
};

/**
 * Sub-hero compliance strip. Warm neutral band (neutral-100) with four
 * cobalt-tinted icons that signal Saudi-market readiness at a glance.
 */
export function TrustStrip({ label, marks }: TrustStripProps) {
  const items = [
    { key: "gea", Icon: ShieldCheck, label: marks.gea },
    { key: "mada", Icon: CreditCard, label: marks.mada },
    { key: "zatca", Icon: FileCheck2, label: marks.zatca },
    { key: "sama", Icon: Wallet, label: marks.sama },
  ] as const;

  return (
    <section
      aria-label={label}
      className="border-y border-border bg-neutral-100"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-4 py-6 sm:flex-row sm:flex-wrap sm:items-center sm:gap-8 sm:px-6">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-600">
          {label}
        </span>
        <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
          {items.map(({ key, Icon, label: name }) => (
            <span
              key={key}
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-navy-900/80"
            >
              <Icon
                className="size-[18px] text-brand-cobalt-500"
                aria-hidden
              />
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
