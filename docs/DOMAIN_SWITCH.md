# 独自ドメインの切り替え手順(www.yagiribrewery.com)

**ゴール**: `www.yagiribrewery.com` を新サイト(Cloudflare)にし、BASE のショップは `shop.yagiribrewery.com` へ引っ越す。
メール(`craftbeeraddict@yagiribrewery.com`)は止めない。

- ドメインの契約・DNS: いまは **Squarespace**。新サイトを `www` で出すには、**DNSの管理を Cloudflare に移す**必要がある(ドメインの契約は Squarespace のまま)。
- BASE の独自ドメインは、サブドメインが必須(ルートドメインは不可)。BASE のヘルプ: ホスト名に `shop` などを入れ、種類 CNAME、値 `cname.thebase.in`。
- 画面の名前は変わることがある。迷ったら、画面を私に見せてください。

## コードの準備(済。PR は、切り替えの当日までマージしない)
- `site.config.json`: `shopUrl` → `https://shop.yagiribrewery.com/items/all`、`siteUrl` → `https://www.yagiribrewery.com`
- 特商法・プライバシーのリンクは、`shopUrl` のドメインから作る(`%%SHOP_ORIGIN%%`)
- 旧BASEのURL(`/items/*` `/categories/*` `/cart` `/law` `/privacy`)は、新しいショップへ 301 で転送(`dist/_redirects`。`site.config.json` の `baseRedirectPaths`)
- 公開用に `robots.txt`(許可)と `sitemap.xml`、各ページに正式URL(`canonical`)。確認用は従来どおり検索に載せない
- **なぜ当日までマージしないか**: マージすると、サイトのショップのボタンが、まだ無い `shop.yagiribrewery.com` を指して壊れるため

## フェーズ0: 準備(サイトにもメールにも影響なし)
1. Squarespace のドメインの DNS 設定画面で、**いまのレコードをすべて控える**(画面の写真でよい)。特に MX、TXT(SPF・DKIM・DMARC)、`www` の CNAME、A / AAAA。メールをどこで使っているか(Google Workspace など)も確認
2. 控えたレコードを私に見せてください(名前・種類・値。パスワードなどは写さない)。Cloudflare に取り込むレコードと突き合わせます
3. Cloudflare → ウェブサイト → **サイトを追加** → `yagiribrewery.com` → Free プラン。自動で取り込まれたレコードを、1. と見比べ、足りないものを足す
   - **メール関連(MX と、メール用の TXT・CNAME)は「DNSのみ(グレーの雲)」**
   - `www` の CNAME(→ BASE)も、いまは「DNSのみ(グレー)」
4. Cloudflare が表示する**2つのネームサーバー**を控える

## フェーズ1: ネームサーバーの変更(反映に数分〜最大48時間)
5. Squarespace で DNSSEC が有効なら、先に無効にする(有効なまま変えると、名前が引けなくなる)
6. Squarespace のドメイン → DNS 設定 → ネームサーバー → カスタムに変更し、4. の2つを入れる
7. Cloudflare が「アクティブ」になるまで待つ。**この間も、BASE のショップ(www)とメールは、いままでどおり動く**
8. アクティブになったら確認: メールの送信・受信テスト、`www.yagiribrewery.com`(BASE)が開く

## フェーズ2: 切り替え当日(約30分。wwwが一時的に不安定)
9. Cloudflare の DNS に `shop` の CNAME → `cname.thebase.in` を追加(**DNSのみ・グレーの雲**)
10. BASE の「独自ドメイン App」で、ショップのURLを **shop.yagiribrewery.com** に変更。設定が反映されるまで待つ
11. `shop.yagiribrewery.com` が開き、商品ページ → カートまで進めることを確認
12. **私に連絡**。コードの PR をマージして、確認用 → 公開用(workers.dev)に出す。確認用で、ショップのボタンが `shop.yagiribrewery.com` へ飛ぶことを確認
13. Cloudflare の DNS から、`www` の CNAME(→ BASE)を**削除**
14. Workers & Pages → `yagiri-web` → 設定 → ドメインとルート → **カスタムドメインを追加** → `www.yagiribrewery.com`(Cloudflare が DNS を自動で作る)
15. `yagiribrewery.com`(wwwなし)を www へ転送: DNS に `A` `@` `192.0.2.1`(**プロキシ・オレンジの雲**)を追加 → ルール → リダイレクトルール → ホスト名が `yagiribrewery.com` なら `https://www.yagiribrewery.com` + パスへ 301(クエリを保つ)

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
- BASE の旧URLのうち、転送が必要なもの。`/items` `/categories` `/cart` `/law` `/privacy` 以外に、検索結果や SNS に残っているURLがないか(`site:www.yagiribrewery.com` で検索して、私に一覧を教えてください。`baseRedirectPaths` に足します)
- メールの提供元と、Squarespace の DNS にあるレコードの全体
