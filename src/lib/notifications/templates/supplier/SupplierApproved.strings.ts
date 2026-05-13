// SU — supplier verification approved copy.
export const strings = {
  en: {
    preview: (n: string) => `${n} is verified on Sevent`,
    eyebrow: "Sevent · Supplier verification",
    heading: (n: string) => `You're verified, ${n}.`,
    body: "Your business profile passed admin review and is now live on Sevent. Organizers can discover, request quotes, and book your services.",
    nextStepsHeading: "Next steps",
    steps: [
      "Review and refine your packages so \"from\" prices are accurate.",
      "Add at least one of each pricing rule type that applies to your business.",
      "Block any dates you are unavailable in your calendar.",
    ],
    cta: "Open your Sevent dashboard",
    note: "You're receiving this because your supplier account was approved on Sevent — the Saudi event marketplace.",
  },
  ar: {
    preview: (n: string) => `تم التحقق من ${n} على سيڤنت`,
    eyebrow: "سيڤنت · التحقق من المورّد",
    heading: (n: string) => `تم التحقق من ${n}.`,
    body: "اجتاز ملفك التجاري مراجعة الإدارة وأصبح مرئيًا الآن على سيڤنت. يمكن للمنظّمين اكتشافك وطلب عروض أسعار وحجز خدماتك.",
    nextStepsHeading: "الخطوات التالية",
    steps: [
      "راجع باقاتك وحسّنها بحيث تكون أسعار \"تبدأ من\" دقيقة.",
      "أضف ما يناسبك من كل نوع من قواعد التسعير.",
      "احجب في تقويمك أي تواريخ تكون فيها غير متاح.",
    ],
    cta: "افتح لوحة تحكم سيڤنت",
    note: "تستلم هذه الرسالة لأنه تمت الموافقة على حساب المورّد الخاص بك على سيڤنت — منصّة المناسبات السعودية.",
  },
} as const;
