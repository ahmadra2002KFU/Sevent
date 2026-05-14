// message.received — immediate email when a Sevent admin starts a new
// dedicated thread with a user (single-user compose only; bulk broadcasts
// and replies stay in-app, the latter covered by the daily reminder).
export const strings = {
  en: {
    subject: "New message from the Sevent team",
    preheader: "The Sevent team sent you a new message",
    eyebrow: "New message",
    heading: "You have a new message",
    body: "The Sevent team just started a conversation with you. Here's a preview — open it to read the full message and reply.",
    snippetLabel: "Message",
    noSnippet: "(no preview available)",
    cta: "Open the message",
    note: "Replies to this email reach the Sevent operations team if you need help.",
  },
  ar: {
    subject: "رسالة جديدة من فريق سيڤنت",
    preheader: "أرسل لك فريق سيڤنت رسالة جديدة",
    eyebrow: "رسالة جديدة",
    heading: "لديك رسالة جديدة",
    body: "بدأ فريق سيڤنت محادثة جديدة معك. إليك معاينة سريعة — افتح الرسالة لقراءتها كاملةً والرد عليها.",
    snippetLabel: "الرسالة",
    noSnippet: "(لا تتوفر معاينة)",
    cta: "فتح الرسالة",
    note: "تصل الردود على هذه الرسالة إلى فريق عمليات سيڤنت إن احتجت للمساعدة.",
  },
} as const;
