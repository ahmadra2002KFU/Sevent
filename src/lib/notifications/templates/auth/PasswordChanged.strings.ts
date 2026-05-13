// A4 — password-changed security notice.
export const strings = {
  en: {
    preview: "Your Sevent password was changed",
    eyebrow: "Account · Security",
    heading: "Your password was changed",
    greeting: (name: string) => `Hi ${name},`,
    body: (when: string) =>
      `This confirms the password on your Sevent account was updated on ${when}.`,
    warning: (email: string) =>
      `If you didn't make this change, contact ${email} immediately so we can secure your account.`,
    cta: "Contact support",
  },
  ar: {
    preview: "تم تغيير كلمة المرور في حسابك على سيڤنت",
    eyebrow: "الحساب · الأمان",
    heading: "تم تغيير كلمة المرور",
    greeting: (name: string) => `مرحبًا ${name}،`,
    body: (when: string) =>
      `نؤكد لك أنه تم تحديث كلمة المرور لحسابك في سيڤنت بتاريخ ${when}.`,
    warning: (email: string) =>
      `إن لم تكن أنت من قام بهذا التغيير، فيرجى التواصل فورًا مع ${email} لتأمين حسابك.`,
    cta: "تواصل مع الدعم",
  },
} as const;
