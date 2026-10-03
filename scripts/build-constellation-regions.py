"""Add IAU constellation regions and label anchors to the existing offline catalog.

Run after build-star-catalog.py:
  python scripts/build-constellation-regions.py work/catalog
Inputs: constellations.bounds.json and constellations.json from the pinned
revision in catalog-sources.json. Original data and license: d3-celestial.
"""
import hashlib
import json
import math
import pathlib
import sys

source = pathlib.Path(sys.argv[1])
out = pathlib.Path(__file__).resolve().parents[1] / 'public/data'

def precess(ra, dec, start, end):
    # IAU 1976 mean-equator precession (Meeus). Used only at build time.
    T, t = (start - 2000) / 100, (end - start) / 100
    zeta = ((2306.2181 + 1.39656*T - .000139*T*T)*t + (.30188-.000344*T)*t*t + .017998*t**3) / 3600
    z = ((2306.2181 + 1.39656*T - .000139*T*T)*t + (1.09468+.000066*T)*t*t + .018203*t**3) / 3600
    theta = ((2004.3109 - .85330*T - .000217*T*T)*t - (.42665+.000217*T)*t*t - .041833*t**3) / 3600
    a, d, th = map(math.radians, (ra+zeta, dec, theta))
    A = math.cos(d)*math.sin(a)
    B = math.cos(th)*math.cos(d)*math.cos(a)-math.sin(th)*math.sin(d)
    C = math.sin(th)*math.cos(d)*math.cos(a)+math.cos(th)*math.sin(d)
    return ((math.degrees(math.atan2(A, B))+z) % 360, math.degrees(math.asin(max(-1, min(1, C)))))

def sample_ring(ring):
    points = []
    for start, end in zip(ring, ring[1:]):
        # Boundaries follow B1875 parallels/meridians, not great-circle shortcuts.
        a, b = precess(*start, 2000, 1875), precess(*end, 2000, 1875)
        dra = (b[0]-a[0]+180) % 360 - 180
        steps = max(1, math.ceil(max(abs(dra), abs(b[1]-a[1]))))
        points.append([round(start[0] % 360, 5), round(start[1], 5)])
        for i in range(1, steps):
            ra, dec = precess(a[0]+dra*i/steps, a[1]+(b[1]-a[1])*i/steps, 1875, 2000)
            points.append([round(ra, 5), round(dec, 5)])
    points.append(points[0])
    return points

catalog = json.loads((out/'constellations.json').read_text())
by_id = {c['id']: c for c in catalog}
for c in catalog:
    c['labelPositions'], c['boundaries'] = [], []
for f in json.loads((source/'constellations.json').read_text())['features']:
    by_id[f['id']]['labelPositions'].append(f['geometry']['coordinates'])
for f in json.loads((source/'constellations.bounds.json').read_text())['features']:
    assert f['geometry']['type'] == 'Polygon'
    by_id[f['id']]['boundaries'].extend(sample_ring(ring) for ring in f['geometry']['coordinates'])
assert len(catalog) == 88 and all(c['boundaries'] and c['labelPositions'] for c in catalog)
(out/'constellations.json').write_text('[\n'+',\n'.join(json.dumps(c,ensure_ascii=False,separators=(',',':')) for c in catalog)+'\n]\n')
metadata = json.loads((out/'catalog-sources.json').read_text())
metadata['regions'] = dict(source='d3-celestial / IAU constellation boundaries', epoch='J2000',
    constellationCount=88, regionCount=sum(len(c['boundaries']) for c in catalog),
    notes='B1875 boundary parallels/meridians sampled at <= 1 degree and precessed to J2000; source coordinates rounded, intended for visualization.',
    inputs={name:hashlib.sha256((source/name).read_bytes()).hexdigest() for name in ['constellations.json','constellations.bounds.json']})
(out/'catalog-sources.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
print('Added regions and label anchors:', metadata['regions']['regionCount'], 'regions')
