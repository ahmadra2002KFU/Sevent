// Compact 1-2 page Arabic executive summary.
// Run: node "Claude Docs/scripts/build_executive_summary_ar.js"

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, LevelFormat, BorderStyle,
  WidthType, ShadingType, VerticalAlign, PageNumber, Footer,
} = require("docx");
const JSZip = require("jszip");

const OUT = path.join(__dirname, "..", "deliverables", "business-model", "ملخص-تنفيذي-استراتيجية-Sevent.docx");
const FONT = "Calibri";
const COLOR_PRIMARY = "1F5132";
const COLOR_ACCENT = "2C7A4B";
const COLOR_DANGER = "B91C1C";
const COLOR_HEADER_FILL = "2C7A4B";
const COLOR_ZEBRA_FILL = "F0F7F2";

function P(parts, opts = {}) {
  const arr = Array.isArray(parts) ? parts : [{ text: parts }];
  return new Paragraph({
    bidirectional: true,
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: { after: 60, line: 280 },
    children: arr.map(r => new TextRun({
      text: r.text, rightToLeft: true, font: FONT,
      size: opts.size ?? 20, bold: r.bold, italics: r.italic, color: r.color,
    })),
  });
}

function H1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, bidirectional: true,
    alignment: AlignmentType.LEFT,
    spacing: { before: 180, after: 80 },
    children: [new TextRun({
      text, rightToLeft: true, font: FONT,
      size: 26, bold: true, color: COLOR_PRIMARY,
    })],
  });
}

function Bullet(parts, refName = "bullet-list") {
  const arr = Array.isArray(parts) ? parts : [{ text: parts }];
  return new Paragraph({
    numbering: { reference: refName, level: 0 },
    bidirectional: true, alignment: AlignmentType.LEFT,
    spacing: { after: 40, line: 260 },
    children: arr.map(r => new TextRun({
      text: r.text, rightToLeft: true, font: FONT,
      size: 20, bold: r.bold, color: r.color,
    })),
  });
}

const TB = { style: BorderStyle.SINGLE, size: 6, color: "BFD9C9" };
const CELL_BORDERS = { top: TB, bottom: TB, left: TB, right: TB };

function TC(text, opts = {}) {
  let align = opts.align ?? AlignmentType.LEFT;
  if (align === AlignmentType.RIGHT) align = AlignmentType.LEFT;
  return new TableCell({
    width: { size: opts.width ?? 2340, type: WidthType.DXA },
    borders: CELL_BORDERS,
    shading: opts.header
      ? { fill: COLOR_HEADER_FILL, type: ShadingType.CLEAR }
      : (opts.zebra ? { fill: COLOR_ZEBRA_FILL, type: ShadingType.CLEAR } : undefined),
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      bidirectional: true, alignment: align,
      spacing: { before: 20, after: 20 },
      children: [new TextRun({
        text, rightToLeft: true, font: FONT,
        size: opts.size ?? 18,
        bold: opts.bold ?? opts.header,
        color: opts.header ? "FFFFFF" : (opts.color ?? "000000"),
      })],
    })],
  });
}

function makeTable(rows, colWidths) {
  return new Table({
    columnWidths: colWidths,
    margins: { top: 50, bottom: 50, left: 100, right: 100 },
    visuallyRightToLeft: true,
    rows,
  });
}

const children = [];

// Title strip
children.push(
  new Paragraph({
    bidirectional: true, alignment: AlignmentType.LEFT,
    spacing: { before: 0, after: 80 },
    children: [new TextRun({
      text: "ملخص تنفيذي — استراتيجية منصة Sevent",
      rightToLeft: true, font: FONT, size: 32, bold: true, color: COLOR_PRIMARY,
    })],
  }),
  new Paragraph({
    bidirectional: true, alignment: AlignmentType.LEFT,
    spacing: { after: 160 },
    children: [new TextRun({
      text: "نموذج العمل، خارطة الطريق، والحماية من التسرب  |  29 أبريل 2026",
      rightToLeft: true, font: FONT, size: 18, italics: true, color: "555555",
    })],
  }),
);

