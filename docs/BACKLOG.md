# 残タスク(上から順に)


4. **YAGIRIYA の空欄**: 済(ディナー価格・メニュー全体)。残り: パイント容量(BEER 101 の `[ ]ml`)、土日祝のランチ有無、現金の可否。ON TAP は `content/taplist.json` から作る(済。毎週の入れ替えは `items` と `updated` を直す)
5. **製品データの外出し** — 製品一覧を `content/products.json` にして、ABV/IBU/BASEリンクを管理
6. **未来年表のデータ化** — `content/future.json` から年表を生成(内容は別スレッドで作成中のものを受け取る)。できるまで、FUTURE ページは出力しない(`site.config.json` の `hiddenPages`)、ナビとトップの欄は `data-pending="future"` で隠してある。公開するとき: `hiddenPages` から `future` を外し、`hidden` を外す
7. **写真・動画の差し替え** — 点線枠を実素材に。画像は WebP、幅 1600px 以下。
   - 済(既存素材): Y1・トップのYAGIRIYAタイル(外観)/ Y3(タップ)/ S2(渡辺・石田)/ S4(カウンター)/ トップのヒーロー背景(旧トップのイラスト。動画 MOVIE 01 ができるまでの仮)
   - 隠してある(素材待ち。`data-pending`): PHOTO 02、製品 03〜07、S3。MOVIE 01 はイラスト、S1 は背景なし、Y2 は店内の写真で仮もとの撮影指示は `docs/PHOTO_SLOTS.md`。外観・店内はハロウィン装飾の時期の写真なので、季節が変わったら撮り直し
8. **OGP画像・favicon・sitemap.xml・robots.txt**
   - 済: OGP画像(`public/images/og.png`。正式ロゴの暗い版)と `og:image` / `twitter:card`(醸造所の各ページ。URLは `site.config.json` の `siteUrl`)
   - 未: favicon(正式ロゴには小さく使えるマークが無いので、決めてから)、sitemap.xml、robots.txt(workers.dev のうちは検索に載せない方が安全。ドメイン切り替えの直前に)、YAGIRIYA ページ用のOGP
9. **読み物の運用開始** — 月次で `draft: true` の記事PRを作る
10. **ドメイン切り替え**(完成後。BASE の独自ドメイン設定を外し、Cloudflare に付け替え)

## 隠してあるもの(`data-pending`。揃ったら `hidden` を外す。`grep -rn data-pending src`)
- `photo`: 写真の枠(PHOTO 02・製品 03〜07・S3)/ `spec`: 製品の ABV・IBU の行 / `release`: NEW RELEASE のバナー / `future`: FUTURE のナビとトップの欄
- リンク先が `#` のまま: トップの ONLINE SHOP タイル・フッターの Instagram とメール・STORY の2か所・メニューPDF・404
