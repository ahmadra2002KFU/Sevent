// Arabic walkthrough deck for the RFQ / RFP feature on the Sevent platform.
// Run with: node build_rfq_rfp_walkthrough.js
//
// Reuses the helpers from the arabic-pptx skill (inlined below so this script
// is self-contained and does not depend on the skill folder being on disk).

const PptxGenJS = require("pptxgenjs");
const path = require("path");
const fs = require("fs");

// ---- CONFIG ----
const FONT_AR = "Cairo";
const FONT_AR_FALLBACK = "Segoe UI";
const COLOR_PRIMARY = "1F5132";
const COLOR_ACCENT = "2E7D32";
const COLOR_MUTED = "6B7280";
const COLOR_BG = "FFFFFF";
const COLOR_DARK = "111827";

const IMG_DIR = "D:/Mufeed/Sevent/Screenshots/RFQ and RFP";
const OUTPUT = "D:/Mufeed/Sevent/Code/Claude Docs/RFQ-RFP-Walkthrough-AR.pptx";

const W = 13.333;
const H = 7.5;
const MARGIN = 0.5;
const TITLE_Y = 0.45;
const CONTENT_Y = 1.55;
const CONTENT_H = H - CONTENT_Y - 0.6;

function img(fileName) {
  return { path: path.join(IMG_DIR, fileName) };
}

function defineMaster(pres, opts = {}) {
  const { projectName = "" } = opts;
  pres.defineSlideMaster({
    title: "MASTER",
    background: { color: COLOR_BG },
    objects: [
      { rect: { x: 0, y: 0, w: W, h: 0.08, fill: { color: COLOR_PRIMARY } } },
      { text: {
          text: projectName,
          options: {
            x: W - 3.5, y: H - 0.45, w: 3, h: 0.35,
            fontFace: FONT_AR, fontSize: 10, color: COLOR_MUTED,
            align: "right", rtlMode: true,
          },
      }},
    ],
    slideNumber: { x: 0.5, y: H - 0.45, w: 1.5, h: 0.35, fontFace: FONT_AR_FALLBACK, fontSize: 10, color: COLOR_MUTED, align: "left" },
  });
}

function addTitle(slide, text) {
  slide.addText(text, {
    x: MARGIN, y: TITLE_Y, w: W - 2 * MARGIN, h: 0.85,
    fontFace: FONT_AR, fontSize: 30, bold: true, color: COLOR_PRIMARY,
    align: "right", rtlMode: true,
  });
  slide.addShape("rect", {
    x: W - MARGIN - 1.2, y: TITLE_Y + 0.85, w: 1.2, h: 0.06,
    fill: { color: COLOR_ACCENT }, line: { color: COLOR_ACCENT },
  });
}

function coverSlide(pres, { title, subtitle, footnote }) {
  const s = pres.addSlide();
  s.background = { color: COLOR_PRIMARY };

  // Decorative accent on left
  s.addShape("rect", { x: 0, y: 0, w: 0.35, h: H, fill: { color: COLOR_ACCENT }, line: { color: COLOR_ACCENT } });

  s.addText(title, {
    x: 0.8, y: 2.3, w: W - 1.6, h: 1.8,
    fontFace: FONT_AR, fontSize: 52, bold: true, color: "FFFFFF",
    align: "right", rtlMode: true, paraSpaceAfter: 6,
  });

  if (subtitle) {
    s.addText(subtitle, {
      x: 0.8, y: 4.2, w: W - 1.6, h: 1.0,
      fontFace: FONT_AR, fontSize: 22, color: "A7F3D0",
      align: "right", rtlMode: true,
    });
  }

  if (footnote) {
    s.addText(footnote, {
      x: 0.8, y: 6.4, w: W - 1.6, h: 0.5,
      fontFace: FONT_AR, fontSize: 14, color: "D1FAE5",
      align: "right", rtlMode: true,
    });
  }
  return s;
}

