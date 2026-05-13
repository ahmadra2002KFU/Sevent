// SU — supplier verification needs follow-up copy.
export const strings = {
  en: {
    preview: (n: string) => `${n} — verification needs follow-up`,
    eyebrow: "Sevent · Supplier verification",
    heading: (n: string) =>
      `${n}: we need a few changes before we can verify you.`,
    body: "Our team reviewed your application but couldn't approve it yet. Please address the notes below and resubmit.",
    notesHeading: "Reviewer notes",
    notesFallback:
      "No specific notes were left. Please double-check your documents and business details, then resubmit.",
    cta: "Update your application",
    note: "Replies to this email reach the Sevent admin team. We're happy to help you get verified.",
  },
  ar: {
    preview: (n: string) => `${n} — تحتاج عملية التحقق إلى مراجعة`,
    eyebrow: "سيڤنت · التحقق من المورّد",
    heading: (n: string) => `${n}: نحتاج إلى بعض التعديلات قبل التحقق منك.`,
    body: "راجع فريقنا طلبك ولكن تعذّر اعتماده حتى الآن. يرجى معالجة الملاحظات أدناه ثم إعادة الإرسال.",
    notesHeading: "ملاحظات المراجع",
    notesFallback:
      "لم تُترك ملاحظات محددة. يرجى مراجعة مستنداتك وبيانات نشاطك التجاري ثم إعادة الإرسال.",
    cta: "تحديث طلبك",
    note: "تصل الردود على هذه الرسالة إلى فريق إدارة سيڤنت. يسعدنا مساعدتك في إكمال عملية التحقق.",
  },
} as const;
