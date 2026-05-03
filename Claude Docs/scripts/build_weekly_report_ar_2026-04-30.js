// Build a 1-page Arabic weekly progress report (.docx) for منصة سفنت,
// in a skim-friendly table layout. Period: 26/04/2026 → 30/04/2026.
// Run from project root:
//   node "Claude Docs/scripts/build_weekly_report_ar_2026-04-30.js"

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, HeadingLevel, BorderStyle,
  PageNumber, Footer,
  Table, TableRow, TableCell, WidthType, ShadingType, VerticalAlign,
} = require("docx");
const JSZip = require("jszip");

const OUT = path.join(
  __dirname, "..", "deliverables", "weekly-reports",
  "2026-04-30-weekly-report-ar.docx",
);
const FONT = "Calibri";
const COLOR_PRIMARY = "1F3A5F";
const COLOR_ACCENT  = "2C5F8D";
const COLOR_HEADER_BG = "1F3A5F";
const COLOR_ZEBRA = "F2F5F9";
const COLOR_BORDER = "BFC9D6";

// --- inline runs --------------------------------------------------
function R(text, opts = {}) {
  return new TextRun({
    text, rightToLeft: true, font: FONT,
    size: opts.size ?? 22, bold: opts.bold, color: opts.color,
  });
}

function P(runs, opts = {}) {
  if (!Array.isArray(runs)) runs = [runs];
  return new Paragraph({
    bidirectional: true,
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: { after: opts.after ?? 40, line: opts.line ?? 280 },
    children: runs.map(r => (typeof r === "string" ? R(r, opts) : r)),
  });
}

function H1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    bidirectional: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 40 },
    children: [R(text, { size: 30, bold: true, color: COLOR_PRIMARY })],
  });
}

// Build a paragraph with mixed bold/regular runs from segments:
//   [["نص عادي ", false], ["نص بارز", true], [" ثم بقية", false]]
function mixedP(segments, opts = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: { after: opts.after ?? 40, line: opts.line ?? 280 },
    children: segments.map(([text, bold]) =>
      R(text, { size: opts.size ?? 21, bold, color: opts.color })
    ),
  });
}

// --- table cells --------------------------------------------------
function cell({ children, shading, header = false, width, align = AlignmentType.LEFT }) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    shading: shading ? { type: ShadingType.CLEAR, fill: shading, color: "auto" } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: Array.isArray(children) ? children : [children],
  });
}

function headerCell(text, width) {
  return cell({
    width,
    shading: COLOR_HEADER_BG,
    children: new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      spacing: { before: 20, after: 20 },
      children: [R(text, { size: 22, bold: true, color: "FFFFFF" })],
    }),
  });
}

// Each row: [titleText, [segments for highlights]]
const ROWS = [
  [
    "نظام الملاحظات الداخلي",
    [
      ["إطلاق ", false],
      ["قناة فيدباك داخل المنصة", true],
      [" مع ", false],
      ["إرفاق لقطة شاشة تلقائية", true],
      [" وتسليم الملاحظات إلى لوحة الإدارة.", false],
    ],
  ],
  [
    "تسريع المنصة",
    [
      ["تحسينات جوهرية على ", false],
      ["سرعة الصفحات والصور", true],
      ["، تشغيل العمليات بالتوازي، وعرض ", false],
      ["شاشات تحميل أنيقة (Skeletons)", true],
      [".", false],
    ],
  ],
  [
    "اكتمال رحلة المورد",
    [
      ["دمج ", false],
      ["الإعداد والملف الشخصي", true],
      ["، ", false],
      ["معرض أعمال بصيغة PDF", true],
      ["، و", false],
      ["تأكيد/رفض الحجز", true],
      [" مباشرة.", false],
    ],
  ],
  [
    "اكتمال رحلة المنظِّم وطلبات العروض",
    [
      ["دمج ", false],
      ["إنشاء الفعالية مع جدول البنود", true],
      [" في خطوة واحدة، وإطلاق ", false],
      ["مسار طلب العرض الفنّي", true],
      [".", false],
    ],
  ],
  [
    "الامتثال للأنظمة السعودية",
    [
      ["تفعيل ", false],
      ["ضريبة القيمة المضافة 15٪", true],
      [" (شامل/غير شامل)، واشتراط ", false],
      ["رقم جوال سعودي للمنظِّم", true],
      [" عند التسجيل.", false],
    ],
  ],
  [
    "تحسينات تجربة المستخدم",
    [
      ["رسائل خطأ ", false],
      ["واضحة بالعربية", true],
      [" بدلًا من الرسائل التقنية، و", false],
      ["تحسينات لشاشات الجوال", true],
      [" في صفحات الملف الشخصي.", false],
    ],
  ],
];

