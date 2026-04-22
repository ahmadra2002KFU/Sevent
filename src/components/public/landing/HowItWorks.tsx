import {
  FileText,
  Send,
  ListChecks,
  Handshake,
  type LucideIcon,
} from "lucide-react";
import { SectionHeading } from "./SectionHeading";

export type HowItWorksStep = {
  title: string;
  body: string;
};

type HowItWorksProps = {
  id?: string;
  eyebrow: string;
  heading: string;
  lede: string;
  steps: ReadonlyArray<HowItWorksStep>;
};

const STEP_ICONS: ReadonlyArray<LucideIcon> = [
  FileText,
  Send,
  ListChecks,
  Handshake,
];

/**
 * Four numbered step cards. The number chip overhangs the top edge of each
 * card; the step icon sits in the trailing corner as a soft cue.
 */
export function HowItWorks({
  id,
  eyebrow,
  heading,
  lede,
  steps,
}: HowItWorksProps) {
  return (
    <section
      aria-labelledby={id}
      className="border-y border-border bg-neutral-100 py-20 sm:py-24"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id={id}
          eyebrow={eyebrow}
          heading={heading}
          lede={lede}
        />
        <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, idx) => {
            const Icon = STEP_ICONS[idx] ?? STEP_ICONS[0];
            return (
              <li
                key={step.title}
                className="relative rounded-[0.875rem] border border-border bg-card p-6 pt-8"
              >
                <span
                  aria-hidden
                  className="absolute -top-3.5 inline-flex size-8 items-center justify-center rounded-[0.625rem] bg-brand-navy-900 text-sm font-extrabold text-white shadow-brand-md start-6"
                >
                  {idx + 1}
                </span>
                <Icon
                  className="absolute size-5 text-neutral-400 end-5 top-5"
                  aria-hidden
                />
                <h3 className="mt-3 text-[17px] font-bold tracking-tight text-brand-navy-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  {step.body}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
