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
// ---------- 「上に戻る」ボタン ----------
// 縦に長いページ用。少し下へスクロールすると右下に出る。YAGIRIYA ページだけ配色を変える(デザインを混ぜない)。
const toTop = (yagiriya) => `<style>
#to-top{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:60;width:48px;height:48px;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .2s;${yagiriya ? 'background:#145E50;border:2px solid #F4ECD9;color:#F4ECD9' : 'background:rgba(122,30,43,.94);border:1px solid #C9AA6E;color:#FFFFFF'}}
#to-top.on{opacity:1;pointer-events:auto}
#to-top:focus-visible{outline:2px solid #C9AA6E;outline-offset:2px}
@media print{#to-top{display:none}}
</style>
<button type="button" id="to-top" aria-label="ページの先頭へ"><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 16V4M4 9l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>
<script>
(function () {
  var b = document.getElementById('to-top');
  if (!b) return;
  function sync() { b.classList.toggle('on', window.scrollY > 240); }
  window.addEventListener('scroll', sync, { passive: true });
  sync();
  b.addEventListener('click', function () {
    var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
  });
})();
</script>`;
const SHOP_ORIGIN = new URL(cfg.shopUrl).origin; // 特商法・プライバシーのリンクの元(ショップのドメイン)
const OUT_PAGES = []; // sitemap 用(出力した公開ページ)
// ---------- ビール(銘柄)の一覧と詳細 ----------
// content/beers.json から作る。1銘柄=1ページ(版や仕込み回が違っても同じ銘柄は1つにまとめて載せる)。
// ファイルが無い・空のときは /beer/ を出さず、PRODUCT は従来どおりトップの該当欄へ向ける。
const BEER_FILE = path.join(ROOT, 'content/beers.json');
const beerData = fs.existsSync(BEER_FILE) ? JSON.parse(fs.readFileSync(BEER_FILE, 'utf8')) : {};
const rawBeers = beerData.beers ?? [];
// ショップで売っていない間(全銘柄が売り切れのとき)は shopOpen:false。「販売中」「買う」と出さない(買えないのに買えると見せない)
const SHOP_OPEN = beerData.shopOpen !== false;
const INSTAGRAM_URL = 'https://www.instagram.com/yagiribrewery';
const beerSlugs = new Set();
const beers = rawBeers.map((b, i) => {
  for (const k of ['slug', 'name', 'style', 'status']) if (!b[k]) throw new Error(`content/beers.json の ${i + 1} 件目: "${k}" がありません`);
  if (!/^[a-z0-9-]+$/.test(b.slug)) throw new Error(`content/beers.json: slug は半角英小文字・数字・ハイフンだけ(${b.slug})`);
  if (beerSlugs.has(b.slug)) throw new Error(`content/beers.json: slug が重複しています(${b.slug})`);
  beerSlugs.add(b.slug);
  if (!['current', 'retired'].includes(b.status)) throw new Error(`content/beers.json: ${b.slug} の status は current か retired`);
  // 数字は、無いものは載せない(0 として出さない)。入っているなら数として読めること
  for (const k of ['abv', 'ibu', 'og', 'fg']) if (b[k] != null && !Number.isFinite(Number(b[k]))) throw new Error(`content/beers.json: ${b.slug} の ${k} が数ではありません`);
  return b;
}).filter((b) => !b.draft || STAGING);
const PRODUCT_HREF = beers.length ? '/beer/' : '/#product';
// トップの PRODUCT 欄: 銘柄のページがあればそこへ、無ければショップへ。スペック行も同じデータから出す(二重に書かない)
const beerBySlug = Object.fromEntries(beers.map((b) => [b.slug, b]));
const specLine = (b) => [b.abv != null ? `ABV ${Number(b.abv).toFixed(1)}%` : '', b.ibu != null ? `IBU ${Number(b.ibu)}` : ''].filter(Boolean).join(' / ');
const ALL_PRODUCTS_HREF = beers.length ? '/beer/' : cfg.shopUrl;
// YAGIRIYA のデザインのページ(緑・生成り)。/tap/ は店内のQRの受け先(ハブ)
const isYagiriya = (rel) => rel.startsWith('yagiriya') || rel.startsWith('tap/');
const write = (rel, html) => {
  html = html.replace(/%%SHOP_ORIGIN%%/g, SHOP_ORIGIN).replace(/%%PRODUCT_HREF%%/g, PRODUCT_HREF).replace(/%%ALL_PRODUCTS_HREF%%/g, ALL_PRODUCTS_HREF)
    .replace(/%%FUND_URL%%/g, cfg.fundUrl)
    .replace(/%%BEER_HREF:([a-z0-9-]+)%%/g, (m, k) => (beerBySlug[k] ? `/beer/${k}/` : cfg.shopUrl))
    .replace(/%%BEER_SPEC:([a-z0-9-]+)%%/g, (m, k) => (beerBySlug[k] ? esc(specLine(beerBySlug[k])) : ''));
  if (rel.endsWith('.html') && rel !== '404.html') {
    OUT_PAGES.push(rel);
    // 正式なURL(workers.dev など別のアドレスで開かれても、検索には正式なURLを伝える)。確認用には付けない
    if (!STAGING) html = html.replace('</head>', `<link rel="canonical" href="${cfg.siteUrl}/${rel.replace(/index\.html$/, '')}">\n</head>`);
  }
  // タブのアイコン(favicon)。醸造所は黒地のY+赤い矢、YAGIRIYA は深緑地のY。デザインを混ぜない
  if (rel.endsWith('.html')) {
    const pre = isYagiriya(rel) ? 'yagiriya-' : '';
    html = html.replace('</head>', `<link rel="icon" href="/${pre}favicon.ico" sizes="any">\n<link rel="icon" type="image/png" sizes="192x192" href="/${pre}icon-192.png">\n<link rel="apple-touch-icon" href="/${pre}apple-touch-icon.png">\n</head>`);
  }
  if (rel.endsWith('.html') && rel !== '404.html') html = html.replace('</body>', `${toTop(isYagiriya(rel))}\n</body>`);
  // 読まれ方の計測(匿名。中身は public/pulse.js と worker/index.js、説明は docs/PULSE.md)
  if (rel.endsWith('.html') && rel !== '404.html') html = html.replace('</body>', '<script src="/pulse.js" defer></script>\n</body>');
  // クラウドファンディングの導線(data-fund)は、期限(fundEnd。その日の終わりまで)を過ぎたら自動で隠す。見ている人の端末の暦日で判定する
  if (rel.endsWith('.html') && html.includes('data-fund')) html = html.replace('</body>', `<script>(function(){var end='${cfg.fundEnd}',d=new Date(),t=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');if(t>end){document.querySelectorAll('[data-fund]').forEach(function(e){e.hidden=true;e.style.display='none';});}})();</script>\n</body>`);
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
  // 記事の中のメモ(<!-- ... -->)は、公開するHTMLに出さない
  let html = marked.parse(content).replace(/<!--[\s\S]*?-->/g, '');
  const toc = [];
  let n = 0;
  html = html.replace(/<h2>(.*?)<\/h2>/g, (m, inner) => { n += 1; toc.push({ id: `s${n}`, text: inner.replace(/<[^>]+>/g, '') }); return `<h2 id="s${n}">${inner}</h2>`; });
  const chars = content.replace(/\s/g, '').length;
  // 参考文献は長いので、折りたたむ(見出しを押すと開く。目次から飛んだときも開く)
  html = html.replace(/(<h2 id="s\d+">)参考文献(<\/h2>)([\s\S]*)$/, (m, open, close, rest) => {
    const count = (rest.match(/<li>/g) || []).length;
    return `<details class="refs"><summary>${open}参考文献<span class="refs-count">(${count}件・押すと開きます)</span>${close}</summary>${rest}</details>`;
  });
  return { slug: f.replace(/\.md$/, ''), ...data, html, toc, minutes: Math.max(1, Math.round(chars / 500)) };
}).filter((p) => !p.draft || STAGING).sort((a, b) => new Date(b.date) - new Date(a.date) || (b.seq ?? 0) - (a.seq ?? 0)); // 同じ日の記事は連載の順(seq)
if (STAGING) posts.forEach((p) => { if (p.draft) p.title = `【下書き】${p.title}`; }); // 下書きは確認用でだけ見える
posts.forEach((p, i) => { p.no = p.no ?? String(posts.length - i).padStart(3, '0'); });

