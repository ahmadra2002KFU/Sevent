// Generates an Arabic .docx answering the supervisor's disintermediation question.
// Run from repo root: node "Claude Docs/scripts/build_disintermediation_ar.js"

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, LevelFormat, BorderStyle,
  WidthType, ShadingType, VerticalAlign, PageBreak, PageNumber,
  Footer,
} = require("docx");
const JSZip = require("jszip");

const OUT = path.join(__dirname, "..", "deliverables", "business-model", "حماية-المنصة-من-التسرب.docx");
const FONT = "Calibri";
const COLOR_PRIMARY = "1F5132";
const COLOR_ACCENT = "2C7A4B";
const COLOR_HEADER_FILL = "2C7A4B";
const COLOR_ZEBRA_FILL = "F0F7F2";

function P(text, opts = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: { after: 120, line: 360 },
    ...(opts.indent && { indent: opts.indent }),
    children: [new TextRun({
      text, rightToLeft: true, font: FONT,
      size: opts.size ?? 24, bold: opts.bold, color: opts.color,
    })],
  });
}

function H1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, bidirectional: true,
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
    heading: HeadingLevel.HEADING_2, bidirectional: true,
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
    heading: HeadingLevel.HEADING_3, bidirectional: true,
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
    bidirectional: true, alignment: AlignmentType.LEFT,
    spacing: { after: 80 },
    children: [new TextRun({ text, rightToLeft: true, font: FONT, size: 24 })],
  });
}

function PB() { return new Paragraph({ children: [new PageBreak()] }); }

const TB = { style: BorderStyle.SINGLE, size: 6, color: "BFD9C9" };
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
      bidirectional: true, alignment: align,
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

const children = [];

// Cover
children.push(
  new Paragraph({
    bidirectional: true, alignment: AlignmentType.CENTER,
    spacing: { before: 1200, after: 200 },
    children: [new TextRun({
      text: "كيف نحمي المنصة من التسرب؟",
      rightToLeft: true, font: FONT, size: 44, bold: true, color: COLOR_PRIMARY,
    })],
  }),
  new Paragraph({
    bidirectional: true, alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({
      text: "ردًا على سؤال المشرف: ما الذي يمنع المنظم والمورد من التعامل المباشر خارج المنصة؟",
      rightToLeft: true, font: FONT, size: 24, color: "555555",
    })],
  }),
  new Paragraph({
    bidirectional: true, alignment: AlignmentType.CENTER,
    spacing: { before: 1200 },
    children: [new TextRun({
      text: "Sevent — استراتيجية المنصة", rightToLeft: true, font: FONT, size: 22,
    })],
  }),
  new Paragraph({
    bidirectional: true, alignment: AlignmentType.CENTER,
    children: [new TextRun({
      text: "29 أبريل 2026", rightToLeft: true, font: FONT, size: 22, color: "555555",
    })],
  }),
  PB(),
);

// Section 1: Honest reality
children.push(
  H1("أولًا: الواقع الصريح"),
  P("سؤال المشرف هو السؤال الوجودي لأي منصة B2B Marketplace في العالم، ويستحق إجابة صادقة وليس عامة. ظاهرة التعامل المباشر خارج المنصة، أو ما يُعرف بـ Disintermediation، هي التهديد الأكبر لأي سوق رقمي يربط طرفين، وليست خاصية فريدة بسوق Sevent."),
  P("سوق الفعاليات في السعودية تحديدًا يجمع الخصائص الثلاث الأكثر خطورة لظاهرة التسرب:"),
  Bullet("قيمة المعاملة عالية: ميزانية فعالية واحدة قد تتراوح من 50 ألف إلى 500 ألف ريال أو أكثر."),
  Bullet("التكرار منخفض: المنظم قد يستخدم نفس المورد مرتين إلى أربع مرات في السنة فقط."),
  Bullet("العلاقات شخصية وعلاقاتية، خصوصًا في السوق السعودي حيث الثقة تُبنى وجهًا لوجه."),
  P("أي شركة منصات تدّعي أن منتجها محمي تمامًا من التسرب تكذب. منصات عالمية مثل Upwork و Thumbtack تخسر بين 30 و 50 بالمئة من المعاملات المتكررة خارج المنصة بعد التعارف الأول. السؤال الصحيح إذًا ليس \"كيف نمنع التسرب نهائيًا\" لأن هذا مستحيل، بل \"كيف نجعل البقاء على المنصة هو الخيار الأرخص والأسهل لكلا الطرفين\"."),
  PB(),
);

