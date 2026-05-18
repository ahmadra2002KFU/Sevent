// Arabic PowerPoint starter — copy this file into your project, set the
// IMG_DIR + OUTPUT path, edit the `slides` section, then:
//   node build_deck.js
//
// Requires: npm install pptxgenjs
//
// Why the helpers exist: PowerPoint RTL has a few sharp edges (per-shape
// rtlMode, manual column reversal for tables, bullet direction). The helpers
// below hide all of that so the slide-building code stays declarative.

const PptxGenJS = require("pptxgenjs");
const path = require("path");
const fs = require("fs");

// ---- CONFIG (edit these) ----
const FONT_AR = "Cairo"; // Install from Google Fonts on the presenting machine
const FONT_AR_FALLBACK = "Segoe UI"; // Auto-used if Cairo missing on target box
const COLOR_PRIMARY = "1F5132"; // deep green
const COLOR_ACCENT = "2E7D32"; // medium green
const COLOR_MUTED = "6B7280"; // gray
const COLOR_BG = "FFFFFF";
const COLOR_DARK = "111827";

const IMG_DIR = path.join(__dirname, "images"); // put slide images here
const OUTPUT = path.join(__dirname, "presentation.pptx");

// ---- Layout constants (LAYOUT_WIDE = 13.333 × 7.5 inches) ----
const W = 13.333;
const H = 7.5;
const MARGIN = 0.5;
const TITLE_Y = 0.45;
const CONTENT_Y = 1.55;
const CONTENT_H = H - CONTENT_Y - 0.6;

// ---- Helpers ----

// Image path → { path } or { data: "data:image/..." } for embedding.
// pptxgenjs accepts `path` when running in Node; using path is simpler.
function img(fileName) {
  return { path: path.join(IMG_DIR, fileName) };
}

// Create a master slide with footer (slide number + project name on left, date on right)
function defineMaster(pres, opts = {}) {
  const { projectName = "", footer = true } = opts;
  pres.defineSlideMaster({
    title: "MASTER",
    background: { color: COLOR_BG },
    objects: footer ? [
      // Thin accent bar at top
      { rect: { x: 0, y: 0, w: W, h: 0.08, fill: { color: COLOR_PRIMARY } } },
      // Project name bottom-right (RTL logical "start")
      { text: {
          text: projectName,
          options: {
            x: W - 3.5, y: H - 0.45, w: 3, h: 0.35,
            fontFace: FONT_AR, fontSize: 10, color: COLOR_MUTED,
            align: "right", rtlMode: true,
          },
      }},
      // Slide number bottom-left
      { text: {
          text: "",
          options: {
            x: 0.5, y: H - 0.45, w: 1.5, h: 0.35,
            fontFace: FONT_AR_FALLBACK, fontSize: 10, color: COLOR_MUTED,
            align: "left",
          },
      }},
    ] : [],
    slideNumber: { x: 0.5, y: H - 0.45, w: 1.5, h: 0.35, fontFace: FONT_AR_FALLBACK, fontSize: 10, color: COLOR_MUTED, align: "left" },
  });
}

// Arabic title at the top of a content slide
function addTitle(slide, text) {
  slide.addText(text, {
    x: MARGIN, y: TITLE_Y, w: W - 2 * MARGIN, h: 0.85,
    fontFace: FONT_AR, fontSize: 32, bold: true, color: COLOR_PRIMARY,
    align: "right", rtlMode: true,
  });
  // Accent underline
  slide.addShape("rect", {
    x: W - MARGIN - 1.2, y: TITLE_Y + 0.85, w: 1.2, h: 0.06,
    fill: { color: COLOR_ACCENT }, line: { color: COLOR_ACCENT },
  });
}

