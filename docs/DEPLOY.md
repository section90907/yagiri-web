# 公開の流れ(確認用 → 公開用)

公開前に、確認用のURLで見てから本番へ移す。

| | 確認用(staging) | 公開用(production) |
|---|---|---|
| Worker 名 | `yagiri-web-staging` | `yagiri-web` |
| URL | https://yagiri-web-staging.craftbeeraddict.workers.dev | https://yagiri-web.craftbeeraddict.workers.dev(のちに独自ドメイン) |
| 反映されるブランチ | `main` | `production` |
| ビルドコマンド | `npm run build:staging` | `npm run build` |
| デプロイコマンド | `npx wrangler deploy --env staging` | `npx wrangler deploy` |
| 見た目 | 画面の上に赤い「確認用(非公開)」の帯。検索に載せない(`noindex`・`robots.txt`) | 帯なし |

## 日々の流れ
1. 変更はブランチで作り、PR を `main` に入れる → **確認用が自動で更新される**
2. 確認用のURLで、PC とスマホの両方を見る
3. よければ `main` を `production` に取り込む(GitHub で `main` → `production` の PR を作ってマージ)→ **公開用が自動で更新される**
4. 公開用のURLで、もう一度だけ確認する

**マージの権限**: `main`(確認用)へのPRは、Claude が確認なしでマージしてよい。`production`(公開用)へのPRは、ユーザーが「マージして」と言ったときだけマージする。

`production` へは、確認用で見たものだけを入れる。直接 `production` に変更を入れない(確認用と公開用が食い違う)。

## Cloudflare での初回設定(一度だけ。人がダッシュボードで行う)
1. `production` ブランチを作る(いまの `main` と同じ内容で作る)
2. 既存の `yagiri-web` の設定(Settings → Builds)で、監視するブランチを `main` から **`production`** に変える。ビルド/デプロイコマンドはそのまま
3. 確認用の Worker を作る: Workers & Pages → 作成 → Git リポジトリをインポート → `section90907/yagiri-web`
   - 監視するブランチ: `main`
   - ビルドコマンド: `npm run build:staging`
   - デプロイコマンド: `npx wrangler deploy --env staging`
   - Worker 名は `yagiri-web-staging`(`wrangler.jsonc` の `env.staging.name` と一致させる。違うとビルドが失敗する)
4. 確認用のURLを開き、赤い帯が出ることを確認する

設定を切り替えるまでは、従来どおり `main` への変更で公開用が更新される。

## ローカルで見る
- 公開用と同じ見た目: `npm run preview`
- 確認用と同じ見た目(帯・noindex つき): `npm run preview:staging`
