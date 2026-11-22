"""Puts the changes made at the console into the laptop's copy of the data.
1. On the laptop: get MOVES.TSV and BOARDS.TSV off the card (or type @MOVES in the Serial Monitor and save what it prints as MOVES.TSV).
2. Run:  python3 apply_moves.py  "SD card files"  MOVES.TSV
   It plays every line back in order, exactly like the console does, writes the new KINDS.TSV (and UNITS.TSV if two units
   traded places) and fixes the byte offsets.
3. Send the new files to the card, then type @CLEARMOVES.
(Since console v5.51 the console does this itself when its list is nearly full and the website has every change:
this script is only needed to rebuild the card's files on a laptop.)"""
import sys, os, shutil, subprocess
sd, movesfile = sys.argv[1], sys.argv[2]
units = [l.rstrip('\r\n').split('\t')[0] for l in open(os.path.join(sd, 'UNITS.TSV')) if l.strip()]
def name_code(s):
    h = 2166136261
    for b in s.encode('latin-1', 'replace'): h ^= b; h = (h * 16777619) & 0xFFFFFFFF
    return h & 0xFFFFFF
changes = []
for l in open(movesfile):
    f = l.rstrip('\r\n').split('\t')
    if len(f) < 2 or not f[0]: continue
    if f[0] in ('B', 'A', 'N'): continue                # board changes, new items, not-found marks: BOARDS.TSV, fold_added.py, history only
    if f[0] in ('S', 'X', 'U'): changes.append(f)
    elif f[0] == 'C':                                   # how many Lending has (0 = taken out of Lending)
        k = int(f[1], 16); changes = [c for c in changes if not (c[0] == 'C' and c[1] == k)]
        changes.append(['C', k, int(f[2])])
    else:
        k = int(f[0], 16); changes = [c for c in changes if not (c[0] == 'I' and c[1] == k)]
        changes.append(['I', k, f[1], int(f[2])])
def play(name, u, s, copies):
    k = name_code(name)
    for c in changes:
        t = c[0]
        if t == 'I' and c[1] == k: u, s = c[2], c[3]
        elif t == 'C' and c[1] == k: copies = str(c[2])
        elif t == 'S' and u == c[1] and int(c[2]) <= s <= int(c[3]): u, s = c[4], int(c[5])
        elif t == 'X':
            if u == c[1] and int(c[2]) <= s <= int(c[3]): u, s = c[4], int(c[5])
            elif u == c[4] and int(c[5]) <= s <= int(c[6]): u, s = c[1], int(c[2])
    return u, s, copies
backup = sd.rstrip('/') + ' (before moves)'
if os.path.exists(backup): shutil.rmtree(backup)
shutil.copytree(sd, backup)
out, n = [], 0
for l in open(os.path.join(sd, 'KINDS.TSV'), newline='', encoding='latin-1'):
    end = '\r\n' if l.endswith('\r\n') else '\n'
    f = l.rstrip('\r\n').split('\t')
    if len(f) > 5 and f[4].lstrip('-').isdigit():
        u, s, x = play(f[2], f[3], int(f[4]), f[5])
        if (u, s, x) != (f[3], int(f[4]), f[5]): f[3], f[4], f[5] = u, str(s), x; n += 1
    out.append('\t'.join(f) + end)
open(os.path.join(sd, 'KINDS.TSV'), 'w', newline='', encoding='latin-1').write(''.join(out))
# units that traded places: each keeps its code, name and things; its lights and map spot are the other one's now
upath = os.path.join(sd, 'UNITS.TSV')
ulines = [l.rstrip('\r\n').split('\t') for l in open(upath, encoding='latin-1') if l.strip()]
for c in changes:
    if c[0] != 'U': continue
    a = next((r for r in ulines if r[0] == c[1]), None); b = next((r for r in ulines if r[0] == c[2]), None)
    if a and b: a[2:], b[2:] = b[2:], a[2:]; print('units traded places:', c[1], c[2])
open(upath, 'w', encoding='latin-1', newline='').write(''.join('\t'.join(r) + '\r\n' for r in ulines))
subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fix_offsets.py'), backup, sd], check=True)
print(n, 'kinds changed. The old files are in', backup)
