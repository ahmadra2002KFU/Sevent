// English summary deck: Sevent business model strategy + disintermediation.
// Run: node "Claude Docs/scripts/build_strategy_summary_en.js"

const path = require("path");
const PptxGenJS = require("pptxgenjs");

const OUT = path.join(__dirname, "..", "deliverables", "business-model", "Sevent-Strategy-Summary-v2.pptx");

const FONT = "Calibri";
const COLOR_PRIMARY = "1F5132";
const COLOR_ACCENT = "2E7D32";
const COLOR_LIGHT = "F0F7F2";
const COLOR_DARK = "111827";
const COLOR_MUTED = "6B7280";
const COLOR_DANGER = "B91C1C";

const W = 13.333, H = 7.5, MARGIN = 0.5;

const pres = new PptxGenJS();
pres.layout = "LAYOUT_WIDE";
pres.title = "Sevent Strategy Summary";
pres.author = "Ahmad Rabaya";
pres.company = "Sevent";

pres.defineSlideMaster({
  title: "MASTER",
  background: { color: "FFFFFF" },
  objects: [
    { rect: { x: 0, y: 0, w: W, h: 0.08, fill: { color: COLOR_PRIMARY } } },
    { text: {
        text: "Sevent — Platform Strategy",
        options: { x: 0.5, y: H - 0.42, w: 5, h: 0.3,
          fontFace: FONT, fontSize: 10, color: COLOR_MUTED, align: "left" },
    }},
  ],
  slideNumber: { x: W - 1.0, y: H - 0.42, w: 0.5, h: 0.3,
    fontFace: FONT, fontSize: 10, color: COLOR_MUTED, align: "right" },
});

// Build a flat array of runs from a list of bullets, where each bullet is an
// array of run-objects ({ text, options }). Each bullet maps to one paragraph:
// the first run carries the `bullet` attribute, the last run carries
// `breakLine: true` to end the paragraph. Plain-string items are single-run bullets.
function bulletList(bullets, baseOpts = {}, bulletOpts = { indent: 18 }) {
  const out = [];
  for (const b of bullets) {
    const runs = typeof b === "string" ? [{ text: b }] : b;
    runs.forEach((run, i) => {
      const isFirst = i === 0;
      const isLast = i === runs.length - 1;
      out.push({
        text: run.text,
        options: {
          ...baseOpts,
          ...(run.options || {}),
          ...(isFirst ? { bullet: bulletOpts } : {}),
          ...(isLast ? { breakLine: true } : {}),
        },
      });
    });
  }
  return out;
}

function addTitle(s, text, sub) {
  s.addText(text, {
    x: MARGIN, y: 0.4, w: W - 2 * MARGIN, h: 0.7,
    fontFace: FONT, fontSize: 30, bold: true, color: COLOR_PRIMARY, align: "left",
  });
  s.addShape("rect", {
    x: MARGIN, y: 1.1, w: 0.8, h: 0.06,
    fill: { color: COLOR_ACCENT }, line: { color: COLOR_ACCENT },
  });
  if (sub) {
    s.addText(sub, {
      x: MARGIN, y: 1.18, w: W - 2 * MARGIN, h: 0.4,
      fontFace: FONT, fontSize: 14, italic: true, color: COLOR_MUTED, align: "left",
    });
  }
}

// --- Slide 1: Cover ---
{
  const s = pres.addSlide();
  s.background = { color: COLOR_PRIMARY };
  s.addShape("rect", { x: 0, y: 0, w: 0.3, h: H, fill: { color: COLOR_ACCENT }, line: { color: COLOR_ACCENT } });
  s.addText("Sevent", {
    x: 1.0, y: 1.6, w: W - 2, h: 0.6,
    fontFace: FONT, fontSize: 22, color: "A7F3D0", align: "left",
  });
  s.addText("Platform Business Model Strategy", {
    x: 1.0, y: 2.3, w: W - 2, h: 1.5,
    fontFace: FONT, fontSize: 52, bold: true, color: "FFFFFF", align: "left",
  });
  s.addText("Recommendation, roadmap, and defense against disintermediation", {
    x: 1.0, y: 4.1, w: W - 2, h: 0.5,
    fontFace: FONT, fontSize: 20, color: "A7F3D0", align: "left",
  });
  s.addText([
    { text: "Ahmad Rabaya", options: { bold: true, color: "FFFFFF" } },
    { text: "  •  29 April 2026", options: { color: "D1FAE5" } },
  ], {
    x: 1.0, y: 6.2, w: W - 2, h: 0.4,
    fontFace: FONT, fontSize: 14, align: "left",
  });
}

