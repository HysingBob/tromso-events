#!/usr/bin/env python3
"""Lager prosessuelle plassholder-teksturer til tromsø.net.

Dette er midlertidig materiale fram til Pixies håndlagde papir ligger i
src/assets/. Skriptet lager:

    paper-card-a/b/c.webp   tre ulike kortutsnitt (så kortene ikke gjentar seg)
    paper-stains.webp       gjennomsiktig lag med ujevne vannfargeflekker
    paper-sheet.webp        helt ark (cover, ingen repetisjon)
    paper-tile.webp         speilet flis til lærkanten rundt

Bruk:  python3 scripts/make_placeholder_paper.py
"""
import random
from PIL import Image, ImageDraw, ImageFilter

OUT = 'src/assets'

def wash(seed, size=(1024, 1024), base=(206, 180, 138)):
    """Ujevn vannfargeflate: lavfrekvent støy + korn + myk vignette."""
    random.seed(seed)
    w, h = size
    # hjortelær: varm, gyllen brun — mindre grå, mer rustrød i skyggene
    warm_base = base if base != (206, 180, 138) else (213, 168, 112)
    img = Image.new('RGB', (w, h), warm_base)
    def octave(cells, blur, amount):
        n = Image.new('L', (cells, cells))
        n.putdata([random.randint(0, 255) for _ in range(cells * cells)])
        n = n.resize((w, h), Image.LANCZOS).filter(ImageFilter.GaussianBlur(blur))
        return Image.blend(img, Image.merge('RGB', (n, n, n)), amount)
    for cells, blur, amount in ((7, 55, .50), (19, 24, .28), (53, 7, .15)):
        img = octave(cells, blur, amount)
    grain = Image.new('L', (w // 2, h // 2))
    grain.putdata([random.randint(90, 165) for _ in range((w // 2) * (h // 2))])
    grain = grain.resize((w, h), Image.LANCZOS)
    img = Image.blend(img, Image.merge('RGB', (grain, grain, grain)), .025)
    vig = Image.new('L', (w, h), 0)
    ImageDraw.Draw(vig).ellipse((-w // 7, -h // 7, w + w // 7, h + h // 7), fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(160))
    return Image.composite(img, Image.new('RGB', (w, h), (172, 116, 66)), vig)

def stains(seed, size=(2048, 1280)):
    """Gjennomsiktig lag: bare flekker og skjolder, ingen papirflate."""
    random.seed(seed)
    w, h = size
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(14):
        cx, cy = random.randint(0, w), random.randint(0, h)
        rx = random.randint(60, 340)
        ry = int(rx * random.uniform(.45, 1.15))
        warm = random.choice([(122, 84, 44), (96, 66, 34), (150, 116, 70), (72, 52, 30)])
        a = random.randint(8, 26)
        blob = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(blob).ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=warm + (a,))
        blob = blob.filter(ImageFilter.GaussianBlur(random.uniform(18, 70)))
        layer = Image.alpha_composite(layer, blob)
    return layer

def mirrored(img):
    fh = img.transpose(Image.FLIP_LEFT_RIGHT)
    fv = img.transpose(Image.FLIP_TOP_BOTTOM)
    fhv = fv.transpose(Image.FLIP_LEFT_RIGHT)
    t = Image.new('RGB', (img.width * 2, img.height * 2))
    t.paste(img, (0, 0)); t.paste(fh, (img.width, 0))
    t.paste(fv, (0, img.height)); t.paste(fhv, (img.width, img.height))
    return t

def save(img, name, quality=82):
    p = f'{OUT}/{name}.webp'
    img.save(p, 'WEBP', quality=quality, method=6)
    print(f'  {name:16s} {img.size[0]}x{img.size[1]} -> {p}')

def main():
    print('plassholder-papir:')
    for seed, name in ((7, 'paper-card-a'), (23, 'paper-card-b'), (41, 'paper-card-c')):
        save(wash(seed, (1200, 800)), name)
    save(wash(11, (1600, 1000)), 'paper-sheet')
    save(stains(5), 'paper-stains')
    save(mirrored(wash(3, (1024, 1024)).resize((1024, 1024))), 'paper-tile')
    print('\nErstatt med Pixies filer ved å legge dem i src/assets/ med samme navn.')

if __name__ == '__main__':
    main()
