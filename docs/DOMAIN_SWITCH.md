# 独自ドメインの切り替え手順(www.yagiribrewery.com)

**状態: 切り替え完了(2026-10-21)。** www・裸ドメイン→www の転送・shop(BASE)・メールの送受信を確認済み。以下は記録と、残りの任意作業。

**ゴール**: `www.yagiribrewery.com` を新サイト(Cloudflare)にし、BASE のショップは `shop.yagiribrewery.com` へ引っ越す。
メール(`craftbeeraddict@yagiribrewery.com`)は止めない。

- ドメインの契約: Squarespace。**DNS は、すでに Cloudflare**(ネームサーバーも Cloudflare)。
- BASE の独自ドメインは、サブドメインが必須(ルートドメインは不可)。BASE のヘルプ: ホスト名に `shop` などを入れ、種類 CNAME、値 `cname.thebase.in`。
- 画面の名前は変わることがある。迷ったら、画面を私に見せてください。

## コードの準備(済。PR は、切り替えの当日までマージしない)
- `site.config.json`: `shopUrl` → `https://shop.yagiribrewery.com/items/all`、`siteUrl` → `https://www.yagiribrewery.com`
- 特商法・プライバシーのリンクは、`shopUrl` のドメインから作る(`%%SHOP_ORIGIN%%`)
- 旧BASEのURL(`/items/*` `/categories/*` `/cart` `/law` `/privacy`)は、新しいショップへ 301 で転送(`dist/_redirects`。`site.config.json` の `baseRedirectPaths`)
- 公開用に `robots.txt`(許可)と `sitemap.xml`、各ページに正式URL(`canonical`)。確認用は従来どおり検索に載せない
- **なぜ当日までマージしないか**: マージすると、サイトのショップのボタンが、まだ無い `shop.yagiribrewery.com` を指して壊れるため

## フェーズ0・1: DNS の Cloudflare への移行 — **済(2026-10 に確認)**
- Cloudflare に `yagiribrewery.com` のゾーンがあり(DNS セットアップ: フル)、Squarespace は **カスタムネームサーバー(= Cloudflare)** を使っている。**ネームサーバーの変更は不要**
- `brew.yagiribrewery.com`(醸造管理アプリ `brewledger`)と `fund.yagiribrewery.com`(`yagiri-fund`)が、すでに同じ Cloudflare アカウントの Worker として載っている。`yagiri-web` も同じようにカスタムドメインを足せる

### いまの Cloudflare の DNS レコード(11件。2026-10 の画面)
| 名前 | 種類 | 内容 | プロキシ | 切り替えでの扱い |
|---|---|---|---|---|
| `yagiribrewery.com` | A | 185.230.63.107 | プロキシ済み | フェーズ2・15 で、www への転送に使う(ダミーのIPに変える) |
| `www` | CNAME | cname.thebase.in | プロキシ済み | **フェーズ2・13 で削除**(Worker に置き換える) |
| `_domainconnect` | CNAME | _domainconnect.domains.squarespace.com | プロキシ済み | そのまま |
| `yagiribrewery.com` | MX ×5 | aspmx.l.google.com ほか(優先度10〜50) | DNSのみ | **そのまま(メール)** |
| `yagiribrewery.com` | TXT | google-site-verification=… | DNSのみ | そのまま |
| `brew` | Worker | brewledger | プロキシ済み | そのまま |
| `fund` | Worker | yagiri-fund | プロキシ済み | そのまま |

### 切り替えの前に確認したいこと(Squarespace の古いレコードとの差)
Squarespace の DNS 画面には、Cloudflare に**無い**レコードが残っている。いまは Cloudflare が正なので、使っていれば、Cloudflare に足す必要がある。
- `67rsz3bo43i3` CNAME → `gv-vq3ywpv2nuptsv.dv.googlehosted.com`: Google の**ドメイン所有の確認**用(Search Console など)。使っていれば、Cloudflare に足す(**DNSのみ**)
- `square` A → 199.34.228.177、`www.square` CNAME → `square.yagiribrewery.com`、`square` TXT: **Square のオンラインストア**用(Entri 経由)。`square.yagiribrewery.com` を使っていれば、Cloudflare に足す(**DNSのみ**)。使っていなければ、不要
- `yagiribrewery.com` の A(185.230.63.107): いま何を表示しているか(wwwなしで開いたとき)。切り替えで www への転送に置き換える

