// Build an Arabic email reply as a .docx file.
// Run from D:\Mufeed\Sevent\Code:  node "Claude Docs/build_email_reply.js"

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, HeadingLevel, LevelFormat,
} = require("docx");
const JSZip = require("jszip");

const OUT = path.join(__dirname, "Reply-RFQ-RFP-Update.docx");
const FONT = "Calibri";
const COLOR_PRIMARY = "1F5132";

function P(text, opts = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: { after: 160, line: 360 },
    children: [new TextRun({
      text, rightToLeft: true, font: FONT,
      size: opts.size ?? 24, bold: opts.bold, color: opts.color,
    })],
  });
}

function H1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    bidirectional: true,
    alignment: AlignmentType.LEFT,
    spacing: { before: 240, after: 200 },
    children: [new TextRun({
      text, rightToLeft: true, font: FONT,
      size: 32, bold: true, color: COLOR_PRIMARY,
    })],
  });
}

function Bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullet-list", level: 0 },
    bidirectional: true,
    alignment: AlignmentType.LEFT,
    spacing: { after: 100, line: 340 },
    children: [new TextRun({ text, rightToLeft: true, font: FONT, size: 24 })],
  });
}

function Blank() { return new Paragraph({ children: [new TextRun("")] }); }

const children = [
  P("الموضوع: Re: متابعة العمل على المنصة", { bold: true, size: 26 }),
  Blank(),
  P("المهندس محمد المحترم،"),
  P("السلام عليكم ورحمة الله وبركاته،"),
  Blank(),
  P("شاكرًا لكم متابعتكم وتوجيهاتكم."),
  Blank(),
  P("بالنسبة لطلب RFQ و RFP، أودّ إفادتكم بأنه قد تم استكمال العمل عليهما اليوم على المنصة، بحيث:"),
  Bullet("يستطيع المنظِّم إنشاء طلب عرض سعر (RFQ) وطلب عرض فني (RFP) وإرساله للموردين المؤهَّلين."),
  Bullet("يقوم الموردون بتقديم عروضهم عبر المنصة مباشرة."),
  Bullet("يظهر للمنظِّم جدول مقارنة بين العروض المقدَّمة من الموردين الذين تقدّموا لتنفيذ الخدمة، لتسهيل المفاضلة بينهم."),
  Bullet("تتوقف الرحلة عند مرحلة ما قبل التعاقد كما تفضّلتم، على أن تُعالَج مرحلة التعاقد لاحقًا ضمن اجتماعات منفصلة."),
  Blank(),
  P("المنصة جاهزة للتجربة على الرابط:"),
  P("https://sevent.ahmadgh.ovh"),
  Blank(),
  P("وفي انتظار ملاحظات المهندس محمد الخليفة على تسجيل الموردين لاعتماد الإرسال إليهم."),
  Blank(),
  P("تحياتي،"),
  P("أحمد ربايعة"),
];

const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, color: COLOR_PRIMARY, font: FONT, rightToLeft: true },
        paragraph: {
          spacing: { before: 240, after: 200 }, outlineLevel: 0,
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
    ],
  },
  sections: [{
    properties: {
      page: {
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
      rtlGutter: true,
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