// --- Slide 2: The 9 platform business models ---
{
  const s = pres.addSlide();
  addTitle(s, "9 Platform Business Models", "Mapped across the marketplace landscape");

  const headers = ["Model", "Control", "Margin", "Example (Events)"];
  const rows = [
    ["Open Marketplace", "Low", "2-10%", "Eventbrite, Meetup"],
    ["Managed Marketplace", "High", "15-30%", "Classpass, Resy"],
    ["Aggregator", "Low", "Medium", "SeatGeek, StubHub"],
    ["First-party (pseudo)", "Full", "High", "Ticketmaster, DICE"],
    ["SaaS-enabled", "Med-High", "High", "Cvent, Splash"],
    ["Discovery / Lead-gen", "Low", "Low", "The Knot, WeddingWire"],
    ["Auction-based", "Medium", "Variable", "Lyte"],
    ["Vertical Marketplace", "Variable", "Variable", "GigSalad, Headout"],
    ["Subscription", "High", "Medium", "Classpass"],
  ];

  const headerRow = headers.map(h => ({
    text: h,
    options: { bold: true, color: "FFFFFF", fill: { color: COLOR_PRIMARY }, align: "left", fontSize: 14, fontFace: FONT },
  }));
  const bodyRows = rows.map((r, i) => r.map((c, j) => ({
    text: c,
    options: {
      bold: r[0] === "SaaS-enabled",
      color: r[0] === "SaaS-enabled" ? COLOR_PRIMARY : COLOR_DARK,
      fill: { color: r[0] === "SaaS-enabled" ? COLOR_LIGHT : (i % 2 ? "F9FAFB" : "FFFFFF") },
      align: "left", fontSize: 13, fontFace: FONT, valign: "middle",
    },
  })));

  s.addTable([headerRow, ...bodyRows], {
    x: MARGIN, y: 1.7, w: W - 2 * MARGIN,
    colW: [3.0, 2.0, 2.0, 5.333],
    border: { type: "solid", color: "D1D5DB", pt: 0.5 },
    rowH: 0.42,
  });

  s.addText([
    { text: "Key question: ", options: { bold: true, color: COLOR_PRIMARY } },
    { text: "what's hardest for the organizer to do alone? That decides the model.", options: { color: COLOR_DARK } },
  ], {
    x: MARGIN, y: H - 0.85, w: W - 2 * MARGIN, h: 0.35,
    fontFace: FONT, fontSize: 14, italic: true, align: "left",
  });
}

// --- Slide 3: Recommendation for Sevent ---
{
  const s = pres.addSlide();
  addTitle(s, "Recommendation: SaaS-enabled Vertical Marketplace", "B2B focus — organizer ↔ supplier, not consumer tickets");

  s.addText([
    { text: "Why this fits Saudi specifically", options: { bold: true, fontSize: 18, color: COLOR_PRIMARY } },
  ], { x: MARGIN, y: 1.75, w: W - 2 * MARGIN, h: 0.4, fontFace: FONT, align: "left" });

  const bullets = [
    [
      { text: "Massive digitization gap in suppliers — ", options: { bold: true } },
      { text: "catering, AV, decor, photography run on WhatsApp + Excel. No CRM, no calendars, no quote systems. A professional tool delivers value before any customer arrives." },
    ],
    [
      { text: "Trust in Saudi B2B is relational — ", options: { bold: true } },
      { text: "open marketplaces fail because organizers don't book unfamiliar suppliers. Need a light Managed layer: CR verification, audited reviews, payment guarantee." },
    ],
    [
      { text: "Vision 2030 institutional spend — ", options: { bold: true } },
      { text: "corporate and government events need ZATCA invoices, contracts, audit trails. RFQ + line-items + 15% VAT (already built) serve this market directly." },
    ],
    [
      { text: "Codebase already supports it — ", options: { bold: true } },
      { text: "RFQ flow, supplier portfolios, ZATCA-ready VAT, organizer-supplier model. No rewrite needed, only deepening of existing tools." },
    ],
  ];

  const items = bulletList(
    bullets,
    { fontFace: FONT, fontSize: 16, color: COLOR_DARK, align: "left", paraSpaceAfter: 12 },
  );
  s.addText(items, { x: MARGIN, y: 2.3, w: W - 2 * MARGIN, h: 4.2, valign: "top" });

  s.addShape("rect", {
    x: MARGIN, y: H - 1.2, w: W - 2 * MARGIN, h: 0.55,
    fill: { color: COLOR_LIGHT }, line: { color: COLOR_ACCENT, width: 1 },
  });
  s.addText([
    { text: "Anchor customer = the supplier, not the organizer. ", options: { bold: true, color: COLOR_PRIMARY } },
    { text: "Organizers follow good suppliers — the reverse is far slower. (Shopify, Toast, ServiceTitan rule.)" },
  ], {
    x: MARGIN + 0.2, y: H - 1.1, w: W - 2 * MARGIN - 0.4, h: 0.4,
    fontFace: FONT, fontSize: 14, color: COLOR_DARK, align: "left",
  });
}

