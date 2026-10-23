# 残タスク(上から順に)


4. **YAGIRIYA の空欄** — 済(メニュー・容量・土日ランチ・現金)。ON TAP は `content/taplist.json`
5. **製品データの外出し** — 製品一覧を `content/products.json` にして、ABV/IBU/BASEリンクを管理
6. **未来年表** — **済(2026-10)**。`content/future/` から生成。更新の手順は `docs/FUTURE_UPDATE.md`
7. **写真・動画の差し替え** — 点線枠を実素材に。画像は WebP、幅 1600px 以下。
   - 済(既存素材): Y1・トップのYAGIRIYAタイル(外観)/ Y3(タップ)/ S2(渡辺・石田)/ S4(カウンター)/ トップのヒーロー背景(旧トップのイラスト。動画 MOVIE 01 ができるまでの仮)
   - 隠してある(素材待ち。`data-pending`): PHOTO 02、製品 03〜07、S3。MOVIE 01 はイラスト、S1 は背景なし、Y2 は店内の写真で仮もとの撮影指示は `docs/PHOTO_SLOTS.md`。外観・店内はハロウィン装飾の時期の写真なので、季節が変わったら撮り直し
8. **OGP画像・favicon・sitemap.xml・robots.txt**
   - 済: OGP画像(`public/images/og.png`。正式ロゴの暗い版)と `og:image` / `twitter:card`(醸造所の各ページ。URLは `site.config.json` の `siteUrl`)。公開用の `robots.txt`・`sitemap.xml`・canonical(ドメイン切り替えのPRに含む)
   - 済: favicon(醸造所=黒地に正式ロゴの Y と赤い矢 / YAGIRIYA=深緑地に生成りの Y と二重罫。`public/*favicon.ico` など。YAGIRIYA 側は仮のデザイン)
   - 未: YAGIRIYA ページ用のOGP
9. **読み物の運用開始** — 連載計画は `docs/JOURNAL_PLAN.md`。1本目(ビールの歴史)は公開(`beer-history.md`)。IPA(`ipa-origin.md`)も公開。「ブルワーのひとこと」は付けない(石田さんが書きたいときだけ追加)。次の記事は計画のとおり
10. **ドメイン切り替え** — **済(2026-10-21)**。手順と記録は `docs/DOMAIN_SWITCH.md`。残り: Instagram・Google ビジネスプロフィール・名刺のリンク更新、SPF/DMARC(任意)、Search Console

## 隠してあるもの(`data-pending`。揃ったら `hidden` を外す。`grep -rn data-pending src`)
- `photo`: 写真の枠(PHOTO 02・製品 03〜07・S3)/ `release`: NEW RELEASE のバナー / 

## PRODUCT(ビールのスペックとアーカイブ)
- 12銘柄を `content/beers.json` に入力済み(`docs/BEER_ARCHIVE.md`)。トップの製品カードの ABV・IBU の行は、このデータから自動で出る(`spec` の隠しは外した)。
- `status` は確定(2026-10): 終売は SUNPARADE D.P. と SUNPARADE キウイだけ。ほかは「再び仕込む可能性あり」=current。
- **確認待ち**: (確認事項なし。Nelson CANVAS・PEAT MERCKX は別ページで確定、トップの綴りは SUNPARADE に統一)
- 新作を造ったら `content/beers.json` に1件足す(新規は `draft: true` で確認用に出し、見てから外す)。

## YAGIRIYA
- 済: `/tap/`(QRの受け先のハブ)。ACCESS に Google マップの埋め込み(外部のiframe。スクロールして見えるまで読み込まない)と「Googleマップで開く」。ピンの位置は住所検索なので、ずれていれば Google マップの共有リンクに差し替える。

## クラウドファンディング(期限 2026-11-03)
- 導線は自動で隠れる。**11/4 以降に、導線を HTML から外す**(`data-fund` を検索)。

## 制作の受注(/web/)
- 済: `/web/`(ホームページ制作のみ)とフッターの入口。BrewLedger の案内は保留(`docs/WEB_BREWLEDGER_DRAFT.md`。デモ・お試しの仕組みが決まってから)。要確認: 定款の事業目的 / 作成例の掲載可否(クラウドファンディングのページが自作かどうか)/ 問い合わせ時の個人情報の扱いの文言。

## AGU
- 実装済み(ON TAP・診断・BEER 101・読みもの)。**公開日は 2026-10-24**(公開用へ出した日)。要確認: 原典での数字の確認 / 商標(J-PlatPat)/ 公開日の Wayback 保存。
