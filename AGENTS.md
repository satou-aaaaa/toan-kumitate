# AGENTS.md

答案くみたて：憲法・民法総論・刑法総論の事例で、答案の4つの段（問題提起→規範→あてはめ→結論）の札を選んで組む1日5問の学習ゲーム。`index.html` と `data.js`（論点と問題の作り方）を GitHub Pages で公開する。

## 準備（最初に一度）

```bash
bash scripts/setup.sh   # Node.js（版は .nvmrc）を確かめ、検査の依存とブラウザを入れる。何度実行してもよい
```

## push する前の確認

```bash
node qa/run.mjs             # 問題（論点ごとに2000問）・今日の5問と上級（3年分）・とことん（300回）・通しで遊ぶ・続きから・古いタブ・自信・復習・幅320px・PWA・引き継ぎ・見やすさ（CI の QA と同じ）
node tools/check-laws.mjs   # data.js の条文の言葉（jo）を e-Gov 法令 API と照らす（条文を足したら必ず）
```

## このリポジトリの決まり

- 中身は条文（e-Gov）と判例（裁判所の裁判例ページ、`SRC` の `h_*`）で確かめたことだけ。判例は判決文を読んでから足す。読めていない論点は `PENDING` に置き、`KINDS` に入れない。学説が分かれる所は判例の立場。法律の相談にしない（「このゲームについて」と README に書く。QA が見る）。
- 規範の札からは出どころ（「（○条）」「（判例）」）を `bare` で消す（それで答えが分かるため）。組み終えたら出どころ付きの全文を出す。問題提起のまちがいの札に似た論点（`FAM`）を出さない。
- 人は A・B・C／甲・乙・丙、物は `OBJS`。すべて架空。実在の人・会社の名前を使わない。作った人の学校などの個人情報を書かない。
- 今日の5問（やさしい2・ふつう2・むずかしい1、3科目そろえる）・上級（3科目のむずかしい各1、今日と別）は日本時間の日付の種で決まり、だれでも同じ。`Math.random()` は練習・とことんの種だけ。乱数は `sort` の比較の中で引かない。`KINDS`・`OBJS`・事例の並びは最後に足すだけ（QA の `PIN` が第1回の1問目を見る）。`data.js` を変える PR は自動ではマージされない（`hold_paths`）。
- ★はまちがい＋ヒントの数（0で★3・1で★2・2以上で★1）。ヒントは段ごとに2回（見るところ → 2つにしぼる）。上級はヒントなし。時間制限なし。
- 好きなだけ遊べる：チケット・回数制限・🔒を入れない（shared-workflows `routines/game-dev.md` F1〜F7）。とことん（`runs.e`）は「ここで降りる」まで続き、自己ベスト `ebest` は一度で組めた数。
- 記録 `toan-v1`：`days`・`hdays`・`adays`・`dex`・`runs`（`d`・`h`・`p`・`e`・`r`・`a:日付`、途中は `cur.st`・`cur.hs`・`cur.wrong`＝"段:札"）・`ach`・`kofi`・`ebest`。保存の前に読み直し、`load` は両側を `fresh()` で補う。答える前に `same` で同じ問題か確かめ、`keep` は別のタブのヒント・まちがいを減らさない（shared-workflows `incidents/2026-11-04-daily-game-save-gaps.md`）。保存できないあいだは `#savewarn` を出し続ける。
- 1問を深くする：`depth.js` と `qa/depth-check.mjs` は shared-workflows `template/` の写しで、ここでは直さない。「🎯 自信あり？」は最初の段でまちがう前だけ。まちがい・ヒントがあった問題は `Depth.mark` で復習（`runs.r`）へ。
- 見やすさ・引き継ぎ：a11y の設定・`qa/a11y.mjs`・`transfer.js`・`qa/transfer-check.mjs` は template の写し。`data-keys` は `toan-v1,toan-fs,toan-depth`。記録の形を変えたら QA の `sample` も合わせる。色だけで分けない（✓ 正解・✕ ちがう・☆）。
- 外へ通信しない（CSP `connect-src 'self'`）。共有は押したときに開くリンクだけで、シェアの文に問題・答えを出さない。感想は Issue フォーム、応援は Ko-fi のリンクだけ（全部まちがいなしで初めて終えたときに1行）。
- 機能を足す・直すたびに `qa/run.mjs` に検査を足す。一行の式の途中にコメント `//` を足さない。setTimeout は画面が替わっていたら何もしない。
- PWA：画面のファイルを足したら `sw.js` の `SHELL` に足し、中身を大きく変えたら `CACHE` の版を上げる。絵は `node tools/make-icons.cjs`・`node tools/make-og.cjs`。
- 公開リポジトリなので、個人情報・鍵を入れない。

## 公開

- GitHub Pages は `main` のルート（`/`）。PR の QA と Secret scan が ✅ になると `automerge.yml` が自動でマージする（止めるときは下書きかラベル「自動マージしない」）。
- `sw.js`・`manifest.webmanifest`・`data.js` を変える PR は CodeRabbit のレビュー（`@coderabbitai review`）を待ち、手でマージする直前に今の head へのレビューを読み直す。

## 共通のきまり

- PR は satou-aaaaa/shared-workflows の `routines/pr.md`、全体は `routines/common.md` に従う。CI は共通部品を呼ぶだけ。
- Claude 以外の AI・人は shared-workflows の `routines/tool-map.md` と `routines/without-claude.md` を読む。
