// 3-slide Arabic deck summarizing the platform business models report.
// Run from repo root: node "Claude Docs/scripts/build_business_models_deck_ar.js"

const path = require("path");
const PptxGenJS = require("pptxgenjs");
const {
  defineMaster, contentSlide, twoColumnSlide, tableSlide,
  COLOR_PRIMARY, COLOR_ACCENT, FONT_AR,
  W, H, MARGIN,
} = require("./build_arabic_pptx_helpers.js");

const OUT = path.join(__dirname, "..", "deliverables", "business-model", "نماذج-أعمال-منصات-الفعاليات.pptx");

const pres = new PptxGenJS();
pres.layout = "LAYOUT_WIDE";
pres.rtlMode = true;
pres.title = "نماذج أعمال منصات الفعاليات";
pres.author = "أحمد رباية";
pres.company = "Sevent";

defineMaster(pres, { projectName: "Sevent — استراتيجية المنصة" });

// ============================================================
// Slide 1: المشهد العام — التصنيفات التسعة
// ============================================================
twoColumnSlide(pres, {
  title: "نماذج أعمال منصات الفعاليات",
  right: {
    heading: "التصنيفات التسعة",
    bullets: [
      "السوق المفتوح — Eventbrite",
      "السوق المُدار — Classpass",
      "المُجمِّع — SeatGeek",
      "البائع المباشر — Ticketmaster",
      "SaaS-enabled — Cvent / Shopify",
      "الاكتشاف — The Knot",
      "المزاد — Lyte",
      "السوق العمودي — GigSalad",
      "الاشتراك — Classpass",
    ],
  },
  left: {
    heading: "السؤال الحاسم",
    bullets: [
      "ما الذي يصعب على المنظم فعله بنفسه؟",
      "إذا كانت المشكلة الوصول للجمهور: السوق المفتوح يكفي.",
      "إذا كانت الجودة متفاوتة: السوق المُدار أفضل.",
      "إذا كان السوق مجزّأ بمزودين بلا أدوات: SaaS-enabled هو الأقوى.",
      "كثير من المنصات الناجحة تبدأ بنموذج وتتطور لآخر مع نضج المنتج.",
    ],
  },
});

// ============================================================
// Slide 2: التوصية — SaaS-enabled لـ Sevent
// ============================================================
contentSlide(pres, {
  title: "التوصية لـ Sevent: سوق عمودي مدعوم بـ SaaS",
  bullets: [
    {
      text: "فجوة الرقمنة عند الموردين هائلة في السعودية",
      sub: [
        "موردو التموين والصوتيات والديكور يديرون أعمالهم عبر WhatsApp و Excel.",
        "أي أداة احترافية تخلق قيمة فورية قبل أن يأتي عميل واحد من المنصة.",
      ],
    },
    {
      text: "الثقة في السوق السعودي علاقاتية",
      sub: [
        "السوق المفتوح لا يعمل في B2B لأن المنظم يطلب ضمانة قبل التعامل.",
        "نحتاج طبقة Managed خفيفة: تحقق سجل تجاري، تقييمات موثقة، ضمان دفع.",
      ],
    },
    {
      text: "رؤية 2030 والإنفاق الحكومي والمؤسسي",
      sub: [
        "الفعاليات المؤسسية تحتاج فواتير ضريبية وعقودًا وتتبعًا منظمًا.",
        "أدوات RFQ والبنود وضريبة 15% المبنية في Sevent تخدم هذا السوق مباشرة.",
      ],
    },
    {
      text: "الفخ: لا تبنِ سوق تذاكر للمستهلك (نسخة Eventbrite عربية)",
      sub: [
        "Eventbrite و Platinumlist و Webook موجودون. الهامش رقيق ولا lock-in.",
      ],
    },
  ],
  note: "نقطة الارتكاز: ابدأ بالمورد لا المنظم. المنظم يمشي خلف الموردين الجيدين، والعكس أبطأ.",
});

// ============================================================
// Slide 3: خارطة الطريق — 3 مراحل
// ============================================================
tableSlide(pres, {
  title: "خارطة الطريق: ثلاث مراحل تدريجية",
  headers: ["المرحلة", "النموذج", "المنتج", "الإيراد"],
  rows: [
    [
      "1 — الآن",
      "SaaS للموردين",
      "أداة عروض أسعار، بورتفوليو، تقويم، فواتير ضريبية",
      "اشتراك شهري",
    ],
    [
      "2 — خلال 6-12 شهر",
      "Managed Marketplace خفيف",
      "مطابقة موردين بمنظمين عبر RFQ، تحقق هوية، ضمان دفع",
      "عمولة 8-15%",
    ],
    [
      "3 — بعد 18 شهر",
      "Vertical Network",
      "بيانات السوق، تمويل موردين، تأمين فعاليات",
      "متعدد المصادر",
    ],
  ],
  colWidths: [2.0, 2.6, 5.5, 2.2],
  note: "الـ codebase الحالي (RFQ، بنود، VAT 15%، بورتفوليو) يدعم المرحلة الأولى مباشرة دون إعادة كتابة.",
});

pres.writeFile({ fileName: OUT })
  .then(p => console.log("Wrote:", p))
  .catch(err => { console.error(err); process.exit(1); });