const eyecatch = (p, ratio) => p.image
  ? `<img src="${esc(p.image)}" alt="" style="display: block; width: 100%; aspect-ratio: ${ratio}; object-fit: cover">`
  : `<div style="aspect-ratio: ${ratio}; background: #161616; border: 1px solid #2E2E2E; display: flex; align-items: center; justify-content: center; font-family: Cinzel, 'Times New Roman', serif; font-size: 16px; letter-spacing: 0.3em; color: #6E6A60">YAGIRI JOURNAL</div>`;

// ---------- ON TAP(content/taplist.json から) ----------
const tap = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/taplist.json'), 'utf8'));
const yen = (n) => '¥' + Number(n).toLocaleString('en-US');
const circled = (n) => String.fromCodePoint(0x2460 + n - 1); // ①〜⑩(10まで)
const tapDate = tap.updated.replace(/-/g, '.');
// まだ届いていないタップは comingSoon:true。価格は出さず「COMING SOON」と出す(出していない商品の値段を見せない)
// AGU(矢切ブルワリーの量の単位): 一杯の純アルコール量(g) ÷ 基準(厚労省の目安。site.config.json の agu.baseG)。小数第1位
const AGU = cfg.agu ?? { baseG: 20, baseYear: 2026, since: '2026-10-24' };
const aguName = `AGU${AGU.baseYear}`;
const aguSinceJa = AGU.since.replace(/^(\d+)-(\d+)-(\d+)$/, (m, y, mo, d) => `${y}年${Number(mo)}月${Number(d)}日`);
const aguOf = (abv, ml) => (Number(abv) * Number(ml) * 0.8 / 100 / AGU.baseG).toFixed(1);
const mlOf = (t) => ({ regular: t.ml?.regular ?? 260, big: t.ml?.big ?? 470 }); // 既定の容量。バドワイザーだけ taplist.json の ml で上書き
const tapCards = tap.items.map((t) => `<div style="display: flex; flex-direction: column; gap: 10px; padding: 22px 24px; border: 1px ${t.comingSoon ? 'dashed' : 'solid'} #7FA89C; background: rgba(0, 0, 0, 0.12)${t.comingSoon ? '; opacity: 0.78' : ''}">
<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px"><span style="font-family: 'Alfa Slab One', serif; font-size: 26px; color: #E3D3A8">${t.no ? String(t.no).padStart(2, '0') : '─'}</span><span style="font-size: 14px; text-align: right">${t.original ? '<span style="background: #E3D3A8; color: #145E50; padding: 2px 10px; font-weight: 700">オリジナル</span>' : esc(t.brewery ?? '')}</span></div>
<div><span style="font-size: 22px; font-weight: 700">${esc(t.name)}</span>${t.ruby ? ` <span style="font-size: 14px">${esc(t.ruby)}</span>` : ''}</div>
<div style="font-size: 15px">${esc(t.style)} ／ ALC.${Number(t.abv).toFixed(1)}%</div>
<div style="font-size: 15px; color: #E3D3A8">${aguOf(t.abv, mlOf(t).regular)} AGU(レギュラー)・${aguOf(t.abv, mlOf(t).big)} AGU(ビッグ)</div>
${t.comingSoon ? `<div style="font-family: 'Alfa Slab One', serif; font-size: 16px; color: #E3D3A8; letter-spacing: 0.08em">COMING SOON <span style="font-family: 'Zen Maru Gothic', sans-serif; font-size: 15px; letter-spacing: 0">─ もうすぐ到着</span></div>` : `<div style="font-family: 'Alfa Slab One', serif; font-size: 16px; color: #E3D3A8">レギュラー ${yen(t.regular)} ／ ビッグ ${yen(t.big)}</div>`}
<p style="margin: 0; font-size: 15px; line-height: 1.9">${esc(t.desc)}</p>
<div><span style="display: inline-block; border: 1px solid #E3D3A8; padding: 2px 12px; font-size: 14px">${esc(t.tag)}</span></div>
</div>`).join('\n');
const comingNos = new Set(tap.items.filter((t) => t.comingSoon).map((t) => t.no)); // 届いていないタップを含むセットは COMING SOON
const tapSets = `<div style="margin-top: 40px; padding: 28px 32px; border: 2px solid #E3D3A8; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 16px"><span style="font-family: 'Alfa Slab One', serif; font-size: 24px; color: #E3D3A8">${esc(tap.sets.title)}</span><span style="font-family: 'Alfa Slab One', serif; font-size: 22px">${yen(tap.sets.price)}</span><span style="font-size: 14px">${esc(tap.sets.size)}</span></div>
${tap.sets.items.map((x) => { const soon = x.order.some((n) => comingNos.has(n)); return `<div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 4px 20px; padding-top: 12px; border-top: 1px dashed #7FA89C${soon ? '; opacity: 0.78' : ''}"><span><b style="font-size: 17px">${esc(x.title)}</b> <span style="font-size: 15px">${esc(x.desc)}</span>${soon ? ' <span style="display: inline-block; border: 1px solid #E3D3A8; padding: 0 10px; font-size: 13px; font-family: \'Alfa Slab One\', serif; letter-spacing: 0.08em">COMING SOON</span>' : ''}</span><span style="font-size: 20px; letter-spacing: 0.1em">${x.order.map(circled).join(' → ')}</span></div>`; }).join('\n')}
<span style="font-size: 14px">※ ${esc(tap.sets.note)}</span>
</div>`;
// ビール診断用のデータ(味の目安 profile がある銘柄だけ。無い銘柄は診断の対象外にして、推測で入れない)
const finderMissing = tap.items.filter((t) => !t.profile || !t.likes).map((t) => t.name);
if (finderMissing.length) console.warn(`診断の対象外(profile か likes がない): ${finderMissing.join(', ')}`);
const FINDER_DATA = JSON.stringify({
  updated: tapDate, setPrice: tap.sets.price,
  items: tap.items.filter((t) => t.profile && t.likes && !t.comingSoon).map((t) => ({ no: t.no, name: t.name, ruby: t.ruby ?? '', style: t.style, brewery: t.brewery ?? '', original: !!t.original, abv: t.abv, regular: t.regular, big: t.big, tag: t.tag, desc: t.desc, profile: t.profile, likes: t.likes, aguR: aguOf(t.abv, mlOf(t).regular), aguB: aguOf(t.abv, mlOf(t).big) })),
}).replace(/</g, '\\u003c');
const TAPLIST = `<p style="margin: 0 0 8px; font-size: 15px">${esc(tap.sizes)}</p>\n<p style="margin: 0 0 20px; font-size: 14px; line-height: 1.9">AGU:一杯の純アルコール量が、厚生労働省の目安(約${AGU.baseG}g)の何倍かを表す数字です。安全な量を示すものではありません。ご自身の許容量を、AGUでも把握して、無理のない量でお楽しみください。<a href="/guide/#agu" style="text-decoration: underline; color: #E3D3A8">くわしくは BEER 101</a></p>\n<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px">\n${tapCards}\n</div>\n${tapSets}`;

