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
4. `sets.items` の `order`(飲み比べセットの順番。`no` の番号)も確認する
5. 確認用で見る(ON TAP の一覧と、診断が動くこと)→ 公開用へ

メモ: 診断の「点数のつけ方」は `src/partials/beer-finder.html` の `score()`。度数7%以上は、「軽く」「のどを潤す」を選んだ人や、飲み慣れていない人には、勧めない(減点)。

## タップリストのQR
- QR の行き先は `https://www.yagiribrewery.com/tap/`(ハブ。`src/pages/tap/index.html`)。ビール診断・読みもの・今日のタップリスト(`/yagiriya/#ontap`)の3つへ案内する。
- URL は変えない(印刷したQRが無効になる)。ページの中身は後から直してよい。