// --- Slide 4: The trap to avoid ---
{
  const s = pres.addSlide();
  addTitle(s, "The Trap to Avoid", "Why we are NOT building Eventbrite-Arabia");

  const bullets = [
    [{ text: "Eventbrite, Platinumlist, Webook ", options: { bold: true } }, { text: "already own consumer ticketing in the region." }],
    [{ text: "Razor-thin margins — ", options: { bold: true } }, { text: "2-5% per ticket; no path to high LTV." }],
    [{ text: "Zero lock-in — ", options: { bold: true } }, { text: "organizers can leave any moment; no defensible moat." }],
    [{ text: "No long-term value layer — ", options: { bold: true } }, { text: "each event is a one-shot transaction; no compounding asset." }],
    [{ text: "Sevent is NOT in this market — ", options: { bold: true, color: COLOR_PRIMARY } }, { text: "RFQ ≠ tickets. The codebase already says B2B." }],
  ];

  const items = bulletList(
    bullets,
    { fontFace: FONT, fontSize: 18, color: COLOR_DARK, align: "left", paraSpaceAfter: 14 },
    { code: "274C" },
  );
  s.addText(items, { x: MARGIN, y: 1.9, w: W - 2 * MARGIN, h: 4.5, valign: "top" });

  s.addShape("rect", {
    x: MARGIN, y: H - 1.5, w: W - 2 * MARGIN, h: 0.85,
    fill: { color: "FEF2F2" }, line: { color: COLOR_DANGER, width: 1 },
  });
  s.addText([
    { text: "Bottom line: ", options: { bold: true, color: COLOR_DANGER } },
    { text: "consumer tickets is a graveyard for new entrants. Stay B2B, stay vertical, stay SaaS-first." },
  ], {
    x: MARGIN + 0.2, y: H - 1.4, w: W - 2 * MARGIN - 0.4, h: 0.65,
    fontFace: FONT, fontSize: 16, color: COLOR_DARK, align: "left", valign: "middle",
  });
}

// --- Slide 5: 3-phase roadmap ---
{
  const s = pres.addSlide();
  addTitle(s, "3-Phase Roadmap", "Build the SaaS layer first, marketplace second, network third");

  const headers = ["Phase", "Model", "Product", "Revenue"];
  const rows = [
    ["Phase 1\n(Now)", "SaaS for Suppliers", "Quote system, portfolio, calendar, ZATCA invoicing", "Monthly subscription"],
    ["Phase 2\n(6-12 months)", "Light Managed Marketplace", "RFQ-based matching, identity verification, payment escrow", "Commission 8-15%"],
    ["Phase 3\n(18+ months)", "Vertical Network", "Market data, supplier financing, event insurance", "Multi-source"],
  ];

  const headerRow = headers.map(h => ({
    text: h,
    options: { bold: true, color: "FFFFFF", fill: { color: COLOR_PRIMARY }, align: "left", fontSize: 14, fontFace: FONT, valign: "middle" },
  }));
  const bodyRows = rows.map((r, i) => r.map((c, j) => ({
    text: c,
    options: {
      bold: j === 0 || j === 1,
      color: j === 0 ? COLOR_PRIMARY : COLOR_DARK,
      fill: { color: i % 2 ? COLOR_LIGHT : "FFFFFF" },
      align: "left", fontSize: 14, fontFace: FONT, valign: "middle",
    },
  })));

  s.addTable([headerRow, ...bodyRows], {
    x: MARGIN, y: 1.9, w: W - 2 * MARGIN,
    colW: [2.2, 2.8, 5.3, 2.0],
    border: { type: "solid", color: "D1D5DB", pt: 0.5 },
    rowH: 1.0,
  });

  s.addText([
    { text: "Strategic note: ", options: { bold: true, color: COLOR_PRIMARY } },
    { text: "the existing codebase (RFQ, line-items, VAT 15%, portfolio) supports Phase 1 directly — no rewrite required." },
  ], {
    x: MARGIN, y: H - 0.95, w: W - 2 * MARGIN, h: 0.4,
    fontFace: FONT, fontSize: 14, italic: true, align: "left",
  });
}