function sectionSlide(pres, { number, title, subtitle }) {
  const s = pres.addSlide();
  s.background = { color: COLOR_PRIMARY };
  if (number) {
    s.addText(String(number), {
      x: 0, y: 1.0, w: W, h: 2.5,
      fontFace: FONT_AR_FALLBACK, fontSize: 180, bold: true, color: "064E3B",
      align: "center",
    });
  }
  s.addText(title, {
    x: 0.5, y: 3.8, w: W - 1, h: 1.2,
    fontFace: FONT_AR, fontSize: 40, bold: true, color: "FFFFFF",
    align: "center", rtlMode: true,
  });
  if (subtitle) {
    s.addText(subtitle, {
      x: 0.5, y: 5.0, w: W - 1, h: 0.8,
      fontFace: FONT_AR, fontSize: 18, color: "A7F3D0",
      align: "center", rtlMode: true,
    });
  }
  s.addShape("rect", {
    x: W / 2 - 0.5, y: 5.9, w: 1.0, h: 0.06,
    fill: { color: COLOR_ACCENT }, line: { color: COLOR_ACCENT },
  });
  return s;
}

// Image slide where the screenshot is centered and a 1-2 sentence Arabic caption
// sits beneath it.
function imageSlide(pres, { title, image, caption }) {
  const s = pres.addSlide();
  addTitle(s, title);

  const iy = CONTENT_Y;
  const ih = CONTENT_H - 1.2; // leave room for caption below
  const iw = W - 2 * MARGIN;
  const ix = MARGIN;

  s.addImage({
    ...img(image),
    x: ix, y: iy, w: iw, h: ih,
    sizing: { type: "contain", w: iw, h: ih },
  });

  if (caption) {
    s.addText(caption, {
      x: MARGIN, y: iy + ih + 0.1, w: W - 2 * MARGIN, h: 0.9,
      fontFace: FONT_AR, fontSize: 16, color: COLOR_DARK,
      align: "right", rtlMode: true, valign: "top",
    });
  }
  return s;
}

function closingSlide(pres, { title, bullets, footnote }) {
  const s = pres.addSlide();
  s.background = { color: COLOR_PRIMARY };

  s.addText(title, {
    x: 0.8, y: 0.9, w: W - 1.6, h: 1.2,
    fontFace: FONT_AR, fontSize: 38, bold: true, color: "FFFFFF",
    align: "right", rtlMode: true,
  });

  s.addShape("rect", {
    x: W - 0.8 - 1.2, y: 2.05, w: 1.2, h: 0.06,
    fill: { color: "A7F3D0" }, line: { color: "A7F3D0" },
  });

  const items = bullets.map(b => ({
    text: b,
    options: {
      bullet: { indent: 22 },
      fontFace: FONT_AR, fontSize: 20, color: "FFFFFF",
      rtlMode: true, align: "right", paraSpaceAfter: 12,
    },
  }));
  s.addText(items, {
    x: 0.8, y: 2.4, w: W - 1.6, h: 4.2,
    valign: "top",
  });

  if (footnote) {
    s.addText(footnote, {
      x: 0.8, y: 6.6, w: W - 1.6, h: 0.5,
      fontFace: FONT_AR, fontSize: 14, italic: true, color: "A7F3D0",
      align: "right", rtlMode: true,
    });
  }
  return s;
}

// ---- BUILD ----

const pres = new PptxGenJS();
pres.layout = "LAYOUT_WIDE";
pres.rtlMode = true;
pres.title = "تدفق طلبات عروض الأسعار والعروض الفنية - سفنت";
pres.author = "Sevent";
pres.company = "Sevent";

defineMaster(pres, { projectName: "منصّة سفنت" });

// 1) Cover
coverSlide(pres, {
  title: "تدفق طلبات عروض الأسعار والعروض الفنية",
  subtitle: "RFQ / RFP — جولة على التجربة في منصّة سفنت",
  footnote: "من إنشاء الطلب حتى مقارنة العروض",
});

// 2) Section 1 — Organizer creates the RFQ
sectionSlide(pres, {
  number: "1",
  title: "إنشاء طلب العرض من قِبل المنظِّم",
  subtitle: "ينشئ المنظِّم طلب عرض ويُحدِّد متطلباته",
});

