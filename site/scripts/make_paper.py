#!/usr/bin/env python3
"""Gjør Pixies papir-PNG om til ferdige bakgrunner for tromsø.net.

Bruk:
    python3 scripts/make_paper.py <kilde.png|kilde.webp> [--out src/assets]

Lager:
    src/assets/paper-tile.webp   2x2 speilet flis (2048x2048) — ingen synlig skjøt
    src/assets/paper-sheet.webp  2560x1600 ark for sideflaten (cover)
    src/assets/paper-card.webp   1200x800 rolig utsnitt til kortene

Skriver også ut lys-statistikk, slik at vi ser om mørk tekst kan ligge oppå.
"""
import argparse, sys
from PIL import Image, ImageFilter, ImageStat

def mirrored_tile(im, size=1024):
    """Speil kant til kant: 2x2 av speilvendte utgaver gir en sømløs flis."""
    im = im.convert('RGB').resize((size, size), Image.LANCZOS)
    flip_h = im.transpose(Image.FLIP_LEFT_RIGHT)
    flip_v = im.transpose(Image.FLIP_TOP_BOTTOM)
    flip_hv = flip_v.transpose(Image.FLIP_LEFT_RIGHT)
    tile = Image.new('RGB', (size * 2, size * 2))
    tile.paste(im, (0, 0))
    tile.paste(flip_h, (size, 0))
    tile.paste(flip_v, (0, size))
    tile.paste(flip_hv, (size, size))
    return tile

def fit_cover(im, w, h):
    src = im.convert('RGB')
    sw, sh = src.size
    scale = max(w / sw, h / sh)
    return src.resize((max(1, round(sw * scale)), max(1, round(sh * scale))), Image.LANCZOS).crop(
        ((round(sw * scale) - w) // 2, (round(sh * scale) - h) // 2,
         (round(sw * scale) - w) // 2 + w, (round(sh * scale) - h) // 2 + h))

def report(name, im):
    g = im.convert('L')
    w, h = g.size
    mid = g.crop((w // 4, h // 4, w * 3 // 4, h * 3 // 4))
    st, stm = ImageStat.Stat(g), ImageStat.Stat(mid)
    print(f"  {name:16s} {im.size[0]}x{im.size[1]}  "
          f"lys hele {st.mean[0]:.0f}  midtparti {stm.mean[0]:.0f} "
          f"(mørkeste midtpunkt {min(mid.getdata()):.0f})")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('source')
    ap.add_argument('--out', default='src/assets')
    ap.add_argument('--tile', type=int, default=1024)
    ap.add_argument('--quality', type=int, default=82)
    a = ap.parse_args()

    src = Image.open(a.source)
    print(f"kilde: {a.source} {src.size[0]}x{src.size[1]}")

    tile = mirrored_tile(src, a.tile)
    sheet = fit_cover(src, 2560, 1600)
    card = fit_cover(src, 1200, 800)

    out = a.out
    for name, img in (('paper-tile', tile), ('paper-sheet', sheet), ('paper-card', card)):
        p = f"{out}/{name}.webp"
        img.save(p, 'WEBP', quality=a.quality, method=6)
        report(name, img)
        print(f"    -> {p}")

    print("\nLyshet: hold midtpartiet over ~70 for at mørk brun tekst skal leses.")
    return 0

if __name__ == '__main__':
    sys.exit(main())
