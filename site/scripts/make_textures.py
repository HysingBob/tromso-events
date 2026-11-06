#!/usr/bin/env python3
"""Lagar vevversjonar av teksturane for tema v7 «oppslagstavle».

Kjeldefiler: design/textures/src/{wood-brown,planks-blue,paper-kraft}.jpg
Mål:         src/assets/textures/{board,banner,paper}.webp

  board  1024x512, uendra
  banner 1024x1024, uendra
  paper  1024 px brei, ljosna slik at snittfargen ligg kring #D6C29C

Skriv ut snittfarge (hex) og percentil-spenn for kvar fil, som grunnlag for
CSS-fallbackfarger og kontrastmåling.
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'design', 'textures', 'src')
OUT = os.path.join(ROOT, 'src', 'assets', 'textures')
TARGET_PAPER = (0xD6, 0xC2, 0x9C)


def stats(im):
    """Snittfarge + percentilar (2 / 50 / 98) i RGB og relativ luminans."""
    px = list(im.convert('RGB').getdata())
    n = len(px)
    avg = tuple(sum(c[i] for c in px) // n for i in range(3))
    ch = {i: sorted(c[i] for c in px) for i in range(3)}
    pct = {p: tuple(ch[i][min(n - 1, int(n * p / 100))] for i in range(3)) for p in (2, 50, 98)}
    return avg, pct


def lum(rgb):
    def f(c):
        c /= 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contrast(a, b):
    l1, l2 = lum(a), lum(b)
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def report(name, path, im):
    avg, pct = stats(im)
    size = os.path.getsize(path)
    print(f'{name}: {im.size[0]}x{im.size[1]}  {size/1024:.1f} KB  avg #{avg[0]:02X}{avg[1]:02X}{avg[2]:02X}')
    for p in (2, 50, 98):
        c = pct[p]
        print(f'    p{p}: #{c[0]:02X}{c[1]:02X}{c[2]:02X}  luminans {lum(c):.4f}')
    return avg, pct


def save_webp(im, name, quality=80, alpha=False):
    """Skriv webp (og png-fallback ved alpha). Returnerer sti + fil."""
    im = im.convert('RGBA') if alpha else im.convert('RGB')
    p = os.path.join(OUT, name)
    im.save(p, 'WEBP', quality=quality, method=6)
    return p, im


def plank_rows(im):
    """Radvise luminansprofilar: finn mørke fugerader i ei plankeflis.

    Returnerer (pitch, first_full_top, gaps) der pitch er avstanden mellom
    to fuge-senter (plankhøgd i piksel), first_full_top er y-verdien der den
    første heile plank byrjar, og gaps er lista av fuge-senter.
    """
    w, h = im.size
    px = im.convert('RGB').load()
    rows = []
    for y in range(h):
        s = 0
        for x in range(0, w, 8):
            r, g, b = px[x, y][:3]
            s += lum((r, g, b))
        rows.append(s / (w // 8 + (1 if w % 8 else 0)))
    med = sorted(rows)[h // 2]
    # Ei fuge er eit lokalt minimum tydeleg under medianen
    gaps = []
    for y in range(1, h - 1):
        if rows[y] < med * 0.72 and rows[y] <= rows[y - 1] and rows[y] <= rows[y + 1]:
            if not gaps or y - gaps[-1][-1] > 3:
                gaps.append([y])
            else:
                gaps[-1].append(y)
    centres = [round(sum(g) / len(g)) for g in gaps if len(g)]
    centres = [c for i, c in enumerate(centres) if i == 0 or c - centres[i - 1] > 8]
    pitches = [centres[i + 1] - centres[i] for i in range(len(centres) - 1)]
    pitch = sorted(pitches)[len(pitches) // 2] if pitches else h
    return pitch, (centres[0] if centres else 0), centres, rows


def v71_textures(out):
    """v7.1: grøn marmor (masthead), grøne plankar (dagdelarar), kompassrose."""
    marble = Image.open(os.path.join(SRC, 'marble-green.png'))
    p, im = save_webp(marble, 'marble.webp')
    out['marble'] = report('marble', p, im)

    planks = Image.open(os.path.join(SRC, 'planks-green.png'))
    p, im = save_webp(planks, 'planks.webp')
    out['planks'] = report('planks', p, im)
    pitch, first, centres, rows = plank_rows(Image.open(p))
    print(f'    plank: pitch {pitch} px, fuge-senter {centres[:12]}'
          f'{" …" if len(centres) > 12 else ""} ({len(centres)} fuger)')
    print(f'    første heile plank byrjar på y={first} (fugesenter) — '
          f'bruk background-position:0 {-first}px for å leggje fuga i toppkanten')

    rose = Image.open(os.path.join(SRC, 'compass-rose.png'))
    rose_rgba = rose.convert('RGBA')
    rose_rgba.thumbnail((512, 512), Image.Resampling.LANCZOS)
    p, im = save_webp(rose_rgba, 'compass.webp', alpha=True)
    p_png = os.path.join(OUT, 'compass.png')
    rose_rgba.save(p_png, 'PNG', optimize=True)
    out['compass'] = report('compass', p, rose_rgba)
    print(f'    compass.png {os.path.getsize(p_png)/1024:.1f} KB (fallback, alpha)')


def main():
    os.makedirs(OUT, exist_ok=True)
    out = {}

    wood = Image.open(os.path.join(SRC, 'wood-brown.jpg')).convert('RGB')
    p = os.path.join(OUT, 'board.webp')
    wood.save(p, 'WEBP', quality=80, method=6)
    out['board'] = report('board ', p, Image.open(p))

    planks = Image.open(os.path.join(SRC, 'planks-blue.jpg')).convert('RGB')
    p = os.path.join(OUT, 'banner.webp')
    planks.save(p, 'WEBP', quality=80, method=6)
    out['banner'] = report('banner', p, Image.open(p))

    kraft = Image.open(os.path.join(SRC, 'paper-kraft.jpg')).convert('RGB')
    w = 1024
    h = round(kraft.height * w / kraft.width)
    kraft = kraft.resize((w, h), Image.Resampling.LANCZOS)
    avg, _ = stats(kraft)
    # Ljosn mot kvitt med eigen faktor per kanal så snittet treff målet.
    k = tuple((255 - TARGET_PAPER[i]) / (255 - avg[i]) for i in range(3))
    lut = []
    for i in range(3):
        lut.append([min(255, round(255 - (255 - v) * k[i])) for v in range(256)])
    paper = kraft.point(lut[0] + lut[1] + lut[2])
    p = os.path.join(OUT, 'paper.webp')
    paper.save(p, 'WEBP', quality=80, method=6)
    out['paper'] = report('paper ', p, Image.open(p))

    v71_textures(out)

    print('\nsnittfarger for CSS:')
    for k2, (avg, _) in out.items():
        print(f'  --{k2}-avg: #{avg[0]:02X}{avg[1]:02X}{avg[2]:02X}')
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f'\nsamla teksturvekt: {total/1024:.1f} KB (budsjett 700 KB)')
    if total > 450 * 1024:
        print('ÅTVARING: over budsjett')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
