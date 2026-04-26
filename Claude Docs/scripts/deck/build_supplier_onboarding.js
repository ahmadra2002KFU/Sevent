// Arabic supplier onboarding walkthrough deck.
// Run from this folder: node build_supplier_onboarding.js

const PptxGenJS = require("pptxgenjs");
const path = require("path");

// ---- CONFIG ----
const FONT_AR = "Cairo";
const FONT_AR_FALLBACK = "Segoe UI";
const COLOR_PRIMARY = "0F2747";   // Sevent navy (matches header in screenshots)
const COLOR_ACCENT = "1F5132";    // deep green (brand)
const COLOR_GOLD = "B98A2E";      // verified-supplier badge gold
const COLOR_MUTED = "6B7280";
const COLOR_BG = "FFFFFF";
const COLOR_OFFWHITE = "F7F4EE";
const COLOR_DARK = "111827";

const IMG_DIR = "D:\\Mufeed\\Sevent\\Screenshots\\Suppliers Onboarding";
const OUTPUT = "D:\\Mufeed\\Sevent\\Code\\Claude Docs\\Supplier-Onboarding-Walkthrough-AR.pptx";

// ---- Layout (LAYOUT_WIDE = 13.333 x 7.5) ----
const W = 13.333;
const H = 7.5;
const MARGIN = 0.5;
const TITLE_Y = 0.45;
const CONTENT_Y = 1.55;
const CONTENT_H = H - CONTENT_Y - 0.6;

function imgPath(file) {
  return path.join(IMG_DIR, file);
}

