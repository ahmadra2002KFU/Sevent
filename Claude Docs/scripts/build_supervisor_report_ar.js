// Build the Arabic supervisor progress report (.docx) for Sevent.
// Run from project root:  node "Claude Docs/scripts/build_supervisor_report_ar.js"

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, LevelFormat, BorderStyle,
  WidthType, ShadingType, VerticalAlign, PageBreak, PageNumber, Footer,
} = require("docx");
const JSZip = require("jszip");

const OUT = path.join(__dirname, "..", "deliverables", "weekly-reports", "2026-04-27-تقرير-المشرف.docx");
const FONT = "Calibri";
const COLOR_PRIMARY = "1F3A5F";
const COLOR_ACCENT = "2C5F8D";
const COLOR_HEADER_FILL = "2C5F8D";
const COLOR_ZEBRA_FILL = "EEF3F8";

function P(text, opts = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: { after: 120, line: 360 },
    children: [new TextRun({
      text, rightToLeft: true, font: FONT,
      size: opts.size ?? 24, bold: opts.bold, italics: opts.italics, color: opts.color,
    })],
  });
}

function H1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    bidirectional: true,
    alignment: AlignmentType.LEFT,
    spacing: { before: 360, after: 240 },
    children: [new TextRun({
      text, rightToLeft: true, font: FONT,
      size: 36, bold: true, color: COLOR_PRIMARY,
    })],
  });
}

function H2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    bidirectional: true,
    alignment: AlignmentType.LEFT,
    spacing: { before: 280, after: 160 },
    children: [new TextRun({
      text, rightToLeft: true, font: FONT,
      size: 30, bold: true, color: COLOR_ACCENT,
    })],
  });
}

function H3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    bidirectional: true,
    alignment: AlignmentType.LEFT,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({
      text, rightToLeft: true, font: FONT,
      size: 26, bold: true, color: "000000",
    })],
  });
}

function Bullet(text, refName = "bullet-list") {
  return new Paragraph({
    numbering: { reference: refName, level: 0 },
    bidirectional: true,
    alignment: AlignmentType.LEFT,
    spacing: { after: 80 },
    children: [new TextRun({ text, rightToLeft: true, font: FONT, size: 24 })],
  });
}

function Num(text, refName) {
  return new Paragraph({
    numbering: { reference: refName, level: 0 },
    bidirectional: true,
    alignment: AlignmentType.LEFT,
    spacing: { after: 80 },
    children: [new TextRun({ text, rightToLeft: true, font: FONT, size: 24 })],
  });
}

function PB() { return new Paragraph({ children: [new PageBreak()] }); }
function Blank() { return new Paragraph({ children: [new TextRun("")] }); }

const TB = { style: BorderStyle.SINGLE, size: 6, color: "BFD4E6" };
const CELL_BORDERS = { top: TB, bottom: TB, left: TB, right: TB };

function TC(text, opts = {}) {
  const width = opts.width ?? 2340;
  let align = opts.align ?? AlignmentType.LEFT;
  if (align === AlignmentType.RIGHT) align = AlignmentType.LEFT;
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: CELL_BORDERS,
    shading: opts.header
      ? { fill: COLOR_HEADER_FILL, type: ShadingType.CLEAR }
      : (opts.zebra ? { fill: COLOR_ZEBRA_FILL, type: ShadingType.CLEAR } : undefined),
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      bidirectional: true,
      alignment: align,
      spacing: { before: 40, after: 40 },
      children: [new TextRun({
        text, rightToLeft: true, font: FONT,
        size: opts.size ?? 22,
        bold: opts.bold ?? opts.header,
        color: opts.header ? "FFFFFF" : (opts.color ?? "000000"),
      })],
    })],
  });
}

function makeTable(rows, colWidths) {
  return new Table({
    columnWidths: colWidths,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    visuallyRightToLeft: true,
    rows,
  });
}

// ============================================================
// CONTENT
// ============================================================
const children = [];

