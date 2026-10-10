# 読み物(JOURNAL)記事の書き方 — Claude下書き用仕様

記事は `content/journal/<slug>.md` に1ファイルずつ置く。`<slug>` は半角英数とハイフン(例: `hop-biotransformation`)。URLは `/journal/<slug>/` になる。
`_template.md` をコピーして使う。`_` で始まるファイルはビルド対象外。

## front matter
| 項目 | 必須 | 内容 |
|---|---|---|
| title | ○ | 32字以内目安 |
| category | ○ | 醸造科学 / 世界の潮流 / 酵母 / BREW LOG のいずれか |
| date | ○ | 公開日 YYYY-MM-DD |
| updated | | 更新日 |
| author | | 既定は「矢切ブルワリー」 |
| lead | ○ | 80〜120字。一覧・meta descriptionに使用 |
| point | | 要点3行(配列) |
| image | | アイキャッチ。`public/images/journal/` に置き `/images/journal/xxx.jpg` で指定 |
| draft | | true の間は公開されない |

## 本文ルール
- 見出しは `##`(目次に自動で入る)。小見出しは `###`。
- 1か所 `>` 引用で「ブルワーのひとこと」枠を作る。下書きでは仮文を入れ、レビュー時に石田が書き換える。
- 最後に `## 参考文献` を置き、論文・公的資料・一次情報を番号付きで挙げる。数字や断定には必ず出典を付ける。
- 文体はです・ます。専門用語は初出で一言説明し、詳しい定義は `/guide/` へリンク。
- 洒落は見出しではなく本文中にさりげなく、1記事1つまで。

## 運用フロー
1. Claudeが `draft: true` の記事をブランチに追加してPRを作る
2. 石田がPR上でレビュー・修正(ブルワーのひとこと等)
3. `draft: false` にしてmainへマージ → Cloudflareが自動ビルド・公開