// Cover / title slide
function coverSlide(pres, { title, subtitle, heroImage, team, university, course, supervisor }) {
  const s = pres.addSlide();
  s.background = { color: COLOR_PRIMARY };

  // Hero image on the LEFT half (Arabic logical order = right-first, so image goes left)
  if (heroImage) {
    s.addImage({ ...img(heroImage), x: 0, y: 0, w: W * 0.5, h: H, sizing: { type: "cover", w: W * 0.5, h: H } });
  }

  // Right half: dark-green panel with Arabic text
  const rx = W * 0.5 + 0.5;
  const rw = W * 0.5 - 1;

  if (university) {
    s.addText(university, {
      x: rx, y: 0.6, w: rw, h: 0.4,
      fontFace: FONT_AR, fontSize: 14, color: "D1FAE5", align: "right", rtlMode: true,
    });
  }

  s.addText(title, {
    x: rx, y: 1.4, w: rw, h: 1.8,
    fontFace: FONT_AR, fontSize: 54, bold: true, color: "FFFFFF",
    align: "right", rtlMode: true, paraSpaceAfter: 6,
  });

  if (subtitle) {
    s.addText(subtitle, {
      x: rx, y: 3.3, w: rw, h: 1.0,
      fontFace: FONT_AR, fontSize: 20, color: "A7F3D0",
      align: "right", rtlMode: true,
    });
  }

  if (course) {
    s.addText(course, {
      x: rx, y: 4.4, w: rw, h: 0.4,
      fontFace: FONT_AR, fontSize: 14, color: "D1FAE5", align: "right", rtlMode: true,
    });
  }

  if (supervisor) {
    s.addText(supervisor, {
      x: rx, y: 4.85, w: rw, h: 0.4,
      fontFace: FONT_AR, fontSize: 14, color: "D1FAE5", align: "right", rtlMode: true,
    });
  }

  // Team table
  if (team && team.length) {
    const rows = team.map(m => [
      { text: m.id, options: { fontFace: FONT_AR_FALLBACK, fontSize: 12, color: "FFFFFF", align: "center" } },
      { text: m.name, options: { fontFace: FONT_AR, fontSize: 12, color: "FFFFFF", align: "right", rtlMode: true } },
    ]);
    s.addTable(rows, {
      x: rx, y: 5.5, w: rw, colW: [rw * 0.35, rw * 0.65],
      border: { type: "solid", color: "34D399", pt: 0.5 },
      fill: { color: "064E3B" },
      rowH: 0.35,
    });
  }

  return s;
}

// Section divider (between chapters)
function sectionSlide(pres, { number, title }) {
  const s = pres.addSlide();
  s.background = { color: COLOR_PRIMARY };
  if (number) {
    s.addText(String(number), {
      x: 0, y: 1.2, w: W, h: 2.5,
      fontFace: FONT_AR_FALLBACK, fontSize: 180, bold: true, color: "064E3B",
      align: "center",
    });
  }
  s.addText(title, {
    x: 0.5, y: 4.0, w: W - 1, h: 1.2,
    fontFace: FONT_AR, fontSize: 44, bold: true, color: "FFFFFF",
    align: "center", rtlMode: true,
  });
  s.addShape("rect", {
    x: W / 2 - 0.5, y: 5.3, w: 1.0, h: 0.06,
    fill: { color: COLOR_ACCENT }, line: { color: COLOR_ACCENT },
  });
  return s;
}

// Bullet slide
// bullets: array of strings OR objects { text, sub: [string, ...] }
function contentSlide(pres, { title, bullets = [], note }) {
  const s = pres.addSlide();
  addTitle(s, title);

  const textItems = [];
  for (const b of bullets) {
    if (typeof b === "string") {
      textItems.push({
        text: b,
        options: { bullet: { indent: 20 }, fontFace: FONT_AR, fontSize: 20, color: COLOR_DARK, rtlMode: true, paraSpaceAfter: 10, align: "right" },
      });
    } else {
      textItems.push({
        text: b.text,
        options: { bullet: { indent: 20 }, fontFace: FONT_AR, fontSize: 20, color: COLOR_DARK, rtlMode: true, paraSpaceAfter: 6, align: "right", bold: !!b.bold },
      });
      for (const sub of (b.sub || [])) {
        textItems.push({
          text: sub,
          options: { bullet: { indent: 40, code: "25CB" }, fontFace: FONT_AR, fontSize: 16, color: COLOR_MUTED, rtlMode: true, paraSpaceAfter: 4, align: "right" },
        });
      }
    }
  }

  s.addText(textItems, {
    x: MARGIN, y: CONTENT_Y, w: W - 2 * MARGIN, h: CONTENT_H - 0.5,
    valign: "top",
  });

  if (note) {
    s.addText(note, {
      x: MARGIN, y: H - 0.95, w: W - 2 * MARGIN, h: 0.4,
      fontFace: FONT_AR, fontSize: 12, italic: true, color: COLOR_MUTED,
      align: "right", rtlMode: true,
    });
  }
  return s;
}

