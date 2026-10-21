# CLAUDE.md — 矢切ブルワリー公式サイト(yagiri-web)

Claude Code はこのファイルと `docs/` を最初に読むこと。ユーザーとのやりとりは日本語。

## プロジェクト概要
- 矢切ブルワリー合同会社(千葉県松戸市のクラフトビール醸造所)の公式サイトと、直営タップルーム「YAGIRIYA」のページ。
- 公式サイトは独自ドメイン `www.yagiribrewery.com` で稼働中(2026-10-21 に切り替え済み。裸ドメインは www へ転送)。販売は引き続き BASE で、ショップは `shop.yagiribrewery.com`。
- 公開用URL: https://www.yagiribrewery.com(workers.dev の URL も残っている) / 確認用URL: https://yagiri-web-staging.craftbeeraddict.workers.dev(2段階の流れは `docs/DEPLOY.md`)
- リポジトリ: https://github.com/section90907/yagiri-web(**公開リポジトリ**。秘密情報・個人情報を絶対にコミットしない)

## デプロイ(重要)
- **確認用と公開用の2段階。** `main` へ入れると確認用(`yagiri-web-staging`)が、`production` ブランチへ入れると公開用(`yagiri-web`)が Cloudflare Workers Builds で自動更新される。詳細と初回設定は `docs/DEPLOY.md`(設定を切り替えるまでは、従来どおり `main` で公開用が更新される)。`production` へは、確認用で見たものだけを PR で入れる。
- Claude Code は `wrangler deploy` や `wrangler login` を実行しない。Cloudflare の認証情報も扱わない。
- 作業は必ずブランチを切って行い、PR を作る。**main への直接 push は、ユーザーが明示的に許可したときだけ。**
- **確認用(`main`)へのマージは、確認なしで Claude が行ってよい**(ユーザーの常設の許可。2026-10)。条件は、`npm run build` と `npm run build:staging` が通り、画面を確認(スマホ幅の横スクロール0・JSエラー0)したあと。マージ後に、何を入れたかと、確認用で見てほしい点を報告する。
- **確認用に入れたら、毎回、確認用URLと見てほしいページの直リンクを報告に書く**(ユーザーの指示。2026-10)。例: `https://yagiri-web-staging.craftbeeraddict.workers.dev/journal/foam/`。
- **公開用(`production`)へは、既定で「公開まで」進める**(ユーザーの常設の指示。2026-10)。確認用(`main`)に入れたら、続けて `main` → `production` の PR を作り、マージして公開する。**ユーザーが「一度確認したい」と先に伝えたときだけ**、確認用で止めて、公開用の PR は作っても、マージは「マージして」「公開して」の合図を待つ。
- **公開したら、`production` を `main`(確認用)へも取り込む**(`production` → `main` の PR を作ってマージ)。公開用と確認用の履歴と内容をそろえるため。公開用だけに入った変更があれば、確認用にも入る。取り込んだあと、`git diff main production` が空であることを確かめる。
- 破壊的な変更(記事やページの削除、URLの変更、アイコンや設定の大きな差し替え)や、公開すると元に戻しにくいものは、既定の「公開まで」でも、先に確認する。

## 構成とコマンド
- `src/pages/` 静的ページ(`index.html` トップ / `story/` / `guide/` / `future/` / `yagiriya/` / `404.html`)
- `src/partials/` 共通ヘッダー・フッター(`brewery-*` と `yagiriya-*` の2系統)。ページには `<!--include:brewery-header current=story-->` のように書く。ナビの `data-nav="キー"` が current と一致したリンクだけ強調される。トップの大きなフッターと404のヘッダーは意図的に独自
- `src/templates/` 読み物の一覧(`journal-list.html`)・詳細(`article.html`)テンプレート
- `content/journal/*.md` 読み物記事。`_` 始まりはビルド対象外
- `content/beers.json` PRODUCT(ビールのスペックとアーカイブ)。1銘柄=1ページ。載せる項目と載せない項目は `docs/BEER_ARCHIVE.md`(**原料の分量・原価は公開リポジトリに入れない**)
- `content/taplist.json` YAGIRIYA の ON TAP とビール診断(毎週入れ替わる。直すとビルドが欄を作る。手順は `docs/TAPLIST_UPDATE.md`。メニュー作成スレッドへの指示文と `likes` の判断基準は `docs/MENU_THREAD_PROMPT.md`)
- `src/partials/beer-finder.html` ビール診断(5つの質問。点数のつけ方は `score()`。データは taplist.json の `profile` と `likes`)
- `public/` そのまま公開される静的ファイル(画像は `public/images/`)
- `site.config.json` BASE ショップURLなど(`%%SHOP_URL%%` に差し込まれる)
- `scripts/build.mjs` `dist/` を生成(依存は marked と gray-matter のみ。フレームワークは使わない方針)
  - 全ページ(404を除く)の右下に「上に戻る」ボタンを、ビルドで差し込む(`toTop`。YAGIRIYA は緑、それ以外はえんじ。240px 以上スクロールすると出る)
- `npm install` → `npm run build` → `npm run preview`(wrangler dev でローカル確認)
- コミット前に必ず `npm run build` が通ることを確認する。

## 守ること
- デザインのルールは `docs/DESIGN.md`。特に **醸造所ページと YAGIRIYA ページのデザインを混ぜない**。
- 事実(住所・営業時間・価格・ビール名など)は `docs/SITE_FACTS.md` を正とする。載っていない事実は推測で書かず、ユーザーに聞く。
- `[ ]` の空欄はプレースホルダー。実データが来るまで消さない・でっち上げない。写真の枠は、素材が無い間は `hidden`(`data-pending="photo"`)で隠してある。消さない(もとの撮影指示は `docs/PHOTO_SLOTS.md`)。素材が揃ったら `<img>` に差し替えて、枠の `hidden` ごと外す。未記入の数値の行・新作バナー・FUTURE も同様に `data-pending` で隠してある(一覧は `docs/BACKLOG.md`)。FUTURE ページは `site.config.json` の `hiddenPages` で出力していない。
- 読み物記事は `docs/ARTICLE_GUIDE.md` に従う。参考文献は実在を確認できたものだけ。出典を捏造しない。新規記事は必ず `draft: true`。
- 外部スクリプトや外部画像を増やさない(Google Fonts は可)。サイトは静的のまま保つ。
- タップ領域は 44px 以上、スマホ幅で横スクロールが出ないこと。
- 残タスクは `docs/BACKLOG.md`。終わったら更新する。