// ---------- 未来年表(content/future/future-timeline.json から) ----------
// 確認中(pending)の項目は、ページにも、配るデータ(timeline.json)にも出さない。
// 文言は醸造家の監修済みなので、そのまま出す(要約・言い換えをしない)。
const FUT = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/future/future-timeline.json'), 'utf8'));
const futPool = FUT.items.filter((x) => !x.pending);
const futById = Object.fromEntries(futPool.map((x) => [x.id, x]));
const futGet = (id) => { const x = futById[id]; if (!x) throw new Error(`future-timeline.json: ハイライトの項目 ${id} が、公開できる項目にありません(確認中か、存在しません)`); return x; };
const futBadges = (x) => `<span class="badge badge--${x.kind}">${esc(FUT.kinds[x.kind])}</span>${(x.kind === 'plan' || x.kind === 'pred') && x.dots ? `<span class="dots" title="${esc(x.confLabel)}" aria-label="${esc(x.confLabel)}">${x.dots}</span>` : ''}`;
const futSource = (x) => x.url ? `<a class="row__src" href="${esc(x.url)}" target="_blank" rel="noopener">出典:${esc(x.src)} ↗</a>` : (x.src ? `<span class="row__src">出典:${esc(x.src)}</span>` : '');
const futRow = (x) => `<article class="row"><div class="row__meta"><span class="row__year">${esc(x.year)}</span><div class="row__badges">${futBadges(x)}</div></div><div class="row__body"><span class="row__cat">${esc(x.cat)}</span><h3 class="row__title" style="margin:0">${esc(x.title)}</h3><p class="row__text">${esc(x.body)}</p>${x.why ? `<p class="row__why">なぜこの年? — ${esc(x.why)}</p>` : ''}${futSource(x)}</div></article>`;
const FUT_PAST = FUT.highlights.past.map((id) => futRow(futGet(id))).join('');
const FUT_BUCKETS = FUT.highlights.buckets.map((b) => `<div class="block" id="${esc(b.anchor)}"><div class="block__side"><span class="block__year">${esc(b.label)}</span><span class="block__range">${esc(b.range)}</span><span class="block__lead">${esc(b.lead)}</span></div><div class="block__main">${b.items.map((id) => futRow(futGet(id))).join('')}<aside class="take" aria-label="醸造家の思索"><div class="take__head"><span class="take__label">YAGIRI’S TAKE</span><span class="take__note">醸造家の思索 — 根拠をもとにした想像です</span></div>${b.takes.map((id) => `<div><h3>${esc(futGet(id).title)}</h3><p>${esc(futGet(id).body)}</p></div>`).join('')}</aside></div></div>`).join('');
// トップの「IV. Future」: 年代ごとの見出し(年表のリード文)
const FUTURE_TOP = FUT.highlights.buckets.map((b) => `<div style="display: flex; flex-direction: column; gap: 6px">
<span style="font-family: Cinzel, 'Times New Roman', serif; font-size: 34px; color: #C9AA6E">${esc(b.label)}</span>
<span style="font-size: 17px; color: #E6E0D2">${esc(b.lead)}</span>
</div>`).join('\n');
const futUpdatedJa = FUT.updatedAt.replace('-', '年') + '月';

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
  if (rel.endsWith('.html')) html = fill(html, { SHOP_URL: esc(cfg.shopUrl), SITE_URL: esc(cfg.siteUrl), LATEST: latest, TAPLIST, TAPLIST_DATE: tapDate, FINDER_DATA, FUTURE_TOP, AGU_BASE_G: String(AGU.baseG), AGU_NAME: aguName, AGU_SINCE_JA: aguSinceJa });
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


