// rfq.invited — organizer invited the supplier to quote on a new RFQ (a new opportunity).
export const strings = {
  en: {
    subject: "You've been invited to a new opportunity",
    preheader: (eventType: string) =>
      `An organizer invited you to quote on ${eventType}`,
    eyebrow: "New opportunity",
    heading: "You've been invited to quote",
    body: (eventType: string, category: string) =>
      category
        ? `An organizer has invited you to submit a quote for ${eventType} in the ${category} category. Review the details and respond before the deadline below.`
        : `An organizer has invited you to submit a quote for ${eventType}. Review the details and respond before the deadline below.`,
    deadlineLabel: "Respond by",
    cta: "View opportunity",
    note: "Replies to this email reach the Sevent operations team if you need help.",
  },
  ar: {
    subject: "تمت دعوتك إلى فرصة جديدة",
    preheader: (eventType: string) => `دعاك أحد المنظِّمين لتقديم عرض سعر لـ ${eventType}`,
    eyebrow: "فرصة جديدة",
    heading: "تمت دعوتك لتقديم عرض سعر",
    body: (eventType: string, category: string) =>
      category
        ? `دعاك أحد المنظِّمين لتقديم عرض سعر لـ ${eventType} ضمن فئة ${category}. راجع التفاصيل وقدّم ردّك قبل الموعد النهائي أدناه.`
        : `دعاك أحد المنظِّمين لتقديم عرض سعر لـ ${eventType}. راجع التفاصيل وقدّم ردّك قبل الموعد النهائي أدناه.`,
    deadlineLabel: "الرد قبل",
    cta: "عرض الفرصة",
    note: "تصل الردود على هذه الرسالة إلى فريق عمليات سيڤنت إن احتجت للمساعدة.",
  },
} as const;