// --- Cover ---
children.push(
  new Paragraph({
    bidirectional: true, alignment: AlignmentType.CENTER,
    spacing: { before: 1200, after: 200 },
    children: [new TextRun({
      text: "تقرير تقدُّم منصّة Sevent",
      rightToLeft: true, font: FONT,
      size: 56, bold: true, color: COLOR_PRIMARY,
    })],
  }),
  new Paragraph({
    bidirectional: true, alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({
      text: "موجَّه للمشرف غير التقني",
      rightToLeft: true, font: FONT,
      size: 32, color: COLOR_ACCENT,
    })],
  }),
  new Paragraph({
    bidirectional: true, alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 80 },
    children: [new TextRun({
      text: "التاريخ: ٢٧ أبريل ٢٠٢٦",
      rightToLeft: true, font: FONT, size: 26,
    })],
  }),
  new Paragraph({
    bidirectional: true, alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({
      text: "الفترة: الأسبوع الأوّل من خطّة تمتدّ لاثني عشر أسبوعاً",
      rightToLeft: true, font: FONT, size: 24,
    })],
  }),
  new Paragraph({
    bidirectional: true, alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({
      text: "الموعد المستهدف للإطلاق التجريبي: ١٣ يوليو ٢٠٢٦",
      rightToLeft: true, font: FONT, size: 24,
    })],
  }),
  PB(),
);

// --- Intro ---
children.push(
  H1("التعريف بالمنصّة"),
  P("Sevent هو سوق رقمي إلكتروني سعودي للفعاليات يربط بين منظِّمي الفعاليات (شركات، جهات حكومية وشبه حكومية، وكالات فعاليات) من جهة، والمورّدين (قاعات، تموين، تصوير، ديكور… إلخ) من جهة أخرى. فكرة المنصّة مستوحاة من نموذج Airbnb وUber لكن مطبَّقة على قطاع الفعاليات، وتهدف إلى استبدال نمط (إرسال طلب عرض سعر فردي إلى كل مورّد على حدة) بسوق إلكتروني واحد يُدير الدورة كاملة من البحث وحتى تسليم الخدمة."),
);

// --- Section 1 — exec summary ---
children.push(
  H1("١. الملخّص التنفيذي"),
  P("نحن في نهاية الأسبوع الأوّل من خطّة من ستّ مراحل (Sprints) كلّ مرحلة أسبوعان. الهيكل الأساسي للمنصّة جاهز ويعمل محلياً، ودورة المورّد كاملة تقريباً (تسجيل، توثيق، نشر، كتالوج، تقويم)، ودورة المنظِّم تعمل حتى مرحلة قبول العرض السعري من المورّد."),
  P("المتبقّي حتى نصل إلى منتج تجريبي قابل للتشغيل (MVP) مع ٢٠–٣٠ مورّد حقيقي في الرياض وجدّة هو: عقد PDF تلقائي، تأكيد الحجز من المورّد، نظام التقييمات بعد انتهاء الفعالية، نظام النزاعات، ثم النشر على السيرفر الإنتاجي.", { bold: true }),
);