// 1. Recommendation in one bullet block
children.push(H1("١. التوصية"));
children.push(
  Bullet([
    { text: "النموذج: ", bold: true, color: COLOR_PRIMARY },
    { text: "سوق عمودي متخصص مدعوم بطبقة SaaS — B2B بين منظمي الفعاليات والموردين." },
  ]),
  Bullet([
    { text: "نقطة الارتكاز: ", bold: true, color: COLOR_PRIMARY },
    { text: "المورد قبل المنظم. الأدوات أولًا، المعاملات تأتي تبعًا." },
  ]),
  Bullet([
    { text: "القطاع المستهدف: ", bold: true, color: COLOR_PRIMARY },
    { text: "الفعاليات المؤسسية والحكومية (إنفاق رؤية 2030، أقل تسرب)." },
  ]),
  Bullet([
    { text: "نتجنب: ", bold: true, color: COLOR_DANGER },
    { text: "سوق التذاكر للمستهلك (Eventbrite العربي). السوق مزدحم وهامشه رقيق." },
  ]),
);

// 2. Why Saudi
children.push(H1("٢. لماذا يناسب السوق السعودي"));
children.push(
  Bullet([
    { text: "فجوة رقمنة هائلة عند الموردين — ", bold: true },
    { text: "تموين، صوتيات، ديكور، تصوير يديرون أعمالهم على WhatsApp و Excel." },
  ]),
  Bullet([
    { text: "الثقة علاقاتية — ", bold: true },
    { text: "السوق المفتوح يفشل، نحتاج طبقة Managed خفيفة (تحقق سجل تجاري، تقييمات، ضمان دفع)." },
  ]),
  Bullet([
    { text: "إنفاق مؤسسي وحكومي ضخم — ", bold: true },
    { text: "يتطلب فواتير ZATCA وعقودًا. أدوات RFQ والبنود وضريبة 15% المبنية في Sevent تخدم هذا مباشرة." },
  ]),
);

// 3. Roadmap table
children.push(H1("٣. خارطة الطريق — ثلاث مراحل"));
const roadmapRows = [
  new TableRow({
    tableHeader: true,
    children: [
      TC("الإيراد", { header: true, width: 2200 }),
      TC("المنتج", { header: true, width: 4400 }),
      TC("النموذج", { header: true, width: 2400 }),
      TC("المرحلة", { header: true, width: 1600 }),
    ],
  }),
  new TableRow({ children: [
    TC("اشتراك شهري", { width: 2200, zebra: true }),
    TC("عروض أسعار، بورتفوليو، تقويم، فواتير ZATCA", { width: 4400, zebra: true }),
    TC("SaaS للموردين", { width: 2400, zebra: true, bold: true, color: COLOR_PRIMARY }),
    TC("١ — الآن", { width: 1600, zebra: true, bold: true }),
  ]}),
  new TableRow({ children: [
    TC("عمولة 8-15%", { width: 2200 }),
    TC("مطابقة عبر RFQ، تحقق هوية، ضمان دفع", { width: 4400 }),
    TC("Managed خفيف", { width: 2400, bold: true, color: COLOR_PRIMARY }),
    TC("٢ — 6-12 شهر", { width: 1600, bold: true }),
  ]}),
  new TableRow({ children: [
    TC("متعدد", { width: 2200, zebra: true }),
    TC("بيانات السوق، تمويل موردين، تأمين فعاليات", { width: 4400, zebra: true }),
    TC("Vertical Network", { width: 2400, zebra: true, bold: true, color: COLOR_PRIMARY }),
    TC("٣ — 18+ شهر", { width: 1600, zebra: true, bold: true }),
  ]}),
];
children.push(makeTable(roadmapRows, [2200, 4400, 2400, 1600]));
children.push(P(""));

// 4. Disintermediation defenses
children.push(H1("٤. الحماية من التسرب (Disintermediation)"));
children.push(
  P([
    { text: "الهدف ليس منع التسرب نهائيًا (مستحيل)، بل ", italic: true },
    { text: "جعل البقاء على المنصة أرخص من المغادرة.", bold: true, color: COLOR_PRIMARY },
  ]),
);