// ---------- 未来年表のページ ----------
if (!(cfg.hiddenPages ?? []).includes('future')) {
  const futTpl = include(fs.readFileSync(path.join(ROOT, 'src/templates/future.html'), 'utf8'), 'future.html');
  write('future/index.html', fill(futTpl, { SITE_URL: esc(cfg.siteUrl), PAST: FUT_PAST, BUCKETS: FUT_BUCKETS, TOTAL: String(futPool.length), NOW_JA: esc(futUpdatedJa), UPDATED_JA: esc(futUpdatedJa) }));
  // アーカイブが読むデータ(確認中の項目は含めない)
  fs.mkdirSync(path.join(DIST, 'future'), { recursive: true });
  fs.writeFileSync(path.join(DIST, 'future/timeline.json'), JSON.stringify({ updatedAt: FUT.updatedAt, categories: FUT.categories, eras: FUT.eras, kinds: FUT.kinds, items: futPool }));
}

// ---------- ビールの一覧・詳細ページ ----------
if (beers.length) {
  const labelOf = { current: SHOP_OPEN ? '販売中' : 'ただいま売り切れ', retired: '終売(アーカイブ)' };
  const stat = (b) => [b.abv != null ? `ABV ${Number(b.abv).toFixed(1)}%` : '', b.ibu != null ? `IBU ${Number(b.ibu)}` : ''].filter(Boolean).join(' ／ ');
  const badge = (b) => `<span style="display: inline-block; border: 1px solid ${b.status === 'current' ? '#C9AA6E' : '#4A4A4A'}; color: ${b.status === 'current' ? '#C9AA6E' : '#BDB7A9'}; padding: 2px 12px; font-size: 14px; letter-spacing: 0.1em">${labelOf[b.status]}</span>`;
  const head = (title, desc) => `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="%%SITE_URL%%/images/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500&family=Shippori+Mincho:wght@400;600;800&family=Zen+Kaku+Gothic+New:wght@400;700&display=swap">
<style>
body{margin:0;background:#0B0B0B}
a{color:#EFE9DC;text-decoration:none}a:hover{color:#C9AA6E}
</style>
<style>*,*::before,*::after{box-sizing:border-box} img{max-width:100%}</style>
<link rel="stylesheet" href="/css/mobile.css">
</head>
<body>
<div style="background: #0B0B0B; color: #EFE9DC; font-family: 'Zen Kaku Gothic New', sans-serif; width: 100%">
<!--include:brewery-header current=beer-->
`;
  const foot = `
<!--include:brewery-footer-->
</div>
</body>
</html>
`;
  const ordered = [...beers.filter((b) => b.status === 'current'), ...beers.filter((b) => b.status === 'retired')];
  const card = (b) => `<a href="/beer/${b.slug}/" style="display: flex; flex-direction: column; gap: 10px; padding: 24px 26px; border: 1px solid #2E2E2E; background: #121212; min-height: 44px">
<span style="font-family: Cinzel, 'Times New Roman', serif; font-size: 14px; letter-spacing: 0.22em; color: #C9AA6E">${esc(b.style)}</span>
<span style="font-family: Cinzel, 'Shippori Mincho', serif; font-size: 26px; letter-spacing: 0.04em">${esc(b.name)}</span>
<span style="font-size: 15px; color: #CFC8B8; letter-spacing: 0.08em">${esc(stat(b))}</span>
<span>${badge(b)}</span>
</a>`;
  const group = (title, sub, list) => list.length ? `<section style="max-width: 1168px; margin: 0 auto; padding: 24px 56px 56px">
<div style="display: flex; align-items: baseline; gap: 16px; margin-bottom: 28px; border-bottom: 1px solid #262626; padding-bottom: 14px"><h2 style="margin: 0; font-family: Cinzel, 'Times New Roman', serif; font-weight: 400; font-size: 28px; letter-spacing: 0.12em">${title}</h2><span style="font-family: 'Shippori Mincho', serif; font-size: 16px; color: #CFC8B8; letter-spacing: 0.2em">${sub}</span></div>
<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 24px">
${list.map(card).join('\n')}
</div>
</section>` : '';
  const soldOutNote = `<div style="display: flex; flex-direction: column; gap: 16px; align-items: flex-start"><p style="margin: 0; font-size: 17px; line-height: 2; color: #E6E0D2">ただいま、すべての銘柄が売り切れです。再販や新作は、Instagram でお知らせします。</p><a href="${INSTAGRAM_URL}" style="border: 1px solid #C9AA6E; color: #C9AA6E; padding: 14px 26px; min-height: 44px; display: inline-flex; align-items: center; font-family: Cinzel, 'Times New Roman', serif; font-size: 15px; letter-spacing: 0.2em">INSTAGRAM ↗</a></div>`;
  const notice = `<p style="margin: 0; font-size: 14px; color: #BDB7A9; line-height: 1.9">お酒は20歳になってから。20歳未満の方の飲酒は法律で禁止されています。</p>`;
  const indexHtml = head('PRODUCT ビール一覧 | 矢切ブルワリー', '矢切ブルワリーがこれまでに造ったビールの一覧。スタイル、ABV、IBU、使ったホップ・モルト・酵母を銘柄ごとに掲載しています。') + `
<section style="max-width: 1168px; margin: 0 auto; padding: 96px 56px 40px">
<span style="font-family: Cinzel, 'Times New Roman', serif; font-size: 17px; letter-spacing: 0.3em; color: #C9AA6E">II.</span>
<h1 style="margin: 12px 0 8px; font-family: Cinzel, 'Times New Roman', serif; font-weight: 400; font-size: 88px; line-height: 1; letter-spacing: 0.04em">Our Product</h1>
<p style="margin: 0; font-family: 'Shippori Mincho', serif; font-size: 18px; letter-spacing: 0.2em; color: #DCD4C0">泡製品 ─ これまでに造った、すべてのビール。</p>
<p style="margin: 28px 0 0; max-width: 720px; font-size: 17px; line-height: 2; color: #CFC8B8">同じ銘柄は、仕込みを重ねても1ページにまとめています。${SHOP_OPEN ? 'いま買えるものは「販売中」、過去に造ったものは「終売」としてアーカイブに残しています。' : '現在、ショップではすべての銘柄が売り切れです。再び仕込むもの(現行)と、過去に造ったもの(終売)をアーカイブとして残しています。'}</p>
</section>
${SHOP_OPEN ? group('NOW ON SALE', '販売中', ordered.filter((b) => b.status === 'current')) : group('LINEUP', '現行ラインナップ(ただいま売り切れ)', ordered.filter((b) => b.status === 'current'))}
${group('ARCHIVE', '終売・過去の銘柄', ordered.filter((b) => b.status === 'retired'))}
<section style="max-width: 1168px; margin: 0 auto; padding: 0 56px 96px; display: flex; flex-direction: column; gap: 24px">
${SHOP_OPEN ? `<a href="%%SHOP_URL%%" style="align-self: flex-start; background: #7A1E2B; color: #FFFFFF; padding: 14px 26px; min-height: 44px; display: inline-flex; align-items: center; font-family: Cinzel, 'Times New Roman', serif; font-size: 15px; letter-spacing: 0.25em">SHOP で買う ↗</a>` : soldOutNote}
${notice}
</section>` + foot;
  write('beer/index.html', include(fill(indexHtml, { SHOP_URL: esc(cfg.shopUrl), SITE_URL: esc(cfg.siteUrl) }), 'beer/index.html'));

  const list = (arr) => (arr ?? []).map(esc).join('、');
  for (const b of ordered) {
    const rows = [
      ['STYLE', esc(b.style)],
      ['ABV', b.abv != null ? `${Number(b.abv).toFixed(1)}%` : ''],
      ['IBU', b.ibu != null ? String(Number(b.ibu)) : ''],
      ['OG', b.og != null ? Number(b.og).toFixed(3) : ''],
      ['FG', b.fg != null ? Number(b.fg).toFixed(3) : ''],
      ['HOPS', list(b.hops)],
      ['MALTS', list(b.malts)],
      ['ADJUNCTS', list(b.adjuncts)],
      ['YEAST', list(b.yeast)],
    ].filter(([, v]) => v);
    const desc = `${b.name}(${b.style})。${stat(b) ? stat(b) + '。' : ''}矢切ブルワリーのビール。`;
    const buy = b.status === 'current' && !SHOP_OPEN
      ? soldOutNote
      : b.status === 'current'
      ? `<a href="${esc(b.shop_url ?? cfg.shopUrl)}" style="align-self: flex-start; background: #7A1E2B; color: #FFFFFF; padding: 14px 26px; min-height: 44px; display: inline-flex; align-items: center; font-family: Cinzel, 'Times New Roman', serif; font-size: 15px; letter-spacing: 0.25em">SHOP で買う ↗</a>`
      : `<p style="margin: 0; font-size: 16px; color: #CFC8B8; line-height: 1.9">この銘柄は終売です。記録としてスペックを残しています。</p>`;
    const html = head(`${b.name} | PRODUCT | 矢切ブルワリー`, desc) + `
<article style="max-width: 1168px; margin: 0 auto; padding: 64px 56px 96px">
<nav aria-label="パンくず" style="font-size: 15px; color: #BDB7A9; display: flex; gap: 10px; flex-wrap: wrap"><a href="/">TOP</a><span>/</span><a href="/beer/">PRODUCT</a><span>/</span><span>${esc(b.name)}</span></nav>
<div style="max-width: 820px; margin: 48px 0 40px; display: flex; flex-direction: column; gap: 16px">
<span style="font-family: Cinzel, 'Times New Roman', serif; font-size: 15px; letter-spacing: 0.3em; color: #C9AA6E">${esc(b.style)}</span>
<h1 style="margin: 0; font-family: Cinzel, 'Shippori Mincho', serif; font-weight: 400; font-size: clamp(34px, 9vw, 56px); line-height: 1.2; letter-spacing: 0.04em; overflow-wrap: anywhere">${esc(b.name)}</h1>
${b.ruby ? `<span style="font-size: 16px; color: #CFC8B8; letter-spacing: 0.1em">${esc(b.ruby)}</span>` : ''}
<span>${badge(b)}</span>
${b.first ? `<span style="font-size: 15px; color: #CFC8B8">初めて仕込んだ年: ${esc(b.first)}</span>` : ''}
</div>
${b.desc ? `<p style="max-width: 720px; margin: 0 0 48px; font-family: 'Shippori Mincho', serif; font-size: 19px; line-height: 2.1; color: #E6E0D2">${esc(b.desc)}</p>` : ''}
<div style="max-width: 720px; border-top: 1px solid #C9AA6E; margin-bottom: 48px">
${rows.map(([k, v]) => `<div style="display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 16px; padding: 18px 0; border-bottom: 1px solid #262626"><span style="font-family: Cinzel, 'Times New Roman', serif; font-size: 15px; letter-spacing: 0.25em; color: #C9AA6E">${k}</span><span style="font-size: 18px; line-height: 1.8; overflow-wrap: anywhere; min-width: 0">${v}</span></div>`).join('\n')}
</div>
<div style="display: flex; flex-direction: column; gap: 24px; max-width: 720px">
${buy}
${notice}
<a href="/beer/" style="font-family: Cinzel, 'Times New Roman', serif; font-size: 15px; letter-spacing: 0.25em; min-height: 44px; display: inline-flex; align-items: center">← ビール一覧へ</a>
</div>
</article>` + foot;
    write(`beer/${b.slug}/index.html`, include(fill(html, { SHOP_URL: esc(cfg.shopUrl), SITE_URL: esc(cfg.siteUrl) }), `beer/${b.slug}`));
  }
}