// --- Slide 6: Disintermediation — the threat ---
{
  const s = pres.addSlide();
  addTitle(s, "The Disintermediation Threat", "Supervisor's question: what stops them from going around the platform?");

  s.addText([
    { text: "The honest answer: ", options: { bold: true, color: COLOR_DANGER } },
    { text: "no platform fully prevents it. ", options: { bold: false } },
    { text: "Goal = make staying cheaper than leaving.", options: { bold: true, color: COLOR_PRIMARY } },
  ], {
    x: MARGIN, y: 1.85, w: W - 2 * MARGIN, h: 0.4,
    fontFace: FONT, fontSize: 18, align: "left",
  });

  s.addText("Why Saudi events are the WORST case:", {
    x: MARGIN, y: 2.45, w: W - 2 * MARGIN, h: 0.4,
    fontFace: FONT, fontSize: 16, bold: true, color: COLOR_DARK, align: "left",
  });

  const factors = [
    [{ text: "High transaction value — ", options: { bold: true } }, { text: "single event budget often 50K-500K SAR" }],
    [{ text: "Low frequency — ", options: { bold: true } }, { text: "organizer uses same supplier 2-4 times per year" }],
    [{ text: "Relational trust — ", options: { bold: true } }, { text: "Saudi B2B runs on personal relationships" }],
  ];
  const items = bulletList(
    factors,
    { fontFace: FONT, fontSize: 16, color: COLOR_DARK, align: "left", paraSpaceAfter: 8 },
  );
  s.addText(items, { x: MARGIN, y: 2.95, w: W - 2 * MARGIN, h: 1.7, valign: "top" });

  s.addShape("rect", {
    x: MARGIN, y: 4.85, w: W - 2 * MARGIN, h: 2.0,
    fill: { color: COLOR_LIGHT }, line: { color: COLOR_ACCENT, width: 1 },
  });
  s.addText("Why SaaS-enabled solves it structurally:", {
    x: MARGIN + 0.2, y: 4.95, w: W - 2 * MARGIN - 0.4, h: 0.4,
    fontFace: FONT, fontSize: 16, bold: true, color: COLOR_PRIMARY, align: "left",
  });
  const struct = [
    [{ text: "Met on Sevent + paid on Sevent → ", options: { bold: true } }, { text: "subscription + commission (full revenue)" }],
    [{ text: "Met on Sevent + paid off-platform → ", options: { bold: true } }, { text: "subscription still paid (partial revenue)" }],
    [{ text: "Supplier manages legacy clients on Sevent → ", options: { bold: true } }, { text: "subscription paid (ongoing revenue)" }],
  ];
  const structItems = bulletList(
    struct,
    { fontFace: FONT, fontSize: 14, color: COLOR_DARK, align: "left", paraSpaceAfter: 6 },
    { code: "2705" },
  );
  s.addText(structItems, { x: MARGIN + 0.3, y: 5.4, w: W - 2 * MARGIN - 0.6, h: 1.4, valign: "top" });
}

