// 矢切ブルワリー サイトビルド
// src/pages/ の静的ページと content/journal/*.md の記事から dist/ を生成する。
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(ROOT, 'dist');
// 確認用(staging)のビルド: 検索に載せず、画面の上に「確認用」と出す。公開用には一切入れない。
const STAGING = process.argv.includes('--staging');
fs.rmSync(DIST, { recursive: true, force: true });
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
if (STAGING) cfg.siteUrl = cfg.stagingUrl; // OGP などの絶対URLも確認用に向ける

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fill = (tpl, map) => tpl.replace(/%%([A-Z_]+)%%/g, (m, k) => (k in map ? map[k] : m));
// ---------- 共通部品(src/partials/) ----------
// <!--include:名前 current=キー--> をその部品で置き換える。ヘッダーの nav は data-nav="キー" の
// リンクだけ現在地として強調し、data-only-current 付きは現在地のときだけ出す(いまは該当なし)。
const PARTIALS = path.join(ROOT, 'src/partials');
const include = (html, from) => html.replace(/<!--include:([\w-]+)(?: current=([\w-]+))?-->/g, (m, name, cur) => {
  const file = path.join(PARTIALS, `${name}.html`);
  if (!fs.existsSync(file)) throw new Error(`${from}: 部品 "${name}" が src/partials/ にありません`);
  return fs.readFileSync(file, 'utf8').replace(/<a ([^>]*?)data-nav="([\w-]+)"([^>]*)>(.*?)<\/a>/g, (a, pre, key, post, text) => {
    const on = key === cur;
    if (/data-only-current/.test(post) && !on) return '';
    const attrs = (pre + post).replace(/\s*data-only-current/, '').trim();
    return `<a ${attrs}${on ? ' style="color: #C9AA6E"' : ''}>${text}</a>`;
  });
});
const STAGING_BAR = '<div style="background: #7A1E2B; color: #FFFFFF; text-align: center; font-size: 14px; letter-spacing: 0.1em; padding: 8px 12px">確認用(非公開) ─ 公開前の確認ページです</div>';
const forStaging = (html) => html
  .replace('</head>', '<meta name="robots" content="noindex, nofollow">\n</head>')
  .replace(/<body[^>]*>/, (m) => `${m}\n${STAGING_BAR}`);
const write = (rel, html) => {
  if (STAGING && rel.endsWith('.html')) html = forStaging(html);
  const p = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html);
};
const copyDir = (from, to) => {
  if (!fs.existsSync(from)) return;
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name), d = path.join(to, e.name);
    if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copyDir(s, d); }
    else fs.copyFileSync(s, d);
  }
};
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

// ---------- 記事の読み込み ----------
const JDIR = path.join(ROOT, 'content/journal');
const fmtDate = (d) => { const x = new Date(d); return `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, '0')}.${String(x.getDate()).padStart(2, '0')}`; };
const posts = fs.readdirSync(JDIR).filter((f) => f.endsWith('.md') && !f.startsWith('_')).map((f) => {
  const { data, content } = matter(fs.readFileSync(path.join(JDIR, f), 'utf8'));
  const required = ['title', 'category', 'date', 'lead'];
  for (const k of required) if (!data[k]) throw new Error(`${f}: front matter "${k}" がありません`);
  let html = marked.parse(content);
  const toc = [];
  let n = 0;
  html = html.replace(/<h2>(.*?)<\/h2>/g, (m, inner) => { n += 1; toc.push({ id: `s${n}`, text: inner.replace(/<[^>]+>/g, '') }); return `<h2 id="s${n}">${inner}</h2>`; });
  const chars = content.replace(/\s/g, '').length;
  return { slug: f.replace(/\.md$/, ''), ...data, html, toc, minutes: Math.max(1, Math.round(chars / 500)) };
}).filter((p) => !p.draft).sort((a, b) => new Date(b.date) - new Date(a.date));
posts.forEach((p, i) => { p.no = p.no ?? String(posts.length - i).padStart(3, '0'); });

const eyecatch = (p, ratio) => p.image
  ? `<img src="${esc(p.image)}" alt="" style="display: block; width: 100%; aspect-ratio: ${ratio}; object-fit: cover">`
  : `<div style="aspect-ratio: ${ratio}; background: #161616; border: 1px solid #2E2E2E; display: flex; align-items: center; justify-content: center; font-family: Cinzel, 'Times New Roman', serif; font-size: 16px; letter-spacing: 0.3em; color: #6E6A60">YAGIRI JOURNAL</div>`;

