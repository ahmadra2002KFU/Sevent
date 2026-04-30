// Generates an Arabic .docx report on platform business models for Sevent.
// Run from repo root: node "Claude Docs/scripts/build_business_models_ar.js"

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, LevelFormat, BorderStyle,
  WidthType, ShadingType, VerticalAlign, PageBreak, PageNumber,
  Footer,
} = require("docx");
const JSZip = require("jszip");

const OUT = path.join(__dirname, "..", "deliverables", "business-model", "نماذج-أعمال-منصات-الفعاليات.docx");
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

function PMixed(runs, opts = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: { after: 120, line: 360 },
    children: runs.map(r => new TextRun({
      text: r.text,
      rightToLeft: r.rtl !== false,
      font: FONT,
      size: opts.size ?? 24,
      bold: r.bold,
      color: r.color,
    })),
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
      text: "نماذج أعمال منصات الفعاليات",
      rightToLeft: true, font: FONT, size: 48, bold: true, color: COLOR_PRIMARY,
    })],
  }),
  new Paragraph({
    bidirectional: true, alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({
      text: "تحليل وتوصية استراتيجية لمنصة Sevent في السوق السعودي",
      rightToLeft: true, font: FONT, size: 28, color: "555555",
    })],
  }),
  new Paragraph({
    bidirectional: true, alignment: AlignmentType.CENTER,
    spacing: { before: 1200 },
    children: [new TextRun({
      text: "أعدّه: أحمد رباية", rightToLeft: true, font: FONT, size: 22,
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

// Intro
children.push(
  H1("مقدمة"),
  P("هذا التقرير يستعرض التصنيفات الرئيسية لنماذج أعمال المنصات الرقمية، مع أمثلة من قطاع الفعاليات بشكل خاص ومن قطاعات أخرى للمقارنة. الهدف ليس مجرد عرض النماذج، بل الوصول إلى توصية محددة للنموذج الأنسب لمنصة Sevent بناءً على خصائص السوق السعودي والوضع الحالي للمنتج. القرار في هذا الجانب يحدد الكثير من قرارات المنتج والهندسة والتسويق لاحقًا، لذا يستحق التحليل العميق قبل الالتزام بأي مسار."),
  PB(),
);

// Section 1: Models catalog
children.push(H1("الفصل الأول: تصنيفات نماذج المنصات"));

children.push(
  H2("1. السوق المفتوح (Open Marketplace)"),
  P("المنصة تربط البائع بالمشتري دون تدخل كبير في التسعير أو جودة العرض. دورها يقتصر على توفير البنية التحتية: قوائم، بحث، دفع، تقييمات."),
  P("أمثلة في الفعاليات: Eventbrite حيث يحدد المنظم كل شيء وتأخذ المنصة عمولة على كل تذكرة، و Meetup حيث تنظم المجتمعات لقاءاتها بحرية."),
  P("أمثلة أخرى من قطاعات مختلفة: Etsy و eBay و Fiverr."),
  P("العمولة عادة بين 2 و 10 بالمئة، والمنصة لا تتحمل مسؤولية جودة المنتج."),
);

children.push(
  H2("2. السوق المُدار (Managed Marketplace)"),
  P("المنصة تتحكم بالسعر أو الجودة أو المطابقة بشكل خوارزمي. تفرض معايير صارمة وتضمن تجربة موحدة للعميل."),
  P("أمثلة في الفعاليات: Classpass التي تشتري حصص لياقة بالجملة وتعيد بيعها بنموذج اشتراك، و Resy و OpenTable في الحجوزات حيث تتحكم المنصة بتجربة الحجز كاملة."),
  P("أمثلة أخرى: أوبر و DoorDash و Stitch Fix."),
  P("تأخذ هامشًا أعلى يتراوح بين 15 و 30 بالمئة لأنها تقدم قيمة أكبر من مجرد ربط الطرفين."),
);

children.push(
  H2("3. المُجمِّع (Aggregator)"),
  P("تجمع المنصة مخزونًا قائمًا أصلًا من مزودين مستقلين وتقدمه في واجهة موحدة. لا تخلق عرضًا جديدًا، بل تنظم العرض الموجود وتسهّل الوصول إليه."),
  P("أمثلة في الفعاليات: SeatGeek و StubHub اللذان يجمعان التذاكر من Ticketmaster ومن البائعين الثانويين، و Songkick الذي يجمع جداول الحفلات من مصادر متعددة."),
  P("أمثلة أخرى: Booking و Kayak و Skyscanner و Google Shopping."),
  P("نموذج الإيرادات غالبًا عمولة عالية أو رسوم إدراج."),
);

children.push(
  H2("4. البائع المباشر بقناع منصة (First-party)"),
  P("تبدو كمنصة لكنها فعليًا تشتري وتبيع. تتحمل مخاطر المخزون لكنها تتحكم بالهامش بشكل كامل."),
  P("أمثلة في الفعاليات: Ticketmaster كشريك حصري لمعظم القاعات، و DICE التي تتعاقد مباشرة مع الفنانين."),
  P("أمثلة أخرى: قسم Retail في أمازون وليس Marketplace، و Zalando و Net-a-Porter."),
);

children.push(
  H2("5. منصة الإدارة (SaaS-enabled Marketplace)"),
  P("تبيع المنصة أداة إدارة للبائع أولًا، ثم تستفيد من القاعدة المتراكمة لبناء طبقة سوق فوقها. هذا النموذج صاعد جدًا وكثيرًا ما يهزم المنصات التقليدية."),
  P("أمثلة في الفعاليات: Cvent لإدارة المؤتمرات للشركات ثم سوق للقاعات والموردين، و Splash، و Hopin سابقًا."),
  P("أمثلة أخرى: Shopify كأداة متجر ثم Shop App، و Toast كنقاط بيع للمطاعم ثم Toast Tables."),
  P("ميزة هذا النموذج أن البائع يصبح مرتبطًا بالأداة، فلا يستطيع المغادرة بسهولة كما في المنصات المفتوحة."),
);

children.push(
  H2("6. منصة الاكتشاف بدون معاملة (Discovery)"),
  P("تعرض الخيارات وتحوّل العميل لإتمام المعاملة خارج المنصة. تكسب من الإعلانات أو من رسوم العملاء المحتملين."),
  P("أمثلة في الفعاليات: The Knot و WeddingWire كدليل لمزودي خدمات الأعراس، و Bandsintown لاكتشاف الحفلات بدون بيع تذاكر مباشرة."),
  P("أمثلة أخرى: Yelp و Zillow في معظم الأسواق و TripAdvisor."),
);

children.push(
  H2("7. منصة المزاد (Auction-based)"),
  P("السعر يُحدد ديناميكيًا عبر العرض والطلب اللحظي، وليس ثابتًا."),
  P("أمثلة في الفعاليات: Lyte للمزاد على التذاكر النادرة، وتذاكر بعض النوادي الرياضية."),
  P("أمثلة أخرى: eBay الأصلي و Sotheby's و Google Ads و Christie's."),
);

children.push(
  H2("8. السوق العمودي المتخصص (Vertical Marketplace)"),
  P("يخدم فئة واحدة بعمق، مع أدوات وميزات مفصّلة للقطاع."),
  P("أمثلة في الفعاليات: GigSalad للحفلات الخاصة، و The Bash لحجز فناني الحفلات، و Headout للأنشطة السياحية."),
  P("أمثلة أخرى: Houzz للتصميم الداخلي و Reverb للآلات الموسيقية."),
  P("غالبًا تنافس المنصات الأفقية الكبرى بتقديم خدمة مخصصة جدًا."),
);

children.push(
  H2("9. منصة الاشتراك (Subscription Marketplace)"),
  P("المستهلك يدفع رسمًا شهريًا للوصول لمكتبة من المخزون، بدلًا من الدفع لكل معاملة."),
  P("أمثلة في الفعاليات: Classpass، و MoviePass سابقًا، وبعض اشتراكات المتاحف الموسمية."),
  P("أمثلة أخرى: Netflix للمحتوى، و Costco في نموذج رسوم العضوية."),
);

children.push(PB());

// Models comparison table
children.push(
  H1("الفصل الثاني: ملخص مقارن للنماذج"),
  P("الجدول التالي يلخّص النماذج التسعة من حيث طبيعة التحكم ومستوى الهامش ومدى ملاءمة كل منها لمنصة فعاليات في السوق السعودي:"),
);

const compareRows = [
  new TableRow({
    tableHeader: true,
    children: [
      TC("الملاءمة للسعودية", { header: true, width: 2400 }),
      TC("الهامش", { header: true, width: 1600 }),
      TC("مستوى التحكم", { header: true, width: 2200 }),
      TC("النموذج", { header: true, width: 2400 }),
    ],
  }),
  new TableRow({ children: [
    TC("متوسطة", { width: 2400, zebra: true }),
    TC("منخفض", { width: 1600, zebra: true }),
    TC("منخفض", { width: 2200, zebra: true }),
    TC("السوق المفتوح", { width: 2400, zebra: true }),
  ]}),
  new TableRow({ children: [
    TC("عالية", { width: 2400 }),
    TC("مرتفع", { width: 1600 }),
    TC("مرتفع", { width: 2200 }),
    TC("السوق المُدار", { width: 2400 }),
  ]}),
  new TableRow({ children: [
    TC("منخفضة", { width: 2400, zebra: true }),
    TC("متوسط", { width: 1600, zebra: true }),
    TC("منخفض", { width: 2200, zebra: true }),
    TC("المُجمِّع", { width: 2400, zebra: true }),
  ]}),
  new TableRow({ children: [
    TC("منخفضة", { width: 2400 }),
    TC("مرتفع", { width: 1600 }),
    TC("كامل", { width: 2200 }),
    TC("البائع المباشر", { width: 2400 }),
  ]}),
  new TableRow({ children: [
    TC("عالية جدًا", { width: 2400, zebra: true, bold: true, color: COLOR_PRIMARY }),
    TC("مرتفع", { width: 1600, zebra: true }),
    TC("متوسط إلى مرتفع", { width: 2200, zebra: true }),
    TC("SaaS-enabled", { width: 2400, zebra: true, bold: true, color: COLOR_PRIMARY }),
  ]}),
  new TableRow({ children: [
    TC("متوسطة", { width: 2400 }),
    TC("منخفض", { width: 1600 }),
    TC("منخفض", { width: 2200 }),
    TC("الاكتشاف", { width: 2400 }),
  ]}),
  new TableRow({ children: [
    TC("منخفضة", { width: 2400, zebra: true }),
    TC("متغير", { width: 1600, zebra: true }),
    TC("متوسط", { width: 2200, zebra: true }),
    TC("المزاد", { width: 2400, zebra: true }),
  ]}),
  new TableRow({ children: [
    TC("عالية", { width: 2400 }),
    TC("متغير", { width: 1600 }),
    TC("متغير", { width: 2200 }),
    TC("السوق العمودي", { width: 2400 }),
  ]}),
  new TableRow({ children: [
    TC("متوسطة", { width: 2400, zebra: true }),
    TC("متوسط", { width: 1600, zebra: true }),
    TC("مرتفع", { width: 2200, zebra: true }),
    TC("الاشتراك", { width: 2400, zebra: true }),
  ]}),
];
children.push(makeTable(compareRows, [2400, 1600, 2200, 2400]));
children.push(PB());

// Section: How to choose
children.push(
  H1("الفصل الثالث: كيف تختار النموذج المناسب"),
  P("السؤال الحاسم هو ما الذي يصعب على المنظم فعله بنفسه. إذا كان التحدي الأكبر هو الوصول للجمهور فنموذج السوق المفتوح كافٍ. أما إذا كانت الجودة متفاوتة جدًا والمستهلك يحتاج ضمانة فالنموذج المُدار أفضل. وإذا كان السوق مجزّأ بمزودين صغار يفتقدون لأدوات احترافية فنموذج SaaS-enabled هو الأقوى استراتيجيًا لأنه يخلق حاجزًا عاليًا أمام المنافسين."),
  P("نقطة مهمة: كثير من المنصات الناجحة تبدأ بنموذج وتتطور لآخر. أوبر بدأت سوقًا ثم أصبحت مُدارة. Shopify بدأت SaaS ثم بنت Shop. هذا التحول طبيعي مع نضج المنصة، والمهم أن يكون الانتقال مدروسًا وليس مبكرًا أو متأخرًا."),
  PB(),
);

// Section: Recommendation for Sevent
children.push(
  H1("الفصل الرابع: التوصية لـ Sevent في السوق السعودي"),
  P("بناءً على ما أراه في الـ codebase الحالي من نظام طلبات عروض الأسعار (RFQ) والبنود وإدارة الموردين وعروض الأسعار والبورتفوليو وضريبة القيمة المضافة 15 بالمئة، فإن Sevent تتجه فعليًا نحو نموذج سوق عمودي متخصص مدعوم بطبقة SaaS للسوق B2B بين منظمي الفعاليات والموردين. هذا أقوى نموذج للسوق السعودي تحديدًا، وفيما يلي تفصيل الأسباب."),

  H2("لماذا SaaS-enabled هو الأنسب للسعودية"),
  P("السوق السعودي له ثلاث خصائص حاسمة تجعل هذا النموذج يفوز:"),

  H3("1. فجوة الرقمنة عند الموردين هائلة"),
  P("معظم موردي الفعاليات في المملكة من تموين وصوتيات وديكور وتصوير يديرون أعمالهم عبر WhatsApp و Excel وأوراق. لا يملكون CRM ولا تقاويم حجوزات ولا أنظمة عروض أسعار احترافية. هذا يعني أن أي أداة احترافية تقدمها لهم تخلق قيمة فورية حتى قبل أن يأتي عميل واحد من المنصة. هذا هو المدخل الصحيح: ادخل كأداة، تحوّل لسوق."),

  H3("2. الثقة في السعودية علاقاتية"),
  P("نموذج السوق المفتوح على غرار Eventbrite لا يعمل في B2B السعودي لأن المنظم لا يحجز موردًا لم يتعامل معه أحد يثق به. لذا تحتاج طبقة Managed خفيفة فوق الـ SaaS تشمل التحقق من السجل التجاري وتقييمات موثقة وضمان دفع. لكن لا تذهب لـ Managed Marketplace الكامل من البداية لأنه مكلف ولا يقبل التوسع السريع."),

  H3("3. رؤية 2030 والإنفاق الحكومي والمؤسسي"),
  P("السوق الحقيقي ليس الأعراس فقط، بل الفعاليات المؤسسية والحكومية التي تحتاج فواتير ضريبية وعقودًا وتتبعًا منظمًا. الأدوات الـ B2B التي بنيتها (RFQ والبنود وضريبة القيمة المضافة) تخدم هذا السوق مباشرة، وهذا الإنفاق هو الأكبر والأكثر استدامة في السوق السعودي حاليًا."),
  PB(),
);

// Section: Trap to avoid
children.push(
  H1("الفصل الخامس: الفخ الذي يجب تجنبه"),
  P("أكبر خطأ ممكن هو محاولة بناء سوق تذاكر للمستهلك (نسخة عربية من Eventbrite). هذا فخ لأسباب واضحة:"),
  Bullet("Eventbrite و Platinumlist و Webook موجودون أصلًا في السوق."),
  Bullet("الهامش رقيق جدًا، بين 2 و 5 بالمئة على التذكرة."),
  Bullet("لا يوجد lock-in حقيقي، فالمنظم يستطيع المغادرة في أي لحظة."),
  Bullet("لا تُبنى عليه قيمة طويلة المدى ولا حاجز دفاعي ضد المنافسين."),
  P("Sevent ليست في هذا السوق، والكود الحالي يقول ذلك بوضوح: نظام RFQ لا يساوي نظام تذاكر، وبنية قاعدة البيانات تعكس B2B لا B2C."),
  PB(),
);

// Section: Specific recommendation with table
children.push(
  H1("الفصل السادس: التوصية المحددة"),
  P("نموذج هجين بثلاث طبقات، يُبنى تدريجيًا حسب الجدول التالي:"),
);

const phaseRows = [
  new TableRow({
    tableHeader: true,
    children: [
      TC("الإيراد", { header: true, width: 2400 }),
      TC("المنتج", { header: true, width: 3600 }),
      TC("النموذج", { header: true, width: 2200 }),
      TC("المرحلة", { header: true, width: 1400 }),
    ],
  }),
  new TableRow({ children: [
    TC("اشتراك شهري", { width: 2400, zebra: true }),
    TC("أداة عروض أسعار وبورتفوليو وتقويم وفواتير ضريبية", { width: 3600, zebra: true }),
    TC("SaaS للموردين", { width: 2200, zebra: true }),
    TC("1 (الآن)", { width: 1400, zebra: true, bold: true }),
  ]}),
  new TableRow({ children: [
    TC("عمولة 8 إلى 15 بالمئة", { width: 2400 }),
    TC("مطابقة موردين بمنظمين عبر RFQ، تحقق هوية، ضمان دفع", { width: 3600 }),
    TC("Managed خفيف", { width: 2200 }),
    TC("2 (6-12 شهر)", { width: 1400, bold: true }),
  ]}),
  new TableRow({ children: [
    TC("متعدد المصادر", { width: 2400, zebra: true }),
    TC("بيانات السوق، تمويل موردين، تأمين فعاليات", { width: 3600, zebra: true }),
    TC("Vertical Network", { width: 2200, zebra: true }),
    TC("3 (18+ شهر)", { width: 1400, zebra: true, bold: true }),
  ]}),
];
children.push(makeTable(phaseRows, [2400, 3600, 2200, 1400]));

children.push(
  H2("نقطة الارتكاز: المورد قبل المنظم"),
  P("العميل المرجعي يجب أن يكون المورد لا المنظم. لأن المنظم يمشي خلف الموردين الجيدين، والعكس أبطأ بكثير. هذه القاعدة مأخوذة من تجارب Shopify و Toast و ServiceTitan وغيرها من المنصات الناجحة. ابدأ بحل مشكلة حقيقية لمورد واحد، ثم ضاعف عدد الموردين، ثم اجلب المنظمين تلقائيًا لأن الموردين الجيدين يجذبون الطلب."),
  PB(),
);

// Section: Verification questions
children.push(
  H1("الفصل السابع: التحقق قبل الالتزام"),
  P("قبل أي تغيير جوهري في الـ codebase أو في الاستراتيجية، يجب التحقق من ثلاثة أسئلة بناءً على بيانات فعلية وليس افتراضات:"),
  Bullet("هل المستخدمون الحاليون في Sevent منظمون أم موردون أم الاثنان؟ ما هي النسبة بينهم؟"),
  Bullet("ما الميزة التي يستخدمونها أكثر اليوم؟ هذا يكشف نقطة الارتكاز الفعلية للمنتج."),
  Bullet("ما معدل الاحتفاظ للمورد مقابل المنظم؟ من يبقى أطول هو الجانب الذي يجب الاستثمار فيه أولًا."),
  P("الإجابة على هذه الأسئلة الثلاثة تحدد ما إذا كانت التوصية أعلاه تنطبق كما هي، أم تحتاج تعديلًا في ترتيب المراحل أو في التركيز."),
  PB(),
);

// Closing
children.push(
  H1("خلاصة"),
  P("النموذج الموصى به لمنصة Sevent هو سوق عمودي متخصص مدعوم بطبقة SaaS للموردين، مع طبقة Managed خفيفة تنمو تدريجيًا. هذا النموذج يستفيد من فجوة الرقمنة في السوق السعودي، ويتماشى مع الطبيعة العلاقاتية للأعمال، ويستهدف الإنفاق المؤسسي والحكومي المتنامي ضمن رؤية 2030. الـ codebase الحالي يدعم هذا الاتجاه بالفعل، ولا يحتاج إعادة كتابة بل توسعة وتعميقًا للأدوات الموجودة."),
  P("الخطوة التالية المقترحة: مراجعة بيانات الاستخدام الحالية للإجابة على أسئلة التحقق، ثم بناء خارطة طريق تفصيلية لمرحلة الـ SaaS أولًا قبل الانتقال لطبقة السوق."),
);

// Document assembly
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
