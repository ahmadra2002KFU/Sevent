// OR8 — supplier confirmed the booking.

export const strings = {
  en: {
    preview: (supplier: string, eventName: string) =>
      `${supplier} confirmed your booking for "${eventName}"`,
    eyebrow: "Booking · Confirmed",
    heading: (supplier: string) => `${supplier} confirmed your booking`,
    confirmedLabel: (eventStartsAt: string) =>
      `Confirmed for ${eventStartsAt}`,
    body: (eventName: string, eventStartsAt: string) =>
      `Your booking for "${eventName}" on ${eventStartsAt} is locked in. The supplier's company profile PDF is now available for download from the booking page.`,
    cta: "Open booking",
    secondary:
      "Need to change anything? Contact the supplier through the booking page.",
    greeting: (name: string) => `Hi ${name},`,
  },
  ar: {
    preview: (supplier: string, eventName: string) =>
      `أكّد ${supplier} حجزك لفعالية "${eventName}"`,
    eyebrow: "حجز · مؤكّد",
    heading: (supplier: string) => `أكّد ${supplier} حجزك`,
    confirmedLabel: (eventStartsAt: string) =>
      `مؤكّد بتاريخ ${eventStartsAt}`,
    body: (eventName: string, eventStartsAt: string) =>
      `تم تثبيت حجزك لفعالية "${eventName}" بتاريخ ${eventStartsAt}. الملف التعريفي للمورّد متاح الآن للتنزيل من صفحة الحجز.`,
    cta: "فتح الحجز",
    secondary:
      "هل تحتاج لتعديل شيء؟ تواصل مع المورّد عبر صفحة الحجز.",
    greeting: (name: string) => `مرحبًا ${name}،`,
  },
} as const;
