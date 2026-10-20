# CLAUDE.md — 矢切ブルワリー公式サイト(yagiri-web)

Claude Code はこのファイルと `docs/` を最初に読むこと。ユーザーとのやりとりは日本語。

## プロジェクト概要
- 矢切ブルワリー合同会社(千葉県松戸市のクラフトビール醸造所)の公式サイトと、直営タップルーム「YAGIRIYA」のページ。
- 現在の公式サイトは BASE で稼働中。このサイトが完成したら独自ドメインを切り替える(**ドメイン移行はまだ先**)。販売は引き続き BASE。
- 公開用URL: https://yagiri-web.craftbeeraddict.workers.dev / 確認用URL: https://yagiri-web-staging.craftbeeraddict.workers.dev(2段階の流れは `docs/DEPLOY.md`)
- リポジトリ: https://github.com/section90907/yagiri-web(**公開リポジトリ**。秘密情報・個人情報を絶対にコミットしない)

## デプロイ(重要)
- **確認用と公開用の2段階。** `main` へ入れると確認用(`yagiri-web-staging`)が、`production` ブランチへ入れると公開用(`yagiri-web`)が Cloudflare Workers Builds で自動更新される。詳細と初回設定は `docs/DEPLOY.md`(設定を切り替えるまでは、従来どおり `main` で公開用が更新される)。`production` へは、確認用で見たものだけを PR で入れる。
- Claude Code は `wrangler deploy` や `wrangler login` を実行しない。Cloudflare の認証情報も扱わない。
- 作業は必ずブランチを切って行い、PR を作る。**main への直接 push は、ユーザーが明示的に許可したときだけ。**
- push・PR作成の前に、変更内容の要約を見せてユーザーに確認する。

## 構成とコマンド
- `src/pages/` 静的ページ(`index.html` トップ / `story/` / `guide/` / `future/` / `yagiriya/` / `404.html`)
- `src/partials/` 共通ヘッダー・フッター(`brewery-*` と `yagiriya-*` の2系統)。ページには `<!--include:brewery-header current=story-->` のように書く。ナビの `data-nav="キー"` が current と一致したリンクだけ強調される。トップの大きなフッターと404のヘッダーは意図的に独自
- `src/templates/` 読み物の一覧(`journal-list.html`)・詳細(`article.html`)テンプレート
- `content/journal/*.md` 読み物記事。`_` 始まりはビルド対象外
- `public/` そのまま公開される静的ファイル(画像は `public/images/`)
- `site.config.json` BASE ショップURLなど(`%%SHOP_URL%%` に差し込まれる)
- `scripts/build.mjs` `dist/` を生成(依存は marked と gray-matter のみ。フレームワークは使わない方針)
- `npm install` → `npm run build` → `npm run preview`(wrangler dev でローカル確認)
- コミット前に必ず `npm run build` が通ることを確認する。

## 守ること
- デザインのルールは `docs/DESIGN.md`。特に **醸造所ページと YAGIRIYA ページのデザインを混ぜない**。
- 事実(住所・営業時間・価格・ビール名など)は `docs/SITE_FACTS.md` を正とする。載っていない事実は推測で書かず、ユーザーに聞く。
- `[ ]` の空欄はプレースホルダー。実データが来るまで消さない・でっち上げない。写真の枠は、素材が無い間は `hidden`(`data-pending="photo"`)で隠してある。消さない(もとの撮影指示は `docs/PHOTO_SLOTS.md`)。素材が揃ったら `<img>` に差し替えて、枠の `hidden` ごと外す。未記入の数値の行も同様に `data-pending="spec"` で隠してある。
- 読み物記事は `docs/ARTICLE_GUIDE.md` に従う。参考文献は実在を確認できたものだけ。出典を捏造しない。新規記事は必ず `draft: true`。
- 外部スクリプトや外部画像を増やさない(Google Fonts は可)。サイトは静的のまま保つ。
- タップ領域は 44px 以上、スマホ幅で横スクロールが出ないこと。
- 残タスクは `docs/BACKLOG.md`。終わったら更新する。
