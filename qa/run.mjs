// 答案くみたての検査。問題の作り方（論点ごとに2000問：4つの段・段ごとに答えは1つ・規範の札に出どころが残らない・出典）・
// 今日の5問と上級の組み方（3年分）・とことんの並び（何百回作って1回の中で重ならない）・通しで遊ぶ・まちがい・ヒント・続きから・
// 上級・練習（科目・難しさ・論点）・とことん・論点帳・実績・カレンダー・あとから・古いタブ・自信・復習・文字の大きさ・言い方（法律の相談にしない）・スマホ幅・PWA・引き継ぎ・見やすさを確かめる。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { checkTransfer } from "./transfer-check.mjs";
import { checkSwStall } from "./sw-check.mjs";
import { checkDepth } from "./depth-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail).slice(0, 400) });
const G = createRequire(import.meta.url)(path.join(root, "data.js"));
const KEY = "toan-v1", DKEY = "toan-depth", FSKEY = "toan-fs";

const PIN = "m_93:1:4"; // 第1回の1問目（変わったら過去の日の問題が変わった印）
// ---- 1. 問題の作り方（ブラウザを使わない）----
{
  const bad = {}, seen = {}, N = 2000;
  for (const k of G.KINDS) {
    seen[k.id] = new Set();
    for (let s = 0; s < N; s++) {
      const P = G.make(`${k.id}|qa${s}`), why = [];
      if (P.steps.length !== 4 || P.steps.map((x) => x.name).join() !== "問題提起,規範,あてはめ,結論") why.push("段が4つでない");
      P.steps.forEach((st, j) => { const n = j === 3 ? 2 : 3; if (st.opts.length !== n || new Set(st.opts).size !== n || st.opts.filter((o) => o === st.ans).length !== 1) why.push(`${st.name}の札が${n}つでない・答えが1つでない`); });
      if ([P.fact, ...P.steps.flatMap((x) => x.opts)].some((x) => typeof x !== "string" || !x || /undefined|NaN|null|\$\{/.test(x))) why.push("中身が空");
      if (P.steps[1].opts.some((o) => /（[^（）]*(?:条|判例)[^（）]*）/.test(o))) why.push("規範の札に出どころ（○条・判例）が残っていて、答えが分かる");
      if (!P.src.length || P.src.some((x) => !Array.isArray(x) || !/^https:\/\//.test(x[1]))) why.push("出典が無い");
      if (JSON.stringify(G.make(`${k.id}|qa${s}`)) !== JSON.stringify(P)) why.push("同じ種で同じ問題にならない");
      seen[k.id].add(G.keyOf(P));
      if (why.length && !bad[k.id]) bad[k.id] = why.join("・");
    }
  }
  check(`問題：${G.KINDS.length}論点×${N}問で、4つの段・段ごとに札3つ（結論は2つ）で答えは1つ・規範の札に出どころが残らない・出典がある`, Object.keys(bad).length === 0, JSON.stringify(bad));
  const total = Object.values(seen).reduce((a, s) => a + s.size, 0), few = G.KINDS.filter((k) => seen[k.id].size < 30).map((k) => `${k.id}:${seen[k.id].size}`);
  check("問題の数：全部で1000通り以上・どの論点も30通り以上（好きなだけ遊んでも同じ問題が続かない。game-dev.md F6）", total >= 1000 && few.length === 0, `${total}通り ${few.join(",")}`);
  const cnt = (lv, s) => G.kindsOf(lv, s).length;
  check("論点：3科目それぞれ、やさしい・ふつう・むずかしいが2つ以上（今日の5問と上級が組める）", ["ken", "min", "kei"].every((s) => [0, 1, 2].every((l) => cnt(l, s) >= 2)), JSON.stringify([0, 1, 2].map((l) => ["ken", "min", "kei"].map((s) => cnt(l, s)))));
  // 結論が二つに分かれる論点は、事例で結論が入れかわる（どちらかを覚えるだけで当たらない）。全部の事例で結論の札が答えに使われる
  const oneSided = G.KINDS.filter((k) => k.cases.length > 1 && new Set(k.cases.map((c) => c.yes)).size < 2).map((k) => k.id);
  check("事例が2つある論点は、結論が事例で入れかわる", oneSided.length === 0, oneSided.join(","));
  // 問題提起のまちがいの札に、同じ事例でも正しく見えてしまう論点（FAM）を出さない
  const famBad = [];
  for (const k of G.KINDS) for (let s = 0; s < 300; s++) { const P = G.make(`${k.id}|fam${s}`); for (const o of P.steps[0].opts) { const x = G.KINDS.find((y) => y.issue === o); if (x && x.id !== k.id && (G.near(x.id, k.id) || x.s !== k.s)) famBad.push(`${k.id}:${x.id}`); } }
  check("問題提起のまちがいの札は、同じ科目のほかの論点から・似た論点（FAM）は出さない", famBad.length === 0, [...new Set(famBad)].slice(0, 5).join(","));
  const longWhy = [], longLook = [];
  for (const k of G.KINDS) { if ([...k.why].length > 130) longWhy.push(k.id); if ([...k.look].length > 45) longLook.push(k.id); }
  check("なぜは130字以内・ヒントは45字以内（一文を短く）", !longWhy.length && !longLook.length, longWhy.concat(longLook).join(","));
  const okBench = Object.entries(G.SRC).filter(([id]) => id.startsWith("h_")).every(([, [n]]) => /^最高裁 (昭和|平成|令和)\d+年\d+月\d+日 (大法廷|第[一二三]小法廷)(判決|決定)（.+）$/.test(n));
  check("判例の名前は「最高裁 年月日 法廷 判決・決定（事件名）」の形（年月日・法廷は判例ページの表示を写す。CodeRabbit #1 で法廷名のちがいが見つかった）", okBench);
  const used = new Set(G.KINDS.flatMap((k) => k.src)), okSrc = [...used].every((id) => G.SRC[id]) && Object.entries(G.SRC).filter(([id]) => used.has(id)).map(([, v]) => v).every(([n, u]) => n && /^https:\/\/(laws\.e-gov\.go\.jp\/law\/|www\.courts\.go\.jp\/hanrei\/\d+\/detail2\/index\.html$)/.test(u));
  check("使う出典は e-Gov 法令検索と裁判所の裁判例（判例ごとのページ）だけ（確かめ中の判例は PENDING に置き、使わない）", okSrc);
  const hsrc = G.KINDS.filter((k) => /判例/.test(k.rule) && !k.src.some((s) => s.startsWith("h_"))).map((k) => k.id);
  check("規範が「判例」による論点には、判例の出典が付いている", hsrc.length === 0, hsrc.join(","));
  check("条文の言葉（jo）は、どれも法令・条・項・本文の形（e-Gov との照合は tools/check-laws.mjs）", G.KINDS.every((k) => k.jo.every((j) => ["憲法", "民法", "刑法"].includes(j[0]) && Number.isInteger(j[1]) && Number.isInteger(j[2]) && typeof j[3] === "string" && j[3].length >= 6)));
  check("人の名前は記号だけ（A・B・C／甲・乙・丙）。実在の人・会社の名前を入れない", G.KINDS.every((k) => !/株式会社[^A]|さん|氏/.test(k.cases.map((c) => c.f("x")).join(""))));
}
{
  // 今日の5問・上級の組み方（3年分）
  const bad = [], cover = new Set(); let sameAsPrev = 0, prev = "";
  const d0 = Date.parse("2026-11-13");
  for (let i = 0; i < 365 * 3; i++) {
    const d = new Date(d0 + i * 864e5).toISOString().slice(0, 10), dl = G.dailyTags(d), hl = G.hardTags(d);
    const dk = dl.map((t) => t.split("|")[0]), hk = hl.map((t) => t.split("|")[0]);
    if (dl.length !== 5 || new Set(dk).size !== 5 || dk.map((k) => G.BY[k].lv).join() !== "0,0,1,1,2" || new Set(dk.map((k) => G.BY[k].s)).size !== 3) bad.push(d + " 今日");
    if (hl.length !== 3 || new Set(hk).size !== 3 || hk.some((k) => G.BY[k].lv !== 2) || hk.includes(dk[4]) || new Set(hk.map((k) => G.BY[k].s)).size !== 3) bad.push(d + " 上級");
    if (JSON.stringify(dl) !== JSON.stringify(G.dailyTags(d))) bad.push(d + " 同じにならない");
    if (dk.join() === prev) sameAsPrev++; prev = dk.join();
    if (i < 90) [...dk, ...hk].forEach((k) => cover.add(k));
  }
  check("今日の5問（やさしい2・ふつう2・むずかしい1、3科目がそろい論点は重ねない）と上級（3科目のむずかしい各1・今日のむずかしいと別）を3年分作れる", bad.length === 0, bad.slice(0, 5).join(","));
  check(`3か月のうちに${G.KINDS.length}論点が全部出る・前の日と同じ組の日が少ない`, cover.size === G.KINDS.length && sameAsPrev < 10, `${cover.size}論点・前の日と同じ ${sameAsPrev}日`);
  const P0 = G.make(G.dailyTags("2026-11-13")[0]);
  check("第1回（2026-11-13）の1問目が作ったときのまま（並べ替え・削除で過去の日の問題を変えない）", `${P0.kind}:${P0.v}` === PIN, `${P0.kind}:${P0.v}`);
}

// ---- 2. ファイルの中身 ----
const html = readFileSync(path.join(root, "index.html"), "utf8"), gen = readFileSync(path.join(root, "data.js"), "utf8"), readme = readFileSync(path.join(root, "README.md"), "utf8");
const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$/.test(u));
check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない（出典のリンクは押したときに開くだけ）", ext.length === 0 && ![...html.matchAll(/<script[^>]+src="([^"]+)"/g)].some((m) => /^https?:/.test(m[1])), ext.join(","));
check("CSP で通信先を自分だけにしている", /connect-src 'self'/.test(html) && !/connect-src[^;"]*https/.test(html));
check("Math.random は練習・とことんの種だけ（今日の5問・上級は日付の乱数。data.js には無い）", (html.match(/Math\.random/g) || []).length === 2 && !/Math\.random/.test(gen));
check("乱数は sort の比較の中で引かない（ブラウザで引く回数が変わる）", !/\.sort\(\s*\([^)]*\)\s*=>[^\n;]*\b(R|rng|rand|Math\.random)\s*\(/.test(html + gen));
check("一行の式の途中にコメント // を足さない（行の残りが消える。rosen-hitofude 2026-11-04）", !/;\s*\/\/[^\n]*;\s*\w/.test(gen.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n")));
check("言い方：「このゲームについて」と README に、法律の相談に使えないこと・判例の立場によること・相談先がある", /法律の相談には使えません/.test(html) && /判例の立場/.test(html) && /法テラス/.test(html) && /法律の相談/.test(readme));
check("写し元（健康情報みぬき）の言葉が残っていない", !/健康情報|健康食品|みぬき|見抜き|kenko|根拠なし|広告|医師・薬剤師|__km\b/.test(html + gen + readme));
check("公開リポジトリに、作った人の学校・名前などを書かない", !/慶應|慶応|通信教育課程|keio/i.test(html + gen + readme));
check("画面にお笑いの言葉を入れない（本物っぽく）", !/お笑い|ギャグ|ツッコミ|なんでやねん|（うそ）/.test(html + gen));
check("引き継ぎ：transfer.js をゲームの script より前に、このゲームの記録のキー（記録・文字・復習）だけで読む・depth.js も前に読む", /<script src="transfer\.js" data-game="toan-kumitate" data-keys="toan-v1,toan-fs,toan-depth"><\/script>\s*<script src="depth\.js" data-game="toan-kumitate" data-key="toan-depth"><\/script>\s*<\/head>/.test(html) && html.indexOf('src="transfer.js"') < html.indexOf('src="data.js"') && /data-hk/.test(html) && existsSync(path.join(root, "transfer.js")));
check("好きなだけ遊べる：チケット・回数の上限・🔒で開くモードを入れない（game-dev.md F1・F2）", !/🎫|チケット|すると開く|🔒/.test(html) && !/\blife\b|ELIFE/.test(html));
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/toan-kumitate/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームの name が3字以上（2字だとフォームが出ない。shared-workflows incidents/2026-11-05-feedback-form-not-shown.md）", [...((fy.match(/^name:\s*(.+)$/m) || [])[1] || "").trim()].length >= 3);
  check("感想フォームは名前・メールを聞かない", /id: fun/.test(fy) && !/id: (name|email|mail)/.test(fy) && /labels: \["感想"\]/.test(fy)); }
check("README の URL のすぐ後ろに全角の字を続けない（Link check が URL の一部と読む）", !/https?:\/\/[\x21-\x7e]*[^\x00-\x7f]/.test(readme.replace(/\]\(https?:\/\/[^)\s]+\)/g, "").replace(/<https?:\/\/[^>\s]+>/g, "")));
{ const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1]);
  check("PWA：sw.js は画面のファイルを全部保存し（引き継ぎの transfer.js・深さの depth.js も）、取り直して保存し、外へ何も送らない", ["./index.html", "./data.js", "./transfer.js", "./depth.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"].every((f) => shell.includes(f)) && /cache: "reload"/.test(sw) && !/https?:\/\//.test(sw.replace(/^\/\/.*$/gm, "")));
  { const st = await checkSwStall(sw); check("PWA：通信が止まっても4秒ほどで保存した画面に切り替わり、少しずつ届く受信は待ち、何も無ければ60秒で返す（shared-workflows template/qa/sw-check.mjs）", st.ok, JSON.stringify(st)); }
  check("PWA：manifest にアイコン2つと名前がある", mf.name === "答案くみたて" && mf.icons.length >= 2 && mf.start_url === "./"); }

// ---- 3. ブラウザで遊ぶ ----
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname), f = path.join(root, p === "/" ? "index.html" : p);
  if ((f !== root && !f.startsWith(root + path.sep)) || !existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
const TODAY = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
async function newPage(w = 390, ctx) {
  const c = ctx || await browser.newContext({ viewport: { width: w, height: 800 } });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); });
  await p.goto(url); await p.waitForTimeout(200);
  return p;
}
const closeHow = async (p) => { if (await p.locator("#howto[open]").count()) await p.click("#howto-ok"); };
// いまの段の正しい札・まだ押していないまちがいの札
const ansIdx = (p) => p.evaluate(() => { const c = __tk.cur(), st = c.P.steps[c.st]; return st.opts.indexOf(st.ans); });
const wrongIdx = (p) => p.evaluate(() => { const c = __tk.cur(), st = c.P.steps[c.st]; return st.opts.findIndex((o) => o !== st.ans && !c.wrong.includes(`${c.st}:${o}`)); });
const mem = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), KEY);
// 1問を4つの段まで組む（wrong：最初の段でまちがえる数）
async function solve(p, { wrong = 0 } = {}) {
  for (let i = 0; i < wrong; i++) await p.click(`.ch[data-j="${await wrongIdx(p)}"]`);
  for (let st = 0; st < 4; st++) { if (await p.locator(".verdict").count()) break; await p.click(`.ch[data-j="${await ansIdx(p)}"]`); }
  await p.waitForSelector(".verdict");
}