// Slide: 155357 — RFQ detail page (organizer side, no invitations yet)
imageSlide(pres, {
  title: "صفحة طلب العرض لدى المنظِّم",
  image: "Screenshot 2026-04-26 155357.png",
  caption: "بعد إنشاء الطلب يفتح المنظِّم صفحة الطلب ليراجع المتطلبات (مثال: «أكل وتجهيز مطبخ») وحالة الطلب «مُرسل». في هذه المرحلة لم تُرسل دعوات بعد للموردين، ويظهر قسم «الموردون المدعوون» فارغًا.",
});

// 3) Section 2 — Supplier discovers and reviews the request
sectionSlide(pres, {
  number: "2",
  title: "استقبال الطلب من قِبل المورد",
  subtitle: "يصل الطلب إلى الموردين عبر «فرص السوق»",
});

// Slide: 155440 — Supplier "Market opportunities" page with filters
imageSlide(pres, {
  title: "فرص السوق لدى المورد",
  image: "Screenshot 2026-04-26 155440.png",
  caption: "يفتح المورد صفحة «فرص السوق» ليتصفّح طلبات العروض المنشورة. تظهر الفرص مع تفاصيل المدينة والتاريخ والميزانية، ويمكنه تصفيتها بحسب نوع الفعالية أو نطاق السعر قبل الدخول إلى الفرصة المناسبة.",
});

// Slide: 160208 — Wider view of marketplace listing with multiple opportunities
imageSlide(pres, {
  title: "قائمة الفرص المتاحة للمورد",
  image: "Screenshot 2026-04-26 160208.png",
  caption: "تظهر للمورد جميع الفرص المتاحة سواءً كانت من السوق المفتوح أو من دعوات مباشرة. يضغط على «عرض والتقديم» للدخول إلى تفاصيل الفرصة وتقديم عرضه عليها.",
});

// Slide: 155518 — Supplier views the RFQ detail
imageSlide(pres, {
  title: "تفاصيل الفرصة من جهة المورد",
  image: "Screenshot 2026-04-26 155518.png",
  caption: "يستعرض المورد تفاصيل الطلب: المدينة، نافذة الفعالية، عدد الضيوف، الميزانية ومتطلبات المنظِّم. ثم يبدأ تقديم عرضه بالضغط على زر «تقديم وإرسال عرض السعر».",
});

// 4) Section 3 — Supplier submits the quote
sectionSlide(pres, {
  number: "3",
  title: "إعداد العرض وإرساله",
  subtitle: "يبني المورد عرض السعر ويُرفق ملفه الفني",
});

// Slide: 160325 — Quote builder (pricing items)
imageSlide(pres, {
  title: "منشئ عرض السعر — بنود التسعير",
  image: "Screenshot 2026-04-26 160325.png",
  caption: "يُدخل المورد بنود التسعير يدويًا (الوصف، الكمية، الوحدة، سعر الوحدة، الإجمالي)، أو يستعين بمحرّك القواعد ليولِّد له مسوّدة جاهزة من باقاته المعرَّفة سلفًا.",
});

// Slide: 160337 — Quote builder continued (extras, terms, technical PDF)
imageSlide(pres, {
  title: "إضافات وشروط ورفع الملف الفني",
  image: "Screenshot 2026-04-26 160337.png",
  caption: "يكمل المورد العرض بإضافة رسوم التجهيز والتفكيك، نسبة العربون، شروط الإلغاء، وما يشمله/لا يشمله العرض. كما يمكنه إرفاق ملف فني بصيغة PDF يوضّح أعماله السابقة قبل الضغط على «إرسال العرض».",
});

// Slide: 155814 — Supplier confirmation after sending the quote
imageSlide(pres, {
  title: "تأكيد إرسال العرض للمورد",
  image: "Screenshot 2026-04-26 155814.png",
  caption: "بعد إرسال العرض تظهر للمورد رسالة تأكيد بأن عرضه سيظهر للمنظِّم في لوحته. يستعرض المورد ملخّص الفعالية، الإجمالي المُرسل (مثال: 19,000 ر.س)، ومدة صلاحية عرضه، مع إمكانية «تعديل العرض».",
});

// 5) Section 4 — Organizer reviews and compares
sectionSlide(pres, {
  number: "4",
  title: "استلام العروض ومقارنتها",
  subtitle: "يرى المنظِّم العروض جنبًا إلى جنب",
});

