#!/usr/bin/env python3
"""Éin gong: legg om arrangementsdata til nye filterdimensjonar.

Gjer tre ting på filene i ../events/:
  1. kategori mappast inn i Bob sine sju: Konsert, Scene, Film, Utstilling,
     Prat, Idrett, Aktivitet.
  2. nytt felt «malgruppe»: liste av Familie / Ungdom / 18+.
  3. «gratis» vert alltid ein boolsk verdi (manglande = ikkje gratis).

Malgruppe-regel (dokumentert i tromso_net_design.md):
  - 18+     = 18-årsgrense eller tydeleg vaksenarrangement.
  - Ungdom  = også aktuelt for ungdom (kan stå saman med 18+ når 18-åringar er velkomne).
  - Familie = passar for barn og vaksne saman.
"""
import json, pathlib, re

EVENTS = pathlib.Path(__file__).resolve().parent.parent / 'events'

# json.dumps bryt alle lister over fleire linjer. Trekk korte lister av reine
# strengar saman att, så filene ikkje endrar seg meir enn nødvendig.
ARRAY = re.compile(r'\[\s+((?:"[^"]*"(?:,\s*)?)+?)\s*\]')


def tighten(text):
    def collapse(match):
        items = re.findall(r'"[^"]*"', match.group(1))
        inline = '[' + ', '.join(items) + ']'
        return inline if len(inline) <= 92 else match.group(0)
    return ARRAY.sub(collapse, text)

KATEGORI_MAP = {
    'Foredrag': 'Prat',
    'Humor': 'Scene',
    'Annet': 'Aktivitet',
    'Familie': 'Scene',
    'Friluft': 'Aktivitet',
    'Mat og drikke': 'Aktivitet',
}

# Kategori som ikkje kjem fram av den gamle mappinga (skjerming av film).
KATEGORI_PÅSLAG = {
    '2026-11-12-brokeback-live-dub': ['Film', 'Scene'],
    # «Familie» var ein kategori i det gamle settet. Museumsnatta er i røynda ei
    # utstilling — familie er målgruppe, ikkje kategori.
    '2026-11-28-natt-pa-museet': ['Utstilling'],
}

MALGRUPPE = {
    '2026-11-06-morten-abel-full-of-dreams': ['Ungdom', '18+'],
    '2026-11-06-ordkalotten-poetikk': ['18+'],
    '2026-11-07-hivju-the-garbage-king': ['Ungdom', '18+'],
    '2026-11-12-brokeback-live-dub': ['Ungdom', '18+'],
    '2026-11-12-janove-strykekvartett': ['Ungdom', '18+'],
    '2026-11-14-lille-caesar': ['Ungdom', '18+'],
    '2026-11-19-det-er-ales-premiere': ['Ungdom', '18+'],
    '2026-11-19-symfonisk-soloppgang': ['Ungdom', '18+'],
    '2026-11-20-rorbuashow-siste-reis': ['18+'],
    '2026-11-22-christmas-nordic-tenors': ['18+'],
    '2026-11-28-det-er-ales-siste-forestilling': ['Ungdom', '18+'],
    '2026-11-28-tones-ingvar-julekonsert': ['18+'],
    '2026-11-30-diaspora-tamil-archives': ['Familie', 'Ungdom'],
    '2026-12-04-forjulsballetten': ['Familie', 'Ungdom'],
    '2026-12-05-moby-dick-premiere': ['Ungdom'],
    '2026-12-11-inge-bremnes-mot-lys': ['18+'],
    '2026-12-12-jan-gunnar-hoff-stille-lys': ['Familie', 'Ungdom'],
    '2026-12-18-anders-jektvik': ['Ungdom', '18+'],
    '2026-12-20-adam-douglas-an-american-holiday': ['18+'],
    '2027-01-16-moby-dick-relaext': ['Familie', 'Ungdom'],
    # Lagt til av dei andre agentane (november 2026), same regelverk:
    '2026-11-07-puffs': ['Ungdom', '18+'],
    '2026-11-09-tibetanske-riter': ['Ungdom', '18+'],
    '2026-11-10-fuglearet-2026-birdlife-tromso': ['Ungdom', '18+'],
    '2026-11-10-kiuryaq': ['Ungdom', '18+'],
    '2026-11-10-pust-piano-body-prayer': ['18+'],
    '2026-11-12-sjakkmatt-hostdans': ['Ungdom', '18+'],
    '2026-11-18-big-bang-fiesta': ['Familie', 'Ungdom'],
    '2026-11-18-familiekonstellasjon': ['18+'],
    '2026-11-18-the-hunger-games-sunrise-on-the-reaping-premiere': ['Ungdom'],
    '2026-11-19-the-hunger-games-sunrise-on-the-reaping': ['Ungdom'],
    '2026-11-20-aktiv-dodshjelp': ['Ungdom', '18+'],
    '2026-11-20-the-hunger-games-sunrise-on-the-reaping': ['Ungdom'],
    '2026-11-21-julemesse-kvaloysletta-husflidslag': ['Familie', 'Ungdom'],
    '2026-11-26-makosir': ['Ungdom', '18+'],
    '2026-11-27-soria-records-showcase': ['18+'],
    '2026-11-28-glimt-2026-det-lille-kulturhus': ['Familie', 'Ungdom'],
    '2026-11-28-karlsoy-prestegaard-verlos-vintage': ['Ungdom', '18+'],
    '2026-11-28-natt-pa-museet': ['Familie', 'Ungdom'],
    '2026-12-04-julerocken-2026': ['Ungdom', '18+'],
    '2026-12-05-flamenco-aften': ['Ungdom', '18+'],
    '2026-12-11-bigbang-bukta-live': ['Ungdom', '18+'],
    '2026-12-12-tofl': ['Ungdom', '18+'],
}


def migrate(data):
    ident = data['id']
    if ident in KATEGORI_PÅSLAG:
        kategori = KATEGORI_PÅSLAG[ident]
    else:
        kategori = []
        for k in data.get('kategori') or []:
            ny = KATEGORI_MAP.get(k, k)
            if ny not in kategori:
                kategori.append(ny)
    data['kategori'] = kategori
    if ident not in MALGRUPPE:
        raise SystemExit(f'manglar malgruppe for {ident}')
    data['malgruppe'] = MALGRUPPE[ident]
    data['gratis'] = bool(data.get('gratis'))
    # «malgruppe» skal ligge rett etter aldersgrense i fila, ikkje heilt sist.
    if 'malgruppe' in data:
        order = [k for k in data if k != 'malgruppe']
        anchor = order.index('aldersgrense') if 'aldersgrense' in order else order.index('kategori')
        rebuilt = {}
        for key in order:
            rebuilt[key] = data[key]
            if key == order[anchor]:
                rebuilt['malgruppe'] = data['malgruppe']
        data = rebuilt
    return data


def main():
    changed = 0
    for path in sorted(EVENTS.glob('*.json')):
        original = path.read_text(encoding='utf-8')
        data = json.loads(original)
        updated = migrate(data)
        text = tighten(json.dumps(updated, ensure_ascii=False, indent=2) + '\n')
        if text != original:
            path.write_text(text, encoding='utf-8')
            changed += 1
    print(f'{changed} arrangementsfiler oppdatert av {len(list(EVENTS.glob("*.json")))}')


if __name__ == '__main__':
    main()