// --- Section 2 — what is done ---
children.push(
  H1("٢. ما الذي تمّ إنجازه فعلياً (الموجود الآن)"),

  H2("٢-١ البنية التحتية والأساسات"),
  Bullet("المنصّة تعمل محلياً على Next.js مع قاعدة بيانات Supabase ذاتية الاستضافة."),
  Bullet("نظام تسجيل الدخول والاشتراك (بريد إلكتروني + كلمة مرور) يعمل لجميع الأدوار الأربعة: المنظِّم، المورّد، المشرف، الزائر العام."),
  Bullet("عُزِلت كلّ واجهات كل دور عن غيرها، مع طبقة أمان على مستوى قاعدة البيانات (Row-Level Security)."),
  Bullet("تمّ إنجاز ٢٩ ملف ترحيل لقاعدة البيانات تغطّي: المستخدمين، التصنيفات، المورّدين، الباقات، قواعد التسعير، التقويم، الفعاليات، طلبات عروض الأسعار، العروض، الحجوزات، التقييمات، النزاعات، الإشعارات."),
  Bullet("كلّ المبالغ المالية تُخزَّن بالهللة (وحدة عدد صحيح) لمنع أخطاء التقريب."),

  H2("٢-٢ جانب المورّد"),
  Bullet("معالج تسجيل ذاتي للمورّد: معلومات النشاط، الوثائق (سجل تجاري، عنوان وطني، إلخ)، الموقع ونطاق الخدمة، اللغات، السعة الاستيعابية. وقد تمّ مؤخّراً دمج هذا المعالج داخل صفحة الإعدادات بحيث يكمل المورّد ملفّه على مراحل."),
  Bullet("معرض أعمال يدعم رفع الصور وملفّات PDF، مع تخزين آمن وروابط موقَّعة."),
  Bullet("كتالوج الباقات: إنشاء وتعديل الباقات بأسعار الهللة، الحدّ الأدنى والأعلى للكميّة، إخفاء أو إظهار السعر «ابتداءً من»."),
  Bullet("قواعد التسعير: فترات ذروة، خصومات، رسوم ثابتة، حدّ أدنى للسعر، رسوم سفر — كلّها قابلة للترتيب حسب الأولويّة وللتفعيل أو التعطيل."),
  Bullet("التقويم: عرض شهري + إضافة فترات حظر يدويّة (إجازة، صيانة، مناسبة خاصّة) مع منع التضارب تلقائياً."),
  Bullet("صندوق الوارد للفرص: يستقبل المورّد طلبات عروض الأسعار التي تُطابق نشاطه ومدينته، ويرى موعد الردّ المطلوب."),
  Bullet("منشئ العرض السعري: محرّك تسعير تلقائي يُولِّد مسوّدة العرض من قواعد التسعير، ثم يُتيح للمورّد التعديل اليدوي قبل الإرسال. كلّ إرسال يُنتج «نسخة معتمدة» غير قابلة للتعديل، مع بصمة SHA-256 لمنع العبث."),
  Bullet("إضافة جديدة هذا الأسبوع: إمكانية إرسال مقترح فنّي (Technical Proposal) كملفّ PDF مع العرض، وزرّ تأكيد أو رفض الحجز من قبل المورّد بعد قبول المنظِّم."),

  H2("٢-٣ جانب المنظِّم"),
  Bullet("الصفحات العامّة للموقع: الصفحة الرئيسية، فهرس التصنيفات، صفحة المورّد العامّة بعد اعتماد المشرف."),
  Bullet("بحث عام بالتصنيف والمدينة."),
  Bullet("لوحة المنظِّم + قائمة الفعاليات + قائمة طلبات عروض الأسعار وحالاتها."),
  Bullet("معالج إنشاء فعالية: نوع الفعالية، التاريخ، المدينة، الموقع، عدد الضيوف، نطاق الميزانيّة."),
  Bullet("معالج طلب عرض سعر مع حقول مخصَّصة لكلّ تصنيف (تصوير له حقوله، تموين له حقوله… إلخ)."),
  Bullet("خدمة المطابقة التلقائية: تُرشِّح المورّدين المعتمدين الذين تتطابق فئتهم ومدينتهم وسعتهم وتقويمهم، ثم تُرتِّبهم وفق خمسة معايير (الكفاءة، المسافة، سرعة الاستجابة، جودة الحجوزات السابقة، التدوير العادل) وتُعيد أفضل خمسة."),
  Bullet("محرِّر القائمة المختصرة: يستطيع المنظِّم حذف مورِّد مقترح أو إضافة آخر يدوياً."),
  Bullet("قبول العرض السعري: يقبل المنظِّم العرض ⇒ يدخل الحجز في حالة «بانتظار تأكيد المورِّد» مع حجز مبدئي للتاريخ في تقويم المورِّد لمدة ٤٨ ساعة (Soft-Hold)."),

  H2("٢-٤ جانب المشرف"),
  Bullet("طابور التحقُّق من المورّدين: مراجعة الوثائق، اعتماد أو رفض مع ملاحظة، تحديث حالة التحقُّق."),
  Bullet("لوحة معلومات أساسية + صفحة الإشعارات."),

  H2("٢-٥ الجودة والاختبارات"),
  Bullet("اختبارات وحدويّة لمحرّك التسعير ومحرّك المطابقة."),
  Bullet("فحص شامل لقواعد التدويل: كلّ النصوص مربوطة بمفاتيح ترجمة، الإنجليزية افتراضية، والعربية مسوّدة جاهزة للترجمة الكاملة لاحقاً."),
  Bullet("تنظيف معماري شامل لطبقة الأمان وأذونات الوصول."),
);

// --- Section 3 — gaps ---
children.push(
  H1("٣. الفجوات المتبقّية للوصول إلى MVP"),
  P("الجدول التالي يلخّص المهام الحرجة التي يجب إنجازها قبل إطلاق النسخة التجريبيّة:"),
);

