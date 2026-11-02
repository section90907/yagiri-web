#!/usr/bin/env python3
"""毎週のタップリスト(A4・縦・CRAFT BEER)のPDFを、content/taplist.json から作る。開発用の道具(サイトのビルドには使わない)。

使い方:  python3 scripts/taplist-pdf/make.py [出力フォルダ]       # 既定: ./out(Git 管理外)
         → <出力フォルダ>/taplist_YYYYMMDD_A4.pdf(と、確認用の .html)
必要なもの: Python3 + segno(QRコード。pip install segno)、Node + Playwright(Chromium)、書体(下の FONTS を、初回に Google Fonts から ~/.cache/yagiri-taplist/ へ取る)
決まり:  レーダーチャートは、JSON の profile の数値から描く(サイトの ON TAP・ビール診断と同じ元データ。ずれない)
         入荷前(comingSoon)は「COMING SOON」(価格なし)、売り切れ(soldOut)は「SOLD OUT」。番号の無い定番(バドワイザー)は載せない(従来のPDFと同じ)
詳しくは docs/TAPLIST_UPDATE.md
"""
import sys, os, json, math, html, subprocess, urllib.request
try:
    import segno
except ImportError:
    sys.exit('segno が必要です: pip install segno')

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CACHE = os.path.expanduser('~/.cache/yagiri-taplist/')
FONTS = {'NotoSansJP.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf'}
os.makedirs(CACHE, exist_ok=True)
for n, u in FONTS.items():
    if not os.path.exists(CACHE + n): urllib.request.urlretrieve(u, CACHE + n)

QR_URL = 'https://www.yagiribrewery.com/m'   # 短いアドレス(QRの点が粗くなり、印刷でにじんでも読める)。/m は、サイトが /tap/?from=qr-menu へ転送する(メニューのQRからの来訪を、集計で見分ける)
AGU_BASE = 20.0
esc = lambda s: html.escape(str(s if s is not None else ''))
circled = lambda n: chr(0x2460 + int(n) - 1)
yen = lambda n: '¥' + format(int(n), ',')
tap = json.load(open(os.path.join(ROOT, 'content', 'taplist.json'), encoding='utf-8'))
items = [t for t in tap['items'] if t.get('no')]
by_no = {t['no']: t for t in items}


def ml_of(t):
    m = t.get('ml', {}) or {}
    return m.get('regular', 240), m.get('big', 470)


def agu(abv, ml): return f'{abv * ml * 0.8 / 100 / AGU_BASE:.1f}'


