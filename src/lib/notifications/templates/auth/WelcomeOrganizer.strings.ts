// A2 — first sign-in welcome for organizer role.
export const strings = {
  en: {
    preview: "Welcome to Sevent — start your first event",
    eyebrow: "Welcome · Organizer",
    heading: "Welcome to Sevent",
    greeting: (name: string) => `Hi ${name},`,
    body: "Your account is ready. As an organizer you can post event RFQs and book vetted Saudi suppliers — venues, caterers, photographers and more — all in one place.",
    bullet1: "Create an event in seconds.",
    bullet2: "Receive quotes from verified suppliers.",
    bullet3: "Book and manage everything in one place.",
    cta: "Create your first event",
  },
  ar: {
    preview: "مرحبًا بك في سيڤنت — ابدأ فعاليتك الأولى",
    eyebrow: "أهلاً · منظّم فعاليات",
    heading: "مرحبًا بك في سيڤنت",
    greeting: (name: string) => `مرحبًا ${name}،`,
    body: "حسابك جاهز. بصفتك منظّمًا للفعاليات يمكنك نشر طلبات عروض الأسعار وحجز مورّدين سعوديين موثوقين — قاعات وضيافة ومصوّرين وأكثر — في مكان واحد.",
    bullet1: "أنشئ فعاليتك خلال ثوانٍ.",
    bullet2: "استقبل عروض أسعار من مورّدين موثّقين.",
    bullet3: "احجز وأدر كل شيء من مكان واحد.",
    cta: "أنشئ فعاليتك الأولى",
  },
} as const;
