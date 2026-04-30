// Convert MCP-style simplified JSON arrays in Claude Docs/diagrams/*.excalidraw.json
// into canonical Excalidraw .excalidraw files (version 2 schema).
// Run: node "Claude Docs/scripts/convert_to_excalidraw.js"

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SRC_DIR = path.join(__dirname, "..", "diagrams");
const FILES = [
  "01-marketplace-lifecycle",
  "02-roles-overview",
  "03-booking-state-machine",
];

const rand32 = () => crypto.randomBytes(4).readUInt32BE(0);

// Approximate text width for centering bound labels.
// Excalidraw uses Cascadia/Virgil/Helvetica; rough heuristic per char.
function textWidth(text, fontSize) {
  return text.length * fontSize * 0.6;
}
function textHeight(fontSize) {
  return Math.round(fontSize * 1.25);
}

function baseProps() {
  return {
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: rand32(),
    version: 1,
    versionNonce: rand32(),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
  };
}

function expand(simple) {
  const out = [];
  for (const e of simple) {
    if (e.type === "cameraUpdate" || e.type === "delete" || e.type === "restoreCheckpoint") continue;

    if (e.type === "rectangle" || e.type === "ellipse" || e.type === "diamond") {
      const id = e.id;
      const labelId = e.label ? `${id}_label` : null;
      const elem = {
        ...baseProps(),
        ...(e.strokeColor && { strokeColor: e.strokeColor }),
        ...(e.backgroundColor && { backgroundColor: e.backgroundColor }),
        ...(e.fillStyle && { fillStyle: e.fillStyle }),
        ...(e.strokeWidth !== undefined && { strokeWidth: e.strokeWidth }),
        ...(e.opacity !== undefined && { opacity: e.opacity }),
        type: e.type,
        id,
        x: e.x, y: e.y, width: e.width, height: e.height,
        roundness: e.roundness ?? null,
        boundElements: labelId ? [{ type: "text", id: labelId }] : null,
      };
      out.push(elem);

      if (e.label) {
        const fontSize = e.label.fontSize ?? 20;
        const tw = textWidth(e.label.text, fontSize);
        const th = textHeight(fontSize);
        const text = {
          ...baseProps(),
          type: "text",
          id: labelId,
          x: e.x + (e.width - tw) / 2,
          y: e.y + (e.height - th) / 2,
          width: tw,
          height: th,
          strokeColor: e.label.strokeColor ?? "#1e1e1e",
          fontSize,
          fontFamily: 5, // 5 = Excalifont (default in v2)
          text: e.label.text,
          textAlign: "center",
          verticalAlign: "middle",
          baseline: Math.round(fontSize * 0.85),
          containerId: id,
          originalText: e.label.text,
          lineHeight: 1.25,
          autoResize: true,
        };
        out.push(text);
      }
    } else if (e.type === "text") {
      const fontSize = e.fontSize ?? 20;
      const tw = textWidth(e.text, fontSize);
      const th = textHeight(fontSize);
      out.push({
        ...baseProps(),
        type: "text",
        id: e.id,
        x: e.x, y: e.y,
        width: tw, height: th,
        strokeColor: e.strokeColor ?? "#1e1e1e",
        fontSize,
        fontFamily: 5,
        text: e.text,
        textAlign: "left",
        verticalAlign: "top",
        baseline: Math.round(fontSize * 0.85),
        containerId: null,
        originalText: e.text,
        lineHeight: 1.25,
        autoResize: true,
      });
    } else if (e.type === "arrow") {
      const id = e.id;
      const labelId = e.label ? `${id}_label` : null;
      const elem = {
        ...baseProps(),
        type: "arrow",
        id,
        x: e.x, y: e.y,
        width: Math.abs(e.width || 0),
        height: Math.abs(e.height || 0),
        ...(e.strokeColor && { strokeColor: e.strokeColor }),
        ...(e.strokeStyle && { strokeStyle: e.strokeStyle }),
        ...(e.strokeWidth !== undefined && { strokeWidth: e.strokeWidth }),
        points: e.points || [[0, 0], [e.width || 0, e.height || 0]],
        lastCommittedPoint: null,
        startBinding: null,
        endBinding: null,
        startArrowhead: e.startArrowhead ?? null,
        endArrowhead: e.endArrowhead ?? "arrow",
        elbowed: false,
        boundElements: labelId ? [{ type: "text", id: labelId }] : null,
      };
      out.push(elem);

      if (e.label) {
        const fontSize = e.label.fontSize ?? 16;
        const tw = textWidth(e.label.text, fontSize);
        const th = textHeight(fontSize);
        const midX = e.x + (e.width || 0) / 2;
        const midY = e.y + (e.height || 0) / 2;
        out.push({
          ...baseProps(),
          type: "text",
          id: labelId,
          x: midX - tw / 2,
          y: midY - th / 2,
          width: tw,
          height: th,
          strokeColor: e.label.strokeColor ?? "#1e1e1e",
          fontSize,
          fontFamily: 5,
          text: e.label.text,
          textAlign: "center",
          verticalAlign: "middle",
          baseline: Math.round(fontSize * 0.85),
          containerId: id,
          originalText: e.label.text,
          lineHeight: 1.25,
          autoResize: true,
        });
      }
    }
  }
  return out;
}

const appState = {
  gridSize: null,
  viewBackgroundColor: "#ffffff",
};

for (const name of FILES) {
  const inPath = path.join(SRC_DIR, `${name}.excalidraw.json`);
  const outPath = path.join(SRC_DIR, `${name}.excalidraw`);
  const simple = JSON.parse(fs.readFileSync(inPath, "utf8"));
  const elements = expand(simple);
  const file = {
    type: "excalidraw",
    version: 2,
    source: "https://excalidraw.com",
    elements,
    appState,
    files: {},
  };
  fs.writeFileSync(outPath, JSON.stringify(file, null, 2));
  console.log(`Wrote ${outPath}  (${elements.length} elements)`);
}
