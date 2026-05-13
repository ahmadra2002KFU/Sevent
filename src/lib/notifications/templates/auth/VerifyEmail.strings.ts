// A1 — email verification copy.
export const strings = {
  en: {
    preview: "Confirm your Sevent email address",
    eyebrow: "Account · Verification",
    heading: (name: string) => `Welcome, ${name}`,
    body: "Thanks for signing up to Sevent. Click the button below to confirm this is your email address and finish setting up your account.",
    cta: "Verify email",
    note: "This link expires in 24 hours. If you didn't sign up for Sevent, you can safely ignore this email.",
  },
  ar: {
    preview: "أكّد بريدك الإلكتروني في سيڤنت",
    eyebrow: "الحساب · التحقق",
    heading: (name: string) => `أهلاً، ${name}`,
    body: "شكرًا لتسجيلك في سيڤنت. اضغط على الزر أدناه لتأكيد أن هذا بريدك الإلكتروني وإكمال إعداد حسابك.",
    cta: "تأكيد البريد الإلكتروني",
    note: "ينتهي صلاحية الرابط خلال 24 ساعة. إن لم تكن قد سجّلت في سيڤنت فيمكنك تجاهل هذه الرسالة بأمان.",
  },
} as const;