// ---------- ON TAP(content/taplist.json から) ----------
const tap = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/taplist.json'), 'utf8'));
const yen = (n) => '¥' + Number(n).toLocaleString('en-US');
const circled = (n) => String.fromCodePoint(0x2460 + n - 1); // ①〜⑩(10まで)
const tapDate = tap.updated.replace(/-/g, '.');
const tapCards = tap.items.map((t) => `<div style="display: flex; flex-direction: column; gap: 10px; padding: 22px 24px; border: 1px solid #7FA89C; background: rgba(0, 0, 0, 0.12)">
<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px"><span style="font-family: 'Alfa Slab One', serif; font-size: 26px; color: #E3D3A8">${t.no ? String(t.no).padStart(2, '0') : '─'}</span><span style="font-size: 14px; text-align: right">${t.original ? '<span style="background: #E3D3A8; color: #145E50; padding: 2px 10px; font-weight: 700">オリジナル</span>' : esc(t.brewery ?? '')}</span></div>
<div><span style="font-size: 22px; font-weight: 700">${esc(t.name)}</span>${t.ruby ? ` <span style="font-size: 14px">${esc(t.ruby)}</span>` : ''}</div>
<div style="font-size: 15px">${esc(t.style)} ／ ALC.${Number(t.abv).toFixed(1)}%</div>
<div style="font-family: 'Alfa Slab One', serif; font-size: 16px; color: #E3D3A8">レギュラー ${yen(t.regular)} ／ ビッグ ${yen(t.big)}</div>
<p style="margin: 0; font-size: 15px; line-height: 1.9">${esc(t.desc)}</p>
<div><span style="display: inline-block; border: 1px solid #E3D3A8; padding: 2px 12px; font-size: 14px">${esc(t.tag)}</span></div>
</div>`).join('\n');
const tapSets = `<div style="margin-top: 40px; padding: 28px 32px; border: 2px solid #E3D3A8; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 16px"><span style="font-family: 'Alfa Slab One', serif; font-size: 24px; color: #E3D3A8">${esc(tap.sets.title)}</span><span style="font-family: 'Alfa Slab One', serif; font-size: 22px">${yen(tap.sets.price)}</span><span style="font-size: 14px">${esc(tap.sets.size)}</span></div>
${tap.sets.items.map((x) => `<div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 4px 20px; padding-top: 12px; border-top: 1px dashed #7FA89C"><span><b style="font-size: 17px">${esc(x.title)}</b> <span style="font-size: 15px">${esc(x.desc)}</span></span><span style="font-size: 20px; letter-spacing: 0.1em">${x.order.map(circled).join(' → ')}</span></div>`).join('\n')}
<span style="font-size: 14px">※ ${esc(tap.sets.note)}</span>
</div>`;
const TAPLIST = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px">\n${tapCards}\n</div>\n${tapSets}`;

// ---------- 静的ページ ----------
const PAGES = path.join(ROOT, 'src/pages');
const latest = posts.slice(0, 3).map((p) => `<a href="/journal/${p.slug}/" style="display: grid; grid-template-columns: 120px 1fr; gap: 20px; padding: 22px 0; border-top: 1px solid #3F5C52; align-items: center">
<span style="aspect-ratio: 16 / 10; overflow: hidden; background: #1C362F">${p.image ? `<img src="${esc(p.image)}" alt="" style="width: 100%; height: 100%; object-fit: cover">` : ''}</span>
<span style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 14px; color: #DCD4C0; letter-spacing: 0.1em">${esc(p.category)} ／ ${fmtDate(p.date)}</span><span style="font-family: 'Shippori Mincho', serif; font-size: 19px; line-height: 1.6; font-weight: 600">${esc(p.title)}</span></span>
</a>`).join('\n') || `<p style="font-family: 'Shippori Mincho', serif; font-size: 18px; padding: 22px 0; border-top: 1px solid #3F5C52">ただいま発酵中…</p>`;

for (const f of walk(PAGES)) {
  const rel = path.relative(PAGES, f);
  // まだ公開しないページ(site.config.json の hiddenPages)は出力しない。URLを直接開いても404になる
  if ((cfg.hiddenPages ?? []).some((p) => rel === p || rel.startsWith(p + path.sep))) continue;
  let html = fs.readFileSync(f, 'utf8');
  if (rel.endsWith('.html')) html = include(html, rel);
  if (rel.endsWith('.html')) html = fill(html, { SHOP_URL: esc(cfg.shopUrl), SITE_URL: esc(cfg.siteUrl), LATEST: latest, TAPLIST, TAPLIST_DATE: tapDate });
  write(rel, html);
}

// ---------- 記事詳細 ----------
const artTpl = include(fs.readFileSync(path.join(ROOT, 'src/templates/article.html'), 'utf8'), 'article.html');
const navLink = (p, dir) => p
  ? `<a href="/journal/${p.slug}/" style="padding: 48px 56px; display: flex; flex-direction: column; gap: 8px;${dir === 'next' ? ' text-align: right' : ' border-right: 1px solid #262626'}"><span style="font-family: Cinzel, 'Times New Roman', serif; font-size: 14px; letter-spacing: 0.3em; color: #C9AA6E">${dir === 'next' ? 'NEXT →' : '← PREV'}</span><span style="font-family: 'Shippori Mincho', serif; font-size: 18px">${esc(p.title)}</span></a>`
  : `<span style="padding: 48px 56px"></span>`;
