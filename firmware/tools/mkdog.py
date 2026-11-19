#!/usr/bin/env python3
# Makes dog.h for the console from the dog artwork. Usage: mkdog.py <artwork folder> <out dog.h> [preview.png]
# Each animation is a list of PNG frames. Every frame of one animation is scaled by the same amount and stood on the
# same ground line, then all frames share one 16-colour palette. A frame is stored as runs: one byte = (run length - 1)
# in the top 4 bits and the colour number in the bottom 4, left to right, top to bottom.
import sys, os
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw
src, out = sys.argv[1], sys.argv[2]
BG = (0, 0, 0); EDGE = (224, 224, 224)      # the console's background (black) and the pale outline (CMU Steel Gray)
def have(n): return os.path.exists(os.path.join(src, n))
def frames(prefix, count, fallback):
    names = ['%s-%d.png' % (prefix, i) for i in range(1, count + 1)]
    return names if all(have(n) for n in names) else fallback
def load(name):
    im = Image.open(os.path.join(src, name)).convert('RGBA')
    if im.getextrema()[3][0] == 255:                                   # no see-through background: take the plain one out from the corners
        w, h = im.size; work = im.convert('RGB')
        for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]: ImageDraw.floodfill(work, seed, (255, 0, 255), thresh=38)
        a = Image.new('L', (w, h), 255); a.putdata([0 if p == (255, 0, 255) else 255 for p in work.getdata()]); im.putalpha(a)
    return im
def animation(names, H, padL=3, padR=3, same_canvas=False):
    ims = [load(n) for n in names]
    if same_canvas:                                                    # frames drawn on one shared canvas: crop them all by the same box, so nothing jumps
        box = None
        for im in ims:
            b = im.split()[3].point(lambda v: 255 if v > 40 else 0).getbbox()
            box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
        ims = [im.crop(box) for im in ims]
    else: ims = [im.crop(im.split()[3].point(lambda v: 255 if v > 40 else 0).getbbox()) for im in ims]
    sc = (H - 6) / max(im.size[1] for im in ims)
    ims = [im.resize((max(1, round(im.size[0] * sc)), max(1, round(im.size[1] * sc))), Image.LANCZOS) for im in ims]
    W = max(im.size[0] for im in ims) + padL + padR + 4; W += W % 2
    cells = []
    for g in ims:
        c = Image.new('RGBA', (W, H), (0, 0, 0, 0)); c.alpha_composite(g, (padL + 2 + (W - padL - padR - 4 - g.size[0]) // 2, H - 3 - g.size[1]))
        a = c.split()[3]; ring = a.filter(ImageFilter.MaxFilter(5)).point(lambda v: 255 if v > 60 else 0)
        rgb = ImageEnhance.Brightness(ImageEnhance.Color(c.convert('RGB')).enhance(1.6)).enhance(1.2)
        base = Image.new('RGB', (W, H), BG); base.paste(Image.new('RGB', (W, H), EDGE), mask=ring); base.paste(rgb, mask=a.point(lambda v: 255 if v > 110 else 0)); cells.append(base)
    return cells
ANIMS = [  # name, frames, height on screen, left pad
 ('WALK',  frames('console-walk', 6, None), 56, 8, True),
 ('SIT',   frames('console-sit', 2, None), 60, 3, True),
 ('SLEEP', frames('console-sleep', 4, None), 48, 3, True),
 ('WAKE',  frames('console-wake', 4, None), 60, 3, True),
 ('BARK',  frames('console-bark', 3, None), 60, 3, True),
 ('HOP',   frames('console-hop', 3, None), 72, 3, True),
 ('WAVE',  frames('console-wave', 4, None), 50, 3, True),
 ('TILT',  frames('console-head-tilt', 4, None), 48, 3, True),
 ('SNIFF', frames('console-sniff', 4, None), 44, 3, True),
]
missing = [a[0] for a in ANIMS if not a[1]]
if missing: sys.exit('frames missing for: ' + ', '.join(missing))
built = [(n, animation(f, H, pad, 3, same)) for n, f, H, pad, same in ANIMS]
allc = [c for _, cells in built for c in cells]
strip = Image.new('RGB', (sum(c.size[0] for c in allc), max(c.size[1] for c in allc)), BG); x = 0
for c in allc: strip.paste(c, (x, 0)); x += c.size[0]
q = strip.quantize(16, method=Image.Quantize.MEDIANCUT, kmeans=6, dither=Image.Dither.NONE)
pal = q.getpalette()[:48]; pal = [tuple(pal[i * 3:i * 3 + 3]) for i in range(16)]
bi = min(range(16), key=lambda i: sum((pal[i][j] - BG[j]) ** 2 for j in range(3))); pal[bi] = BG
q.putpalette([v for p in pal for v in p] + [0] * (768 - 48))
if len(sys.argv) > 3: q.convert('RGB').resize((strip.size[0] * 2, strip.size[1] * 2), Image.NEAREST).save(sys.argv[3])
def runs(img):
    px = list(img.getdata()); o = []; i = 0
    while i < len(px):
        j = i
        while j < len(px) and px[j] == px[i] and j - i < 16: j += 1
        o.append(((j - i - 1) << 4) | px[i]); i = j
    return o
rgb565 = lambda p: ((p[0] >> 3) << 11) | ((p[1] >> 2) << 5) | (p[2] >> 3)
h = '''// The dog's pictures for the console screen. The drawings are Diana's (made with ChatGPT's image tool); this file is
// made from them by tools/mkdog.py, which Claude wrote. Each picture is shrunk for the screen and given a pale outline
// so a black dog shows on the dark background. A picture is stored as runs of one colour: each byte holds the run's
// length minus 1 in its top half and a colour number 0-15 in its bottom half. DOG_COLOR turns the number into a colour.
#pragma once
const uint16_t DOG_COLOR[16] PROGMEM = { %s };
''' % ', '.join('0x%04X' % rgb565(p) for p in pal)
x = 0; total = 0; seen = {}
for name, cells in built:
    W, H = cells[0].size
    h += 'const byte %s_W = %d, %s_H = %d, %s_N = %d;\n' % (name, W, name, H, name, len(cells))
    names = []
    for i, c in enumerate(cells):
        d = tuple(runs(q.crop((x, 0, x + W, H)))); x += W
        if (W, H, d) in seen: names.append(seen[(W, H, d)]); continue          # the same picture again (a pose an animation returns to): stored once
        seen[(W, H, d)] = '%s_%d' % (name, i); names.append(seen[(W, H, d)]); total += len(d)
        h += 'const uint8_t %s_%d[] PROGMEM = {\n  ' % (name, i) + ',\n  '.join(', '.join('0x%02X' % v for v in d[k:k + 24]) for k in range(0, len(d), 24)) + '\n};\n'
    h += 'const uint8_t* const %s[] PROGMEM = { %s };\n' % (name, ', '.join(names))
open(out, 'w').write(h)
if total + 32 > 40600: sys.exit('too big: %d bytes. The pictures and the screen texts must stay inside the first 64 KB of the board.' % (total + 32))
print('pictures:', sum(len(c) for _, c in built), 'stored:', len(seen), ' bytes on the board:', total + 32, ' widths:', {n: c[0].size for n, c in built})