// Two-column slide. In RTL, the `right` column is the logical "first" column.
function twoColumnSlide(pres, { title, right, left }) {
  const s = pres.addSlide();
  addTitle(s, title);
  const colW = (W - 2 * MARGIN - 0.3) / 2;

  // Right column (read first in RTL)
  renderColumn(s, right, W - MARGIN - colW, CONTENT_Y, colW);
  // Left column
  renderColumn(s, left, MARGIN, CONTENT_Y, colW);

  return s;
}

function renderColumn(s, col, x, y, w) {
  if (!col) return;
  if (col.heading) {
    s.addText(col.heading, {
      x, y, w, h: 0.5,
      fontFace: FONT_AR, fontSize: 20, bold: true, color: COLOR_ACCENT,
      align: "right", rtlMode: true,
    });
    y += 0.55;
  }
  const items = (col.bullets || []).map(b => ({
    text: typeof b === "string" ? b : b.text,
    options: {
      bullet: { indent: 18 },
      fontFace: FONT_AR, fontSize: 17, color: COLOR_DARK,
      rtlMode: true, align: "right", paraSpaceAfter: 8,
    },
  }));
  if (items.length) {
    s.addText(items, { x, y, w, h: CONTENT_H - (col.heading ? 0.55 : 0), valign: "top" });
  }
}

// Image slide with Arabic caption. Optional bullets appear to the LEFT of the image.
function imageSlide(pres, { title, image, caption, bullets, imageWidth = 8 }) {
  const s = pres.addSlide();
  addTitle(s, title);

  const hasText = bullets && bullets.length;
  const iw = hasText ? imageWidth * 0.75 : imageWidth;
  const ix = W - MARGIN - iw; // image on the right (RTL visual)
  const iy = CONTENT_Y;
  const ih = CONTENT_H - 0.8;

  s.addImage({ ...img(image), x: ix, y: iy, w: iw, h: ih, sizing: { type: "contain", w: iw, h: ih } });

  if (caption) {
    s.addText(caption, {
      x: ix, y: iy + ih + 0.05, w: iw, h: 0.4,
      fontFace: FONT_AR, fontSize: 12, italic: true, color: COLOR_MUTED,
      align: "center", rtlMode: true,
    });
  }

  if (hasText) {
    const tx = MARGIN;
    const tw = W - 2 * MARGIN - iw - 0.3;
    const items = bullets.map(b => ({
      text: typeof b === "string" ? b : b.text,
      options: {
        bullet: { indent: 18 },
        fontFace: FONT_AR, fontSize: 17, color: COLOR_DARK,
        rtlMode: true, align: "right", paraSpaceAfter: 8,
      },
    }));
    s.addText(items, { x: tx, y: iy, w: tw, h: ih, valign: "top" });
  }
  return s;
}

// Table slide. Pass `headers` and `rows` in LOGICAL reading order (right-to-left);
// the helper reverses them so the first element renders on the visual right.
function tableSlide(pres, { title, headers, rows, colWidths, note }) {
  const s = pres.addSlide();
  addTitle(s, title);

  const n = headers.length;
  const tableW = W - 2 * MARGIN;
  const widths = colWidths || Array(n).fill(tableW / n);
  // Reverse both headers and widths so the visual order matches Arabic reading
  const revHeaders = [...headers].reverse();
  const revWidths = [...widths].reverse();
  const revRows = rows.map(r => [...r].reverse());

  const headerRow = revHeaders.map(h => ({
    text: h,
    options: { fontFace: FONT_AR, fontSize: 15, bold: true, color: "FFFFFF", align: "center", rtlMode: true, fill: { color: COLOR_PRIMARY } },
  }));

  const bodyRows = revRows.map((row, i) => row.map(cell => {
    const isNumeric = typeof cell === "string" && /^[\d\s./\-–+]+$/.test(cell);
    return {
      text: cell == null ? "" : String(cell),
      options: {
        fontFace: isNumeric ? FONT_AR_FALLBACK : FONT_AR,
        fontSize: 13, color: COLOR_DARK,
        align: isNumeric ? "center" : "right",
        rtlMode: !isNumeric,
        fill: { color: i % 2 ? "F3F4F6" : "FFFFFF" },
        valign: "middle",
      },
    };
  }));

  s.addTable([headerRow, ...bodyRows], {
    x: MARGIN, y: CONTENT_Y, w: tableW,
    colW: revWidths,
    border: { type: "solid", color: "D1D5DB", pt: 0.5 },
    rowH: 0.4,
  });

  if (note) {
    s.addText(note, {
      x: MARGIN, y: H - 0.85, w: W - 2 * MARGIN, h: 0.35,
      fontFace: FONT_AR, fontSize: 11, italic: true, color: COLOR_MUTED,
      align: "right", rtlMode: true,
    });
  }
  return s;
}

