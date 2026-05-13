// OR9 — supplier declined/cancelled within the 48h confirm window.

export const strings = {
  en: {
    preview: (supplier: string, eventName: string) =>
      `${supplier} cancelled before confirming "${eventName}"`,
    eyebrow: "Booking · Cancelled",
    heading: (supplier: string) => `${supplier} can't take this booking`,
    body: (supplier: string, eventName: string) =>
      `Unfortunately ${supplier} cancelled before confirming the booking for "${eventName}". Your RFQ is still active — you can review other quotes or re-open the request.`,
    reasonLabel: "Reason from supplier",
    cta: "Review other quotes",
    greeting: (name: string) => `Hi ${name},`,
  },
  ar: {
    preview: (supplier: string, eventName: string) =>
      `ألغى ${supplier} الحجز قبل تأكيد فعالية "${eventName}"`,
    eyebrow: "حجز · ملغى",
    heading: (supplier: string) =>
      `تعذّر على ${supplier} تأكيد الحجز`,
    body: (supplier: string, eventName: string) =>
      `للأسف ألغى ${supplier} الحجز قبل تأكيد فعالية "${eventName}". طلبك لا يزال نشطًا — يمكنك مراجعة العروض الأخرى أو إعادة فتح الطلب.`,
    reasonLabel: "السبب من المورّد",
    cta: "مراجعة العروض الأخرى",
    greeting: (name: string) => `مرحبًا ${name}،`,
  },
} as const;
