#!/usr/bin/env python3
"""記事のタイトル動画(黒地に、言葉が出ては消える。矢切カラー)を作る道具。サイトのビルドには使わない(開発用)。

使い方:  python3 scripts/title-video/make.py [slug ...]     # 省略すると、content/title-videos.json の全記事
必要なもの: Python3 + Pillow(raqm 付き)+ numpy + ffmpeg。書体は、初回に Google Fonts(OFL)から
            ~/.cache/yagiri-title-video/ へ取ってくる(リポジトリには入れない)。α や ≒ は DejaVu Serif で描く。
出力:      public/images/journal/<slug>.mp4(10秒ループ・音なし)と <slug>.jpg(ポスター=最後のタイトルの場面)
仕様:      content/title-videos.json(言葉は、記事の本文・見出し・要点から選ぶ。事実と違うことは書かない)
詳しくは docs/TITLE_VIDEO.md
"""
import sys, os, json, math, random, subprocess, tempfile, shutil, urllib.request
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FD = os.path.expanduser('~/.cache/yagiri-title-video/')
FONTS = {
    'ShipporiMincho-Regular.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/shipporimincho/ShipporiMincho-Regular.ttf',
    'ShipporiMincho-Medium.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/shipporimincho/ShipporiMincho-Medium.ttf',
    'ShipporiMincho-SemiBold.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/shipporimincho/ShipporiMincho-SemiBold.ttf',
    'Cinzel.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/cinzel/Cinzel%5Bwght%5D.ttf',
}
SYMBOL_FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'
os.makedirs(FD, exist_ok=True)
for _n, _u in FONTS.items():
    if not os.path.exists(FD + _n): urllib.request.urlretrieve(_u, FD + _n)

W, H, FPS, TOTAL = 1280, 720, 30, 10.0
BG, CREAM, GOLD, WINE = (11, 11, 11), (239, 233, 220), (201, 170, 110), (140, 36, 52)
SIZES = {'大': 96, '中': 54, '小': 32}
GAP = 1.42          # 縦書きの字送り
CATS = {'醸造科学': 'BREW SCIENCE', '世界の潮流': 'WORLD TRENDS', '酵母': 'YEAST', 'BREW LOG': 'BREW LOG'}  # Cinzel に日本語が無いので、英字で

mincho = lambda s, w='Regular': ImageFont.truetype(FD + f'ShipporiMincho-{w}.ttf', s)
cinzel = lambda s: ImageFont.truetype(FD + 'Cinzel.ttf', s)
symfont = lambda s: ImageFont.truetype(SYMBOL_FONT, s)
ease = lambda x: x * x * (3 - 2 * x)
is_latin = lambda w: all(ord(c) < 128 for c in w)
# 明朝に無い文字(α ≒ ℃ など)は、別の書体(DejaVu Serif)で描く。無い文字は、書体に収められた「豆腐」(欠字の記号)と同じ形になるので、それで見分ける
import hashlib
_mf = ImageFont.truetype(FD + 'ShipporiMincho-Regular.ttf', 40)
_hash = lambda c: hashlib.md5(bytes(_mf.getmask(c))).hexdigest()
_TOFU = _hash('\uffff')
_sym_cache = {}
def is_sym(c):
    if c.isascii(): return False
    if c not in _sym_cache: _sym_cache[c] = (_hash(c) == _TOFU)
    return _sym_cache[c]


def env(t, t0, t1, fin=0.9, fout=0.9):
    if t < t0 or t > t1: return 0.0
    return min(ease(min(1, (t - t0) / fin)), ease(min(1, (t1 - t) / fout)))


def tile_vertical(text, size, col):
    pad = 16
    w = int(size * 1.9) + pad * 2
    h = int(len(text) * size * GAP) + size + pad * 2 + 40
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    f = mincho(size, 'Medium' if size > 60 else 'Regular')
    x0 = pad + size * 0.3; y0 = pad + 40
    d.rectangle([x0 + size * 0.5 - 1, pad, x0 + size * 0.5 + 1, pad + 30], fill=WINE + (255,))   # 行の頭の、えんじの短い線
    for i, ch in enumerate(text):
        cy = y0 + i * size * GAP
        if ch in '、。': d.text((x0 + size * 0.58, cy - size * 0.42), ch, font=f, fill=col + (255,))   # 縦書きの句読点は、右上へ
        elif ch == 'ー': d.text((x0 + size * 0.5, cy), '丨', font=f, fill=col + (255,), anchor='mt')
        elif is_sym(ch): d.text((x0 + size * 0.5, cy), ch, font=symfont(int(size * 0.9)), fill=col + (255,), anchor='mt')
        elif is_latin(ch): d.text((x0 + size * 0.5, cy), ch, font=cinzel(int(size * 0.8)), fill=col + (255,), anchor='mt')
        else: d.text((x0, cy), ch, font=f, fill=col + (255,))
    return im.crop(im.getbbox())


