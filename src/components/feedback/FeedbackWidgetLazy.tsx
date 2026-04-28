"use client";

import dynamic from "next/dynamic";

// Lazy wrapper so the heavy FeedbackWidget bundle (motion + html2canvas + a
// stack of radix primitives) only ships after hydration on routes that
// actually render the layout. ssr: false requires a client-component host,
// hence this tiny shim.
const FeedbackWidget = dynamic(
  () =>
    import("./FeedbackWidget").then((m) => ({ default: m.FeedbackWidget })),
  { ssr: false, loading: () => null },
);

export default function FeedbackWidgetLazy() {
  return <FeedbackWidget />;
}
