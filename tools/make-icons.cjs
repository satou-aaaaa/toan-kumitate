// アプリのアイコン（icon-192.png・icon-512.png）を作る。生成りの答案用紙に、4つの段（最後の結論だけ朱）。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#f3efe4"/>
      <rect x="18" y="12" width="64" height="76" rx="4" fill="#fffdf7" stroke="#1d2a3f" stroke-width="2.4"/>
      <rect x="25" y="22" width="14" height="10" rx="2" fill="#1f4f7a"/><line x1="44" y1="27" x2="74" y2="27" stroke="#1d2a3f88" stroke-width="3" stroke-linecap="round"/>
      <rect x="25" y="38" width="14" height="10" rx="2" fill="#1f4f7a"/><line x1="44" y1="43" x2="70" y2="43" stroke="#1d2a3f88" stroke-width="3" stroke-linecap="round"/>
      <rect x="25" y="54" width="14" height="10" rx="2" fill="#1f4f7a"/><line x1="44" y1="59" x2="72" y2="59" stroke="#1d2a3f88" stroke-width="3" stroke-linecap="round"/>
      <rect x="25" y="70" width="14" height="10" rx="2" fill="#b23a24"/><line x1="44" y1="75" x2="64" y2="75" stroke="#b23a24" stroke-width="3.4" stroke-linecap="round"/></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
