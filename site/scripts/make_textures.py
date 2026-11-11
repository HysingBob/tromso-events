#!/usr/bin/env python3
"""Lagar vevversjonar av teksturane for tema v7 «oppslagstavle».

Kjeldefiler: design/textures/src/{wood-plank-32,marble-green,paper-kraft}
Mål:         src/assets/textures/{board,banner,paper}.webp

  board  1024x1024, uendra (kjelde: wood-plank-32.png)
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


def wall_textures(out):
    """Kategorivegger på korta (Bob 2026-11-11): Wallpaper A–D frå Koofr
    (~/Koofr/Wallpaper{A,B,C,D}) som wall-{a,b,c,d}.webp. 1024 px brei,
    uendra elles. wall-d står på ventetrå — hoppar over manglande fil."""
    for stem, src in [('a', 'wall-a.png'), ('b', 'wall-b.jpg'),
                      ('c', 'wall-c.png'), ('d', 'wall-d.png')]:
        sp = os.path.join(SRC, src)
        if not os.path.exists(sp):
            print(f'wall-{stem}: kjelda {src} finst ikkje — hoppar over')
            continue
        im = Image.open(sp).convert('RGB')
        if im.width > 1024:
            im = im.resize((1024, round(im.height * 1024 / im.width)),
                           Image.Resampling.LANCZOS)
        p, im2 = save_webp(im, f'wall-{stem}.webp')
        out[f'wall-{stem}'] = report(f'wall-{stem}', p, im2)


def fabric20(out):
    """Aurora kino Fokus-signatur (Bob 2026-11-11): fabric_20 frå Koofr
    (~/Koofr/Assets/1K-fabric_20-diffuse.jpg) som fabric-20.webp,
    1024 px brei, uendra elles."""
    sp = os.path.join(SRC, 'fabric-20.jpg')
    if not os.path.exists(sp):
        print('fabric-20: kjelda finst ikkje — hoppar over')
        return
    im = Image.open(sp).convert('RGB')
    if im.width > 1024:
        im = im.resize((1024, round(im.height * 1024 / im.width)),
                       Image.Resampling.LANCZOS)
    p, im2 = save_webp(im, 'fabric-20.webp')
    out['fabric-20'] = report('fabric-20', p, im2)


def lovewall23(out):
    """Løvetann Studio-signatur (Bob 2026-11-11): Wallpaper_23 frå Koofr
    (~/Koofr/Assets/walllpaper_23.jpg — filnamnet har trippel-l) som
    lovewall-23.webp, 1024 px brei, uendra elles. Lys blågrå mural
    (snitt #669697, p99.9 lum 0.729) = «dagkort»: standard mørkt blekk
    (#3A2A1E 7,1:1, rust 4,8:1)."""
    sp = os.path.join(SRC, 'lovewall-23.jpg')
    if not os.path.exists(sp):
        print('lovewall-23: kjelda finst ikkje — hoppar over')
        return
    im = Image.open(sp).convert('RGB')
    if im.width > 1024:
        im = im.resize((1024, round(im.height * 1024 / im.width)),
                       Image.Resampling.LANCZOS)
    p, im2 = save_webp(im, 'lovewall-23.webp')
    out['lovewall-23'] = report('lovewall-23', p, im2)


def mahogany(out):
    """PUST Lavvo-signatur (Bob 2026-11-11): mahogany_1 frå Koofr
    (~/Koofr/Assets/mahogany_1.png) som mahogany.webp, 1024 px brei,
    uendra elles. Mahogny er midtone (snitt #974F23, p99.9 lum 0.444) —
    for lys for krem (4,0:1), for mørk for blekk (2,8:1). Løysing: same
    28 % svartvask som vedveggen ligg i CSS over teksturen, så kremblekk
    landar på 6,4–6,9:1."""
    sp = os.path.join(SRC, 'mahogany.png')
    if not os.path.exists(sp):
        print('mahogany: kjelda finst ikkje — hoppar over')
        return
    im = Image.open(sp).convert('RGB')
    if im.width > 1024:
        im = im.resize((1024, round(im.height * 1024 / im.width)),
                       Image.Resampling.LANCZOS)
    p, im2 = save_webp(im, 'mahogany.webp')
    out['mahogany'] = report('mahogany', p, im2)


def ishavswall38(out):
    """Ishavskatedralen-signatur (Bob 2026-11-11): wallpaper_38 frå Koofr
    (~/Koofr/Assets/wallpaper_38.png) som ishavswall-38.webp, 1024 px brei,
    uendra elles. Lys off-white mural (snitt #DFDBCE, p99.9 lum 0.902) =
    «dagkort»: standard mørkt blekk (ink 11,0:1, rust 7,5:1)."""
    sp = os.path.join(SRC, 'ishavswall-38.png')
    if not os.path.exists(sp):
        print('ishavswall-38: kjelda finst ikkje — hoppar over')
        return
    im = Image.open(sp).convert('RGB')
    if im.width > 1024:
        im = im.resize((1024, round(im.height * 1024 / im.width)),
                       Image.Resampling.LANCZOS)
    p, im2 = save_webp(im, 'ishavswall-38.webp')
    out['ishavswall-38'] = report('ishavswall-38', p, im2)


def rosewood(out):
    """Tromsø Kulturhus-signatur (Bob 2026-11-11): Rosewood_1 frå Koofr
    (~/Koofr/Assets/rosewood_1.png) som rosewood.webp, 1024 px brei,
    uendra elles. Mørk rosentre-ved — p99.9 lum 0.179, så kremblekket
    landar på 9,8–12:1 (betre enn fabric-202)."""
    sp = os.path.join(SRC, 'rosewood.png')
    if not os.path.exists(sp):
        print('rosewood: kjelda finst ikkje — hoppar over')
        return
    im = Image.open(sp).convert('RGB')
    if im.width > 1024:
        im = im.resize((1024, round(im.height * 1024 / im.width)),
                       Image.Resampling.LANCZOS)
    p, im2 = save_webp(im, 'rosewood.webp')
    out['rosewood'] = report('rosewood', p, im2)


def main():
    os.makedirs(OUT, exist_ok=True)
    out = {}

    wood = Image.open(os.path.join(SRC, 'wood-plank-32.png')).convert('RGB')
    p = os.path.join(OUT, 'board.webp')
    wood.save(p, 'WEBP', quality=80, method=6)
    out['board'] = report('board ', p, Image.open(p))

    # banner.webp (turkis planke) og planks.webp er ute: Bob brukar marmor for
    # alle turkise element. Sjå design/v7.2-minimal.md.
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

    # Kompassrosa er tilbake: ho står no i botnen av sida (sjå design/v7.2-minimal.md).
    rose = Image.open(os.path.join(SRC, 'compass-rose.png')).convert('RGBA')
    rose.thumbnail((512, 512), Image.Resampling.LANCZOS)
    p = os.path.join(OUT, 'compass.webp')
    rose.save(p, 'WEBP', quality=80, method=6)
    rose.save(os.path.join(OUT, 'compass.png'), 'PNG', optimize=True)
    out['compass'] = report('compass', p, rose)

    v71_textures(out)
    wall_textures(out)
    fabric20(out)
    lovewall23(out)
    mahogany(out)
    ishavswall38(out)
    rosewood(out)

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