function quoteSlide(pres, { quote, attribution }) {
  const s = pres.addSlide();
  s.background = { color: "F9FAFB" };
  s.addShape("rect", { x: 0, y: H / 2 - 0.02, w: W, h: 0.04, fill: { color: COLOR_ACCENT }, line: { color: COLOR_ACCENT } });
  s.addText(`"${quote}"`, {
    x: 1, y: 1.8, w: W - 2, h: 3.5,
    fontFace: FONT_AR, fontSize: 32, bold: true, color: COLOR_PRIMARY,
    align: "center", rtlMode: true,
  });
  if (attribution) {
    s.addText(attribution, {
      x: 1, y: 5.6, w: W - 2, h: 0.5,
      fontFace: FONT_AR, fontSize: 16, color: COLOR_MUTED,
      align: "center", rtlMode: true,
    });
  }
  return s;
}

function closingSlide(pres, { title, subtitle, contact }) {
  const s = pres.addSlide();
  s.background = { color: COLOR_PRIMARY };
  s.addText(title, {
    x: 0.5, y: 2.5, w: W - 1, h: 1.5,
    fontFace: FONT_AR, fontSize: 96, bold: true, color: "FFFFFF",
    align: "center", rtlMode: true,
  });
  if (subtitle) {
    s.addText(subtitle, {
      x: 0.5, y: 4.2, w: W - 1, h: 0.8,
      fontFace: FONT_AR, fontSize: 24, color: "A7F3D0",
      align: "center", rtlMode: true,
    });
  }
  if (contact) {
    s.addText(contact, {
      x: 0.5, y: 5.3, w: W - 1, h: 0.5,
      fontFace: FONT_AR_FALLBACK, fontSize: 14, color: "D1FAE5",
      align: "center",
    });
  }
  return s;
}

// ---- Example usage (delete and replace with your slides) ----

if (require.main === module) {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";
  pres.rtlMode = true;
  pres.title = "عرض تقديمي";
  pres.author = "المؤلف";
  pres.company = "الجامعة";

  defineMaster(pres, { projectName: "اسم المشروع" });

  coverSlide(pres, {
    title: "عنوان المشروع",
    subtitle: "وصف مختصر",
    heroImage: "cover.png",
    team: [
      { id: "000000000", name: "اسم الطالبة" },
    ],
    university: "الجامعة",
    course: "المقرر",
    supervisor: "إشراف: د. فلان",
  });

  contentSlide(pres, {
    title: "المحتويات",
    bullets: ["المقدمة", "الأهداف", "المنهجية", "النتائج", "الخاتمة"],
  });

  closingSlide(pres, { title: "شكراً لاستماعكم", subtitle: "للأسئلة والنقاش" });

  pres.writeFile({ fileName: OUTPUT }).then(p => console.log("Wrote:", p));
}

module.exports = {
  FONT_AR, FONT_AR_FALLBACK,
  COLOR_PRIMARY, COLOR_ACCENT, COLOR_MUTED, COLOR_BG, COLOR_DARK,
  W, H, MARGIN,
  defineMaster, addTitle,
  coverSlide, sectionSlide, contentSlide, twoColumnSlide,
  imageSlide, tableSlide, quoteSlide, closingSlide,
};
