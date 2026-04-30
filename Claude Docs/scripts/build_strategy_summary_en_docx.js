// English consolidated Word report summarizing all platform-strategy discussion.
// Run: node "Claude Docs/scripts/build_strategy_summary_en_docx.js"

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, LevelFormat, BorderStyle,
  WidthType, ShadingType, VerticalAlign, PageBreak, PageNumber,
  Footer,
} = require("docx");

const OUT = path.join(__dirname, "..", "deliverables", "business-model", "Sevent-Strategy-Report.docx");
const FONT = "Calibri";
const COLOR_PRIMARY = "1F5132";
const COLOR_ACCENT = "2C7A4B";
const COLOR_DANGER = "B91C1C";
const COLOR_HEADER_FILL = "2C7A4B";
const COLOR_ZEBRA_FILL = "F0F7F2";

function P(parts, opts = {}) {
  const runs = (Array.isArray(parts) ? parts : [{ text: parts }]).map(r => new TextRun({
    text: r.text, font: FONT, size: opts.size ?? 22,
    bold: r.bold, italics: r.italic, color: r.color,
  }));
  return new Paragraph({
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: { after: 100, line: 320 },
    children: runs,
  });
}

function H1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 200 },
    children: [new TextRun({ text, font: FONT, size: 32, bold: true, color: COLOR_PRIMARY })],
  });
}
function H2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 140 },
    children: [new TextRun({ text, font: FONT, size: 26, bold: true, color: COLOR_ACCENT })],
  });
}

function Bullet(parts, refName = "bullet-list") {
  const runs = (Array.isArray(parts) ? parts : [{ text: parts }]).map(r => new TextRun({
    text: r.text, font: FONT, size: 22,
    bold: r.bold, italics: r.italic, color: r.color,
  }));
  return new Paragraph({
    numbering: { reference: refName, level: 0 },
    spacing: { after: 70 },
    children: runs,
  });
}

function PB() { return new Paragraph({ children: [new PageBreak()] }); }

const TB = { style: BorderStyle.SINGLE, size: 6, color: "BFD9C9" };
const CELL_BORDERS = { top: TB, bottom: TB, left: TB, right: TB };

