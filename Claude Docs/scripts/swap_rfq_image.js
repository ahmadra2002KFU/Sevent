// Pad the cropped 162601 image back to original 1897x988 (white right half)
// then swap it into the pptx in place of the original embedded image.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const JSZip = require("jszip");
const crypto = require("crypto");

const ORIG = "D:/Mufeed/Sevent/Screenshots/RFQ and RFP/Screenshot 2026-04-26 162601.png";
const CROPPED = "D:/Mufeed/Sevent/Screenshots/RFQ and RFP/Screenshot 2026-04-26 162601 - cropped.png";
const PADDED = "D:/Mufeed/Sevent/Screenshots/RFQ and RFP/Screenshot 2026-04-26 162601 - padded.png";
const PPTX = "D:/Mufeed/Sevent/Code/Claude Docs/RFQ-RFP-Walkthrough-AR.pptx";

async function main() {
  const origMeta = await sharp(ORIG).metadata();
  console.log(`Original: ${origMeta.width}x${origMeta.height}`);

  const croppedMeta = await sharp(CROPPED).metadata();
  const rightPad = origMeta.width - croppedMeta.width;
  await sharp(CROPPED)
    .extend({ top: 0, bottom: 0, left: 0, right: rightPad, background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .resize(origMeta.width, origMeta.height, { fit: "fill" })
    .toFile(PADDED);
  console.log(`Padded saved: ${PADDED}`);

  const origBuf = fs.readFileSync(ORIG);
  const origHash = crypto.createHash("sha256").update(origBuf).digest("hex");
  const origSize = origBuf.length;
  console.log(`Original size=${origSize} sha256=${origHash.slice(0, 16)}`);

  const pptxBuf = fs.readFileSync(PPTX);
  const zip = await JSZip.loadAsync(pptxBuf);

  const mediaFiles = Object.keys(zip.files).filter(n => n.startsWith("ppt/media/") && !zip.files[n].dir);
  console.log(`Media entries: ${mediaFiles.length}`);

  let matched = null;
  for (const name of mediaFiles) {
    const data = await zip.file(name).async("nodebuffer");
    if (data.length === 0) continue;
    const h = crypto.createHash("sha256").update(data).digest("hex");
    console.log(`  ${name}  size=${data.length}  sha=${h.slice(0,16)}`);
    if (h === origHash) {
      matched = name;
      break;
    }
  }

  if (!matched) {
    console.error("Could not find embedded image matching original 162601 by hash. Aborting swap.");
    process.exit(2);
  }

  console.log(`Match found: ${matched}`);
  const paddedBuf = fs.readFileSync(PADDED);
  zip.file(matched, paddedBuf);
  const out = await zip.generateAsync({ type: "nodebuffer" });
  fs.writeFileSync(PPTX, out);
  console.log(`Swapped image inside ${PPTX} (new size ${out.length})`);
}

main().catch(e => { console.error(e); process.exit(1); });
