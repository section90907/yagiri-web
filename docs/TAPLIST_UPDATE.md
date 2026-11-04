# 毎週のタップの入れ替え手順

メニュー作成のスレッドへの指示文と、`likes`(味の方向)の判断基準は **`docs/MENU_THREAD_PROMPT.md`**。そこで出力されたJSONを、`content/taplist.json` に取り込む。基準は、すべてのスレッドで共通にする。

ON TAP の欄と「ビール診断(BEER FINDER)」は、どちらも `content/taplist.json` から作られる。入れ替えは、このファイルを直すだけ。

1. `updated`(日付)を直す
2. `items` の銘柄を入れ替える(1銘柄 = 1ブロック)。必須の項目:
   - `no`(番号。バドワイザーのような定番は `null`)、`name`、`style`、`abv`、`regular`、`big`、`tag`、`desc`
   - 醸造所は `brewery`(自社は `original: true`)。読み仮名は `ruby`
3. **診断に出すために、`profile` と `likes` も入れる**(無い銘柄は診断の対象外になる。ビルド時に警告が出る)
   - `profile`: タップリストの**レーダーチャートの値**(1〜5)。`bitter`=苦味、`sweet`=甘味、`fruity`=フルーティー、`body`=コク、`special`=銘柄ごとの軸(スパイシー・ロースト・ダンクなど)
   - `likes`: 味の方向(1〜2個)。`classic`=すっきり王道(ラガー・ピルスナー系)、`fruity`=フルーティー・トロピカル、`roasty`=香ばしい・黒ビール系、`spicy`=スパイス・ハーブ系、`hoppy`=ホップの香りと苦味(IPA系)
3.5. `sets.orderNotice`(飲み比べセットの注文の注意書き。**「セット名ではなく、ビールの番号をスタッフに伝える」**。スタッフは番号を知らない前提)。サイトの ON TAP のセット欄と、PDF(下に赤い枠)の両方に出る。消さない
4. `sets.items`: **決まった組み合わせは2つ+「お好みセット」(`free: true`、`order` は空)の3行**にする。`order` は飲み比べセットの順番(`no` の番号)。`free` の行は、サイトでは「お好み3種」と出て、PDFでもそのまま使われる(AGUの範囲には入れない)
5. 確認用で見る(ON TAP の一覧と、診断が動くこと)→ 公開用へ

メモ: 診断の「点数のつけ方」は `src/partials/beer-finder.html` の `score()`。度数7%以上は、「軽く」「のどを潤す」を選んだ人や、飲み慣れていない人には、勧めない(減点)。

## タップリストのQR
- **QR を刷り直すときは、行き先に目印を付ける:** 置き場所ごとに `https://www.yagiribrewery.com/tap/?from=qr-table`(卓)、`?from=qr-door`(入口)、`?from=qr-menu`(メニュー)のように(`from` は半角英数字とハイフン、12字まで)。管理者ページの「入口」で、どの QR が使われたか分かる。すでに刷ったものは、そのままでも動く(「直接アクセスで入ったページ」に `/tap/` として出る)
- QR の行き先は `https://www.yagiribrewery.com/tap/`(ハブ。`src/pages/tap/index.html`)。ビール診断・読みもの・今日のタップリスト(`/yagiriya/#ontap`)の3つへ案内する。
- URL は変えない(印刷したQRが無効になる)。ページの中身は後から直してよい。

## 売り切れ(SOLD OUT)
- `content/taplist.json` の該当銘柄に `"soldOut": true` を入れる(銘柄は消さない。入荷したら、このフラグを外す)。カードは薄くなって「SOLD OUT ─ 売り切れ」になり、価格は出さない。ビール診断の対象から外れる。飲み比べセットに入っているときは、そのセットにも SOLD OUT が出る(セットの内容を入れ替えるなら、`sets.items` の `order` を直す)
- 売り切れて、そのまま入れ替えるときは、銘柄ごと差し替える

## まだ届いていないタップ(COMING SOON)
- `content/taplist.json` の該当銘柄に `"comingSoon": true` を入れる。カードは点線で「COMING SOON ─ もうすぐ到着」になり、価格は出さない。
- そのタップを含む飲み比べセットにも「COMING SOON」が付く。ビール診断のおすすめからも外れる(出していないビールを勧めない)。
- **届いたら、その行を消す**(`false` にしてもよい)。

## タップリストのPDF(A4・縦・CRAFT BEER)
- `content/taplist.json` から、PDF を作る: `python3 scripts/taplist-pdf/make.py [出力フォルダ]`(既定 `out/`。Git 管理外)。`taplist_YYYYMMDD_A4.pdf` ができる。必要なもの: Python3 + `pip install segno`(QR)、Node + Playwright(Chromium)。書体(Noto Sans JP)は初回に取ってくる
- **レーダーチャートは、JSON の `profile` から描く**(サイトの ON TAP・ビール診断と同じ元データ。ずれない)。番号の無い定番(バドワイザー)は載せない(従来のPDFと同じ)。**印刷用の PDF は、入荷前でも「COMING SOON」を出さず通常表示(価格つき)**(サイトは COMING SOON のまま。オーナーの指示 2026-11)。売り切れは「SOLD OUT」
- QR は `https://www.yagiribrewery.com/m`(短いアドレス。点が粗くなり、印刷でにじんでも読める)。`/m` は、サイトが `/tap/?from=qr-menu` へ転送する(`scripts/build.mjs` の `_redirects`。管理者ページの「入口」で、メニューのQRからの来訪が分かる)。表示は `yagiribrewery.com/tap`。**QRは、純黒・点を行ごとにつなげて描き、まわりの白い余白を4点ぶん以上とる。大きさは約31mm角(余白をふくむ)。小さく刷ると読めなくなるので、縮めない**
- 飲み比べセットの AGU は、3杯(各100mL)の度数の合計から計算(Σ度数 × 0.04)。PDF の説明文は、サイトの `desc` と同じ。**説明文は、約70字(PDFの4行)に収める**(長いと切れる)
- 入荷したら、`comingSoon` を外してから作り直す(PDF もサイトも、同じデータ)

## グラス指定つきのタップ(例: Merckx のチューリップグラス 150ml / 300ml)
- 銘柄に `"glass": "チューリップグラス"` と `"ml": {"regular": 150, "big": 300}` を入れる。サイト・ビール診断・PDF が「150ml ¥800 ／ 300ml ¥1,300」と書き、グラス名のバッジと、容量の注記(「Merckxのみ…」)も自動で出る。AGU も、その容量で計算する。`glass` が無い銘柄は、従来どおり レギュラー / ビッグ。
- **差し替え待ちの下書き(Merckx。2年熟成・¥800/¥1,300)** — 何かのタップが切れたら、その番号の枠にこれを入れる(`no` は入れる枠の番号に変える。説明と profile は、オーナーが確認してから確定):
```json
{"no": 3, "name": "Merckx", "ruby": "メルクス", "style": "ベルジャン・ダークストロング", "original": true, "abv": 8.0, "regular": 800, "big": 1300, "ml": {"regular": 150, "big": 300}, "glass": "チューリップグラス", "tag": "2年熟成", "desc": "2年熟成させたベルジャン・ダークストロングエール。深いコクと、熟成による丸み。チューリップグラスで、ゆっくりどうぞ。", "profile": {"bitter": 2, "sweet": 4, "fruity": 3, "body": 5, "special": 5}, "likes": ["roasty"]}
```
- 入れるときの空き枠の考え方は、同じ系統(濃色・麦芽系が切れたら Merckx、淡色が切れたら Himmel)。ヒンメルは価格が決まったら同じ形で追加する。
