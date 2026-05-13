// A2 — first sign-in welcome for supplier role.
export const strings = {
  en: {
    preview: "Welcome to Sevent — finish onboarding to go live",
    eyebrow: "Welcome · Supplier",
    heading: "Welcome to Sevent",
    greeting: (name: string) => `Hi ${name},`,
    body: "Your account is ready. Complete onboarding so our admins can verify you — once you're approved, your services go live and Saudi organizers can discover and book you.",
    bullet1: "Complete your business profile.",
    bullet2: "Upload your trade license and IBAN documents.",
    bullet3: "Once verified, organizers can find and book you.",
    cta: "Continue onboarding",
  },
  ar: {
    preview: "مرحبًا بك في سيڤنت — أكمل التسجيل لينطلق نشاطك",
    eyebrow: "أهلاً · مورّد",
    heading: "مرحبًا بك في سيڤنت",
    greeting: (name: string) => `مرحبًا ${name}،`,
    body: "حسابك جاهز. أكمل خطوات التسجيل ليتمكّن المشرفون من توثيق حسابك — وبمجرّد اعتماده ستظهر خدماتك للمنظّمين في السعودية ويمكنهم اكتشافك والحجز معك.",
    bullet1: "أكمل الملف التعريفي لنشاطك التجاري.",
    bullet2: "ارفع السجل التجاري ووثائق الآيبان.",
    bullet3: "بمجرّد التوثيق سيتمكّن المنظّمون من إيجادك وحجز خدماتك.",
    cta: "متابعة التسجيل",
  },
} as const;