posts.forEach((p, i) => {
  const html = fill(artTpl, {
    TITLE: esc(p.title), LEAD: esc(p.lead), CATEGORY: esc(p.category), NO: esc(p.no),
    DATE: fmtDate(p.date) + (p.updated ? ` 更新 ${fmtDate(p.updated)}` : ''),
    MINUTES: String(p.minutes), AUTHOR: esc(p.author ?? '矢切ブルワリー'),
    HERO: eyecatch(p, '21 / 9'),
    TOC: p.toc.map((t) => `<a href="#${t.id}" style="font-size: 16px; line-height: 1.7">${esc(t.text)}</a>`).join('\n'),
    POINT: (p.point ?? []).map(esc).join('<br>'),
    BODY: p.html,
    PREV: navLink(posts[i + 1], 'prev'), NEXT: navLink(posts[i - 1], 'next'),
    SHOP_URL: esc(cfg.shopUrl), SITE_URL: esc(cfg.siteUrl),
  });
  write(`journal/${p.slug}/index.html`, html);
});

// ---------- 記事一覧 ----------
const listTpl = include(fs.readFileSync(path.join(ROOT, 'src/templates/journal-list.html'), 'utf8'), 'journal-list.html');
const cats = ['すべて', ...new Set(posts.map((p) => p.category))];
const tabs = cats.map((c, i) => `<button type="button" data-cat="${esc(c)}" style="min-height: 44px; display: inline-flex; align-items: center; padding: 0 20px; border: 1px solid ${i ? '#3A3A3A' : '#7A1E2B'}; background: ${i ? 'transparent' : '#7A1E2B'}; color: #EFE9DC; font: inherit; font-size: 16px; letter-spacing: 0.1em; cursor: pointer">${esc(c)}</button>`).join('\n');
const [first, ...rest] = posts;
const featured = first ? `<a href="/journal/${first.slug}/" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 48px; align-items: center">
${eyecatch(first, '16 / 10')}
<div style="display: flex; flex-direction: column; gap: 16px">
<span style="font-family: Cinzel, 'Times New Roman', serif; font-size: 14px; letter-spacing: 0.3em; color: #C9AA6E">LATEST — No.${esc(first.no)}</span>
<span style="font-size: 15px; color: #CFC8B8">${esc(first.category)} ／ ${fmtDate(first.date)} ／ 約${first.minutes}分で読めます</span>
<span style="font-family: 'Shippori Mincho', serif; font-size: 34px; font-weight: 800; line-height: 1.5">${esc(first.title)}</span>
<span style="font-size: 17px; line-height: 1.9; color: #CFC8B8">${esc(first.lead)}</span>
<span style="font-family: Cinzel, 'Times New Roman', serif; font-size: 15px; letter-spacing: 0.25em; border-bottom: 1px solid #7A1E2B; align-self: flex-start; padding-bottom: 4px">READ →</span>
</div>
</a>` : `<div style="padding: 56px 0; border-top: 1px solid #3F5C52; border-bottom: 1px solid #3F5C52"><p style="margin: 0; font-family: 'Shippori Mincho', serif; font-size: 34px; font-weight: 800">ただいま発酵中…</p><p style="margin: 10px 0 0; color: #DCD4C0">次の記事を仕込んでいます。飲み頃まで、少々お待ちください。</p></div>`;
const cards = rest.map((p) => `<a href="/journal/${p.slug}/" data-cat="${esc(p.category)}" style="display: flex; flex-direction: column; gap: 12px">
${eyecatch(p, '16 / 10')}
<span style="font-size: 14px; color: #CFC8B8; letter-spacing: 0.1em">${esc(p.category)} ／ ${fmtDate(p.date)}</span>
<span style="font-family: 'Shippori Mincho', serif; font-size: 20px; font-weight: 600; line-height: 1.6">${esc(p.title)}</span>
</a>`).join('\n');
const filterJs = `<script>
document.querySelectorAll('button[data-cat]').forEach(function (b) {
  b.addEventListener('click', function () {
    var c = b.getAttribute('data-cat');
    document.querySelectorAll('button[data-cat]').forEach(function (x) { var on = x === b; x.style.background = on ? '#7A1E2B' : 'transparent'; x.style.borderColor = on ? '#7A1E2B' : '#3A3A3A'; });
    document.querySelectorAll('a[data-cat]').forEach(function (a) { a.style.display = (c === 'すべて' || a.getAttribute('data-cat') === c) ? '' : 'none'; });
  });
});
</script>`;
write('journal/index.html', fill(listTpl, { TABS: tabs, FEATURED: featured, POSTS: cards, SHOP_URL: esc(cfg.shopUrl), SITE_URL: esc(cfg.siteUrl) }).replace('</body>', filterJs + '\n</body>'));

// ---------- 静的アセット ----------
copyDir(path.join(ROOT, 'public'), DIST);
if (STAGING) {
  // 二重の保険: ヘッダーと robots.txt でも検索に載せない
  fs.writeFileSync(path.join(DIST, '_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n');
  fs.writeFileSync(path.join(DIST, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
}
console.log(`built${STAGING ? ' (staging)' : ''}: ${posts.length} articles -> dist/`);
