"""Build the fixed J2000 nearby-star map from the HYG v4.1 archive.

Usage: python scripts/build-nearby-star-catalog.py /path/to/source-directory
Download hyg/CURRENT/hygdata_v41.csv and hyg/CURRENT/LICENSE from SOURCE_REVISION
into that directory. No network access is required by this reproducible builder.
"""
import csv
import hashlib
import json
import math
from pathlib import Path
import sys

SOURCE_REVISION = '3bf37f4b2d5460e1278286320d1d62fab9b493c1'
REPOSITORY = 'https://github.com/astronexus/HYG-Database'
PC_TO_LY = 3.2615637771674336
OBLIQUITY = math.radians(23.4392911)
ROOT = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
expected = {'hygdata_v41.csv': 'd9f69fd86bbf90a4e4d52b4c5c53eacfa6dfc0bfdef85bfd94f095e0bebe4ebd',
            'LICENSE': 'f404190403d31e0ce7223f4cb7af954485ad88077358330754dc5c892a856627'}
for filename, digest in expected.items():
    assert hashlib.sha256((source / filename).read_bytes()).hexdigest() == digest, f'{filename}: unexpected source version'
out = ROOT / 'public/data'
sky_path = out / 'real_stars.json'
sky = {s['id']: s for s in json.loads(sky_path.read_text())}
# Common Chinese labels for nearby stars absent from the magnitude-limited sky.
names = {'70666': '比邻星', '87665': '巴纳德星', '118720': '沃尔夫359',
         '53879': '拉兰德21185', '92115': '罗斯154', '118079': '鲁坦726-8 A',
         '118080': '鲁坦726-8 B', '118441': '天狼星B', '32263': '天狼星A',
         '71456': '南门二A', '71453': '南门二B'}


def color(value):
    if not value:
        return '#ffffff'
    bv = max(-.4, min(2., float(value)))
    t = 46 * (1 / (.92 * bv + 1.7) + 1 / (.92 * bv + .62))
    r = 255 if t <= 66 else 329.698727446 * (t - 60) ** -.1332047592
    g = 99.4708025861 * math.log(t) - 161.1195681661 if t <= 66 else 288.1221695283 * (t - 60) ** -.0755148492
    b = 255 if t >= 66 else (0 if t <= 19 else 138.5177312231 * math.log(t - 10) - 305.0447927307)
    return '#' + ''.join(f'{round(max(0, min(255, v))):02x}' for v in (r, g, b))


stars = []
with (source / 'hygdata_v41.csv').open() as file:
    for row in csv.DictReader(file):
        distance = float(row['dist']) * PC_TO_LY
        # HYG uses 100000 pc for unknown distances. The Sun is a separate marker.
        if row['id'] == '0' or not 0 < distance <= 100:
            continue
        ra, dec = float(row['rarad']), float(row['decrad'])
        x = distance * math.cos(dec) * math.cos(ra)
        y = distance * math.cos(dec) * math.sin(ra)
        z = distance * math.sin(dec)
        position = dict(x=round(x, 8), y=round(y * math.cos(OBLIQUITY) + z * math.sin(OBLIQUITY), 8),
                        z=round(-y * math.sin(OBLIQUITY) + z * math.cos(OBLIQUITY), 8))
        existing = sky.get('hip_' + row['hip'], {})
        designation = row['gl'].strip() or (f"HIP {row['hip']}" if row['hip'] else
                                          f"HD {row['hd']}" if row['hd'] else f"HYG {row['id']}")
        star = dict(id='hyg_' + row['id'], name=names.get(row['id'], existing.get('name', '')),
                    englishName=row['proper'], designation=designation, position=position,
                    distanceLy=round(distance, 8), magnitude=float(row['mag']),
                    absoluteMagnitude=float(row['absmag']), spectralType=row['spect'], color=color(row['ci']))
        if row['hip']:
            star['hipId'] = row['hip']
        assert all(math.isfinite(v) for v in [*position.values(), distance, star['magnitude'], star['absoluteMagnitude']])
        stars.append(star)
stars.sort(key=lambda s: (s['distanceLy'], s['id']))
assert len(stars) == 4059 and len({s['id'] for s in stars}) == len(stars)
catalog = dict(version=1, epoch='J2000.0', frame='heliocentric-ecliptic-J2000', positionUnit='ly', radiusLy=100, stars=stars)
header = json.dumps({k: v for k, v in catalog.items() if k != 'stars'}, separators=(',', ':'))
(out / 'nearby_stars.json').write_text(header[:-1] + ',"stars":[\n' +
    ',\n'.join(json.dumps(s, ensure_ascii=False, separators=(',', ':')) for s in stars) + '\n]}\n')
metadata = dict(source='HYG v4.1, David Nash / Astronexus', repository=REPOSITORY,
                revision=SOURCE_REVISION, sourceFile='hyg/CURRENT/hygdata_v41.csv',
                epoch='J2000.0', equinox='J2000', frame=catalog['frame'], positionUnit='ly',
                license='CC BY-SA 4.0', licenseUrl='https://creativecommons.org/licenses/by-sa/4.0/',
                derivativeLicense='CC BY-SA 4.0',
                counts={str(r): sum(s['distanceLy'] <= r for s in stars) for r in (25, 50, 100)},
                inputs={name: hashlib.sha256((source / name).read_bytes()).hexdigest()
                        for name in ('hygdata_v41.csv', 'LICENSE')},
                skyNamesSha256=hashlib.sha256(sky_path.read_bytes()).hexdigest(),
                changes=['Selected known positive distances within 100 light-years; excluded Sun.',
                         'Converted J2000 equatorial directions and catalog distances to J2000 ecliptic light-years.',
                         'Added Chinese display names from the existing XHIP/d3-celestial sky and common labels in the builder.',
                         'Converted B-V to approximate display colors; rounded spatial coordinates to 8 decimal places.'],
                limitations=['Not a volume-complete census; faint stars and brown dwarfs are incompletely represented.',
                             'Fixed J2000 positions and catalog distances, independent of simulation date; no space-motion propagation.',
                             'Multiple-star components are retained as separate source records, not inferred barycenters.',
                             'Magnitudes are catalog V-band values as seen from the Solar System, not from the movable camera.'])
(out / 'nearby-star-sources.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
(out / 'hyg-LICENSE.txt').write_bytes((source / 'LICENSE').read_bytes())
print(f"{len(stars)} nearby stars; radius counts: {metadata['counts']}")