const gapsRows = [
  new TableRow({
    tableHeader: true,
    children: [
      TC("تقدير الجهد", { header: true, width: 1800 }),
      TC("الأهمّيّة", { header: true, width: 1800 }),
      TC("الفجوة", { header: true, width: 5400 }),
    ],
  }),
  new TableRow({
    children: [
      TC("٣ – ٤ أيام", { width: 1800, zebra: true }),
      TC("حرجة", { width: 1800, zebra: true, bold: true }),
      TC("عقد PDF تلقائي يُولَّد من النسخة المعتمدة من العرض السعري عند تأكيد المورّد، ويُرسَل عبر البريد للطرفين.", { width: 5400, zebra: true }),
    ],
  }),
  new TableRow({
    children: [
      TC("٢ – ٣ أيام", { width: 1800 }),
      TC("حرجة", { width: 1800, bold: true }),
      TC("خطّ أنابيب الإشعارات الكامل (Resend + قوالب React Email) لكلّ تغيير حالة: RFQ مُرسل، عرض مستلم، مقبول، مؤكَّد، ملغى، مكتمل.", { width: 5400 }),
    ],
  }),
  new TableRow({
    children: [
      TC("يوم واحد", { width: 1800, zebra: true }),
      TC("حرجة", { width: 1800, zebra: true, bold: true }),
      TC("مهام مجدولة (pg_cron) لانتهاء صلاحيّة الحجز المبدئي بعد ٤٨ ساعة، وإكمال الحجز تلقائياً بعد انتهاء الفعالية.", { width: 5400, zebra: true }),
    ],
  }),
  new TableRow({
    children: [
      TC("٣ أيام", { width: 1800 }),
      TC("عالية", { width: 1800, bold: true }),
      TC("نظام التقييمات بعد اكتمال الحجز (الطرفان يقيِّمان، نشر مزدوج خلال ١٤ يوماً).", { width: 5400 }),
    ],
  }),
  new TableRow({
    children: [
      TC("٤ – ٥ أيام", { width: 1800, zebra: true }),
      TC("عالية", { width: 1800, zebra: true, bold: true }),
      TC("نظام النزاعات: فتح النزاع، تقديم الأدلّة من الطرفين، مساحة عمل المشرف للحلّ.", { width: 5400, zebra: true }),
    ],
  }),
  new TableRow({
    children: [
      TC("٢ – ٣ أيام", { width: 1800 }),
      TC("حرجة قبل الإطلاق", { width: 1800, bold: true }),
      TC("النشر الإنتاجي على السيرفر (Ubuntu + nginx + شهادة SSL + نسخ احتياطي ليلي).", { width: 5400 }),
    ],
  }),
  new TableRow({
    children: [
      TC("يومان", { width: 1800, zebra: true }),
      TC("عالية للجودة", { width: 1800, zebra: true, bold: true }),
      TC("اختبارات Playwright للمسارين الذهبيين: المسار السعيد + مسار النزاع.", { width: 5400, zebra: true }),
    ],
  }),
];
children.push(makeTable(gapsRows, [1800, 1800, 5400]));

children.push(
  H2("مُؤجَّل بشكل واعٍ إلى ما بعد MVP (ليس فجوة — قرار)"),
  P("الدفع داخل المنصّة (Tap وحساب الضمان)، الفوترة الإلكترونية (ZATCA)، التحقّق عبر «نفاذ»، الترجمة العربية الكاملة، الإشعارات عبر واتساب وSMS، الدردشة داخل المنصّة، تكامل تقويم Google، الحجز الفوري، إدارة الحسابات بالوكالة. جميعها مدروسة ومخطّط لها لاحقاً، لكن خروجها من الإصدار التجريبي قرار محسوب لتقصير وقت الإطلاق."),
  P("في المرحلة الحاليّة، الدفع يتمّ خارج المنصّة عبر التحويل البنكي؛ المنصّة فقط تُسجِّل الحالة وتُولِّد العقد وترسل الإشعارات.", { bold: true }),
);