// --- build table --------------------------------------------------
const headerRow = new TableRow({
  tableHeader: true,
  children: [
    headerCell("البند", 35),
    headerCell("أبرز الإنجاز", 65),
  ],
});

const bodyRows = ROWS.map(([title, segments], i) => {
  const zebra = i % 2 === 1 ? COLOR_ZEBRA : undefined;
  return new TableRow({
    children: [
      cell({
        width: 35,
        shading: zebra,
        children: new Paragraph({
          bidirectional: true,
          alignment: AlignmentType.LEFT,
          spacing: { after: 0, line: 280 },
          children: [R(title, { size: 22, bold: true, color: COLOR_PRIMARY })],
        }),
      }),
      cell({
        width: 65,
        shading: zebra,
        children: mixedP(segments, { size: 21 }),
      }),
    ],
  });
});

const border = { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER };
const summaryTable = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [headerRow, ...bodyRows],
  borders: {
    top: border, bottom: border, left: border, right: border,
    insideHorizontal: border, insideVertical: border,
  },
});

// --- document children -------------------------------------------
const children = [];

children.push(
  H1("تقرير الإنجاز الأسبوعي — منصة سفنت"),
  new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [R("للفترة من 26 / 04 / 2026 إلى 30 / 04 / 2026", { size: 20, color: "555555" })],
  }),

  P([R("السلام عليكم ورحمة الله،", { bold: true })], { after: 60 }),
  P("فيما يلي ملخّص أبرز ما تم إنجازه خلال الأسبوع، في صورة جدول للسرعة في الاطّلاع:", { after: 120 }),

  summaryTable,

  // Demo link
  new Paragraph({ spacing: { after: 60 }, children: [R("")] }),
  mixedP(
    [
      ["رابط التجربة: ", true],
      ["https://sevent.ahmadgh.ovh", true],
    ],
    { size: 22, color: "1F5132", after: 80 }
  ),

  // Next steps – inline, compact
  mixedP(
    [
      ["الخطوات القادمة: ", true],
      ["إعداد البريد الرسمي للإشعارات، اعتماد الدومين/السيرفر الرسمي، ومتابعة الملاحظات الواردة عبر القناة الجديدة.", false],
    ],
    { size: 21, after: 100 }
  ),

  P("وتفضّلوا بقبول وافر التقدير والاحترام،", { after: 0 }),
);

// --- assemble doc ------------------------------------------------
const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
  },
  sections: [{
    properties: {
      page: {
        margin: { top: 720, right: 900, bottom: 720, left: 900 },
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

  // Ensure section is RTL.
  docXml = docXml.replace(
    /<w:sectPr([^>]*)>/g,
    (m, attrs) => m.includes("<w:bidi/>") ? m : `<w:sectPr${attrs}><w:bidi/>`,
  );

  // Make tables visually RTL (first logical cell appears on the right).
  docXml = docXml.replace(
    /<w:tblPr>/g,
    "<w:tblPr><w:bidiVisual/>",
  );

  zip.file("word/document.xml", docXml);
  return zip.generateAsync({ type: "nodebuffer" });
}

Packer.toBuffer(doc)
  .then(patchRtl)
  .then(buf => {
    fs.writeFileSync(OUT, buf);
    console.log(`Wrote ${OUT} (${buf.length} bytes) — RTL + bidiVisual patched`);
  })
  .catch(err => { console.error(err); process.exit(1); });