try {
  // はじめて：遊び方が出る・文字の大きさ
  const p = await newPage();
  check("はじめて開くと遊び方が出る", await p.locator("#howto[open]").count() === 1);
  { const c = await browser.newContext(); const r = await c.newPage(); await r.goto(url); await r.waitForTimeout(200); let again = 0;
    for (let i = 0; i < 10; i++) { await r.evaluate(() => localStorage.clear()); await r.reload(); await r.waitForTimeout(200); await r.keyboard.press("Escape"); await r.reload(); await r.waitForTimeout(200); again += await r.locator("#howto[open]").count(); }
    check("遊び方を Esc で閉じてすぐ読み直しても出ない（10回）", again === 0);
  { const c = await browser.newContext(); const r = await c.newPage(); const big = []; // 題が h1{flex:1} で縦に伸びないか（shared-workflows incidents/2026-11-07-title-stretched.md）
    for (const [w, h] of [[820, 1180], [390, 844], [1280, 800]]) { await r.setViewportSize({ width: w, height: h }); await r.goto(url); await r.waitForTimeout(200); await r.keyboard.press("Escape"); await r.waitForTimeout(100);
      const v = await r.evaluate(() => { const e = [...document.querySelectorAll(".title")].find((x) => x.offsetParent); if (!e) return null; const h = e.getBoundingClientRect().height; const f = e.style.flex; e.style.flex = "none"; const n = e.getBoundingClientRect().height; e.style.flex = f; return h - n; });
      if (v === null || v > 4) big.push(`${w}x${h}:${v === null ? "題なし" : "+" + Math.round(v) + "px"}`); }
    check("ホームの題は縦長の画面でも縦に伸びない（820×1180・390×844・1280×800）", big.length === 0, big.join(" ")); await c.close(); }
    await r.evaluate(() => localStorage.clear()); await r.reload(); await r.waitForTimeout(200);
    check("「わかった」を押したその場で「見た」が残る", await r.locator("#howto-ok").evaluate((b) => { b.click(); return Object.keys(localStorage).some((k) => { try { return JSON.parse(localStorage.getItem(k)).tut === true; } catch { return false; } }); }));
    await r.reload(); await r.waitForTimeout(200); check("遊び方を「わかった」で閉じてすぐ読み直しても出ない（その場で残す）", await r.locator("#howto[open]").count() === 0); await c.close(); }
  await p.click("#howto-ok");
  check("文字の大きさ：はじめは「大きい」（19px）", await p.evaluate(() => getComputedStyle(document.documentElement).fontSize) === "19px");
  await p.click('.fsrow button[data-fs="3"]');
  await p.reload(); await p.waitForTimeout(150);
  check("文字の大きさ：「とても大きい」にすると開き直しても残る", await p.evaluate(() => getComputedStyle(document.documentElement).fontSize) === "23px" && await p.locator('.fsrow button[data-fs="3"][aria-pressed="true"]').count() === 1);
  await p.click('.fsrow button[data-fs="2"]');
  check("ホームに今日のコツが出る", (await p.textContent("#tip")).includes("今日のコツ"));

  // 今日の5問：1問目はまちがえる、2問目はヒント2回、ほかはそのまま
  await p.click("#go-d");
  const tags = await p.evaluate(() => __tk.load().runs.d.list);
  check("今日の5問は日付から決まる（data.js の dailyTags と同じ）", JSON.stringify(tags) === JSON.stringify(G.dailyTags(TODAY)));
  check("問題の画面：科目と事例・答案の4つの段・押せる札3つ（高さ56px以上）", await p.locator("#card .fact").count() === 1 && /憲法|民法総論|刑法総論/.test(await p.textContent("#card .bar")) && await p.locator("#toan .ln").count() === 4 && await p.locator(".ch").count() === 3 && (await p.$$eval(".ch", (b) => b.map((x) => x.getBoundingClientRect().height))).every((h) => h >= 56));
  check("押せる札には読み上げ用の名前がある・いまの段の名前が出る", (await p.$$eval(".ch", (t) => t.filter((x) => !x.getAttribute("aria-label")).length)) === 0 && (await p.textContent("#stepq")).includes("問題提起"));
  await p.click(`.ch[data-j="${await wrongIdx(p)}"]`);
  check("まちがえると ✕ の印と「ちがう」の文字（色だけで分けない）・知らせは role=status", await p.locator(".ch.ng").count() === 1 && (await p.evaluate(() => getComputedStyle(document.querySelector(".ch.ng"), "::after").content)).includes("ちがう") && /✕/.test(await p.textContent("#msg")) && await p.getAttribute("#msg", "role") === "status");
  await p.click(`.ch[data-j="${await ansIdx(p)}"]`);
  check("正しい札を押すと答案の1段目に書き足され、次の段（規範）へ進む", (await p.textContent("#toan .ln:nth-child(1)")).length > 10 && await p.evaluate(() => __tk.cur().st) === 1 && (await p.textContent("#stepq")).includes("規範") && await p.locator("#toan .ln.now").count() === 1);
  // 開き直しても、段とまちがいは残る
  await p.reload(); await p.waitForTimeout(150); await p.click("#go-d");
  check("途中で閉じても続きから（同じ問題・同じ段・まちがいの数のまま）", await p.evaluate(() => __tk.cur().i) === 0 && await p.evaluate(() => __tk.cur().st) === 1 && await p.evaluate(() => __tk.cur().wrong.length) === 1);
  check("いまの段より前の段では、自信のボタンを出さない（まちがえた・進んだあとは押せない）", await p.locator("#dp-sure").count() === 0);
  await solve(p);
  check("組み終えると ✓ 答案ができた・答案の4段が埋まり、規範に出どころ（条・判例）が付く・なぜの説明・出典のリンク・★2（まちがい1回）", await p.locator(".verdict").count() === 1 && await p.locator("#toan .ln.todo, #toan .ln.now").count() === 0 && /条|判例/.test(await p.textContent("#toan .ln:nth-child(2)")) && (await p.textContent(".verdict .why")).length > 20 && await p.locator(".verdict .src a").count() >= 1 && (await p.getAttribute(".verdict .stars", "aria-label")) === "星2つ");
  check("組み終えたら、ヒントのボタンは隠れる", await p.locator("#hint:visible").count() === 0);
  await p.click("#next");
  await p.click("#hint");
  check("ヒント1は見るところを言う（札は消さない）", (await p.textContent("#hintbox")).includes("💡") && await p.locator(".ch.ng").count() === 0);
  await p.click("#hint");
  check("ヒント2はまちがいの札を消し、2つにしぼる・その段のヒントは2回まで", await p.locator(".ch.ng").count() === 1 && await p.locator("#hint:disabled").count() === 1);
  await p.click(`.ch[data-j="${await ansIdx(p)}"]`);
  check("次の段に進むと、ヒントをまた使える（段ごとに2回まで）", await p.locator("#hint:disabled").count() === 0 && (await p.textContent("#hintbox")) === "");
  await solve(p);
  check("ヒント2回は★1", (await p.getAttribute(".verdict .stars", "aria-label")) === "星1つ");
  await p.click("#next");
  check("次の問題へ進むと、フォーカスが問題（#card）に移る", await p.evaluate(() => document.activeElement && document.activeElement.id) === "card");
  for (let i = 2; i < 5; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  const s1 = await mem(p);
  check("5問で結果：今日の記録に1問ごとのまちがい（1・2・0・0・0）", JSON.stringify(s1.days[TODAY]?.m) === "[1,2,0,0,0]", JSON.stringify(s1.days[TODAY]));
  const share = await p.textContent(".share");
  check("シェアの文に答え・問題を出さない（印だけ）", /第\d+回/.test(share) && /🟢/.test(share) && !G.KINDS.some((k) => share.includes(k.name.slice(0, 4))) && !/条|判例|無効|罰/.test(share), share);
  check("まちがいのある日は Ko-fi の一言を出さない", await p.locator(".kofi").count() === 0);
  check("結果に「あと少しの実績」と、続けて遊ぶ・上級のボタン・組んだ論点の一覧", await p.locator("#achnext").count() === 1 && await p.locator("#go-e").count() === 1 && await p.locator("#go-h").count() === 1 && await p.locator(".rlist div").count() === 5);
  check("論点帳に組んだ論点が載る", Object.keys(s1.dex).length === 5);
  await p.click("#back");
  check("今日を終えたら、ホームは「今日の結果を見る」と上級", (await p.textContent("#go-d")).includes("結果") && await p.locator("#go-h").count() === 1);
  // 上級：ヒントなし・3問
  await p.click("#go-h");
  check("上級はヒントのボタンが無い・3問", await p.locator("#hint").count() === 0 && (await p.evaluate(() => __tk.load().runs.h.list.length)) === 3);
  for (let i = 0; i < 3; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  check("上級の記録は hdays に入る", (await mem(p)).hdays[TODAY]?.m.length === 3);
  // 練習：科目ごと・記録を増やさない
  await p.click("#back"); await p.click("#go-p"); await p.click('.lv button[data-s="kei"]');
  check("練習で科目を選ぶと、その科目だけ5問", (await p.evaluate(() => __tk.load().runs.p.list)).every((t) => G.BY[t.split("|")[0]].s === "kei") && (await p.evaluate(() => __tk.load().runs.p.list.length)) === 5);
  const before = await mem(p);
  for (let i = 0; i < 5; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  const after = await mem(p);
  check("練習は今日の記録を増やさない（論点帳の数はふえる）", JSON.stringify(after.days) === JSON.stringify(before.days) && Object.values(after.dex).reduce((a, b) => a + b) === Object.values(before.dex).reduce((a, b) => a + b) + 5);
  await p.click("#back"); await p.click("#go-p"); await p.click('.lv button[data-t="2"]');
  check("練習で難しさを選ぶと、その難しさだけ", (await p.evaluate(() => __tk.load().runs.p.list)).every((t) => G.BY[t.split("|")[0]].lv === 2));
  // 論点帳からその論点だけで練習
  await p.click("#back"); await p.click("#go-dex");
  check("論点帳は3科目に分かれる", (await p.$$eval(".agrp", (x) => x.map((e) => e.textContent))).join() === "憲法,民法総論,刑法総論");
  const firstKind = await p.getAttribute(".book button", "data-k");
  await p.click(".book button");
  check("論点帳の論点を押すと、その論点だけで練習", (await p.evaluate(() => __tk.load().runs.p.list)).every((t) => t.startsWith(firstKind + "|")));
  // とことん：まちがえてもヒントを使っても続き、「ここで降りる」で終わる（game-dev.md F1）
  await p.click("#back"); await p.click("#go-e");
  check("とことんは60問の並びから・ライフ（🌸・🎫）が無い", (await p.evaluate(() => __tk.load().runs.e.list.length)) === 60 && !("life" in await p.evaluate(() => __tk.load().runs.e)) && await p.locator("#quit").count() === 1);
  await solve(p); await p.click("#next"); await solve(p); await p.click("#next");
  await solve(p, { wrong: 2 }); await p.click("#next");
  await p.click("#hint"); await p.click("#hint"); await solve(p); await p.click("#next");
  check("とことんはまちがい2回・ヒント2回でも終わらない", await p.locator(".ch").count() >= 2 && await p.evaluate(() => __tk.load().runs.e.res.length) === 4);
  await p.click("#hint"); await p.click("#hint");
  await p.evaluate(() => { const c = __tk.cur(), st = c.P.steps[c.st]; [...document.querySelectorAll(".ch:not(.ng)")].find((b) => st.opts[+b.dataset.j] !== st.ans).click(); });
  await p.waitForTimeout(50);
  check("ヒント2のあとに残ったまちがいを選ぶと、正しい札だけが残る（消した札が戻らない。saibanin-shikumi #1）", await p.locator(".ch.ng").count() === 2 && await p.locator(".ch:not(.ng)").count() === 1 && await p.evaluate(() => { const c = __tk.cur(), st = c.P.steps[c.st]; const b = document.querySelector(".ch:not(.ng)"); return !!b && !b.disabled && st.opts[+b.dataset.j] === st.ans; }));
  await p.reload(); await p.waitForTimeout(200);
  check("とことんは閉じても続きから", (await p.textContent("#go-e")).includes("続きから"));
  await p.click("#go-e"); await solve(p); await p.click("#quit"); await p.waitForTimeout(150);
  check("組み終えた直後でも「ここで降りる」が効き、一度で組めた数（2問）が自己ベストに残る（kyuyo-meisai 1bebfdc）", (await mem(p)).ebest === 2 && (await p.textContent("#eres")).includes("5問") && !("e" in (await mem(p)).runs && (await mem(p)).runs.e));
  {
    const r = await p.evaluate(() => { const K = __tk.G, bad = []; for (let n = 0; n < 300; n++) { const l = __tk.endlessList(), more = l.concat(__tk.moreList(l)); const ks = more.map((t) => K.keyOf(K.make(t))); if (new Set(ks).size !== ks.length) bad.push("重なり"); if (more.some((t, i) => i && t.split("|")[0] === more[i - 1].split("|")[0])) bad.push("同じ論点が続く"); if (l.length !== 60 || more.length !== 100) bad.push("数" + l.length + "/" + more.length); } return bad; });
    check("とことんの並び300回：60問＋足した40問で同じ問題も同じ論点の連続も無い（game-dev.md F6）", r.length === 0, r.slice(0, 3).join(","));
  }
  {
    // 引き継ぎコードなどで数の所に文字が入っても、画面に HTML として出さない
    const q = await newPage(); await closeHow(q);
    await q.evaluate((K) => { const s = JSON.parse(localStorage.getItem(K)) || { v: 1 }; s.ebest = '<img id="xss" src=x>'; s.dex = { m_94: '"><b id="xss2">' }; s.runs = { e: { mode: "e", id: '"><i id="xss3">', date: "2026-11-13", list: ["m_94|1"], res: [] }, h: { list: "bad", res: [] }, p: { mode: "p", id: "y", date: "2026-11-13", list: ["constructor|1"], res: [] }, d: { mode: "d", id: "z", date: "x", list: ["m_94|1"], res: [] }, "a:2026-11-12": { mode: "a", id: "a1", date: "2026-11-12", list: ["m_94|1"], res: [null] }, "a:2026-11-11": { mode: "a", id: "a3", date: "2026-11-11", list: ["m_94|1", "m_94|2"], res: [{ m: 0 }], cur: { i: 1, tag: "m_94|2", wrong: "x", hints: 0 } } }; s.days = { "2026-11-13": { m: "x" }, bad: { m: [0] }, "2026-02-30": { m: [0] } }; localStorage.setItem(K, JSON.stringify(s)); }, KEY);
    await q.reload(); await q.waitForTimeout(250);
    const st = await q.evaluate(() => __tk.load());
    check("記録の形を直す：数の所の文字は0に・形のちがう途中経過と日ごとの記録は捨てる", st.ebest === 0 && st.dex.m_94 === 0 && st.runs.e && !("h" in st.runs) && !("p" in st.runs) && !("d" in st.runs) && !("a:2026-11-12" in st.runs) && st.runs["a:2026-11-11"] && st.runs["a:2026-11-11"].cur === null && Object.keys(st.days).length === 0);
    // 段の番号やまちがいの札が壊れていても、画面が出る
    await q.evaluate((K) => { const s = JSON.parse(localStorage.getItem(K)); s.runs.p = { mode: "p", id: "pp", date: "2026-11-13", list: ["m_94|1"], res: [], cur: { i: 0, tag: "m_94|1", wrong: ["9:x", 3, "1:ない札"], hints: "a", st: 99, hs: -1 } }; localStorage.setItem(K, JSON.stringify(s)); }, KEY);
    await q.reload(); await q.waitForTimeout(150); await q.evaluate(() => __tk.play("p"));
    check("壊れた段の番号・まちがいの札は直して出す（最後の段・まちがい0）", await q.evaluate(() => __tk.cur().st) === 3 && await q.evaluate(() => __tk.cur().wrong.length) === 0 && await q.locator(".ch").count() === 2);
    {
      const z = await newPage(); await closeHow(z);
      await z.evaluate((K) => { const s = JSON.parse(localStorage.getItem(K)) || { v: 1 }; s.v = 1; s.runs = { d: { mode: "x", date: "2026-11-13", list: [], res: [] }, h: { mode: "d", date: "2026-11-13", list: [], res: [] } }; localStorage.setItem(K, JSON.stringify(s)); }, KEY);
      await z.reload(); await z.waitForTimeout(200);
      const r = await z.evaluate(() => __tk.load().runs);
      check("知らない mode の途中経過は捨て、ホームが出る", !("d" in r) && !("h" in r) && await z.locator("#go-d").count() === 1);
      await z.evaluate((K) => { const s = __tk.load(), y = "2026-11-12", G = __tk.G; s.runs.h = { mode: "h", date: y, list: G.hardTags(y), res: [{ m: 0 }, { m: 0 }, { m: 0 }], cur: null, id: "old" }; localStorage.setItem(K, JSON.stringify(s)); }, KEY);
      await z.reload(); await z.waitForTimeout(200); await z.evaluate(() => __tk.start("h"));
      check("終えたまま残った前の日の回は、上書きする前に記録する", !!(await mem(z)).hdays["2026-11-12"]);
      const ok = await z.evaluate((K) => { const s = __tk.load(); s.runs.e = { mode: "e", date: __tk.todayKey(), list: ["m_94|1", "m_93|1"], res: [{ m: 0 }, { m: 0 }], cur: null, id: "e1" }; localStorage.setItem(K, JSON.stringify(s)); const ml = __tk.setMore(() => []); try { __tk.play("e"); return true; } catch (e) { return String(e); } finally { __tk.setMore(ml); } }, KEY);
      check("とことんで足せる問題が無くても固まらずに終える", ok === true && await z.locator("#eres").count() === 1, String(ok));
      await z.context().close();
    }
    {
      // 保存に失敗したタブ（メモリ）と保存済みの記録を合わせるとき（CodeRabbit #1）
      const r = await q.evaluate((K) => {
        const base = { v: 1, tut: true, days: {}, hdays: {}, adays: {}, dex: {}, kofi: {}, ach: {}, ebest: 0 }, d = __tk.todayKey();
        const run = (cur) => ({ mode: "e", id: "same", date: d, list: ["m_94|1", "m_93|1"], res: [], cur });
        localStorage.setItem(K, JSON.stringify({ ...base, t: 1, runs: { e: run({ i: 0, tag: "m_94|1", wrong: [], hints: 0, st: 0, hs: 0 }) } }));
        __tk.setMem(JSON.stringify({ ...base, t: 2, runs: { e: null } }));
        const quit = __tk.load().runs.e;
        localStorage.setItem(K, JSON.stringify({ ...base, t: 1, runs: { e: run({ i: 0, tag: "m_94|1", wrong: [], hints: 3, st: 0, hs: 2 }) } }));
        __tk.setMem(JSON.stringify({ ...base, t: 2, runs: { e: run({ i: 0, tag: "m_94|1", wrong: ["0:x"], hints: 0, st: 0, hs: 0 }) } }));
        const c = __tk.load().runs.e.cur; __tk.setMem(null);
        return [!quit, c.hints, c.wrong.join()];
      }, KEY);
      check("保存に失敗したあと：新しい側で降りたとことんを戻さない・同じ問題のヒントとまちがいは両方を残す", r[0] === true && r[1] === 3 && r[2] === "0:x", JSON.stringify(r));
    }
    check("記録の文字を HTML として出さない", await q.locator("#xss, #xss2, #xss3").count() === 0);
    await q.context().close();
  }
  // 保存できないあいだは帯を出したまま、保存できたら消す（drift-check save:silent）
  {
    const cx = await browser.newContext({ viewport: { width: 390, height: 800 } });
    await cx.addInitScript(() => { const o = Storage.prototype.setItem; window.__block = true; Storage.prototype.setItem = function (k, v) { if (window.__block && k === "toan-v1") throw new Error("full"); return o.call(this, k, v); }; });
    const q = await newPage(390, cx); await closeHow(q); await q.click("#go-d"); await q.click(`.ch[data-j="${await ansIdx(q)}"]`); await q.waitForTimeout(2500);
    check("保存できないと、画面の上に帯が1つ出て、数秒たっても消えない・遊び続けられる", await q.locator("#savewarn").count() === 1 && await q.evaluate(() => __tk.cur().st) === 1);
    await q.evaluate(() => { window.__block = false; }); await q.click(`.ch[data-j="${await ansIdx(q)}"]`); await q.waitForTimeout(100);
    check("保存できるようになったら帯は消え、メモリにあった途中経過も保存される", await q.locator("#savewarn").count() === 0 && (await mem(q)).runs.d.cur.st === 2);
    await cx.close();
  }
  // 実績・このゲームについて
  await p.click("#back"); await p.click("#go-ach");
  check("実績は14個で、腕前・集める・続けるの3つの組", await p.locator(".ach").count() === 14 && await p.locator(".agrp").count() === 3 && await p.locator(".ach.got").count() >= 2);
  check("達成した実績は ✓ の文字も付く（色だけで分けない）", (await p.textContent(".ach.got b")).startsWith("✓"));
  await p.click("#back"); await p.click("#f-about");
  check("このゲームについて：法律の相談に使えないこと・条文と判例の出典", (await p.textContent("#about")).includes("法律の相談には使えません") && await p.locator("#about a").count() >= 3 + Object.keys(G.SRC).filter((k) => k.startsWith("h_")).length);
  await p.context().close();

  // まちがいなしの日は Ko-fi を1回だけ
  {
    const q = await newPage(); await closeHow(q); await q.click("#go-d");
    for (let i = 0; i < 5; i++) { await solve(q); await q.click("#next"); }
    await q.waitForTimeout(150);
    check("全部まちがいなしで初めて終えたときだけ Ko-fi の一言", await q.locator(".kofi").count() === 1 && (await q.textContent(".big")).includes("まちがいなし"));
    await q.click("#back"); await q.click("#go-d");
    check("結果をもう一度見ても Ko-fi は出さない", await q.locator(".kofi").count() === 0);
    await q.context().close();
  }

  // カレンダー・あとから：時計を10日進めて、過去の日の記録を置いて見る
  {
    const SHIFT = 10 * 864e5, TODAY = new Date(Date.now() + 9 * 3600e3 + SHIFT).toISOString().slice(0, 10), dayBefore = (n) => new Date(Date.parse(TODAY) - n * 864e5).toISOString().slice(0, 10);
    const cx = await browser.newContext({ viewport: { width: 390, height: 800 } });
    await cx.addInitScript((sh) => { const o = Date.now; Date.now = () => o() + sh; }, SHIFT);
    const q = await newPage(390, cx);
    await q.evaluate(([d2, d3, K]) => { localStorage.setItem(K, JSON.stringify({ v: 1, tut: true, days: { [d2]: { m: [0, 0, 0, 0, 0], k: [] }, [d3]: { m: [1, 0, 0, 2, 0], k: [] } }, hdays: {}, adays: {}, dex: {}, runs: {}, kofi: {}, ach: {}, ebest: 0 })); }, [dayBefore(2), dayBefore(3), KEY]);
    await q.reload(); await q.waitForTimeout(150);
    check("ホームの「続けて」は、きのうを休んだら — （休んだ日を責めない）", (await q.textContent(".stats")).includes("—"));
    await q.click("#go-cal");
    const lateList = await q.evaluate(() => __tk.lateDays(__tk.load()));
    const exp = [1, 4, 5, 6, 7].map(dayBefore).filter((d) => d >= "2026-11-13");
    check("カレンダー：取りこぼした過去7日（第1回より後）を押せる", JSON.stringify(lateList) === JSON.stringify(exp), lateList.join(","));
    if (lateList.length) {
      const d = lateList[0];
      await q.evaluate((d) => { const b = document.querySelector(`.cal .miss[data-k="${d}"]`); if (b) b.click(); else { const m = document.querySelector(".calnav #prev"); m && m.click(); } }, d);
      if (!(await q.locator(".ch").count())) await q.click(`.cal .miss[data-k="${d}"]`);
      check("あとから：その日の今日の5問と同じ問題", JSON.stringify(await q.evaluate((d) => __tk.load().runs["a:" + d].list, d)) === JSON.stringify(G.dailyTags(d)));
      for (let i = 0; i < 5; i++) { await solve(q); await q.click("#next"); }
      await q.waitForTimeout(150);
      const s = await mem(q);
      check("あとからは adays に入り、今日の記録・続けた日には数えない", s.adays[d] && !s.days[d] && (await q.locator(".share").count()) === 0 && (await q.locator(".kofi").count()) === 0);
    } else check("あとから：遊べる日がある", false, "第1回の日から日がたっていない");
    await q.context().close();
  }

  // 古いタブ：同じ問題を2つのタブで開き、片方で答えたら、もう片方は二重に入れない
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const a = await newPage(390, ctx); await closeHow(a); await a.click("#go-d");
    const b = await ctx.newPage(); b.on("pageerror", (e) => errors.push(e.message)); await b.goto(url); await b.waitForTimeout(150); await b.click("#go-d");
    await solve(a);
    await b.click(`.ch[data-j="${await ansIdx(b)}"]`);
    await b.waitForTimeout(200);
    const s = await mem(a);
    check("古いタブで同じ問題に答えても二重に数えない", s.runs.d.res.length === 1 && Object.values(s.dex).reduce((x, y) => x + y) === 1);
    await a.click("#next"); await b.goto(url); await b.waitForTimeout(150); await b.click("#go-d");
    await a.click("#hint"); await a.click("#hint");
    await b.click("#hint");
    check("別のタブで使ったヒントの数を減らさない", (await mem(a)).runs.d.cur.hints === 2);
    await a.click(`.ch[data-j="${await ansIdx(a)}"]`); await a.waitForTimeout(100);
    await b.evaluate(() => { const c = __tk.cur(), st = c.P.steps[c.st]; [...document.querySelectorAll(".ch:not(:disabled)")].find((x) => st.opts[+x.dataset.j] !== st.ans).click(); }); await b.waitForTimeout(100);
    check("別のタブで次の段へ進んでいたら、古い画面も同じ段になる", await b.evaluate(() => __tk.cur().st) === 1);
    await solve(b); await b.waitForTimeout(150);
    check("組み終えた時も、別のタブのヒントを合わせて数える（★1）", (await mem(b)).runs.d.res[1].m >= 2);
    await ctx.close();
  }

  // 1問を深くする（shared-workflows routines/game-dev.md「1問を深くする」）：自信をかける・4つの段・復習
  {
    const q = await newPage(); await closeHow(q);
    await q.evaluate((tags) => __tk.save((s) => { s.runs.p = { mode: "p", date: __tk.todayKey(), list: tags, res: [], cur: null, id: "dp" }; }), ["m_94|dp1", "p_36|dp2", "k_96|dp3"]);
    await q.evaluate(() => { Depth.runStart(); __tk.play("p"); });
    const sb = await q.$eval("#dp-sure", (b) => [b.getBoundingClientRect().height, b.getAttribute("aria-pressed"), b.textContent]);
    check("自信のボタン：高さ44px以上・はじめは押していない", sb[0] >= 44 && sb[1] === "false", sb.join(","));
    await q.click("#dp-sure");
    check("自信のボタンを押すと ✓ が出る（色だけで分けない）", (await q.getAttribute("#dp-sure", "aria-pressed")) === "true" && (await q.textContent("#dp-sure")).includes("✓"));
    await q.click(`.ch[data-j="${await ansIdx(q)}"]`); await q.click(`.ch[data-j="${await wrongIdx(q)}"]`);
    check("自信ありで、途中の段でまちがえると、知らせに「思いこみ」と出る", (await q.textContent("#msg")).includes("思いこみ"));
    check("まちがえたその時に復習へ入る（解き終えずにやめても残る）", await q.evaluate((D) => { const d = JSON.parse(localStorage.getItem(D) || "{}"); return !!(d.rv && d.rv[__tk.cur().tag]); }, DKEY));
    await solve(q);
    check("組み終えた画面に、自信ありでまちがえたことが出る", (await q.textContent(".verdict")).includes("自信ありでまちがえた"));
    await q.click("#next");
    await q.click("#dp-sure"); await solve(q);
    check("自信ありで一度で組めたら、そう出る", (await q.textContent(".verdict")).includes("自信ありで一度で組めた"));
    await q.click("#next"); await solve(q); await q.click("#next"); await q.waitForTimeout(150);
    check("終えた直後の結果に「自信ありの当たり」が出る", (await q.textContent("#surestat")).includes("1/2"));
    const dp = await q.evaluate((D) => JSON.parse(localStorage.getItem(D) || "{}"), DKEY);
    check("まちがえた・ヒントを使った問題だけ復習に入る", Object.keys(dp.rv || {}).join() === "m_94|dp1", Object.keys(dp.rv || {}).join(","));
    await q.evaluate((D) => { const d = JSON.parse(localStorage.getItem(D)); for (const k in d.rv) d.rv[k].due = "2026-01-01"; localStorage.setItem(D, JSON.stringify(d)); }, DKEY);
    await q.goto(url); await q.waitForTimeout(150);
    check("日の来た復習があると、ホームに「復習 1問」", (await q.textContent("#go-r")).includes("復習 1問"));
    const before = await mem(q);
    await q.click("#go-r");
    check("復習の画面は「復習」と出る・同じ問題", (await q.textContent("header")).includes("復習") && await q.evaluate(() => __tk.cur().tag) === "m_94|dp1");
    await solve(q); await q.click("#next"); await q.waitForTimeout(150);
    const after = await mem(q), dp2 = await q.evaluate((D) => JSON.parse(localStorage.getItem(D)), DKEY);
    check("復習を終えると結果は「復習」・今日の記録は増えない・シェアは出ない", (await q.textContent("h1")).includes("復習") && JSON.stringify(after.days) === JSON.stringify(before.days) && await q.locator("#share").count() === 0);
    check("復習で一度で組むと、次は3日後へ進む", Object.values(dp2.rv).every((x) => x.s === 1 && x.due > TODAY));
    await q.goto(url); await q.waitForTimeout(150);
    check("復習を終えたら、ホームの「復習」は消える", await q.locator("#go-r").count() === 0);
    await q.evaluate((D) => { const d = JSON.parse(localStorage.getItem(D)); d.rv["nai|1"] = { s: 0, due: "2026-01-01", t: 1 }; d.rv["constructor|x"] = { s: 0, due: "2026-01-01", t: 2 }; localStorage.setItem(D, JSON.stringify(d)); }, DKEY);
    await q.goto(url); await q.waitForTimeout(150);
    check("作り直せない鍵（無い論点・constructor）は復習に数えず、ホームも出る", await q.locator("#go-d").count() === 1 && await q.locator("#go-r").count() === 0);
    { const rk = Object.keys(dp2.rv)[0];
      await q.evaluate(([k, D]) => { const d = JSON.parse(localStorage.getItem(D)); d.rv = { [k]: { s: 0, due: "2026-01-01", t: 3 } }; localStorage.setItem(D, JSON.stringify(d)); }, [rk, DKEY]);
      await q.goto(url); await q.waitForTimeout(150); await q.click("#go-r"); await q.click("#hint");
      await q.evaluate(() => __tk.save((s) => { s.runs.r.date = "2026-01-02"; }));
      await q.goto(url); await q.waitForTimeout(150);
      check("復習の途中でヒントを使って日の来た問題が0になっても・日が替わっても、ホームの「復習の続きから」で戻れる", ((await q.locator("#go-r").count()) ? await q.textContent("#go-r") : "").includes("続きから"));
      if (await q.locator("#go-r").count()) { await q.click("#go-r"); check("復習の続きは同じ問題・使ったヒントはそのまま", await q.evaluate(() => __tk.cur().tag) === rk && await q.evaluate(() => __tk.cur().hints) === 1); }
    }
    await q.context().close();
  }
  // スマホ幅・とても大きい文字でもはみ出さない・押す所は44px以上
  {
    const bad = [], small = [];
    for (const [w, fs] of [[320, 3], [390, 2], [320, 1]]) {
      const q = await newPage(w); await closeHow(q);
      await q.evaluate(([fs, K]) => localStorage.setItem(K, String(fs)), [fs, FSKEY]); await q.reload(); await q.waitForTimeout(150);
      for (const go of [null, "#go-d", "solve", "#go-p", "#go-cal", "#go-dex", "#go-ach", "#go-e"]) {
        if (go === "solve") { await solve(q); }
        else if (go) { await q.goto(url); await q.waitForTimeout(100); await q.click(go); }
        await q.waitForTimeout(100);
        const ov = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (ov > 0) bad.push(`${w}px 文字${fs} ${go || "ホーム"} ${ov}px`);
        small.push(...(await q.$$eval("button:not([disabled]), a[href]", (bs) => bs.filter((b) => b.checkVisibility() && !b.closest(".cal")).filter((b) => b.getBoundingClientRect().height < 44).map((b) => (b.id || b.className || b.textContent).slice(0, 20)))).map((x) => `${w}/${fs}/${go}:${x}`));
      }
      await q.context().close();
    }
    check("幅320px・とても大きい文字でも横にはみ出さない", bad.length === 0, bad.join(" / "));
    check("押せる所は高さ44px以上", small.length === 0, [...new Set(small)].slice(0, 8).join(","));
  }
  // 見やすさの設定を全部入れても、ページの一番下まで動ける
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 700 } });
    await ctx.addInitScript(() => localStorage.setItem("a11y-v1", JSON.stringify({ read: true, cvd: true, calm: true, say: true, ruby: true })));
    const q = await newPage(390, ctx); await closeHow(q);
    const r = await q.evaluate(() => { window.scrollTo(0, 1e5); const f = document.querySelector("footer").getBoundingClientRect(); return [scrollY, Math.round(f.bottom), innerHeight, getComputedStyle(document.documentElement).position]; });
    check("見やすさの設定を全部入れても、いちばん下まで動ける（html が固定されない）", r[0] > 0 && r[1] <= r[2] && r[3] === "static", r.join(","));
    await ctx.close();
  }
  // キーボードだけで遊べる（Tab と Enter）
  {
    const q = await newPage(); await closeHow(q);
    await q.focus("#go-d"); await q.keyboard.press("Enter"); await q.waitForTimeout(100);
    for (let st = 0; st < 4; st++) { await q.focus(`.ch[data-j="${await ansIdx(q)}"]`); await q.keyboard.press("Enter"); await q.waitForTimeout(80); }
    check("キーボードだけで4つの段を選んで組める", await q.locator(".verdict").count() === 1);
    await q.context().close();
  }
} catch (e) { check("ブラウザでの検査が最後まで動く", false, e.stack.split("\n").slice(0, 3).join(" ")); }

