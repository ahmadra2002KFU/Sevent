const path = require('path');
const pptxgen = require('pptxgenjs');
const html2pptx = require('./html2pptx.js');

async function build() {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Ahmad Rabaya';
  pptx.title = 'Sevent — Weekly Progress Report';

  const deckDir = __dirname;
  const slides = [
    'slide1.html', 'slide2.html', 'slide3.html', 'slide4.html',
    'slide5.html', 'slide6.html', 'slide7.html', 'slide8.html'
  ];

  for (const f of slides) {
    await html2pptx(path.join(deckDir, f), pptx);
    console.log('Added', f);
  }

  const outPath = path.join(deckDir, 'sevent-weekly-report.pptx');
  await pptx.writeFile({ fileName: outPath });
  console.log('Wrote', outPath);
}

build().catch(err => { console.error(err); process.exit(1); });
