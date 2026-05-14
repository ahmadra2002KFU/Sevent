// message.reminder — daily nudge: the user has an unread message from the
// Sevent team that has been sitting unread for 2h+.
export const strings = {
  en: {
    subject: "You have an unread message on Sevent",
    preheader: "The Sevent team sent you a message that's still unread",
    eyebrow: "Unread message",
    heading: "You have a message waiting",
    body: "The Sevent team sent you a message and it's still unread. Open your inbox to read it and reply.",
    subjectLabel: "Subject",
    noSubject: "(no subject)",
    cta: "Open the message",
    note: "Replies to this email reach the Sevent operations team if you need help.",
  },
  ar: {
    subject: "لديك رسالة غير مقروءة على سيڤنت",
    preheader: "أرسل لك فريق سيڤنت رسالة ما زالت غير مقروءة",
    eyebrow: "رسالة غير مقروءة",
    heading: "لديك رسالة في انتظارك",
    body: "أرسل لك فريق سيڤنت رسالة وما زالت غير مقروءة. افتح صندوق الوارد لقراءتها والرد عليها.",
    subjectLabel: "الموضوع",
    noSubject: "(بدون موضوع)",
    cta: "فتح الرسالة",
    note: "تصل الردود على هذه الرسالة إلى فريق عمليات سيڤنت إن احتجت للمساعدة.",
  },
} as const;
