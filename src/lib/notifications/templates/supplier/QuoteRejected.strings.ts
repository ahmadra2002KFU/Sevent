// quote.rejected — supplier's quote was not chosen; organizer picked a competing quote.
export const strings = {
  en: {
    subject: "Update on your quote",
    preheader: (eventType: string) =>
      `An update on your quote for ${eventType}`,
    eyebrow: "Quote · Update",
    heading: "Your quote wasn't selected this time",
    reason: {
      another_quote_accepted: (eventType: string) =>
        `The organizer reviewed the submissions for ${eventType} and chose a different supplier for this request.`,
      generic: (eventType: string) =>
        `The organizer chose a different supplier for ${eventType}.`,
    },
    thanks:
      "Thank you for taking the time to prepare and submit your quote — it's genuinely appreciated.",
    encouragement:
      "New requests come in regularly. Keep an eye on your RFQs so you're ready to respond to the next opportunity.",
    cta: "View your RFQs",
    note: "Replies to this email reach the Sevent operations team if you have any questions.",
    genericEventFallback: "your event",
  },
  ar: {
    subject: "تحديث بخصوص عرض سعرك",
    preheader: (eventType: string) => `تحديث بخصوص عرض سعرك لـ ${eventType}`,
    eyebrow: "عرض سعر · تحديث",
    heading: "لم يتم اختيار عرض سعرك هذه المرة",
    reason: {
      another_quote_accepted: (eventType: string) =>
        `راجع المنظِّم العروض المقدَّمة لـ ${eventType} واختار مورّدًا آخر لهذا الطلب.`,
      generic: (eventType: string) =>
        `اختار المنظِّم مورّدًا آخر لـ ${eventType}.`,
    },
    thanks:
      "نشكرك على وقتك وجهدك في إعداد عرض السعر وتقديمه — نقدّر ذلك حقًّا.",
    encouragement:
      "تصل طلبات جديدة باستمرار. تابع طلباتك لتكون جاهزًا للرد على الفرصة القادمة.",
    cta: "عرض طلباتك",
    note: "تصل الردود على هذه الرسالة إلى فريق عمليات سيڤنت إن كان لديك أي استفسار.",
    genericEventFallback: "فعاليتك",
  },
} as const;
