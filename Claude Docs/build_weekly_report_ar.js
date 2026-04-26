// Build a short Arabic weekly progress report (.docx) for منصة سفنت.
// Run from project root:  node "Claude Docs/build_weekly_report_ar.js"

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, HeadingLevel, LevelFormat, BorderStyle,
  PageNumber, Footer,
} = require("docx");
const JSZip = require("jszip");

const OUT = path.join(__dirname, "weekly-report-ar.docx");
const FONT = "Calibri";
const COLOR_PRIMARY = "1F3A5F";
const COLOR_ACCENT = "2C5F8D";

function P(text, opts = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: { after: 100, line: 320 },
    children: [new TextRun({
      text, rightToLeft: true, font: FONT,
      size: opts.size ?? 22, bold: opts.bold, color: opts.color,
    })],
  });
}

function H1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    bidirectional: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 80 },
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
    spacing: { before: 200, after: 80 },
    children: [new TextRun({
      text, rightToLeft: true, font: FONT,
      size: 24, bold: true, color: COLOR_ACCENT,
    })],
  });
}

function Bullet(text, refName = "bullet-list") {
  return new Paragraph({
    numbering: { reference: refName, level: 0 },
    bidirectional: true,
    alignment: AlignmentType.LEFT,
    spacing: { after: 60, line: 300 },
    children: [new TextRun({ text, rightToLeft: true, font: FONT, size: 22 }) ],
  });
}

function Divider() {
  return new Paragraph({
    spacing: { before: 60, after: 120 },
    border: {
      bottom: { color: "CFD8DC", style: BorderStyle.SINGLE, size: 6, space: 1 },
    },
    children: [new TextRun("")],
  });
}

const children = [];

// Header
children.push(
  H1("تقرير الإنجاز الأسبوعي — منصة سفنت"),
  new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({
      text: "للأسبوع المنتهي بتاريخ 26 / 04 / 2026",
      rightToLeft: true, font: FONT, size: 20, color: "555555",
    })],
  }),
  Divider(),
);

// Intro
children.push(
  P(
    "السلام عليكم ورحمة الله وبعد،",
    { bold: true }
  ),
  P(
    "يسرّنا أن نرفع لسعادتكم تقريرًا موجزًا عن أبرز ما تم إنجازه في منصة سفنت خلال الأسبوع الماضي. " +
    "تركّز العمل على رفع جودة تجربة المستخدم لجميع الفئات (المنظِّمين، الموردين، فريق الإدارة)، " +
    "وإطلاق مزايا جوهرية تخدم نمو المنصة وجاهزيتها للتشغيل."
  ),
);

// Sections
children.push(
  H2("١. إعادة تصميم رحلة انضمام الموردين"),
  P(
    "تم بناء رحلة تسجيل جديدة كليًا للموردين، أوضح وأقصر، تأخذ المورد خطوةً بخطوة من إنشاء الحساب " +
    "حتى اعتماد ملفه. الهدف: تقليل التسرّب أثناء التسجيل وتسريع وصول الموردين إلى مرحلة العمل الفعلي على المنصة."
  ),

  H2("٢. إطلاق سوق الفرص للموردين"),
  P(
    "أصبح بإمكان المورد تصفّح طلبات العروض المتاحة في السوق واختيار ما يناسبه، مع إمكانية توسيع نطاق التغطية " +
    "ليشمل المملكة بأكملها، إضافة إلى تنظيم الوثائق الرسمية للشركة وملفات العروض الفنية في مكان واحد."
  ),

  H2("٣. تطوير شامل لواجهات المنصة"),
  P(
    "أُعيد تصميم واجهات المنصة بالكامل عبر جميع الأدوار: لوحات تحكم المنظِّم والمورد والإدارة، " +
    "بالإضافة إلى الصفحات العامة. النتيجة: هوية بصرية موحّدة، وتنظيم أوضح للمعلومات، وتجربة استخدام أكثر سلاسة وراحة."
  ),

  H2("٤. تحسين تجربة التسجيل والتنقل"),
  P(
    "تم تطوير تجربة التسجيل بحيث يختار الزائر بوضوح ما إذا كان منظِّمًا أم موردًا، " +
    "مع تحسين قائمة التنقل في الواجهة العامة لتعرض الخيار المناسب لكل زائر، " +
    "وعرض البريد الإلكتروني للمتقدِّم في صفحة المراجعة لدى فريق الإدارة لتسهيل التواصل."
  ),

  H2("٥. تعزيز دعم اللغتين العربية والإنجليزية"),
  P(
    "تمّت مراجعة شاملة للنصوص في جميع أقسام المنصة لضمان تجربة متّسقة وكاملة باللغتين، " +
    "مع عرض أسماء التصنيفات والخدمات بالعربية بشكل صحيح في كل الشاشات."
  ),

  H2("٦. تحسين الأداء والاستقرار"),
  P(
    "أُجريت تحسينات على سرعة التحميل في الصفحات الأكثر استخدامًا، " +
    "ومعالجة عدد من الملاحظات التشغيلية لرفع موثوقية المنصة وجاهزيتها للنشر."
  ),
);