// Section 2: Why SaaS solves it structurally
children.push(
  H1("ثانيًا: لماذا نموذج SaaS-enabled يحلّ المشكلة هيكليًا"),
  P("هنا تكمن العبقرية الاستراتيجية لاختيار النموذج. لو كانت Sevent سوقًا مفتوحًا على غرار Eventbrite، لكان التسرب يقتل المنصة، لأن إيرادها الوحيد هو عمولة المعاملة. أما لأننا اخترنا نموذج SaaS-enabled، فالصورة تختلف جوهريًا، كما يوضح الجدول التالي:"),
);

const scenarioRows = [
  new TableRow({
    tableHeader: true,
    children: [
      TC("هل المنصة تخسر؟", { header: true, width: 2400 }),
      TC("إيراد المنصة", { header: true, width: 3000 }),
      TC("الحالة", { header: true, width: 4200 }),
    ],
  }),
  new TableRow({ children: [
    TC("ربح كامل", { width: 2400, zebra: true, color: COLOR_PRIMARY, bold: true }),
    TC("اشتراك شهري + عمولة", { width: 3000, zebra: true }),
    TC("مورد ومنظم تعارفا عبر Sevent ودفعا عبر المنصة", { width: 4200, zebra: true }),
  ]}),
  new TableRow({ children: [
    TC("ربح جزئي مازال موجودًا", { width: 2400, color: COLOR_ACCENT }),
    TC("اشتراك شهري فقط", { width: 3000 }),
    TC("تعارفا عبر Sevent لكن دفعا خارجها", { width: 4200 }),
  ]}),
  new TableRow({ children: [
    TC("ربح", { width: 2400, zebra: true, color: COLOR_ACCENT }),
    TC("اشتراك شهري", { width: 3000, zebra: true }),
    TC("مورد يستخدم Sevent لإدارة عملائه القدامى المباشرين", { width: 4200, zebra: true }),
  ]}),
];
children.push(makeTable(scenarioRows, [2400, 3000, 4200]));

children.push(
  P("النقطة الحاسمة: المورد يدفع اشتراكًا شهريًا للأداة التي تشمل نظام عروض الأسعار والتقويم والبورتفوليو وفواتير ZATCA، سواء جاءه العميل من المنصة أو من علاقاته الشخصية. هذا بالضبط ما فعلته Shopify و Toast و ServiceTitan في أسواقها. هم يبيعون \"المعاول والجاروف\" لا الذهب نفسه. لذا حتى لو حدث تسرب بنسبة 50 بالمئة من المعاملات، فالمنصة لا تموت، بل تستمر في تحقيق إيراد مستقر من الاشتراكات."),
  PB(),
);

// Section 3: Tactical defenses
children.push(H1("ثالثًا: الدفاعات التكتيكية المحددة لـ Sevent"));
children.push(P("بالإضافة إلى الحماية الهيكلية التي يوفرها نموذج SaaS-enabled، هناك ست ميزات عملية يجب بناؤها لتقليل التسرب فعليًا:"));

children.push(
  H2("1. ZATCA كحاجز قانوني (الأقوى في السعودية)"),
  P("الفوترة الإلكترونية إلزامية للتعاملات بين الشركات في المملكة منذ 2023. أي شركة منظمة فعاليات تتعامل مع جهة حكومية أو مؤسسية يجب أن تستلم فاتورة ضريبية متوافقة مع نظام ZATCA. منصة Sevent تولّد هذه الفواتير تلقائيًا عند قبول عرض السعر، أما التعامل خارج المنصة فيعني أن المورد يجب أن يبني نظامه الخاص للفوترة الإلكترونية، وهذا حاجز تقني وقانوني هائل لا يستطيع معظم الموردين الصغار تجاوزه."),
  P("هذا أقوى دفاع لدينا، وهو فريد للسوق السعودي. لا توجد منصة عالمية تستطيع توفيره بنفس الكفاءة."),
);

