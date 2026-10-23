# BrewLedger の案内(公開を保留中の下書き)

`/web/` に載せる予定だった、BrewLedger の案内の HTML。公開の条件(定款の事業目的、導入を募る範囲、デモ・お試しの仕組み)が決まったら、`src/pages/web/index.html` に戻す。

## セクション(II.)
```html
<section style="max-width: 1168px; margin: 0 auto; padding: 56px 56px 24px; border-top: 1px solid #262626">
<span style="font-family: Cinzel, 'Times New Roman', serif; font-size: 15px; letter-spacing: 0.3em; color: #C9AA6E">II.</span>
<h2 style="margin: 10px 0 20px; font-family: 'Shippori Mincho', serif; font-size: 34px; font-weight: 800">醸造所向け業務アプリ BrewLedger</h2>
<p style="margin: 0 0 24px; max-width: 760px; font-size: 17px; line-height: 2.1; color: #CFC8B8">矢切ブルワリーの業務のために作った、醸造所の記録と帳簿のアプリです。同じ悩みを持つ醸造所の方に、お使いいただけるよう、ご相談を受けています。</p>
<ul style="margin: 0 0 24px; padding-left: 1.4em; max-width: 760px; font-size: 17px; line-height: 2.1; color: #E6E0D2">
<li>仕込み、樽詰め、出荷の記録から、酒税の帳簿(製造記録帳、製品受払帳、移出帳、原料受払帳)と、課税標準数量の集計を作ります</li>
<li>請求書・領収書、出荷明細書の作成と、発行した写しの保存</li>
<li>原料の在庫と、レシピの管理(配合を直しても、過去の仕込みの配合は、書き換わりません)</li>
<li>タップルームの在庫や、シフト表、醸造のタイマー(スマホの通知)も、必要な機能だけ、選んで使えます</li>
<li>会社名、税務署、タンクの寸法などは、導入先ごとに設定します</li>
</ul>
<div style="max-width: 760px; margin: 0 0 24px; padding: 24px 28px; border: 1px solid #C9AA6E"><span style="font-family: Cinzel, 'Times New Roman', serif; font-size: 14px; letter-spacing: 0.3em; color: #C9AA6E">TRIAL</span><p style="margin: 8px 0 0; font-size: 17px; line-height: 2.1; color: #E6E0D2">ご希望の醸造所には、専用の環境をご用意して、期間を決めて、お試しいただくこともできます。まずは、ご相談ください。</p></div>
<p style="margin: 0; max-width: 760px; font-size: 15px; line-height: 2; color: #BDB7A9">帳簿づくりを助けるアプリです。申告の内容の最終確認は、税理士や、税務署にご相談ください。導入の条件や費用は、ご相談のうえ、決めます。</p>
</section>

```

## 作成例のカード
```html
<a href="https://brew.yagiribrewery.com/" style="display: flex; flex-direction: column; gap: 8px; padding: 24px 26px; border: 1px solid #2E2E2E; background: #121212"><span style="font-family: Cinzel, 'Times New Roman', serif; font-size: 13px; letter-spacing: 0.22em; color: #C9AA6E">BUSINESS APP</span><span style="font-family: 'Shippori Mincho', serif; font-size: 20px; font-weight: 600">醸造管理アプリ BrewLedger</span><span style="font-size: 15px; line-height: 1.9; color: #CFC8B8">醸造所の記録と帳簿のアプリ。ログインが必要です。</span></a>
```

## 問い合わせボタン
```html
<a href="mailto:craftbeeraddict@yagiribrewery.com?subject=%E3%80%90BrewLedger%E3%81%AE%E3%81%8A%E8%A9%A6%E3%81%97%E3%83%BB%E5%B0%8E%E5%85%A5%E3%81%AE%E3%81%94%E7%9B%B8%E8%AB%87%E3%80%91&amp;body=%E2%80%BB%E3%81%94%E7%9B%B8%E8%AB%87%E5%86%85%E5%AE%B9%E3%81%AE%E7%9B%AE%E5%AE%89%E3%81%A7%E3%81%99%28%E3%82%8F%E3%81%8B%E3%82%8B%E7%AF%84%E5%9B%B2%E3%81%A7%E6%A7%8B%E3%81%84%E3%81%BE%E3%81%9B%E3%82%93%29%E3%80%82%0A%0A%E2%96%A0%E4%BC%9A%E7%A4%BE%E5%90%8D%E3%83%BB%E9%86%B8%E9%80%A0%E6%89%80%E5%90%8D%3A%0A%E2%96%A0%E3%81%8A%E5%90%8D%E5%89%8D%3A%0A%E2%96%A0%E5%85%8D%E8%A8%B1%E3%81%AE%E7%A8%AE%E9%A1%9E%28%E3%83%93%E3%83%BC%E3%83%AB%E3%83%BB%E7%99%BA%E6%B3%A1%E9%85%92%20%E3%81%AA%E3%81%A9%29%E3%81%A8%E3%80%81%E5%B9%B4%E9%96%93%E3%81%AE%E8%A3%BD%E9%80%A0%E9%87%8F%E3%81%AE%E7%9B%AE%E5%AE%89%3A%0A%E2%96%A0%E3%81%84%E3%81%BE%E5%B8%B3%E7%B0%BF%E3%82%92%E3%81%A9%E3%81%86%E3%81%A4%E3%81%91%E3%81%A6%E3%81%84%E3%82%8B%E3%81%8B%3A%0A%E2%96%A0%E3%81%8A%E8%A9%A6%E3%81%97%E3%82%92%E5%B8%8C%E6%9C%9B%E3%81%99%E3%82%8B%E3%81%8B%28%E3%81%AF%E3%81%84/%E3%81%BE%E3%81%9A%E8%AA%AC%E6%98%8E%E3%82%92%E8%81%9E%E3%81%8D%E3%81%9F%E3%81%84%29%3A%0A%E2%96%A0BrewLedger%E3%81%A7%E7%9F%A5%E3%82%8A%E3%81%9F%E3%81%84%E3%81%93%E3%81%A8%3A%0A" style="border: 1px solid #C9AA6E; color: #C9AA6E; min-height: 52px; padding: 0 26px; display: inline-flex; align-items: center; font-size: 17px; font-weight: 700">BrewLedger のお試し・ご相談 ✉</a>
```
