// organizer.invite_sent — an organizer-company admin invited this address to
// join their company on Sevent.
export const strings = {
  en: {
    subject: (companyName: string) =>
      companyName
        ? `${companyName} invited you to join their team on Sevent`
        : "You're invited to join a team on Sevent",
    preheader: (companyName: string, role: string) =>
      companyName
        ? `Join ${companyName} as ${role}`
        : `Join the team as ${role}`,
    eyebrow: "Team invite",
    heading: (companyName: string) =>
      companyName ? `Join ${companyName}` : "You've been invited to a team",
    body: (companyName: string, role: string, inviterName: string | null) => {
      const company = companyName || "their team";
      const subject = inviterName ? `${inviterName} (admin)` : "An admin";
      return `${subject} invited you to join ${company} as ${role}. Accepting links your Sevent account to their company so you can manage events, RFQs, and bookings on their behalf.`;
    },
    expiresLabel: "Accept by",
    cta: "Accept invite",
    fallback:
      "If the button doesn't work, copy and paste this link into your browser:",
    role: {
      admin: "admin",
      member: "member",
    },
  },
  ar: {
    subject: (companyName: string) =>
      companyName
        ? `دعتك ${companyName} للانضمام إلى فريقها على سيڤنت`
        : "دعوة للانضمام إلى فريق على سيڤنت",
    preheader: (companyName: string, role: string) =>
      companyName
        ? `الانضمام إلى ${companyName} بصفة ${role}`
        : `الانضمام إلى الفريق بصفة ${role}`,
    eyebrow: "دعوة فريق",
    heading: (companyName: string) =>
      companyName ? `الانضمام إلى ${companyName}` : "تمت دعوتك للانضمام إلى فريق",
    body: (companyName: string, role: string, inviterName: string | null) => {
      const company = companyName || "فريقهم";
      const subject = inviterName ? `${inviterName} (مسؤول)` : "أحد المسؤولين";
      return `دعاك ${subject} للانضمام إلى ${company} بصفة ${role}. القبول يربط حسابك على سيڤنت بشركتهم لإدارة الفعاليات وطلبات العروض والحجوزات نيابة عنهم.`;
    },
    expiresLabel: "القبول قبل",
    cta: "قبول الدعوة",
    fallback:
      "إذا لم يعمل الزر، انسخ الرابط التالي والصقه في متصفحك:",
    role: {
      admin: "مسؤول",
      member: "عضو",
    },
  },
} as const;
