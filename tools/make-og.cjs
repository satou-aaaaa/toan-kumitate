// SNS で貼られたときの絵（og.png 1200×630）を作る。今日の問題（答え）は入れず、答案の4つの段の見本だけ。
// 使い方: node tools/make-og.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const ln = (h, t, red) => `<div style="display:flex;gap:16px;align-items:center;font-size:30px;font-weight:700;padding:12px 18px;border-radius:12px;background:#fff;border:3px solid ${red ? "#b23a24" : "#1d2a3f55"}"><b style="flex:0 0 150px;text-align:center;color:#fff;background:${red ? "#b23a24" : "#1f4f7a"};border-radius:8px;padding:4px 0;font-size:28px">${h}</b><span>${t}</span></div>`;
  await p.setContent(`<body style="margin:0;font-family:'Noto Sans CJK JP','IPAPGothic',sans-serif">
  <div style="width:1200px;height:630px;box-sizing:border-box;padding:52px 64px;background:#f3efe4;color:#1d2a3f;display:flex;gap:48px;align-items:center">
    <div style="flex:0 0 400px">
      <div style="font-size:30px;color:#83261a;letter-spacing:.06em">憲法・民法総論・刑法総論</div>
      <div style="font-size:96px;font-weight:900;margin-top:8px;line-height:1.15;color:#123554">答案<br><span style="color:#b23a24">くみたて</span></div>
      <div style="font-size:34px;margin-top:14px">論点を、4つの段で<br>組み立てる1日5問</div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;gap:14px;background:#fffdf7;border:4px solid #1d2a3f;border-radius:8px;padding:24px">${ln("問題提起", "何が争いになる？")}${ln("規範", "条文・判例の基準は？")}${ln("あてはめ", "事実をどう当てる？")}${ln("結論", "問いに答える", 1)}</div>
  </div></body>`);
  await p.screenshot({ path: path.join(__dirname, "..", "og.png") });
  await b.close();
})();