const defenseRows = [
  new TableRow({
    tableHeader: true,
    children: [
      TC("الفكرة", { header: true, width: 7800 }),
      TC("الدفاع", { header: true, width: 3200 }),
    ],
  }),
  new TableRow({ children: [
    TC("توليد فواتير متوافقة تلقائيًا. التعامل خارج المنصة يفرض على المورد بناء نظامه الخاص — حاجز قانوني وتقني فريد للسعودية.", { width: 7800, zebra: true }),
    TC("ZATCA كحاجز قانوني", { width: 3200, zebra: true, bold: true, color: COLOR_PRIMARY }),
  ]}),
  new TableRow({ children: [
    TC("الدفع محجوز حتى تنفيذ الفعالية. المنظم يحصل على حماية، والمورد يحصل على دفعة مقدمة مضمونة.", { width: 7800 }),
    TC("Escrow + مدى", { width: 3200, bold: true, color: COLOR_PRIMARY }),
  ]}),
  new TableRow({ children: [
    TC("معاملة أولى 15%، متكررة 5% أو صفر. يجعل البقاء عقلانيًا اقتصاديًا للمورد.", { width: 7800, zebra: true }),
    TC("عمولة عكسية للمتكرر", { width: 3200, zebra: true, bold: true, color: COLOR_PRIMARY }),
  ]}),
  new TableRow({ children: [
    TC("التقويم وقاعدة العملاء والبورتفوليو على Sevent. المغادرة تعني فقدان النظام التشغيلي بالكامل.", { width: 7800 }),
    TC("التقويم والبورتفوليو", { width: 3200, bold: true, color: COLOR_PRIMARY }),
  ]}),
  new TableRow({ children: [
    TC("فض نزاعات داخل المنصة، أسرع من المحاكم. ضمان استرداد. سجل معاملة موثق.", { width: 7800, zebra: true }),
    TC("حماية النزاعات", { width: 3200, zebra: true, bold: true, color: COLOR_PRIMARY }),
  ]}),
  new TableRow({ children: [
    TC("الجهات الحكومية والمؤسسية لا تستطيع التعامل خارج المنصة بسبب متطلبات الفوترة والعقود. أعراس واجتماعيات = تسرب مرتفع، نتجنبها.", { width: 7800 }),
    TC("التركيز المؤسسي", { width: 3200, bold: true, color: COLOR_PRIMARY }),
  ]}),
];
children.push(makeTable(defenseRows, [7800, 3200]));

// 5. Next step
children.push(H1("٥. الخطوة التالية"));
children.push(
  Bullet([
    { text: "استخراج بيانات الاستخدام الحالية للإجابة على: ", bold: true },
    { text: "نسبة المنظمين إلى الموردين، الميزة الأكثر استخدامًا، معدل الاحتفاظ لكل طرف." },
  ]),
  Bullet([
    { text: "بناء خارطة طريق تفصيلية للمرحلة الأولى ", bold: true },
    { text: "(SaaS للموردين) قبل أي توسعة في طبقة السوق." },
  ]),
  Bullet([
    { text: "الـ codebase الحالي (RFQ، بنود، VAT 15%، بورتفوليو) ", bold: true, color: COLOR_PRIMARY },
    { text: "يدعم المرحلة الأولى مباشرة — توسعة وتعميق، لا إعادة كتابة." },
  ]),
);

const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: 20 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, color: COLOR_PRIMARY, font: FONT, rightToLeft: true },
        paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 0,
          alignment: AlignmentType.LEFT, bidirectional: true } },
    ],
  },
  numbering: {
    config: [{
      reference: "bullet-list",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 600, hanging: 280 } } },
      }],
    }],
  },
  sections: [{
    properties: {
      page: {
        margin: { top: 900, right: 900, bottom: 900, left: 900 },
        pageNumbers: { start: 1, formatType: "decimal" },
      },
      rtlGutter: true,
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Sevent — ملخص تنفيذي   ", font: FONT, size: 16, color: "666666" }),
            new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16 }),
            new TextRun({ text: " / ", font: FONT, size: 16 }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 16 }),
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
    console.log(`Wrote ${OUT} (${buf.length} bytes)`);
  })
  .catch(err => { console.error(err); process.exit(1); });