def tile_horizontal(text, size, col, track):
    latin = is_latin(text.replace(' ', ''))
    f = cinzel(int(size * 0.9)) if latin else mincho(size, 'Medium' if size > 60 else 'Regular')
    fo = lambda c: symfont(int(size * 0.85)) if is_sym(c) else f
    tw = int(sum(fo(c).getlength(c) + track for c in text)); pad = 16
    im = Image.new('RGBA', (tw + pad * 2, int(size * 1.6) + pad * 2 + 20), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle([pad, pad, pad + 30, pad + 2], fill=WINE + (255,))                              # 頭の、えんじの短い線
    cx = pad
    for c in text:
        d.text((cx, pad + 20 + size * 0.62), c, font=fo(c), fill=col + (255,), anchor='lm'); cx += fo(c).getlength(c) + track
    return im.crop(im.getbbox())


def fit_size(text, size, track_ratio, max_w):
    """横に流す言葉・タイトルが、画面からはみ出さないように、大きさを下げる"""
    while size > 24 and (len(text) * size * (1 + track_ratio)) > max_w: size -= 2
    return size


def put(img, tile, cx, cy, a, scale=1.0, blur=0, mblur=0, dx=0):
    if a <= 0.004: return
    t = tile
    if scale != 1.0: t = t.resize((max(1, int(t.width * scale)), max(1, int(t.height * scale))), Image.LANCZOS)
    if blur > 0.3: t = t.filter(ImageFilter.GaussianBlur(blur))
    if mblur > 1:                                                           # 横に流れる、ぶれ
        arr = np.asarray(t, dtype=np.float32); nn = max(1, int(mblur / 4)); pad = int(mblur) + 8
        arr = np.pad(arr, ((0, 0), (pad, pad), (0, 0))); acc = np.zeros_like(arr)
        for k in range(nn + 1): acc += np.roll(arr, int(k * 4 - mblur / 2), axis=1)
        t = Image.fromarray((acc / (nn + 1)).astype(np.uint8), 'RGBA')
    al = t.getchannel('A').point(lambda p: int(p * a))
    img.paste(t.convert('RGB'), (int(cx - t.width / 2 + dx), int(cy - t.height / 2)), mask=al)


def title_masks(cat, title, no):
    label = f'No.{no}   /   {cat}' if no else cat
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m); f1 = cinzel(20)
    tw = sum(f1.getlength(c) + 6 for c in label) - 6; cx = W / 2 - tw / 2
    for c in label: d.text((cx, 290), c, font=f1, fill=255, anchor='lm'); cx += f1.getlength(c) + 6
    size = fit_size(title, 50, 0.44, W - 160)
    m2 = Image.new('L', (W, H), 0); d2 = ImageDraw.Draw(m2); f2 = mincho(size, 'SemiBold')
    tw = sum(f2.getlength(c) + size * 0.44 for c in title) - size * 0.44; cx = W / 2 - tw / 2
    for c in title: d2.text((cx, 380), c, font=f2, fill=255, anchor='lm'); cx += f2.getlength(c) + size * 0.44
    r = Image.new('L', (W, H), 0); ImageDraw.Draw(r).rectangle([W // 2 - 60, 450, W // 2 + 60, 452], fill=255)
    return m, m2, r


def render(spec, outdir):
    rnd = random.Random(int(spec.get('seed', 1)))
    items = []
    for k, raw in enumerate(spec['items']):
        lv, txt = raw.split(':', 1); size = SIZES[lv]
        col = GOLD if (k % 2 == 0 or lv == '大') else CREAM
        vt = tile_vertical(txt, size, col); ht = tile_horizontal(txt, size, col, track=size * (0.35 if lv == '大' else 0.22))
        fits_v = vt.height <= H - 150; fits_h = ht.width <= W - 150
        pick = rnd.choice(['v', 'h']) if (fits_v and fits_h) else ('v' if fits_v else 'h')   # 縦横は抽選。収まらない向きは使わない
        if lv == '小' and is_latin(txt.replace(' ', '')): pick = 'h'
        items.append({'lv': lv, 'tile': vt if pick == 'v' else ht})
    n_it = len(items); starts = [0.2 + i * (4.4 / max(1, n_it - 1)) for i in range(n_it)]
    rnd.shuffle(starts)
    placed = []
    for it, t0 in zip(items, starts):
        it['t0'] = t0; it['t1'] = t0 + rnd.uniform(2.8, 3.3) + (0.5 if it['lv'] == '大' else 0)
        tw, th = it['tile'].size; best = None
        for _ in range(400):
            x = rnd.randint(50, max(51, W - tw - 50)); y = rnd.randint(40, max(41, H - th - 40))
            box = (x - 24, y - 24, x + tw + 24, y + th + 24)
            clash = sum(1 for o in placed if o['t0'] < it['t1'] and it['t0'] < o['t1'] and not (box[2] < o['box'][0] or box[0] > o['box'][2] or box[3] < o['box'][1] or box[1] > o['box'][3]))
            if best is None or clash < best[0]: best = (clash, x, y, box)
            if clash == 0: break
        it['x'], it['y'], it['box'] = best[1], best[2], best[3]; placed.append(it)
    ssize = fit_size(spec['sweep'], 96, 0.19, W - 200)
    sweep = tile_horizontal(spec['sweep'], ssize, CREAM, ssize * 0.19)
    cm, tm, rm = title_masks(CATS.get(spec['category'], spec['category']), spec['title'], spec.get('no', ''))
    n = int(TOTAL * FPS)
    for i in range(n):
        t = i / FPS
        img = Image.new('RGB', (W, H), BG)
        for it in sorted(items, key=lambda z: z['lv'] != '大'):
            a = env(t, it['t0'], it['t1'], 0.9, 1.2)
            if a <= 0: continue
            tw, th = it['tile'].size; cx, cy = it['x'] + tw / 2, it['y'] + th / 2
            out = max(0.0, min(1.0, (t - (it['t1'] - 1.5)) / 1.5))        # 終わりの1.5秒で、中央へ向かって小さくなりながら消える
            k = ease(out); cx += (W / 2 - cx) * 0.14 * k; cy += (H / 2 - cy) * 0.14 * k
            put(img, it['tile'], cx, cy, a * (0.95 if it['lv'] != '小' else 0.8), scale=1 - 0.16 * k, blur=(1 - a) * (10 if it['lv'] == '大' else 7))
        a = env(t, 5.6, 7.5, 0.9, 0.8); kk = 1 - min(1, max(0, (t - 5.6) / 0.9))
        put(img, sweep, W / 2, H / 2 - 20, a, mblur=kk * 90, dx=kk * 110)  # 横に流れて止まる大きな言葉
        a = env(t, 7.5, 9.95, 0.9, 0.6)
        for m, col in ((cm, GOLD), (tm, CREAM), (rm, WINE)):
            mm = m.filter(ImageFilter.GaussianBlur((1 - a) * 7)) if a < 0.99 else m
            img.paste(col, mask=mm.point(lambda p: int(p * a)))
        img.save(f'{outdir}/f{i:04d}.png')
    return n


def main():
    specs = json.load(open(os.path.join(ROOT, 'content', 'title-videos.json'), encoding='utf-8'))
    want = sys.argv[1:] or [k for k in specs if not k.startswith('_')]
    outdir = os.path.join(ROOT, 'public', 'images', 'journal'); os.makedirs(outdir, exist_ok=True)
    for slug in want:
        spec = specs[slug]
        tmp = tempfile.mkdtemp(prefix='tv-')
        try:
            n = render(spec, tmp)
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', f'{tmp}/f%04d.png', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-preset', 'slow', '-movflags', '+faststart', '-an', os.path.join(outdir, f'{slug}.mp4')], check=True)
            Image.open(f'{tmp}/f{int(8.7 * FPS):04d}.png').convert('RGB').save(os.path.join(outdir, f'{slug}.jpg'), quality=86, optimize=True)  # ポスター=タイトルの場面
            print(slug, 'ok', n, 'frames')
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