// Slide: 162601 — Split view: organizer sees suppliers list under "المدعوون"
imageSlide(pres, {
  title: "وصول العروض إلى لوحة المنظِّم",
  image: "Screenshot 2026-04-26 162601.png",
  caption: "تصل عروض الموردين إلى صفحة الطلب لدى المنظِّم. يظهر كل مورد مع حالة عرضه (قدّم عرضًا)، تاريخ الإرسال، والرد إن وُجد — سواء جاء من السوق المفتوح أو من دعوة مباشرة.",
});

// Slide: Comparison Table — side-by-side comparison
imageSlide(pres, {
  title: "جدول مقارنة العروض",
  image: "Comparison Table.png",
  caption: "يستخدم المنظِّم «جدول المقارنة» لاستعراض عروض الموردين جنبًا إلى جنب: الإجمالي، المجموع الفرعي، الرسوم، الدفعة المقدمة، جدول الدفع، البنود، والملف الفني. ومن هنا يمكنه قبول العرض الأنسب أو طلب ملف فني إضافي.",
});

// 6) Section 5 — Booking confirmation handshake (post-acceptance)
sectionSlide(pres, {
  number: "5",
  title: "تحويل العرض المقبول إلى حجز",
  subtitle: "تأكيد الحجز من المورد قبل الموعد النهائي",
});

// Slide: 161200 — Supplier sees the booking pending final confirmation
imageSlide(pres, {
  title: "وصول الحجز إلى المورد بانتظار التأكيد",
  image: "Screenshot 2026-04-26 161200.png",
  caption: "بعد قبول المنظِّم لعرض المورد يتحوّل العرض إلى حجز يظهر في صفحة «الحجوزات» لدى المورد بحالة «بانتظار المورد»، مع عدّاد للموعد النهائي للتأكيد (مثلًا: باقي 48 ساعة).",
});

// Slide: 162356 — Supplier booking detail with confirm/decline buttons
imageSlide(pres, {
  title: "تأكيد الحجز أو رفضه من المورد",
  image: "Screenshot 2026-04-26 162356.png",
  caption: "يفتح المورد تفاصيل الحجز ليراجع بنود العرض المقبول، ثم يضغط «تأكيد الحجز» لاعتماد الالتزام أو «رفض» إذا تعذّر تنفيذه. لا يكتمل الحجز إلا بهذه الخطوة.",
});

// Slide: 161208 — Organizer's booking listing post-confirmation
imageSlide(pres, {
  title: "حجوزات المنظِّم بعد تأكيد الموردين",
  image: "Screenshot 2026-04-26 161208.png",
  caption: "بعد تأكيد المورد يتحوّل الحجز إلى حالة «مؤكَّد» في لوحة المنظِّم. تظهر له جميع حجوزاته مع المورد المعتمد لكل فعالية والإجمالي المتفق عليه.",
});

// Slide: 163006 — Organizer bookings overview
imageSlide(pres, {
  title: "نظرة عامة على الحجوزات لدى المنظِّم",
  image: "Screenshot 2026-04-26 163006.png",
  caption: "تجمع صفحة «الحجوزات» كل عقود المنظِّم في مكان واحد، مع إمكانية عرضها في التقويم. يوفّر هذا للمنظِّم رؤية شاملة لارتباطاته مع الموردين قبل بدء الفعالية.",
});

// 7) Closing — Summary
closingSlide(pres, {
  title: "خلاصة تدفق RFQ / RFP في سفنت",
  bullets: [
    "يُنشئ المنظِّم طلب العرض ويحدّد متطلباته",
    "يستقبل الموردون الطلب عبر «فرص السوق» أو الدعوات المباشرة",
    "يُقدِّم كل مورد عرض سعر مفصَّلًا مع ملف فني اختياري",
    "يقارن المنظِّم العروض في «جدول المقارنة» ويختار الأنسب",
    "يتحوّل العرض المقبول إلى حجز يؤكِّده المورد قبل الموعد النهائي",
  ],
  footnote: "ملاحظة: مرحلة التعاقد لاحقة لهذا التدفق وستُغطّى في اجتماع منفصل.",
});

pres.writeFile({ fileName: OUTPUT }).then(p => {
  const stat = fs.statSync(p);
  console.log("Wrote:", p);
  console.log("Size:", stat.size, "bytes");
});