### 任意の改善(メールの迷惑メール対策。切り替えとは別に、できるときに)
Cloudflare の推奨事項に、SPF と DMARC がないと出ている。メールが Google なので、次を足すと、なりすましを防げる(DNSのみ)。
- TXT `@`: `v=spf1 include:_spf.google.com ~all`
- TXT `_dmarc`: `v=DMARC1; p=none; rua=mailto:craftbeeraddict@yagiribrewery.com`(最初は `p=none` で様子を見る)
- DKIM は、Google 管理コンソールで鍵を作って、TXT を足す

## フェーズ2: 切り替え当日(約30分。wwwが一時的に不安定)
9. Cloudflare の DNS に `shop` の CNAME → `cname.thebase.in` を追加(**DNSのみ・グレーの雲**)
10. BASE の「独自ドメイン App」で、ショップのURLを **shop.yagiribrewery.com** に変更。設定が反映されるまで待つ
11. `shop.yagiribrewery.com` が開き、商品ページ → カートまで進めることを確認
12. **私に連絡**。コードの PR をマージして、確認用 → 公開用(workers.dev)に出す。確認用で、ショップのボタンが `shop.yagiribrewery.com` へ飛ぶことを確認
13. Cloudflare の DNS から、`www` の CNAME(→ BASE)を**削除**
14. Workers & Pages → `yagiri-web` → 設定 → ドメインとルート → **カスタムドメインを追加** → `www.yagiribrewery.com`(Cloudflare が DNS を自動で作る)
15. `yagiribrewery.com`(wwwなし)を www へ転送: 既存の A レコード(`yagiribrewery.com` → 185.230.63.107、プロキシ済み)の内容を `192.0.2.1` に変える(**プロキシ・オレンジの雲のまま**。転送のためのダミーのIP) → ルール → リダイレクトルール → ホスト名が `yagiribrewery.com` なら `https://www.yagiribrewery.com` + パスへ 301(クエリを保つ)

## フェーズ3: 確認
- `https://www.yagiribrewery.com/` が新サイト。`/story/` `/guide/` `/journal/` `/yagiriya/` も表示
- 旧URLの転送: `https://www.yagiribrewery.com/items/all` → `shop.yagiribrewery.com/items/all` に飛ぶ。`/law` `/privacy` も
- `https://yagiribrewery.com/` が www へ転送される
- `https://www.yagiribrewery.com/robots.txt` と `/sitemap.xml`
- **メールの送受信**(フェーズ0の控えと同じ状態か)
- Instagram のプロフィール、Google ビジネスプロフィール、名刺・チラシのQRなどのリンクを更新(www のままで届く。ショップは `shop` へ)
- 任意: Google Search Console に登録して、sitemap を送る

## ロールバック(うまくいかないとき)
1. Cloudflare の DNS で、`www` のカスタムドメイン(Workers)を外し、CNAME `www` → `cname.thebase.in`(グレー)に戻す
2. BASE の独自ドメイン App で、ショップのURLを `www.yagiribrewery.com` に戻す
3. コードの PR を戻す(`site.config.json` の `shopUrl` と `siteUrl`)
DNS を Cloudflare に移したまま、BASE だけ元に戻せる(メールは影響を受けない)。

## 未確認(切り替え前に確認する)
- BASE の独自ドメイン App の、料金・設定画面の文言(BASE のヘルプで確認)
- `67rsz3bo43i3`(Google 所有確認)と `square`(Square オンラインストア)の、使用の有無
- BASE の旧URLのうち、転送が必要なもの。`/items` `/categories` `/cart` `/law` `/privacy` 以外に、検索結果や SNS に残っているURLがないか(`site:www.yagiribrewery.com` で検索して、私に一覧を教えてください。`baseRedirectPaths` に足します)
- 旧 `yagiribrewery.com`(wwwなし)の A レコード(185.230.63.107)が、いま何を表示しているか
