const sharp = require("sharp");
const path = require("path");

const SRC = "D:/Mufeed/Sevent/Screenshots/RFQ and RFP/Screenshot 2026-04-26 162601.png";
const OUT = "D:/Mufeed/Sevent/Screenshots/RFQ and RFP/Screenshot 2026-04-26 162601 - cropped.png";

sharp(SRC)
  .metadata()
  .then(meta => {
    const { width, height } = meta;
    const half = Math.floor(width / 2);
    return sharp(SRC)
      .extract({ left: 0, top: 0, width: half, height })
      .toFile(OUT)
      .then(() => console.log(`Cropped ${width}x${height} → ${half}x${height} → ${OUT}`));
  })
  .catch(err => { console.error(err); process.exit(1); });