// --- Section 4 — next steps ---
children.push(
  H1("٤. الخطوات التالية للوصول إلى MVP وظيفي"),
  P("الجدول الزمني المتبقّي خمسة أسابيع، أسبوع منها مخصَّص للتجارب والتشديد فقط دون إضافة ميزات جديدة."),

  H2("الأسبوع القادم (٢٨ أبريل – ١١ مايو) — استكمال «حلقة الحجز»"),
  Num("توليد عقد PDF من النسخة المعتمدة من العرض السعري وتخزينه في Supabase Storage.", "phase-a"),
  Num("تأكيد المورّد للحجز ⇒ تحويل الحجز المبدئي إلى مؤكَّد + إصدار العقد.", "phase-a"),
  Num("مهمّة مجدولة لانتهاء صلاحيّة الحجوزات المعلّقة.", "phase-a"),
  Num("قوالب البريد الإلكتروني الجاهزة لكلّ تغيير حالة عبر Resend.", "phase-a"),

  H2("الأسبوعان التاليان (١٢ – ٢٥ مايو) — التقييمات والنزاعات"),
  Num("واجهة التقييم بعد اكتمال الفعالية للطرفين.", "phase-b"),
  Num("آليّة نشر التقييمات (الطرفان قيَّما أو انتهت نافذة ١٤ يوماً).", "phase-b"),
  Num("فتح نزاع + رفع أدلّة + مساحة عمل المشرف لإصدار قرار.", "phase-b"),

  H2("الأسبوعان الأخيران (٢٦ مايو – ٨ يونيو) — التشديد والإطلاق التجريبي"),
  Num("اختبارات Playwright للمسارين الذهبيين.", "phase-c"),
  Num("اختبارات أمان شاملة لكلّ الأدوار.", "phase-c"),
  Num("النشر على Ubuntu بنطاق عام + شهادة SSL + نسخ احتياطي مؤتمت.", "phase-c"),
  Num("تجربة تشغيل مع ٢ – ٣ مورّدين أصدقاء قبل الإطلاق الموسَّع لـ ٢٠ – ٣٠ مورّد.", "phase-c"),
  Num("كتابة دليل التشغيل والصيانة (Runbook) واستعلامات SQL لمتابعة مؤشّرات التشغيل.", "phase-c"),

  P("الموعد المستهدف لاكتمال MVP وبدء الطيار التجريبي: ١٣ يوليو ٢٠٢٦.", { bold: true, color: COLOR_PRIMARY }),
);

// --- Section 5 — risks ---
children.push(
  H1("٥. مخاطر تحتاج متابعة من المشرف"),
  Num("استضافة Supabase ذاتيّاً قد تستهلك وقتاً غير متوقَّع في الصيانة. خطّة الاحتياط: الانتقال إلى Supabase السحابيّة المُدارة لو ظهرت مشاكل في النسخ الاحتياطي بنهاية الأسبوع القادم.", "risks"),
  Num("حالات تسعير حدّيّة قد تظهر في اختبارات الوحدة عند بناء واجهة العرض. لدينا أكثر من ١٠ حالات اختبار جاهزة، لكن قد نحتاج إعادة هيكلة لو فشلت ٣ منها أو أكثر.", "risks"),
  Num("اختبارات الأمان (RLS) يجب أن تُكتَب من البداية وليس في النهاية، وهذا ما نلتزم به فعلاً.", "risks"),
  Num("التجربة الميدانيّة مع المورّدين الأصدقاء قد تكشف نقاط احتكاك في تجربة الاستخدام؛ خصَّصنا ٣ أيام في المرحلة الأخيرة لإصلاحات طارئة فقط.", "risks"),
);

// --- Section 6 — yes/no ---
children.push(
  H1("٦. الخلاصة بصيغة «نعم / لا»"),
);