// 深さの部品（shared-workflows template/qa/depth-check.mjs）
{ const e = await checkDepth(readFileSync(path.join(root, "depth.js"), "utf8")); check("depth.js（自信をかける・復習）の動き", e.length === 0, e.join(" / ")); }
// 引き継ぎコード（shared-workflows template/qa/transfer-check.mjs）
try {
  const sample = { [KEY]: JSON.stringify({ v: 1, tut: true, days: { "2026-11-13": { m: [0, 1, 0, 0, 2], k: ["m_93", "p_36", "k_shijin", "m_95", "p_kyobo"] } }, hdays: {}, adays: {}, dex: { m_93: 1, p_36: 1, k_shijin: 1, m_95: 1, p_kyobo: 1 }, runs: {}, kofi: {}, ach: {}, ebest: 7, t: 1 }), [FSKEY]: "3" };
  await checkTransfer({ browser, url, game: "toan-kumitate", sample, check, open: async (pg) => { if (await pg.locator("#howto[open]").count()) await pg.click("#howto-ok"); } });
} catch (e) { check("引き継ぎの検査が最後まで動く", false, e.message.split("\n")[0]); }
await browser.close();
server.close();
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));

{ // 見やすさ・読みやすさ・偏り（shared-workflows template/qa/a11y.mjs の写し）
  const { spawnSync } = await import("node:child_process");
  const a = spawnSync(process.execPath, [path.join(root, "qa", "a11y.mjs")], { encoding: "utf8", env: process.env });
  check("見やすさ・読みやすさの検査（qa/a11y.mjs。中身は qa-report/a11y.md）", a.status === 0, (a.stdout.match(/^- ❌.*$/gm) || []).join(" / ") || (a.status ? a.stderr.slice(-300) : ""));
}

const ng = results.filter((r) => !r.ok);
const md = `# 答案くみたて QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);
