# 読まれ方の計測(匿名・D1)

読みもの・BEER 101 などが、どこまで読まれているかを知るための仕組み。**個人を特定する情報は一切取らない。**

## 取るもの・取らないもの
- 取る: ページのパス / 画面を見ていた秒数 / 見出し(h2)をいくつ読み進めたか / 日付(日本時間) / 記事末のボタンの選択(役に立った・もっと知りたい・ちょっと違う)
- 取らない: IPアドレス・User-Agent・Cookie・端末や人を識別する ID。別のページを同じ人として結びつけることはできない
- `vid` は読み込みごとの使い捨て(同じ読み込みの再送を1件にまとめるだけ。どこにも保存しない)
- ブラウザの「トラッキングしない(DNT)」が有効なら、送らない
- 好みの収集(ビール診断の回答の集計など)を足すときは、別の同意と説明を決めてから。ここには混ぜない

## 構成
- `public/pulse.js` ページで動く。全ページ(404を除く)にビルドが差し込む
- `worker/index.js` `/api/e` だけを受ける Worker。ほかは静的ファイルをそのまま返す(`run_worker_first: ["/api/*"]`)
- D1(バインディング名 `DB`)。表は初回のアクセスで自動で作る(マイグレーション不要)。**確認用と公開用で、別のDB**になる
- PHP は使わない

## Cloudflare 側の設定
- `wrangler.jsonc` の `d1_databases` に `database_id` を書いていない。初回のデプロイで、wrangler が D1 を自動で作って紐づける(確認用・公開用それぞれ)
- 自動で作れなかったとき(ビルドのログに D1 の権限や作成のエラーが出る): ダッシュボードの Storage & Databases → D1 で作り、Workers の Settings → Bindings に `DB` を追加する。または `wrangler.jsonc` の該当箇所へ `database_id` を書く(IDは秘密ではない)

## 数字の見かた(D1 のコンソールで SQL を実行)
```sql
-- 記事ごとの閲覧数・平均滞在・読み進めた割合(見出しがあるページだけ)
SELECT path, COUNT(*) AS 閲覧, ROUND(AVG(secs)) AS 平均秒,
       ROUND(100.0 * SUM(reached) / NULLIF(SUM(total), 0)) AS 読み進め率
FROM visits WHERE total > 0 GROUP BY path ORDER BY 閲覧 DESC;

-- 記事末のボタン
SELECT path, choice, COUNT(*) FROM votes GROUP BY path, choice ORDER BY path;

-- 日ごとの閲覧数
SELECT day, COUNT(*) FROM visits GROUP BY day ORDER BY day DESC LIMIT 30;
```
- 「読み進めた」は、見出しが画面の上のほうまで来たという意味。読んだことの証明ではないので、滞在秒数と合わせて見る
- 3秒未満で離れた分も入っている。気になるときは `WHERE secs >= 3` を付ける

## 守ること
- 取る項目を増やすときは、先にこのファイルに書き、個人を特定できないことを確かめる
- 外のサイトからの書き込みは断る(Origin が同じ出所のときだけ受ける)。値は範囲と形を検査して、外れたら捨てる
- 計測の失敗で、ページの表示に影響を出さない(失敗しても画面には何も出ない)
