"""Build offline J2000 data from d3-celestial (BSD-3-Clause).

Usage: python scripts/build-star-catalog.py work/catalog
Download stars.8.json, starnames.json, constellations.json,
constellations.lines.json and LICENSE from the revision documented in
public/data/catalog-sources.json into that directory first.
"""
import hashlib
import json
import math
import pathlib
import sys

source = pathlib.Path(sys.argv[1])
out = pathlib.Path(__file__).resolve().parents[1] / 'public/data'

def read(name):
    return json.loads((source / name).read_text())

stars = read('stars.8.json')['features']
names = read('starnames.json')
figures = read('constellations.lines.json')['features']
constellation_names = {f['id']: f['properties'] for f in read('constellations.json')['features']}
by_coordinate = {tuple(s['geometry']['coordinates']): s for s in stars}
endpoints = {tuple(p) for f in figures for line in f['geometry']['coordinates'] for p in line}
assert endpoints <= by_coordinate.keys(), 'Every line endpoint must be a catalog star'
required_ids = {by_coordinate[p]['id'] for p in endpoints}

def color(bv):
    # B-V to approximate black-body temperature and display RGB; illustrative color.
    if bv in ('', None):
        return '#ffffff'
    bv = max(-0.4, min(2.0, float(bv)))
    t = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62)) / 100
    r = 255 if t <= 66 else 329.698727446 * (t - 60) ** -0.1332047592
    g = 99.4708025861 * math.log(t) - 161.1195681661 if t <= 66 else 288.1221695283 * (t - 60) ** -0.0755148492
    b = 255 if t >= 66 else (0 if t <= 19 else 138.5177312231 * math.log(t - 10) - 305.0447927307)
    return '#' + ''.join(f'{round(max(0, min(255, v))):02x}' for v in (r, g, b))

catalog = []
for star in stars:
    p = star['properties']
    if p['mag'] > 6.5 and star['id'] not in required_ids:
        continue
    n = names.get(str(star['id']), {})
    ra, dec = star['geometry']['coordinates']
    catalog.append(dict(id=f"hip_{star['id']}", name=n.get('zh', ''),
                        englishName=n.get('name', ''), ra=round(ra % 360, 4), dec=dec,
                        mag=p['mag'], color=color(p.get('bv'))))
catalog.sort(key=lambda s: (s['mag'], s['id']))

# Serpens is supplied as two disconnected figures, but is one of the 88 constellations.
constellations = {}
for figure in figures:
    key = figure['id']
    n = constellation_names[key]
    entry = constellations.setdefault(key, dict(id=key, name=f"{n['zh']} ({n['name']})", lines=[]))
    for line in figure['geometry']['coordinates']:
        ids = [f"hip_{by_coordinate[tuple(p)]['id']}" for p in line]
        entry['lines'].extend([a, b] for a, b in zip(ids, ids[1:]) if a != b)
assert len(constellations) == 88

for filename, data in [('real_stars.json', catalog), ('constellations.json', list(constellations.values()))]:
    (out / filename).write_text('[\n' + ',\n'.join(json.dumps(row, ensure_ascii=False, separators=(',', ':')) for row in data) + '\n]\n')
(out / 'd3-celestial-LICENSE.txt').write_text((source / 'LICENSE').read_text())
metadata = dict(source='d3-celestial / XHIP (Anderson & Francis, 2012)',
    repository='https://github.com/ofrohn/d3-celestial',
    revision='7e720a3de062059d4c5400a379146a601d9010e0', epoch='J2000',
    raUnit='degrees, 0 <= RA < 360', magnitudeLimit=6.5,
    starCount=len(catalog), constellationCount=len(constellations),
    lineCount=sum(len(c['lines']) for c in constellations.values()),
    notes=['Selected catalog entries through apparent magnitude 6.5, plus any required line endpoints.',
           'Constellation figures are conventional illustrations, not IAU boundaries.',
           'Fixed J2000 positions; no proper motion or precession. B-V colors are approximate.'],
    inputs={name: hashlib.sha256((source / name).read_bytes()).hexdigest() for name in
        ['stars.8.json', 'starnames.json', 'constellations.json', 'constellations.lines.json']})
(out / 'catalog-sources.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
print(f"{len(catalog)} stars, {len(constellations)} constellations, {metadata['lineCount']} segments")