// Demo link
children.push(
  H2("رابط التجربة الحالي"),
  P(
    "يمكن تجربة المنصة حاليًا عبر الرابط التالي:"
  ),
  new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.LEFT,
    spacing: { after: 100 },
    children: [new TextRun({
      text: "https://sevent.ahmadgh.ovh",
      font: FONT, size: 22, bold: true, color: "1F5132",
    })],
  }),
);

// Notes & next steps
children.push(
  H2("ملاحظات وخطوات قادمة"),
  Bullet(
    "الدخول إلى المنصة حاليًا متاح بشكل مبسّط، وسيتطلب لاحقًا توثيقًا رسميًا، وعليه نحتاج إلى اعتماد دومين رسمي للمنصة."
  ),
  Bullet(
    "نحتاج إلى سيرفر ودومين خاصَّين بالمنصة لضمان عملها بشكل كامل ومستقر، وسيتم مناقشة ذلك مع فريق الدعم الفني يوم الأحد إن شاء الله."
  ),
  Bullet(
    "نحتاج إلى تفعيل خدمة إرسال البريد الإلكتروني (للإشعارات والتفعيل). الخدمة بسيطة في حد ذاتها، لكن تجهيزها واعتمادها يحتاج بعض الوقت."
  ),
  Bullet(
    "المنصة تعمل حاليًا على سيرفر خاص بشكل مؤقّت، وسيتم نقلها إلى السيرفر الرسمي بمجرّد اعتماد المسار الذي نسير فيه."
  ),
);

// AI usage / cost note
children.push(
  H2("استهلاك أدوات الذكاء الاصطناعي خلال التطوير"),
  P(
    "خلال الأسبوعين الماضيين تمّ استخدام أدوات الذكاء الاصطناعي بشكل مكثّف لتسريع التطوير ورفع جودة المخرجات، " +
    "بإجمالي تجاوز 1.5 مليار رمز معالجة (token)، بما يعادل قرابة 1,090 دولارًا أمريكيًا من حيث التكلفة المرجعية."
  ),
  P(
    "تجدر الإشارة إلى أن هذه التكلفة مشمولة بالكامل ضمن اشتراك Claude الخاص، ولا تترتّب عليها أي مصاريف إضافية على المشروع.",
    { bold: true }
  ),
);

// Closing
children.push(
  Divider(),
  P(
    "نواصل خلال الأسبوع القادم العمل على استكمال مزايا الموردين والمنظِّمين، ورفع جودة المنصة استعدادًا لمراحل التشغيل القادمة."
  ),
  P(
    "وتفضّلوا بقبول وافر التقدير والاحترام،",
    { align: AlignmentType.LEFT }
  ),
);

// Document
const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, color: COLOR_PRIMARY, font: FONT, rightToLeft: true },
        paragraph: { spacing: { before: 0, after: 80 }, outlineLevel: 0,
          alignment: AlignmentType.CENTER, bidirectional: true },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, color: COLOR_ACCENT, font: FONT, rightToLeft: true },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 1,
          alignment: AlignmentType.LEFT, bidirectional: true },
      },
    ],
  },
  numbering: {
    config: [{
      reference: "bullet-list",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    }],
  },
  sections: [{
    properties: {
      page: {
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
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
