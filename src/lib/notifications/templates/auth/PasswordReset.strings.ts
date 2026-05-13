// A3 — password reset copy.
export const strings = {
  en: {
    preview: "Reset your Sevent password",
    eyebrow: "Account · Password",
    heading: "Reset your password",
    greeting: (name: string) => `Hi ${name},`,
    body: "Someone asked to reset the password on your Sevent account. Click the button below to choose a new one.",
    cta: "Set a new password",
    note: "This link expires in 1 hour. If you didn't request a password reset, you can ignore this email — your password won't change.",
  },
  ar: {
    preview: "إعادة تعيين كلمة المرور في سيڤنت",
    eyebrow: "الحساب · كلمة المرور",
    heading: "إعادة تعيين كلمة المرور",
    greeting: (name: string) => `مرحبًا ${name}،`,
    body: "طلب أحدهم إعادة تعيين كلمة المرور لحسابك في سيڤنت. اضغط على الزر أدناه لاختيار كلمة مرور جديدة.",
    cta: "تعيين كلمة مرور جديدة",
    note: "ينتهي صلاحية الرابط خلال ساعة واحدة. إن لم تطلب إعادة تعيين كلمة المرور فيمكنك تجاهل هذه الرسالة، ولن تتغيّر كلمة المرور.",
  },
} as const;
