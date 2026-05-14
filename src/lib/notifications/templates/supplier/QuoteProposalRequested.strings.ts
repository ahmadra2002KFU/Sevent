// quote.proposal_requested — organizer wants a technical/detailed proposal for the supplier's quote.
export const strings = {
  en: {
    subject: "A technical proposal was requested",
    preheader: (eventType: string) =>
      `The organizer wants more detail on your quote for ${eventType}`,
    eyebrow: "Action needed",
    heading: "The organizer requested a technical proposal",
    body: (eventType: string) =>
      `The organizer reviewed your quote for ${eventType} and would like a more detailed technical proposal before moving forward. Please upload your proposal so they can continue their review.`,
    messageLabel: "Note from the organizer",
    cta: "Upload proposal",
    note: "Replies to this email reach the Sevent operations team if you need help.",
  },
  ar: {
    subject: "تم طلب عرض فني",
    preheader: (eventType: string) =>
      `يرغب المنظِّم بمزيد من التفاصيل حول عرض سعرك لـ ${eventType}`,
    eyebrow: "إجراء مطلوب",
    heading: "طلب المنظِّم عرضًا فنيًّا",
    body: (eventType: string) =>
      `راجع المنظِّم عرض سعرك لـ ${eventType} ويرغب بالحصول على عرض فني أكثر تفصيلًا قبل المتابعة. يرجى رفع عرضك الفني ليتمكن من استكمال مراجعته.`,
    messageLabel: "ملاحظة من المنظِّم",
    cta: "رفع العرض الفني",
    note: "تصل الردود على هذه الرسالة إلى فريق عمليات سيڤنت إن احتجت للمساعدة.",
  },
} as const;
