// data.js の各論点の jo（[法令, 条, 項, 本文の言葉]）が、e-Gov 法令検索の本文にそのまま入っているかを1字ずつ照らす。
// 使い方: node tools/check-laws.mjs   （e-Gov 法令 API v1 を読む。外への通信はこの道具だけで、ゲームの画面は通信しない）
// 条文の言葉を足した・直したとき、法改正があったときに回す。ちがう所があれば 1 で終わる。
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const G = require('../data.js');
const LAWNUM = { 憲法: '昭和二十一年憲法', 民法: '明治二十九年法律第八十九号', 刑法: '明治四十年法律第四十五号' };
const strip = (x) => x.replace(/<[^>]+>/g, '').replace(/\s+/g, '');
const cache = new Map();
async function article(law, n, p) {
  const k = `${law}:${n}`;
  if (!cache.has(k)) {
    const url = `https://laws.e-gov.go.jp/api/1/articles;lawNum=${encodeURIComponent(LAWNUM[law])};article=${n}`;
    const r = await fetch(url); if (!r.ok) throw new Error(`${k}: HTTP ${r.status}`);
    cache.set(k, await r.text());
  }
  const xml = cache.get(k);
  if (!p) return strip(xml.replace(/<ArticleCaption>[\s\S]*?<\/ArticleCaption>|<ArticleTitle>[\s\S]*?<\/ArticleTitle>/g, ''));
  const m = xml.match(new RegExp(`<Paragraph Num="${p}"[\\s\\S]*?</Paragraph>`));
  return m ? strip(m[0]) : '';
}
let bad = 0, n = 0;
for (const k of G.KINDS) for (const [law, a, p, words] of k.jo) {
  n++;
  const body = await article(law, a, p);
  if (!body.includes(strip(words))) { bad++; console.log(`✕ ${k.id} ${law}${a}条${p ? p + '項' : ''}「${words}」が本文に無い\n   本文: ${body.slice(0, 200)}`); }
}
console.log(`${n} か所を照らし、ちがいは ${bad}`);
process.exit(bad ? 1 : 0);
