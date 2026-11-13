#!/usr/bin/env python3
"""Refresh public item locations and room geometry from the Room Locator SD snapshot."""
import argparse, csv, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def rows(path):
    with path.open(newline='', encoding='utf-8-sig') as file:
        return list(csv.reader(file, delimiter='\t'))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('sd_folder', type=Path, help='Folder containing KINDS.TSV, UNITS.TSV, BOARDS.TSV and TYPES.TSV')
    args = parser.parse_args()
    folder = args.sd_folder
    data = json.loads((ROOT / 'data.json').read_text())
    by_name = {item['n']: item for item in data['kinds']}
    found = set()
    for row in rows(folder / 'KINDS.TSV'):
        if len(row) < 6: continue
        name, unit, shelf = row[2], row[3], int(row[4])
        item = by_name.get(name)
        if item is None:
            matches = [candidate for key, candidate in by_name.items() if key.startswith(name) and len(key) - len(name) < 20]
            item = matches[0] if len(matches) == 1 else None
        if item is None:
            raise SystemExit(f'New item in KINDS.TSV needs a guide entry first: {name}')
        item['u'], item['s'], item['x'] = unit, shelf, int(row[5])
        found.add(item['n'])
    missing = by_name.keys() - found
    if missing: raise SystemExit('Items missing from KINDS.TSV: ' + ', '.join(sorted(missing)))
    board_map = {row[0]: [int(x) for x in row[1].split(',') if x.strip()] for row in rows(folder / 'BOARDS.TSV') if len(row)>1}
    units = []
    for row in rows(folder / 'UNITS.TSV'):
        if len(row) < 4: continue
        unit = {'code':row[0], 'name':row[1], 'first':int(row[2]), 'shelves':int(row[3]), 'boards':board_map.get(row[0], [])}
        if len(row) >= 8: unit['rect'] = [int(x) for x in row[4:8]]
        units.append(unit)
    names = {unit['code']:unit['name'] for unit in units}
    for item in data['kinds']:
        item['w'] = f"{names.get(item['u'], item['u'])}, shelf {item['s']}" if item['s'] else names.get(item['u'], item['u'])
    (ROOT / 'data.json').write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
    # the console's types, in TYPES.TSV order: a phone "add item" code names its type by this position
    types = [[int(row[0]), row[1]] for row in rows(folder / 'TYPES.TSV') if len(row) >= 2]
    (ROOT / 'room.json').write_text(json.dumps({'source':'Room Locator SD snapshot (run sync_room.py after changing the card)','units':units,'types':types}, indent=2)+'\n')
    print(f"Updated {len(found)} item locations and {len(units)} room units")

if __name__ == '__main__': main()
