# yagiri-web
矢切ブルワリー公式ホームページ(Cloudflare Workers 静的アセット)

## 構成
- `src/pages/` … 静的ページ(トップ / story / guide / future / yagiriya / 404)
- `src/templates/` … 読み物の一覧・詳細テンプレート
- `content/journal/` … 読み物記事(Markdown)。書き方は `docs/ARTICLE_GUIDE.md`
- `public/` … 画像などの静的ファイル(そのまま公開)
- `site.config.json` … BASEのショップURLなど
- `scripts/build.mjs` … `dist/` を生成

## コマンド
```
npm install
npm run build     # dist/ を生成
npm run preview   # ローカル確認(wrangler dev)
```

## Cloudflare(Workers Builds)設定
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
mainへのpushで自動デプロイ。

## 独自ドメイン
完成後、BASEで使っている公式ドメインから切り替える予定(現在は workers.dev で確認中)。