children.push(
  H2("2. الدفع عبر المنصة مع ضمان (Escrow)"),
  P("الفكرة هي جعل الدفع عبر المنصة هو الطريق الأسهل، وليس فقط الأرخص. هذا يحقق ثلاث فوائد متراكبة:"),
  Bullet("الفعالية تحدث مرة واحدة، ولا توجد فرصة ثانية إذا لم يأتِ المورد. نظام الـ Escrow يحمي المنظم من خسارة كاملة."),
  Bullet("المورد يحصل على دفعة مقدمة مضمونة، وهذا يحلّ مشكلة رأس المال العامل لمعظم الموردين الصغار."),
  Bullet("التحويل البنكي السعودي عبر SARIE يأخذ وقتًا وله رسوم. الدفع عبر المنصة عبر مدى يكون فوريًا وأرخص."),
);

children.push(
  H2("3. عمولة عكسية على العملاء المتكررين"),
  P("هنا تخطئ معظم المنصات: تفرض نفس العمولة على العميل المتكرر، فيهرب المورد خارج المنصة بعد المعاملة الأولى لأنها تصبح مكلفة. الصحيح استراتيجيًا هو العكس تمامًا:"),
  Bullet("معاملة أولى مع عميل جديد: عمولة 15 بالمئة (لأن المنصة دفعت تكلفة اكتسابه)."),
  Bullet("معاملة متكررة لنفس العميل: عمولة 5 بالمئة أو حتى صفر."),
  P("هذا التكتيك المعكوس يجعل البقاء على المنصة عقلانيًا اقتصاديًا للمورد، لأن تكلفتنا الحقيقية، وهي اكتساب العميل، دُفعت أصلًا في المعاملة الأولى. فلا داعي لمعاقبة المورد على الاحتفاظ بالعميل."),
);

children.push(
  H2("4. التقويم والبورتفوليو كنقطة احتكاك"),
  P("تقويم المورد ومعرض أعماله وقاعدة عملائه السابقين كلها على Sevent. حتى للعملاء المباشرين، يفضّل المورد إضافتهم على المنصة لأن \"هنا أحتفظ بسجلاتي وأعرف ما لي وما عليّ\". هذا هو نفس مبدأ Shopify: حتى لو جاء العميل من إعلان فيسبوك، الطلب يُسجَّل على Shopify لأن المخزون والشحن والمحاسبة هناك."),
  P("بمجرد أن يصبح Sevent هو السجل الأساسي للمورد، تصبح المغادرة مكلفة جدًا لأنها تعني فقدان كل البيانات التاريخية."),
);

children.push(
  H2("5. حماية النزاعات (مهم في السوق السعودي)"),
  P("في المملكة، التقاضي بطيء ومكلف، ومعظم النزاعات بين الموردين والمنظمين تُحلّ بالواسطة أو لا تُحلّ. منصة Sevent تقدم بديلًا قويًا:"),
  Bullet("آلية فض النزاعات داخل المنصة تكون أسرع وأقل تكلفة."),
  Bullet("شهادات معاملة موثقة رقميًا تُثبت ما تم وما لم يتم."),
  Bullet("ضمان استرداد إذا لم يلتزم المورد بالاتفاق."),
  P("المنظم الذكي يفضّل التعامل عبر المنصة لأنه يعرف أن لديه شبكة أمان قانونية. التعامل المباشر يعني الاعتماد على واسطة شخصية أو محكمة بطيئة."),
);

children.push(
  H2("6. التركيز على القطاع المؤسسي والحكومي أولًا"),
  P("التسرب يختلف بشكل جذري بين القطاعات، ومن المهم أن نوجّه تركيز المنصة للقطاع الأقل تسربًا:"),
);

