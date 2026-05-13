// OR7 — organizer accepted a quote; booking is now awaiting supplier confirmation.

export const strings = {
  en: {
    preview: (supplier: string, eventName: string) =>
      `Booking created for "${eventName}" — waiting on ${supplier}`,
    eyebrow: "Booking · Awaiting supplier",
    heading: (supplier: string) =>
      `Booking created — waiting on ${supplier}`,
    body: (supplier: string, eventName: string, deadline: string) =>
      `You accepted a quote and a soft-hold booking is now live for "${eventName}". ${supplier} has until ${deadline} to confirm.`,
    deadlineLabel: "Supplier confirm deadline",
    note: "If the supplier doesn't confirm in time, the hold expires automatically and you can accept another quote.",
    cta: "Open booking",
    greeting: (name: string) => `Hi ${name},`,
  },
  ar: {
    preview: (supplier: string, eventName: string) =>
      `تم إنشاء حجز لفعالية "${eventName}" — بانتظار ${supplier}`,
    eyebrow: "حجز · بانتظار المورّد",
    heading: (supplier: string) => `تم إنشاء الحجز — بانتظار ${supplier}`,
    body: (supplier: string, eventName: string, deadline: string) =>
      `قبلت العرض وتم إنشاء حجز مؤقّت لفعالية "${eventName}". أمام ${supplier} مهلة حتى ${deadline} للتأكيد.`,
    deadlineLabel: "موعد تأكيد المورّد",
    note: "إذا لم يؤكد المورّد قبل انتهاء المهلة، سينتهي الحجز المؤقّت تلقائيًا ويمكنك قبول عرض آخر.",
    cta: "فتح الحجز",
    greeting: (name: string) => `مرحبًا ${name}،`,
  },
} as const;