function TC(text, opts = {}) {
  return new TableCell({
    width: { size: opts.width ?? 2340, type: WidthType.DXA },
    borders: CELL_BORDERS,
    shading: opts.header
      ? { fill: COLOR_HEADER_FILL, type: ShadingType.CLEAR }
      : (opts.zebra ? { fill: COLOR_ZEBRA_FILL, type: ShadingType.CLEAR } : undefined),
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: opts.align ?? AlignmentType.LEFT,
      spacing: { before: 40, after: 40 },
      children: [new TextRun({
        text, font: FONT, size: opts.size ?? 20,
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
    rows,
  });
}

const children = [];

// ===== Cover =====
children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 1400, after: 200 },
    children: [new TextRun({
      text: "Sevent Platform Strategy",
      font: FONT, size: 48, bold: true, color: COLOR_PRIMARY,
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({
      text: "Business Model, Roadmap, and Defense Against Disintermediation",
      font: FONT, size: 26, color: "555555",
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 1200 },
    children: [new TextRun({ text: "Ahmad Rabaya", font: FONT, size: 22, bold: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "29 April 2026", font: FONT, size: 20, color: "555555" })],
  }),
  PB(),
);

// ===== Executive Summary =====
children.push(
  H1("Executive Summary"),
  Bullet([
    { text: "Recommended model: ", bold: true, color: COLOR_PRIMARY },
    { text: "SaaS-enabled Vertical Marketplace, B2B (organizer ↔ supplier)." },
  ]),
  Bullet([
    { text: "Anchor customer: ", bold: true, color: COLOR_PRIMARY },
    { text: "the supplier, not the organizer. Tools first, transactions follow." },
  ]),
  Bullet([
    { text: "Target sector: ", bold: true, color: COLOR_PRIMARY },
    { text: "institutional and government events (Vision 2030 spend, lowest leakage)." },
  ]),
  Bullet([
    { text: "Trap to avoid: ", bold: true, color: COLOR_DANGER },
    { text: "consumer ticketing. The category is owned by Eventbrite, Platinumlist, Webook." },
  ]),
  Bullet([
    { text: "Defense against disintermediation: ", bold: true, color: COLOR_PRIMARY },
    { text: "ZATCA + escrow + inverse repeat commission + calendar/portfolio lock-in." },
  ]),
  Bullet([
    { text: "Codebase fit: ", bold: true, color: COLOR_PRIMARY },
    { text: "RFQ, line-items, VAT 15%, supplier portfolio already support Phase 1. Deepen, do not rewrite." },
  ]),
  PB(),
);

// ===== 9 Models =====
children.push(
  H1("1. The 9 Platform Business Models"),
  P("The marketplace landscape splits into nine archetypes. Each one is defined by the level of platform control and the typical margin profile."),
);

const modelsRows = [
  new TableRow({
    tableHeader: true,
    children: [
      TC("Example (Events)", { header: true, width: 4200 }),
      TC("Margin", { header: true, width: 1600 }),
      TC("Control", { header: true, width: 1600 }),
      TC("Model", { header: true, width: 2800 }),
    ],
  }),
  new TableRow({ children: [
    TC("Eventbrite, Meetup", { width: 4200, zebra: true }),
    TC("2-10%", { width: 1600, zebra: true }),
    TC("Low", { width: 1600, zebra: true }),
    TC("Open Marketplace", { width: 2800, zebra: true }),
  ]}),
  new TableRow({ children: [
    TC("Classpass, Resy, OpenTable", { width: 4200 }),
    TC("15-30%", { width: 1600 }),
    TC("High", { width: 1600 }),
    TC("Managed Marketplace", { width: 2800 }),
  ]}),
  new TableRow({ children: [
    TC("SeatGeek, StubHub, Songkick", { width: 4200, zebra: true }),
    TC("Medium", { width: 1600, zebra: true }),
    TC("Low", { width: 1600, zebra: true }),
    TC("Aggregator", { width: 2800, zebra: true }),
  ]}),
  new TableRow({ children: [
    TC("Ticketmaster, DICE", { width: 4200 }),
    TC("High", { width: 1600 }),
    TC("Full", { width: 1600 }),
    TC("First-party (pseudo)", { width: 2800 }),
  ]}),
  new TableRow({ children: [
    TC("Cvent, Splash, Hopin", { width: 4200, zebra: true, bold: true, color: COLOR_PRIMARY }),
    TC("High", { width: 1600, zebra: true, bold: true, color: COLOR_PRIMARY }),
    TC("Med-High", { width: 1600, zebra: true, bold: true, color: COLOR_PRIMARY }),
    TC("SaaS-enabled (recommended)", { width: 2800, zebra: true, bold: true, color: COLOR_PRIMARY }),
  ]}),
  new TableRow({ children: [
    TC("The Knot, WeddingWire, Bandsintown", { width: 4200 }),
    TC("Low", { width: 1600 }),
    TC("Low", { width: 1600 }),
    TC("Discovery / Lead-gen", { width: 2800 }),
  ]}),
  new TableRow({ children: [
    TC("Lyte", { width: 4200, zebra: true }),
    TC("Variable", { width: 1600, zebra: true }),
    TC("Medium", { width: 1600, zebra: true }),
    TC("Auction-based", { width: 2800, zebra: true }),
  ]}),
  new TableRow({ children: [
    TC("GigSalad, Headout, The Bash", { width: 4200 }),
    TC("Variable", { width: 1600 }),
    TC("Variable", { width: 1600 }),
    TC("Vertical Marketplace", { width: 2800 }),
  ]}),
  new TableRow({ children: [
    TC("Classpass, MoviePass", { width: 4200, zebra: true }),
    TC("Medium", { width: 1600, zebra: true }),
    TC("High", { width: 1600, zebra: true }),
    TC("Subscription", { width: 2800, zebra: true }),
  ]}),
];
children.push(makeTable(modelsRows, [4200, 1600, 1600, 2800]));

children.push(
  P([
    { text: "Decision rule: ", bold: true, color: COLOR_PRIMARY },
    { text: "ask what is hardest for the organizer to do alone. Audience reach → open marketplace. Quality variance → managed. Fragmented suppliers without tools → SaaS-enabled." },
  ]),
  PB(),
);

// ===== Recommendation =====
children.push(
  H1("2. Recommendation: SaaS-enabled Vertical Marketplace"),
  H2("Why this fits Saudi specifically"),
  Bullet([
    { text: "Massive supplier digitization gap. ", bold: true },
    { text: "Catering, AV, decor, photography vendors run on WhatsApp + Excel. No CRM, no calendars, no quote systems. Any professional tool delivers immediate value before a single customer arrives." },
  ]),
  Bullet([
    { text: "Saudi B2B trust is relational. ", bold: true },
    { text: "Open marketplaces fail because organizers do not book unfamiliar suppliers. Need a thin Managed layer: CR verification, audited reviews, payment guarantee." },
  ]),
  Bullet([
    { text: "Vision 2030 institutional spend. ", bold: true },
    { text: "Corporate and government events need ZATCA invoices, contracts, audit trails. RFQ + line-items + 15% VAT (already built) serve this market directly." },
  ]),
  H2("Why this fits the existing codebase"),
  Bullet("RFQ flow exists with line-items table."),
  Bullet("Supplier portfolios and onboarding wizard implemented."),
  Bullet("VAT 15% with inclusive/exclusive supplier toggle (recent commit)."),
  Bullet("Organizer-supplier role split already in the data model."),
  Bullet("Conclusion: deepen the existing tools; no rewrite required."),
  H2("Anchor customer principle"),
  P([
    { text: "Build for the supplier first. ", bold: true, color: COLOR_PRIMARY },
    { text: "Organizers follow good suppliers; the reverse is far slower. This is the Shopify / Toast / ServiceTitan playbook: sell the picks and shovels, not the gold." },
  ]),
  PB(),
);

// ===== Trap =====
children.push(
  H1("3. The Trap to Avoid"),
  P([
    { text: "Do NOT build an Arabic Eventbrite. ", bold: true, color: COLOR_DANGER },
    { text: "Consumer ticketing is the wrong category for Sevent." },
  ]),
  Bullet("Eventbrite, Platinumlist, Webook already own the consumer ticketing category."),
  Bullet("Margins are 2-5% per ticket. No path to high lifetime value."),
  Bullet("Zero lock-in: organizers can switch any time."),
  Bullet("Each event is one-shot; no compounding asset."),
  Bullet([
    { text: "Sevent is not in this market. ", bold: true, color: COLOR_PRIMARY },
    { text: "RFQ ≠ tickets. The codebase already says B2B." },
  ]),
  PB(),
);

// ===== Roadmap =====
children.push(
  H1("4. Three-Phase Roadmap"),
  P("Build the SaaS layer first, the marketplace second, and the network third. Each phase compounds on the previous one."),
);

const roadmapRows = [
  new TableRow({
    tableHeader: true,
    children: [
      TC("Revenue", { header: true, width: 2400 }),
      TC("Product", { header: true, width: 4800 }),
      TC("Model", { header: true, width: 2400 }),
      TC("Phase", { header: true, width: 1600 }),
    ],
  }),
  new TableRow({ children: [
    TC("Monthly subscription", { width: 2400, zebra: true }),
    TC("Quote system, portfolio, calendar, ZATCA invoicing", { width: 4800, zebra: true }),
    TC("SaaS for Suppliers", { width: 2400, zebra: true, bold: true, color: COLOR_PRIMARY }),
    TC("1 — Now", { width: 1600, zebra: true, bold: true }),
  ]}),
  new TableRow({ children: [
    TC("Commission 8-15%", { width: 2400 }),
    TC("RFQ-based matching, identity verification, payment escrow", { width: 4800 }),
    TC("Light Managed Marketplace", { width: 2400, bold: true, color: COLOR_PRIMARY }),
    TC("2 — 6-12 months", { width: 1600, bold: true }),
  ]}),
  new TableRow({ children: [
    TC("Multi-source", { width: 2400, zebra: true }),
    TC("Market data, supplier financing, event insurance", { width: 4800, zebra: true }),
    TC("Vertical Network", { width: 2400, zebra: true, bold: true, color: COLOR_PRIMARY }),
    TC("3 — 18+ months", { width: 1600, zebra: true, bold: true }),
  ]}),
];
children.push(makeTable(roadmapRows, [2400, 4800, 2400, 1600]));
children.push(PB());

// ===== Disintermediation =====
children.push(
  H1("5. Disintermediation: The Existential Question"),
  P([
    { text: "Supervisor's question: ", italic: true, color: "555555" },
    { text: "what stops organizers and suppliers from going around the platform after they meet on it?" },
  ]),
  H2("The honest answer"),
  P([
    { text: "No platform fully prevents leakage. ", bold: true, color: COLOR_DANGER },
    { text: "Upwork and Thumbtack lose 30-50% of repeat business off-platform after the first transaction. The right goal is to make staying cheaper than leaving — not to seal the door shut." },
  ]),
  H2("Why Saudi events are the worst case"),
  Bullet([
    { text: "High transaction value: ", bold: true },
    { text: "single event budgets often run 50,000 to 500,000 SAR." },
  ]),
  Bullet([
    { text: "Low frequency: ", bold: true },
    { text: "an organizer typically uses the same supplier 2-4 times per year." },
  ]),
  Bullet([
    { text: "Relational trust: ", bold: true },
    { text: "Saudi B2B runs on personal relationships and word of mouth." },
  ]),
  H2("Why SaaS-enabled solves it structurally"),
  P("The model itself absorbs leakage. Three scenarios, three revenue outcomes:"),
);

const leakageRows = [
  new TableRow({
    tableHeader: true,
    children: [
      TC("Outcome for Sevent", { header: true, width: 2800 }),
      TC("Platform Revenue", { header: true, width: 3000 }),
      TC("Scenario", { header: true, width: 5400 }),
    ],
  }),
  new TableRow({ children: [
    TC("Full revenue", { width: 2800, zebra: true, color: COLOR_PRIMARY, bold: true }),
    TC("Subscription + commission", { width: 3000, zebra: true }),
    TC("Met on Sevent, paid on Sevent", { width: 5400, zebra: true }),
  ]}),
  new TableRow({ children: [
    TC("Partial revenue retained", { width: 2800, color: COLOR_ACCENT }),
    TC("Subscription only", { width: 3000 }),
    TC("Met on Sevent, paid off-platform", { width: 5400 }),
  ]}),
  new TableRow({ children: [
    TC("Ongoing revenue", { width: 2800, zebra: true, color: COLOR_ACCENT }),
    TC("Subscription only", { width: 3000, zebra: true }),
    TC("Supplier manages legacy clients on Sevent", { width: 5400, zebra: true }),
  ]}),
];
children.push(makeTable(leakageRows, [2800, 3000, 5400]));

children.push(
  P([
    { text: "Key insight: ", bold: true, color: COLOR_PRIMARY },
    { text: "even if 50% of transactions leak, the platform survives because the supplier keeps paying for the tool. Shopify, Toast, ServiceTitan win this way." },
  ]),
  PB(),
);

// ===== 6 Defenses =====
children.push(
  H1("6. Six Tactical Defenses"),
  P("Concrete features that increase switching cost and make staying the rational choice."),
);

const defensesRows = [
  new TableRow({
    tableHeader: true,
    children: [
      TC("How It Works", { header: true, width: 7800 }),
      TC("Defense", { header: true, width: 3200 }),
      TC("#", { header: true, width: 600, align: AlignmentType.CENTER }),
    ],
  }),
  new TableRow({ children: [
    TC("Auto-generate compliant tax invoices on quote acceptance. Off-platform = supplier must build their own e-invoicing system. Strongest defense and unique to Saudi.", { width: 7800, zebra: true }),
    TC("ZATCA Compliance Barrier", { width: 3200, zebra: true, bold: true, color: COLOR_PRIMARY }),
    TC("1", { width: 600, zebra: true, align: AlignmentType.CENTER, bold: true }),
  ]}),
  new TableRow({ children: [
    TC("Funds held in escrow until event delivery. Suppliers receive guaranteed advance payment (working capital). Mada is instant; SARIE bank transfer is slow and fee-heavy.", { width: 7800 }),
    TC("Escrow Payments + Mada", { width: 3200, bold: true, color: COLOR_PRIMARY }),
    TC("2", { width: 600, align: AlignmentType.CENTER, bold: true }),
  ]}),
  new TableRow({ children: [
    TC("First booking with a client = 15% commission. Repeat booking = 5% or 0%. Makes staying on-platform rational, not punitive. Most platforms do the opposite and lose suppliers.", { width: 7800, zebra: true }),
    TC("Inverse Repeat Commission", { width: 3200, zebra: true, bold: true, color: COLOR_PRIMARY }),
    TC("3", { width: 600, zebra: true, align: AlignmentType.CENTER, bold: true }),
  ]}),
  new TableRow({ children: [
    TC("Supplier's calendar, customer history, portfolio, and financial records all live on Sevent. Leaving means losing the operational system, not just one customer relationship.", { width: 7800 }),
    TC("Calendar + Portfolio Lock-in", { width: 3200, bold: true, color: COLOR_PRIMARY }),
    TC("4", { width: 600, align: AlignmentType.CENTER, bold: true }),
  ]}),
  new TableRow({ children: [
    TC("In-app arbitration is faster than Saudi courts. Refund guarantees protect organizers. Verified transaction history serves as legal evidence if needed.", { width: 7800, zebra: true }),
    TC("Dispute Resolution Layer", { width: 3200, zebra: true, bold: true, color: COLOR_PRIMARY }),
    TC("5", { width: 600, zebra: true, align: AlignmentType.CENTER, bold: true }),
  ]}),
  new TableRow({ children: [
    TC("Government and corporate clients legally cannot transact informally — they need contracts, audits, ZATCA. Lowest-leakage segment, highest spend. Weddings have opposite dynamics: skip them.", { width: 7800 }),
    TC("Institutional Sector Focus", { width: 3200, bold: true, color: COLOR_PRIMARY }),
    TC("6", { width: 600, align: AlignmentType.CENTER, bold: true }),
  ]}),
];
children.push(makeTable(defensesRows, [7800, 3200, 600]));
children.push(PB());

// ===== Honest acknowledgment =====
children.push(
  H1("7. What We Cannot Prevent"),
  P("Honest acknowledgment is part of a credible strategy. These leakage cases will happen and should not be treated as failures:"),
  Bullet("Suppliers and organizers who meet at an event in person will exchange business cards. No platform on earth prevents this."),
  Bullet("Pre-existing relationships from before Sevent existed will not move onto the platform. Stop targeting them."),
  Bullet("Transactions under 10,000 SAR do not justify formal infrastructure. Skip them deliberately."),
  P([
    { text: "These are not losses. ", bold: true, color: COLOR_PRIMARY },
    { text: "They were never the addressable market. The target is transactions that benefit from the platform's infrastructure — not every event in Saudi Arabia." },
  ]),
  PB(),
);

// ===== Closing =====
children.push(
  H1("8. Conclusion"),
  H2("The strategic frame in one sentence"),
  P([
    { text: "Sevent's goal is not to prevent leakage but to make leakage economically irrational ", bold: true, color: COLOR_PRIMARY },
    { text: "for both sides — through subscription that stays paid regardless of customer source, low repeat-commission that rewards retention, ZATCA as a legal switching cost, and escrow that protects both parties." },
  ]),
  H2("Verification before commitment"),
  P("Three questions to answer with usage data before locking in this direction:"),
  Bullet("Are current Sevent users organizers, suppliers, or both? What is the ratio?"),
  Bullet("Which feature do they use most? This reveals the real product anchor."),
  Bullet("What is the retention rate of suppliers vs. organizers? Whoever stays longer is who to invest in first."),
  H2("Next step"),
  P([
    { text: "Pull usage data, answer the three questions above, and build a detailed roadmap for Phase 1 (Supplier SaaS) before adding any marketplace features. ", bold: true },
    { text: "The codebase already supports this direction — we deepen, not rewrite." },
  ]),
);

// ===== Document =====
const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, color: COLOR_PRIMARY, font: FONT },
        paragraph: { spacing: { before: 320, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, color: COLOR_ACCENT, font: FONT },
        paragraph: { spacing: { before: 240, after: 140 }, outlineLevel: 1 } },
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
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Sevent — Platform Strategy   |   Page ", font: FONT, size: 18, color: "666666" }),
            new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18 }),
            new TextRun({ text: " of ", font: FONT, size: 18 }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 18 }),
          ],
        })],
      }),
    },
    children,
  }],
});

Packer.toBuffer(doc)
  .then(buf => { fs.writeFileSync(OUT, buf); console.log(`Wrote ${OUT} (${buf.length} bytes)`); })
  .catch(err => { console.error(err); process.exit(1); });
