# 最新情報・イベント(NEWS)

トップ(醸造所)と YAGIRIYA に出る「NEWS」と、過去のお知らせのアーカイブ(`/news/`、`/yagiriya/news/`)。元は `content/news.json`。

## 更新のしかた
- `items` に1件足すだけ。インスタに投稿したら、キャプションと写真(あれば)を Claude に渡せば、整えて足す
- 項目: `id`(英数字) / `date`(掲載日 YYYY-MM-DD) / `kind`(`news` お知らせ・`event` イベント・`menu` メニュー) / `site`(`brewery` `yagiriya` `both`) / `title` / `body` / `link`(任意。サイト内は `/…`、外は `https://…`) / `linkLabel`
- イベントは `eventDate`(開催日)、複数日は `eventEnd`、時間は `eventTime`(例 `17:00〜`)も入れる
- **本文に事実を書くときは、`docs/SITE_FACTS.md` を正にする。日時・価格・出演者などの未確定は、書かずに確認する**

## アーカイブへ移るタイミング
- イベント: 開催日(`eventEnd` か `eventDate`)の翌日から
- お知らせ: `date` から `autoArchiveDays`(30日)後の翌日から
- すぐ移したいとき: `"archived": true`。期限を自分で決めたいとき: `"until": "YYYY-MM-DD"`(その日まで表示)
- 静的サイトなので、ビルド時点の区分に加えて、**見る人の端末の暦日でも切り替わる**(再公開を待たなくてよい)。表示するものが無くなったトップの NEWS 欄は、自動で隠れる
- 削除はしない(過去のお知らせとして残る)。載せたくなくなったものは `archived` ではなく、項目ごと消す(元に戻しにくいので、確認してから)

## 表示
- トップ・YAGIRIYA の NEWS 欄は、表示中のものを新しい順に最大3件。「過去のお知らせ →」「Instagram ↗」のリンク付き
- 醸造所の `/news/` は全件、YAGIRIYA の `/yagiriya/news/` は `site` が `yagiriya` か `both` のものだけ。デザインは混ぜない