// ---------- 静的アセット ----------
copyDir(path.join(ROOT, 'public'), DIST);
// 旧BASEのURL(www.〜/items/… など)を、ショップの新しいドメインへ転送する(検索結果・SNS・ブックマーク対策)
fs.writeFileSync(path.join(DIST, '_redirects'), (cfg.baseRedirectPaths ?? []).flatMap((p) => p.endsWith('/*')
  ? [`${p} ${SHOP_ORIGIN}${p.replace('/*', '/:splat')} 301`]
  : [`${p} ${SHOP_ORIGIN}${p} 301`, `${p}/ ${SHOP_ORIGIN}${p} 301`]).join('\n') + '\n');
if (!STAGING) {
  // 公開用: 検索に載せる。sitemap.xml を出す
  fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`);
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${OUT_PAGES.sort().map((r) => `<url><loc>${cfg.siteUrl}/${r.replace(/index\.html$/, '')}</loc></url>`).join('\n')}\n</urlset>\n`);
}
if (STAGING) {
  // 二重の保険: ヘッダーと robots.txt でも検索に載せない
  fs.writeFileSync(path.join(DIST, '_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n');
  fs.writeFileSync(path.join(DIST, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
}
console.log(`built${STAGING ? ' (staging)' : ''}: ${posts.length} articles, ${beers.length} beers -> dist/`);
