"""timeline_public_v1.csv → future-timeline.json を生成する。
年1回の更新時は CSV を編集してから、このスクリプトを実行する。
  python3 scripts/csv_to_future_json.py content/future/timeline_public_v1.csv content/future/future-timeline.json
CSVの主な列:
  公開見出し / 公開本文 / なぜこの年 : ページに出す文章
  公開区分  : アーカイブ | 非表示(確認中) | 非表示
  ハイライト: これまで | 2030 | 2035 | 2040 | 2050 | 空欄
"""
import csv, json, re, sys
from datetime import date

CATS = {'G': '原料・気候', 'Y': '酵母・発酵', 'M': 'スタイル・市場', 'J': '日本のクラフト', 'R': '制度・税', 'S': '社会・暮らし', 'D': '技術・AI'}
ERAS = {'e1': '〜1999', 'e2': '2000年代', 'e3': '2010年代', 'e4': '2020年代', 'e5': '2030年代', 'e6': '2040年〜'}
KINDS = {'rec': '記録', 'plan': '予定・目標', 'pred': '予測', 'idea': '思索'}
BUCKETS = [
    ('2030', '2027 — 2031', '税と規制が動き、ノンアルと香りの技術が「普通」になる'),
    ('2035', '2032 — 2036', '醸造所の数が絞られ、差がつくのは酵母とデータ'),
    ('2040', '2037 — 2045', '気候と人口の変化が、原料と飲み方を変える'),
    ('2050', '2046 —', '気候の影響が本格化し、原料のあり方が問われる'),
]
NG_SRC = ('Gemini', '未確認', '思索シナリオ', '複数業界記事')

def ylabel(s):
    s = s.strip()
    if s.startswith('FY'): return s[2:6] + '年度'
    if re.fullmatch(r'\d{4}年代', s): return s
    if s == '2050+': return '2050年以降'
    if s == '2080s': return '2080年代'
    m = re.fullmatch(r'(\d{4})[–-](\d{2,4})', s)
    if m and len(m.group(2)) == 2 and int(m.group(2)) > 12: return f'{m.group(1)}〜{m.group(2)}'
    if '頃' in s: return s[:4] + '年頃'
    return s[:4]

def era(y):
    return 'e1' if y < 2000 else 'e2' if y < 2010 else 'e3' if y < 2020 else 'e4' if y < 2030 else 'e5' if y < 2040 else 'e6'

def main(src, dst):
    rows = list(csv.DictReader(open(src, encoding='utf-8-sig')))
    items, hl = [], {}
    for r in rows:
        if r['公開区分'] == '非表示' or not r['公開見出し']:
            continue
        i, ys = r['id'], int(r['年ソート'])
        kind = 'rec' if r['区分'] == '過去' else {'A': 'plan', 'B': 'pred', 'C': 'idea'}[r['層']]
        conf = r['確度']
        pending = r['公開区分'].startswith('非表示')
        s = r['出典']
        if any(k in s for k in NG_SRC) or s in ('—', '-'): s = ''
        url = r['URL'] if r['URL'].startswith('http') else ''
        if not s and pending: s = '出典を確認中'
        if not s and kind in ('pred', 'plan'): s = '関連する研究・統計からの見立て(矢切ブルワリー)'
        if url and not s: s = re.sub(r'^https?://(www\.)?', '', url).split('/')[0]
        items.append({'id': i, 'year': ylabel(r['年表記']), 'ys': ys, 'era': era(ys), 'catKey': i[0], 'cat': CATS[i[0]],
                      'kind': kind, 'dots': {'高': '●●●', '中': '●●○', '低': '●○○'}.get(conf, ''),
                      'confLabel': f'確度 {conf}' if conf in ('高', '中', '低') else '',
                      'title': r['公開見出し'], 'body': r['公開本文'], 'src': s, 'url': url, 'why': r['なぜこの年'], 'pending': pending})
        if r['ハイライト'] and not pending:
            hl.setdefault(r['ハイライト'], []).append((ys, i, kind))
    items.sort(key=lambda x: (x['ys'], x['id']))
    srt = lambda L: [i for _, i, _ in sorted(L)]
    out = {
        'updatedAt': date.today().strftime('%Y-%m'), 'source': src.split('/')[-1],
        'categories': CATS, 'eras': ERAS, 'kinds': KINDS,
        'highlights': {
            'past': srt(hl.get('これまで', [])),
            'buckets': [{'anchor': 'y' + b, 'label': b + '+' if b == '2050' else b, 'range': rg, 'lead': ld,
                         'items': srt([x for x in hl.get(b, []) if x[2] != 'idea']),
                         'takes': srt([x for x in hl.get(b, []) if x[2] == 'idea'])} for b, rg, ld in BUCKETS],
        },
        'items': items,
    }
    json.dump(out, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(items)} items -> {dst}')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