def radar(t):
    p = t['profile']
    axes = [('苦味', p['bitter']), (t['tag'], p['special']), ('フルーティー', p['fruity']), ('甘味', p['sweet']), ('コク', p['body'])]
    cx, cy, R = 50, 52, 33
    pt = lambda i, r: (cx + r * math.cos(math.radians(-90 + 72 * i)), cy + r * math.sin(math.radians(-90 + 72 * i)))
    svg = ['<svg viewBox="0 0 100 100" class="radar" aria-hidden="true">']
    for lv in range(1, 6):
        svg.append('<polygon points="' + ' '.join('%.1f,%.1f' % pt(i, R * lv / 5) for i in range(5)) + '" fill="none" stroke="#C9C0AC" stroke-width="0.4"/>')
    for i in range(5):
        x, y = pt(i, R); svg.append(f'<line x1="{cx}" y1="{cy}" x2="{x:.1f}" y2="{y:.1f}" stroke="#C9C0AC" stroke-width="0.4"/>')
    svg.append('<polygon points="' + ' '.join('%.1f,%.1f' % pt(i, R * v / 5) for i, (_, v) in enumerate(axes)) + '" fill="#BFC6C0" fill-opacity="0.85" stroke="#2E5242" stroke-width="0.7"/>')
    for i, (lab, _) in enumerate(axes):
        x, y = pt(i, R + 3.2)
        anchor = 'middle' if i == 0 else ('start' if i in (1, 2) else 'end')
        if i == 0: y -= 0.5
        if i in (2, 3): y += 3.2
        svg.append(f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="{anchor}" font-size="6.4" fill="#3B3B3B">{esc(lab)}</text>')
    svg.append('</svg>')
    return ''.join(svg)


def cell(t):
    ru, bi = ml_of(t)
    soon, sold = t.get('comingSoon'), t.get('soldOut')
    if t.get('original'): top = '<span class="badge">オリジナル</span>'
    else: top = f'<span class="brew">{esc(t.get("brewery", ""))}</span>'
    if sold: price = '<div class="price"><b>SOLD OUT</b> ─ 売り切れ</div>'
    elif soon: price = '<div class="price"><b>COMING SOON</b> ─ もうすぐ到着</div>'
    else: price = f'<div class="price">レギュラー{yen(t["regular"])} / ビッグ{yen(t["big"])}</div>'
    ruby = f'<div class="ruby">{esc(t.get("ruby", ""))}</div>' if t.get('ruby') else ''
    return f'''<div class="cell{' dim' if (soon or sold) else ''}">
<div class="head"><div class="name"><span class="no">{circled(t["no"])}</span>{esc(t["name"])}</div>{top}</div>
<div class="sub">{ruby}<span class="style">({esc(t["style"])})</span>{price}</div>
<div class="body"><p class="desc">{esc(t["desc"])}</p>{radar(t)}</div>
<div class="foot">ALC.{t["abv"]:.1f}%&nbsp;&nbsp;{agu(t["abv"], ru)} / {agu(t["abv"], bi)} AGU</div>
</div>'''


def set_agu(order): return sum(by_no[n]['abv'] for n in order) * 100 * 0.8 / 100 / AGU_BASE   # 3杯(各100mL)


sets = tap['sets']
agus = [set_agu(x['order']) for x in sets['items'] if not x.get('free')]   # お好みセット(free)は、中身が決まっていないので、AGUの範囲には入れない
icons = ['<svg viewBox="0 0 24 24" class="ic"><g fill="#4F7A4E"><circle cx="12" cy="6" r="3"/><circle cx="8" cy="11" r="3"/><circle cx="16" cy="11" r="3"/><circle cx="12" cy="16" r="3"/><circle cx="12" cy="21" r="2"/></g></svg>',
         '<svg viewBox="0 0 24 24" class="ic"><g fill="#B98B3E"><ellipse cx="7" cy="9" rx="2" ry="4"/><ellipse cx="12" cy="7" rx="2" ry="4"/><ellipse cx="17" cy="9" rx="2" ry="4"/><rect x="11.4" y="11" width="1.2" height="11"/></g></svg>',
         '<svg viewBox="0 0 24 24" class="ic"><circle cx="12" cy="12" r="9" fill="#E8A33D"/><circle cx="12" cy="12" r="6.5" fill="#F6D58C"/><g stroke="#E8A33D" stroke-width="1"><line x1="12" y1="6" x2="12" y2="18"/><line x1="6" y1="12" x2="18" y2="12"/></g></svg>']
set_rows = ''
for i, x in enumerate(sets['items']):
    if x.get('free'):   # お好みセット: 気になる3つを選ぶ(中身は決めない)
        set_rows += f'<div class="srow">{icons[2]}<div class="st"><b>{esc(x["title"])}</b><br><small>{esc(x["desc"])}</small></div><div class="so free">お好み3種</div></div>'
        continue
    flag = any((by_no[n].get('comingSoon') or by_no[n].get('soldOut')) for n in x['order'])
    mark = ' <span class="tag">' + ('SOLD OUT' if any(by_no[n].get('soldOut') for n in x['order']) else 'COMING SOON') + '</span>' if flag else ''
    set_rows += f'<div class="srow{" dim" if flag else ""}">{icons[i % 2]}<div class="st"><b>{esc(x["title"])}</b>{mark}<br><small>{esc(x["desc"])}</small></div><div class="so">{"→".join(circled(n) for n in x["order"])}</div></div>'
# QR: 点を行ごとにつなげた図形で描く(隙間やにじみを減らす)。純黒。誤り訂正は M。まわりの白い余白(静かな領域)は、4点ぶん以上とる
_q = segno.make(QR_URL, error='m', micro=False)
_m = [list(r) for r in _q.matrix]
_n = len(_m)
_d = []
for _y, _row in enumerate(_m):
    _x = 0
    while _x < _n:
        if _row[_x]:
            _s = _x
            while _x < _n and _row[_x]: _x += 1
            _d.append(f'M{_s} {_y}h{_x - _s}v1h-{_x - _s}z')
        else: _x += 1
qr = f'<svg viewBox="-4 -4 {_n + 8} {_n + 8}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="-4" y="-4" width="{_n + 8}" height="{_n + 8}" fill="#fff"/><path d="{"".join(_d)}" fill="#000"/></svg>'
updated = tap['updated']
doc = f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>CRAFT BEER {esc(updated)}</title>
<style>
@font-face{{font-family:'NotoJP';src:url('file://{CACHE}NotoSansJP.ttf');font-weight:100 900}}
@page{{size:A4;margin:0}}
*{{box-sizing:border-box}} html,body{{margin:0}}
body{{width:210mm;height:297mm;background:#F6EEDC;font-family:'NotoJP',sans-serif;color:#2B2B2B;padding:11mm 12mm 8mm}}
h1{{margin:0 0 4mm 6mm;font-size:30pt;font-weight:900;letter-spacing:.01em;line-height:1.1}}
.grid{{display:grid;grid-template-columns:1fr 1fr;border-top:.25mm solid #CFC6B0;border-left:.25mm solid #CFC6B0}}
.grid>*{{border-right:.25mm solid #CFC6B0;border-bottom:.25mm solid #CFC6B0;padding:2mm 2.6mm 1.4mm;height:37.4mm;overflow:hidden}}
.dim .desc,.dim .radar,.dim .foot{{opacity:.62}}
.head{{display:flex;justify-content:space-between;align-items:baseline;gap:2mm}}
.name{{font-size:13.5pt;font-weight:900;line-height:1.1;white-space:nowrap}} .no{{font-weight:700;margin-right:.3mm}}
.brew{{font-size:7.4pt;text-align:right}} .badge{{background:#8C2434;color:#fff;font-size:6.6pt;font-weight:700;padding:.5mm 2.2mm;border-radius:1mm}}
.sub{{display:flex;justify-content:space-between;align-items:baseline;gap:2mm;font-size:7.6pt;margin-top:.3mm;position:relative}}
.ruby{{position:absolute;left:.3mm;top:-1.2mm;font-size:4.6pt;letter-spacing:.02em;color:#444}} .style{{margin-top:1.3mm;display:inline-block}}
.price{{font-size:7.6pt}} .price b{{font-family:inherit;font-weight:800}}
.body{{display:flex;gap:1mm;margin-top:.6mm;height:21.2mm}}
.desc{{margin:0;flex:1 1 56%;font-size:8.1pt;line-height:1.5;overflow:hidden}} .radar{{flex:0 0 40%;height:25mm;margin-top:-2.4mm;margin-right:-1mm}}
.foot{{font-size:7.6pt;margin-top:-1.2mm;font-weight:500}}
.qr{{display:flex;align-items:center;gap:3mm;padding-left:3mm}} .qr svg{{width:31mm;height:31mm;flex:0 0 auto}}
.qr h2{{margin:0 0 1.2mm;font-size:11.2pt;font-weight:900}} .qr p{{margin:0;font-size:7.6pt;line-height:1.55}} .qr small{{display:block;margin-top:1.4mm;font-size:6.6pt;color:#555}}
.sets .sh{{display:flex;align-items:baseline;gap:2.4mm}} .sets h2{{margin:0;font-size:11.5pt;font-weight:900}} .sets .sp{{font-size:10.5pt;font-weight:800}} .sets .sz{{font-size:4.8pt}}
.srow{{display:flex;align-items:center;gap:2mm;margin-top:2.2mm}} .ic{{width:6.2mm;height:6.2mm;flex:0 0 auto}}
.st{{flex:1;font-size:8.4pt;line-height:1.2}} .st small{{font-size:6.8pt}} .so{{font-size:12.4pt;letter-spacing:.04em;white-space:nowrap}} .so.free{{font-size:9.6pt;font-weight:900}}
.tag{{display:inline-block;border:.25mm solid #2B2B2B;font-size:5.4pt;padding:0 1.2mm;font-weight:700;vertical-align:1px}}
.note{{font-size:5.6pt;text-align:right;margin-top:.5mm}}
.legal{{margin-top:3.4mm;text-align:right;font-size:6.6pt;color:#555}}
</style></head><body>
<h1>CRAFT BEER</h1>
<div class="grid">
{''.join(cell(t) for t in items)}
<div class="qr">{qr}<div><h2>どれにするか決まらない人へ</h2><p>5つの質問でおすすめを選びます<br>用語集・読みもの・AGUの考え方も</p><small>yagiribrewery.com/tap</small></div></div>
<div class="sets"><div class="sh"><h2>飲み比べセット</h2><span class="sp">{yen(sets["price"])}</span><span class="sz">{esc(sets["size"].replace(" ", ""))} / 約{min(agus):.1f}〜{max(agus):.1f} AGU</span></div>{set_rows}</div>
</div>
<div class="legal">※「→」はおすすめの飲む順番(飲み比べセット)。　AGU … 一杯の純アルコール量を示す矢切ブルワリー独自の単位。安全な量の目安ではありません。お酒は20歳になってから。　{esc(updated)} 現在</div>
</body></html>'''
out = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'out')); os.makedirs(out, exist_ok=True)
stem = f'taplist_{updated.replace("-", "")}_A4'
open(f'{out}/{stem}.html', 'w', encoding='utf-8').write(doc)
subprocess.run(['node', os.path.join(os.path.dirname(__file__), 'print.cjs'), f'{out}/{stem}.html', f'{out}/{stem}.pdf'], check=True, env={**os.environ, 'NODE_PATH': os.environ.get('NODE_PATH', '/opt/node22/lib/node_modules'), 'CHROMIUM_PATH': os.environ.get('CHROMIUM_PATH', '/opt/pw-browsers/chromium')})
print('ok', f'{out}/{stem}.pdf')