const sectorRows = [
  new TableRow({
    tableHeader: true,
    children: [
      TC("السبب", { header: true, width: 4800 }),
      TC("مستوى التسرب", { header: true, width: 2400 }),
      TC("القطاع", { header: true, width: 2400 }),
    ],
  }),
  new TableRow({ children: [
    TC("شخصي، علاقاتي، يحدث مرة واحدة في حياة العميل عادة", { width: 4800, zebra: true }),
    TC("مرتفع جدًا", { width: 2400, zebra: true, color: "B91C1C" }),
    TC("الأعراس والاجتماعيات", { width: 2400, zebra: true }),
  ]}),
  new TableRow({ children: [
    TC("يتطلب إجراءات وعقود وتدقيق وفواتير ZATCA", { width: 4800 }),
    TC("منخفض", { width: 2400, color: COLOR_PRIMARY, bold: true }),
    TC("الجهات المؤسسية والحكومية", { width: 2400, bold: true }),
  ]}),
];
children.push(makeTable(sectorRows, [4800, 2400, 2400]));

children.push(P("التوصية الواضحة: ركّز على الجهات التي لا تستطيع التعامل خارج المنصة بسبب متطلباتها الإدارية والقانونية. هذا هو قطاع رؤية 2030 الفعلي، وهو أيضًا الأكبر إنفاقًا والأكثر استدامة."));
children.push(PB());

// Section 4: Honest acknowledgment
children.push(
  H1("رابعًا: الاعتراف الصادق بما لا نستطيع منعه"),
  P("من الأمانة المهنية الاعتراف بأن هناك حالات تسرب لا نستطيع منعها بأي تكتيك:"),
  Bullet("مورد قابل عميلًا في حفل افتتاح وأخذ بطاقته الشخصية، وسيتعامل معه مباشرة. لا توجد منصة في العالم تمنع هذا النوع من اللقاءات الميدانية."),
  Bullet("علاقات قائمة بين الموردين والمنظمين قبل دخول المنصة. هؤلاء لن يدخلوا المنصة على الإطلاق ولا فائدة من محاولة جذبهم."),
  Bullet("معاملات صغيرة جدًا أقل من 10 آلاف ريال. هذه لا تستحق الإجراءات الرسمية للمنصة، ولا يجب أن نستهدفها."),
  P("لكن هذه الحالات ليست في الواقع \"خسائر\" لـ Sevent، لأنها لم تكن لتأتي للمنصة أصلًا. السوق المستهدف هو المعاملات التي تستفيد من البنية التحتية للمنصة، وليس كل معاملة فعاليات في المملكة."),
  PB(),
);

// Closing
children.push(
  H1("الخلاصة"),
  P("هدف المنصة ليس منع التسرب نهائيًا، لأن هذا مستحيل في أي سوق B2B في العالم. الهدف الواقعي هو جعل التسرب غير مجدٍ اقتصاديًا لكلا الطرفين. هذا يتحقق عبر أربعة عناصر متكاملة:"),
  Bullet("اشتراك SaaS الذي يبقى يدفعه المورد بغض النظر عن مصدر العميل."),
  Bullet("عمولة منخفضة على المعاملات المتكررة لتحفيز البقاء بدلًا من المغادرة."),
  Bullet("حاجز ZATCA القانوني الذي يجعل التعامل خارج المنصة مكلفًا تقنيًا."),
  Bullet("نظام دفع آمن مع Escrow يحمي الطرفين ويسرّع تدفق الأموال."),
  P("بهذه العناصر مجتمعة، الطرفان يبقيان على المنصة لأن البقاء أرخص وأقل مخاطرة من المغادرة. هذا هو المعيار الذي تقاس به المنصات الناجحة عالميًا، وهو الذي يجب أن نقيس به Sevent."),
);

const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, color: COLOR_PRIMARY, font: FONT, rightToLeft: true },
        paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0,
          alignment: AlignmentType.LEFT, bidirectional: true },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, color: COLOR_ACCENT, font: FONT, rightToLeft: true },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1,
          alignment: AlignmentType.LEFT, bidirectional: true },
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, color: "000000", font: FONT, rightToLeft: true },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2,
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
