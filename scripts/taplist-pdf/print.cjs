// HTML を A4 の PDF にする(Playwright の Chromium を使う開発用の道具)。使い方: node print.cjs <in.html> <out.pdf>
const { chromium } = require('playwright');
(async () => {
  const [, , input, output] = process.argv;
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const p = await b.newPage();
  await p.goto('file://' + require('path').resolve(input));
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: output, format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, preferCSSPageSize: true });
  await b.close();
})();