function defineMaster(pres) {
  pres.defineSlideMaster({
    title: "MASTER",
    background: { color: COLOR_BG },
    objects: [
      { rect: { x: 0, y: 0, w: W, h: 0.08, fill: { color: COLOR_PRIMARY } } },
      { text: {
          text: "منصة سفنت — رحلة انضمام الموردين",
          options: {
            x: W - 5.0, y: H - 0.45, w: 4.5, h: 0.35,
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
    x: W - MARGIN - 1.4, y: TITLE_Y + 0.88, w: 1.4, h: 0.06,
    fill: { color: COLOR_ACCENT }, line: { color: COLOR_ACCENT },
  });
}

// ---- Slide types ----

function coverSlide(pres) {
  const s = pres.addSlide();
  s.background = { color: COLOR_PRIMARY };

  // Decorative accent stripe down the left
  s.addShape("rect", {
    x: 0, y: 0, w: 0.25, h: H,
    fill: { color: COLOR_ACCENT }, line: { color: COLOR_ACCENT },
  });

  // Brand label (top-right)
  s.addText("منصة سفنت", {
    x: 0.5, y: 0.7, w: W - 1, h: 0.5,
    fontFace: FONT_AR, fontSize: 18, color: "A7F3D0",
    align: "right", rtlMode: true,
  });

  // Main title
  s.addText("رحلة انضمام الموردين — التجربة الجديدة", {
    x: 0.5, y: 2.4, w: W - 1, h: 1.6,
    fontFace: FONT_AR, fontSize: 52, bold: true, color: "FFFFFF",
    align: "right", rtlMode: true,
  });

  // Subtitle
  s.addText("جولة بصرية على التدفّق المُعاد تصميمه", {
    x: 0.5, y: 4.2, w: W - 1, h: 0.7,
    fontFace: FONT_AR, fontSize: 24, color: "D1FAE5",
    align: "right", rtlMode: true,
  });

  // Date / report context
  s.addText("التقرير الأسبوعي · 26 أبريل 2026", {
    x: 0.5, y: 6.3, w: W - 1, h: 0.5,
    fontFace: FONT_AR, fontSize: 14, color: "A7F3D0",
    align: "right", rtlMode: true,
  });

  return s;
}

function introSlide(pres) {
  const s = pres.addSlide();
  addTitle(s, "هدف إعادة التصميم");

  s.addText(
    "أعدنا تصميم رحلة انضمام الموردين لتُشجّع الإكمال وتُقلّل التسرّب، عبر خطوات قصيرة ومرئية تنتقل بالمورد من إنشاء الحساب وحتى دخوله سوق الفعاليات.",
    {
      x: MARGIN, y: CONTENT_Y, w: W - 2 * MARGIN, h: 1.0,
      fontFace: FONT_AR, fontSize: 18, color: COLOR_DARK,
      align: "right", rtlMode: true,
    }
  );

  const bullets = [
    "تقليل التسرّب في كل خطوة عبر تجربة واضحة ومُتدرّجة.",
    "توضيح المتطلبات مسبقاً (السجل التجاري، شهادة آيبان، الفئات) قبل البدء.",
    "تسريع الوصول إلى مرحلة استقبال طلبات العروض بعد اعتماد الإدارة.",
  ];

  const items = bullets.map(b => ({
    text: b,
    options: {
      bullet: { indent: 22 },
      fontFace: FONT_AR, fontSize: 20, color: COLOR_DARK,
      rtlMode: true, align: "right", paraSpaceAfter: 12,
    },
  }));

  s.addText(items, {
    x: MARGIN, y: CONTENT_Y + 1.2, w: W - 2 * MARGIN, h: CONTENT_H - 1.2,
    valign: "top",
  });

  return s;
}

function sectionSlide(pres, { number, title, subtitle }) {
  const s = pres.addSlide();
  s.background = { color: COLOR_PRIMARY };

  s.addText(String(number), {
    x: 0, y: 1.1, w: W, h: 2.5,
    fontFace: FONT_AR_FALLBACK, fontSize: 180, bold: true, color: "0A1B33",
    align: "center",
  });

  s.addText(title, {
    x: 0.5, y: 4.0, w: W - 1, h: 1.0,
    fontFace: FONT_AR, fontSize: 40, bold: true, color: "FFFFFF",
    align: "center", rtlMode: true,
  });

  if (subtitle) {
    s.addText(subtitle, {
      x: 0.5, y: 5.05, w: W - 1, h: 0.7,
      fontFace: FONT_AR, fontSize: 18, color: "A7F3D0",
      align: "center", rtlMode: true,
    });
  }

  s.addShape("rect", {
    x: W / 2 - 0.6, y: 5.95, w: 1.2, h: 0.06,
    fill: { color: COLOR_ACCENT }, line: { color: COLOR_ACCENT },
  });
  return s;
}

// Image slide: image on the right (RTL visual), Arabic caption on the left.
function imageSlide(pres, { title, image, captionTitle, caption }) {
  const s = pres.addSlide();
  addTitle(s, title);

  // Image on the right side (RTL visual leading position)
  const iw = 8.4;
  const ih = CONTENT_H - 0.5;
  const ix = W - MARGIN - iw;
  const iy = CONTENT_Y;

  // Subtle frame behind image
  s.addShape("rect", {
    x: ix - 0.06, y: iy - 0.06, w: iw + 0.12, h: ih + 0.12,
    fill: { color: COLOR_OFFWHITE }, line: { color: "E5E7EB", width: 0.5 },
  });

  s.addImage({
    path: imgPath(image),
    x: ix, y: iy, w: iw, h: ih,
    sizing: { type: "contain", w: iw, h: ih },
  });

  // Caption panel on the left
  const cx = MARGIN;
  const cw = W - 2 * MARGIN - iw - 0.3;
  const cy = CONTENT_Y;

  if (captionTitle) {
    s.addText(captionTitle, {
      x: cx, y: cy, w: cw, h: 0.7,
      fontFace: FONT_AR, fontSize: 22, bold: true, color: COLOR_ACCENT,
      align: "right", rtlMode: true,
    });
  }

  s.addText(caption, {
    x: cx, y: cy + (captionTitle ? 0.8 : 0), w: cw, h: ih - (captionTitle ? 0.8 : 0),
    fontFace: FONT_AR, fontSize: 16, color: COLOR_DARK,
    align: "right", rtlMode: true, valign: "top", paraSpaceAfter: 8,
  });

  return s;
}

function closingSlide(pres) {
  const s = pres.addSlide();
  s.background = { color: COLOR_PRIMARY };

  s.addText("نهاية الرحلة — الخطوة التالية", {
    x: 0.5, y: 1.0, w: W - 1, h: 1.0,
    fontFace: FONT_AR, fontSize: 36, bold: true, color: "FFFFFF",
    align: "center", rtlMode: true,
  });

  s.addText(
    "ينتقل المورد من إنشاء الحساب إلى تعبئة الملف التجاري واختيار الفئات والتغطية، ثم يدخل مرحلة المراجعة من قِبَل فريق التوثيق.",
    {
      x: 1.2, y: 2.2, w: W - 2.4, h: 1.2,
      fontFace: FONT_AR, fontSize: 18, color: "D1FAE5",
      align: "center", rtlMode: true,
    }
  );

  // Highlight CTA box
  s.addShape("roundRect", {
    x: 1.5, y: 3.7, w: W - 3, h: 1.9,
    fill: { color: "0A1B33" }, line: { color: COLOR_ACCENT, width: 1.5 },
    rectRadius: 0.15,
  });

  s.addText("الإجراء المطلوب الآن", {
    x: 1.5, y: 3.85, w: W - 3, h: 0.5,
    fontFace: FONT_AR, fontSize: 16, color: "A7F3D0",
    align: "center", rtlMode: true,
  });

  s.addText(
    "بانتظار اعتماد المهندس محمد الخليفة لتفعيل إرسال الموردين عبر المنصة",
    {
      x: 1.7, y: 4.4, w: W - 3.4, h: 1.1,
      fontFace: FONT_AR, fontSize: 22, bold: true, color: "FFFFFF",
      align: "center", rtlMode: true,
    }
  );

  s.addText("منصة سفنت", {
    x: 0.5, y: 6.5, w: W - 1, h: 0.4,
    fontFace: FONT_AR, fontSize: 14, color: "A7F3D0",
    align: "center", rtlMode: true,
  });

  return s;
}

// ---- Build ----

(async () => {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";
  pres.rtlMode = true;
  pres.title = "رحلة انضمام الموردين — منصة سفنت";
  pres.author = "فريق سفنت";
  pres.company = "Sevent";

  defineMaster(pres);

  // 1. Cover
  coverSlide(pres);

  // 2. Intro / goal
  introSlide(pres);

  // ----- Phase 1: Account creation -----
  sectionSlide(pres, {
    number: "1",
    title: "إنشاء الحساب",
    subtitle: "نقطة الدخول للمورد إلى المنصة",
  });

  imageSlide(pres, {
    title: "الصفحة الرئيسية ومدخل المورد",
    image: "Screenshot 2026-04-26 165257.png",
    captionTitle: "بداية الرحلة",
    caption:
      "من الصفحة الرئيسية لمنصة سفنت، يفتح الزائر قائمة \"إنشاء حساب\" ويختار خيار \"أنا مورد — قدّم خدماتك للمنظّمين\" للانتقال إلى تدفّق التسجيل المخصص للموردين.",
  });

  imageSlide(pres, {
    title: "نموذج إنشاء حساب مزوّد الخدمة",
    image: "Screenshot 2026-04-26 165323.png",
    captionTitle: "حقول التسجيل الأساسية",
    caption:
      "نموذج موجز يطلب البريد الإلكتروني للعمل، رقم الجوال (مع كود +966)، وكلمة مرور لا تقل عن 8 أحرف، مع موافقة صريحة على الشروط وسياسة الخصوصية. اللوحة الجانبية تُبرز ثلاث قيم: طلبات حقيقية، ضمان الدفع، وتوثيق رسمي عبر السجل التجاري.",
  });

  // ----- Phase 2: Activity profile + documents -----
  sectionSlide(pres, {
    number: "2",
    title: "الملف التجاري والوثائق",
    subtitle: "تحديد طبيعة النشاط وتعبئة بيانات المنشأة",
  });

  imageSlide(pres, {
    title: "تخصيص الرحلة بحسب شكل النشاط",
    image: "Screenshot 2026-04-26 165334.png",
    captionTitle: "شركة مسجّلة أم مستقل؟",
    caption:
      "في خطوة \"حدّثنا عن نشاطك\"، يختار المورد بين مسارين: شركة مسجّلة (سجل تجاري، شهادة آيبان، ملف اختياري) مع شارة مزوّد موثّق، أو مستقل/صاحب عمل فردي (هوية وطنية وشهادة آيبان). كل مسار يعرض الوقت المتوقع والمتطلبات قبل البدء.",
  });

  imageSlide(pres, {
    title: "الخطوة 1 — معلومات النشاط",
    image: "Screenshot 2026-04-26 165449.png",
    captionTitle: "بطاقة المعاينة الحيّة",
    caption:
      "يعبّئ المورد اسم المسؤول، اسم المنشأة، نبذة قصيرة، ورقم السجل التجاري. يدعم النموذج استيراد البيانات تلقائياً من رابط الموقع الإلكتروني، وتظهر بطاقة معاينة على اليمين تُحاكي شكل ملفه العام أمام المنظّمين، مع تذكير بأن النبذة تزيد طلبات العروض بنسبة تصل إلى 40%.",
  });

  imageSlide(pres, {
    title: "نطاق الخدمة واللغات",
    image: "Screenshot 2026-04-26 165459.png",
    captionTitle: "تغطية جغرافية ولغوية",
    caption:
      "يحدد المورد المدينة الرئيسية ومدن نطاق الخدمة (حتى 15 مدينة)، مع خيار \"أخدم جميع مدن المملكة\" لإخفاء قائمة المدن عند تفعيله، إضافة إلى اللغات التي يعمل بها (العربية والإنجليزية)، لتصل طلبات العروض المناسبة فقط للمنطقة واللغة الصحيحة.",
  });

  // ----- Phase 3: Categories & segments -----
  sectionSlide(pres, {
    number: "3",
    title: "الفئات والشرائح",
    subtitle: "اختيار الخدمات الدقيقة التي يقدّمها المورد",
  });

  imageSlide(pres, {
    title: "الخطوة 2 — الفئات والشرائح",
    image: "Screenshot 2026-04-26 165517.png",
    captionTitle: "اختيار دقيق يجذب طلبات أنسب",
    caption:
      "تعرض المنصة الفئات الرئيسية (صوت وإضاءة، كهرباء وطاقة، مكياج وتجميل، زهور وديكور، تنسيق وإدارة، استاندات ومعارض، نقل ولوجستيات...) ضمن مجموعات قابلة للبحث. التوصية الذكية تنبّه المورد إلى أن اختيار 3–4 فئات أفضل من عشر فئات لرفع جودة الطلبات.",
  });

  // ----- Phase 4: Review -----
  sectionSlide(pres, {
    number: "4",
    title: "مراجعة الإدارة والاعتماد",
    subtitle: "خطوة التحقق قبل ظهور المورد للمنظّمين",
  });

  imageSlide(pres, {
    title: "حالة الطلب — قيد المراجعة",
    image: "Screenshot 2026-04-26 171942.png",
    captionTitle: "استلمنا طلبك",
    caption:
      "بعد إكمال الخطوات، تظهر للمورد شاشة تأكيد رسمية تُعلمه بأن فريق التوثيق يراجع مستنداته خلال 24 ساعة عمل، مع وعد بإشعار عبر بريده فور الاعتماد، وإمكانية العودة إلى لوحة التحكم أو التحدث مع فريق التوثيق مباشرةً.",
  });

  // Closing
  closingSlide(pres);

  await pres.writeFile({ fileName: OUTPUT });
  console.log("Wrote:", OUTPUT);
})();
