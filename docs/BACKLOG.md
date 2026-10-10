# 残タスク(上から順に)

0. **ユーザー確認待ち**: ナビに「BEER 101」を常時出すか。現状は共通ヘッダー内で「BEER 101 ページを開いているときだけ」表示(従来どおり)。常時出すなら `src/partials/brewery-header.html` の `data-only-current` を外すだけ

2. **スマホ表示の調整** — ヒーローの縦書きと大見出しの重なり、表組み(STYLE MAP・メニュー)の折り返しを確認
4. **YAGIRIYA の空欄**: ディナー価格、パイント容量、土日ランチ、現金可否
5. **製品データの外出し** — 製品一覧を `content/products.json` にして、ABV/IBU/BASEリンクを管理
6. **未来年表のデータ化** — `content/future.json` から年表を生成(内容は別スレッドで作成中のものを受け取る)
7. **写真・動画の差し替え** — 点線枠を実素材に。画像は WebP、幅 1600px 以下
8. **OGP画像・favicon・sitemap.xml・robots.txt**
9. **読み物の運用開始** — 月次で `draft: true` の記事PRを作る
10. **ドメイン切り替え**(完成後。BASE の独自ドメイン設定を外し、Cloudflare に付け替え)
