// OR4 — first quote arrives on an RFQ.

export const strings = {
  en: {
    preview: (supplier: string, rfq: string) =>
      `${supplier} sent a quote for "${rfq}"`,
    eyebrow: "Quotes · New",
    heading: (supplier: string) => `${supplier} sent you a quote`,
    body: (rfq: string, amount: string) =>
      `A quote for "${rfq}" just arrived. Total: ${amount}.`,
    amountLabel: "Quote total",
    note: "Open the quote page to see line-items, terms, and either accept or request revisions.",
    cta: "Open quote",
    greeting: (name: string) => `Hi ${name},`,
  },
  ar: {
    preview: (supplier: string, rfq: string) =>
      `أرسل ${supplier} عرض سعر لطلبك "${rfq}"`,
    eyebrow: "عروض الأسعار · جديد",
    heading: (supplier: string) => `أرسل ${supplier} عرض سعر`,
    body: (rfq: string, amount: string) =>
      `وصلك عرض سعر لطلب "${rfq}". الإجمالي: ${amount}.`,
    amountLabel: "إجمالي العرض",
    note: "افتح صفحة العرض لمراجعة البنود والشروط، ثم اقبله أو اطلب تعديلات.",
    cta: "فتح العرض",
    greeting: (name: string) => `مرحبًا ${name}،`,
  },
} as const;