// --- Slide 7: 6 tactical defenses ---
{
  const s = pres.addSlide();
  addTitle(s, "6 Tactical Defenses Against Leakage", "Concrete features that increase switching cost");

  const headers = ["#", "Defense", "How It Works"];
  const rows = [
    ["1", "ZATCA Compliance Barrier", "Auto-generate compliant tax invoices. Off-platform = supplier must build own e-invoicing system. (Strongest, Saudi-unique.)"],
    ["2", "Escrow Payments + Mada", "Funds held until event delivery. Suppliers get advance working capital. Mada is instant; SARIE is slow."],
    ["3", "Inverse Repeat Commission", "First booking = 15%. Repeat booking with same client = 5% or 0%. Makes staying RATIONAL, not punitive."],
    ["4", "Calendar + Portfolio Lock-in", "Supplier's records, availability, history all live on Sevent. Leaving = losing the operational system."],
    ["5", "Dispute Resolution Layer", "In-app arbitration faster than Saudi courts. Refund guarantees. Verified transaction history."],
    ["6", "Institutional Sector Focus", "Government + corporate need contracts, audits, ZATCA. They CANNOT transact informally. Lowest leakage segment."],
  ];

  const headerRow = headers.map(h => ({
    text: h,
    options: { bold: true, color: "FFFFFF", fill: { color: COLOR_PRIMARY }, align: "left", fontSize: 13, fontFace: FONT, valign: "middle" },
  }));
  const bodyRows = rows.map((r, i) => r.map((c, j) => ({
    text: c,
    options: {
      bold: j === 0 || j === 1,
      color: j === 1 ? COLOR_PRIMARY : COLOR_DARK,
      fill: { color: i % 2 ? COLOR_LIGHT : "FFFFFF" },
      align: j === 0 ? "center" : "left", fontSize: 12, fontFace: FONT, valign: "middle",
    },
  })));

  s.addTable([headerRow, ...bodyRows], {
    x: MARGIN, y: 1.85, w: W - 2 * MARGIN,
    colW: [0.6, 3.0, 8.733],
    border: { type: "solid", color: "D1D5DB", pt: 0.5 },
    rowH: 0.7,
  });
}

// --- Slide 8: Final takeaways ---
{
  const s = pres.addSlide();
  addTitle(s, "Key Takeaways", "What we decided, what we build next");

  const takeaways = [
    [{ text: "Model: ", options: { bold: true, color: COLOR_PRIMARY } }, { text: "SaaS-enabled Vertical Marketplace, B2B (organizer ↔ supplier)." }],
    [{ text: "Anchor: ", options: { bold: true, color: COLOR_PRIMARY } }, { text: "supplier first, not organizer. Tools before transactions." }],
    [{ text: "Sector: ", options: { bold: true, color: COLOR_PRIMARY } }, { text: "institutional and government events — Vision 2030 spend, low leakage." }],
    [{ text: "Avoid: ", options: { bold: true, color: COLOR_DANGER } }, { text: "consumer ticketing. Stay B2B." }],
    [{ text: "Defense: ", options: { bold: true, color: COLOR_PRIMARY } }, { text: "ZATCA + escrow + inverse repeat commission + calendar lock-in." }],
    [{ text: "Codebase: ", options: { bold: true, color: COLOR_PRIMARY } }, { text: "already supports Phase 1. Deepen, don't rewrite." }],
  ];

  const items = bulletList(
    takeaways,
    { fontFace: FONT, fontSize: 18, color: COLOR_DARK, align: "left", paraSpaceAfter: 14 },
    { code: "25B6" },
  );
  s.addText(items, { x: MARGIN, y: 1.9, w: W - 2 * MARGIN, h: 3.8, valign: "top" });

  s.addShape("rect", {
    x: MARGIN, y: 5.9, w: W - 2 * MARGIN, h: 1.0,
    fill: { color: COLOR_PRIMARY }, line: { color: COLOR_PRIMARY },
  });
  s.addText("Next step: validate with usage data — supplier vs. organizer ratio, retention, top-used feature.", {
    x: MARGIN + 0.3, y: 6.0, w: W - 2 * MARGIN - 0.6, h: 0.8,
    fontFace: FONT, fontSize: 16, color: "FFFFFF", align: "left", valign: "middle", italic: true,
  });
}

pres.writeFile({ fileName: OUT })
  .then(p => console.log("Wrote:", p))
  .catch(err => { console.error(err); process.exit(1); });