const yesNoRows = [
  new TableRow({
    tableHeader: true,
    children: [
      TC("الجواب", { header: true, width: 2700 }),
      TC("السؤال", { header: true, width: 6300 }),
    ],
  }),
  new TableRow({
    children: [
      TC("نعم — محلياً", { width: 2700, zebra: true, bold: true, color: "1F6F3F" }),
      TC("هل المنصّة تعمل اليوم؟", { width: 6300, zebra: true }),
    ],
  }),
  new TableRow({
    children: [
      TC("نعم", { width: 2700, bold: true, color: "1F6F3F" }),
      TC("هل يستطيع مورّد إكمال ملفّه ونشره؟", { width: 6300 }),
    ],
  }),
  new TableRow({
    children: [
      TC("نعم", { width: 2700, zebra: true, bold: true, color: "1F6F3F" }),
      TC("هل يستطيع منظِّم إنشاء فعالية وإرسال طلب عرض سعر واستقبال عروض وقبول واحد؟", { width: 6300, zebra: true }),
    ],
  }),
  new TableRow({
    children: [
      TC("ليس بعد", { width: 2700, bold: true, color: "B23B3B" }),
      TC("هل يصدر عقد PDF بعد القبول والتأكيد؟ (أوّل عمل الأسبوع القادم)", { width: 6300 }),
    ],
  }),
  new TableRow({
    children: [
      TC("ليس بعد", { width: 2700, zebra: true, bold: true, color: "B23B3B" }),
      TC("هل يوجد تقييم ونزاع؟ (مخطّط للأسبوعَين بعد القادم)", { width: 6300, zebra: true }),
    ],
  }),
  new TableRow({
    children: [
      TC("ليس بعد", { width: 2700, bold: true, color: "B23B3B" }),
      TC("هل المنصّة منشورة على الإنترنت؟ (مخطّط لها قبل أسبوعين من الإطلاق التجريبي)", { width: 6300 }),
    ],
  }),
  new TableRow({
    children: [
      TC("نعم حتى الآن", { width: 2700, zebra: true, bold: true, color: "1F6F3F" }),
      TC("هل نلتزم بالجدول الزمني (١٣ يوليو ٢٠٢٦)؟ أنهينا الأسبوع الأوّل بمستوى أفضل قليلاً من المتوقَّع بفضل دمج معالج التسجيل في الإعدادات وتقدُّم محرّك التسعير.", { width: 6300, zebra: true }),
    ],
  }),
];
children.push(makeTable(yesNoRows, [2700, 6300]));

children.push(
  Blank(),
  P("أُعِدّ هذا التقرير بناءً على فحص فعلي للكود وسجلّ Git وملفّات التخطيط في مجلّد Claude Docs. لمزيد من التفاصيل التقنية يُرجى مراجعة plan.md و plans/sprints.md.", { italics: true, color: "555555", size: 20 }),
);

// ============================================================
// DOCUMENT ASSEMBLY
// ============================================================
const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, color: COLOR_PRIMARY, font: FONT, rightToLeft: true },
        paragraph: {
          spacing: { before: 360, after: 240 }, outlineLevel: 0,
          alignment: AlignmentType.LEFT, bidirectional: true,
        },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, color: COLOR_ACCENT, font: FONT, rightToLeft: true },
        paragraph: {
          spacing: { before: 280, after: 160 }, outlineLevel: 1,
          alignment: AlignmentType.LEFT, bidirectional: true,
        },
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, color: "000000", font: FONT, rightToLeft: true },
        paragraph: {
          spacing: { before: 200, after: 120 }, outlineLevel: 2,
          alignment: AlignmentType.LEFT, bidirectional: true,
        },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullet-list",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
      ...["phase-a", "phase-b", "phase-c", "risks"].map(ref => ({
        reference: ref,
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      })),
    ],
  },
  sections: [{
    properties: {
      page: {
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        pageNumbers: { start: 1, formatType: "decimal" },
      },
      rtlGutter: true,
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "صفحة ", font: FONT, size: 18, color: "666666" }),
            new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18 }),
            new TextRun({ text: " من ", font: FONT, size: 18 }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 18 }),
          ],
        })],
      }),
    },
    children,
  }],
});

async function patchRtl(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  let docXml = await zip.file("word/document.xml").async("string");
  docXml = docXml.replace(
    /<w:sectPr([^>]*)>/g,
    (m, attrs) => m.includes("<w:bidi/>") ? m : `<w:sectPr${attrs}><w:bidi/>`,
  );
  zip.file("word/document.xml", docXml);
  return zip.generateAsync({ type: "nodebuffer" });
}

Packer.toBuffer(doc)
  .then(patchRtl)
  .then(buf => {
    fs.writeFileSync(OUT, buf);
    console.log(`Wrote ${OUT} (${buf.length} bytes) — RTL patched`);
  })
  .catch(err => { console.error(err); process.exit(1); });
