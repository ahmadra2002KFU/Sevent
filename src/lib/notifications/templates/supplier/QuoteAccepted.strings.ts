// SU5 — organizer accepted your quote; you have a soft-hold to confirm or decline.
export const strings = {
  en: {
    preview: (eventName: string) =>
      `Your quote for ${eventName} was accepted — action needed`,
    eyebrow: "Booking · Action needed",
    heading: "Your quote was accepted",
    body: (organizerName: string, eventName: string) =>
      `${organizerName} accepted your quote for ${eventName}. You now have a soft hold on the date and need to confirm or decline before the deadline below.`,
    deadlineLabel: "Confirm or decline by",
    timeoutNote:
      "If you don't act before the deadline, the soft hold expires automatically and the booking is released.",
    cta: "Open booking",
    note: "Replies to this email reach the Sevent operations team if you need help reviewing the booking.",
  },
  ar: {
    preview: (eventName: string) => `تم قبول عرض سعرك لـ ${eventName} — إجراء مطلوب`,
    eyebrow: "حجز · إجراء مطلوب",
    heading: "تم قبول عرض السعر الخاص بك",
    body: (organizerName: string, eventName: string) =>
      `قَبِل ${organizerName} عرض السعر الخاص بك لـ ${eventName}. لديك الآن حجز مبدئي على التاريخ، ويلزم تأكيده أو رفضه قبل الموعد النهائي أدناه.`,
    deadlineLabel: "أكّد أو ارفض قبل",
    timeoutNote:
      "إن لم تتخذ إجراءً قبل الموعد النهائي فسينتهي الحجز المبدئي تلقائيًا ويُحرَّر الحجز.",
    cta: "فتح الحجز",
    note: "تصل الردود على هذه الرسالة إلى فريق عمليات سيڤنت إن احتجت للمساعدة في مراجعة الحجز.",
  },
} as const;
