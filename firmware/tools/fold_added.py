"""Puts the items added at the console (from a phone code) into the laptop's copy of the data.
1. In the Serial Monitor type @ADDED and save everything it prints, up to @END, as ADDED.txt.
2. Run:  python3 fold_added.py  "SD card files"  ADDED.txt
   Each new item goes in with the other items of its type; TYPES.TSV and CODES.TSV are fixed to match.
3. Send KINDS.TSV, TYPES.TSV and CODES.TSV to the card. The added items are then part of the normal list."""
import sys, os, shutil
sd, addedfile = sys.argv[1], sys.argv[2]
raw = open(addedfile, encoding='latin-1').read().replace('\r', '').split('\n')
added, codes, in_codes = [], [], False
for l in raw:
    if l.startswith('@END'): break
    if l.startswith('@CODES'): in_codes = True; continue
    if not l.strip() or l.startswith('@'): continue
    if in_codes: c, pos = l.split('\t')[:2]; codes.append((c, int(pos)))
    else: added.append(l.split('\t'))
# the console's offsets for the added lines (they followed each other at the end of its KINDS.TSV)
def read_lines(path): return open(path, encoding='latin-1', newline='').read().split('\n')[:-1]
kinds = read_lines(os.path.join(sd, 'KINDS.TSV'))
names = {l.split('\t')[2].lower() for l in kinds}
backup = sd.rstrip('/') + ' (before added items)'
if os.path.exists(backup): shutil.rmtree(backup)
shutil.copytree(sd, backup)
# old offsets of every laptop line
def offsets(lines):
    o, p = [], 0
    for l in lines: o.append(p); p += len(l.encode('latin-1')) + 1
    return o
old_off = offsets(kinds)
tagged = [('old', i, l) for i, l in enumerate(kinds)]
console_pos = {}
for j, f in enumerate(added):
    if f[2].lower() in names: print('already in the list, skipped:', f[2]); continue
    line = '\t'.join(f)
    last = max((k for k, t in enumerate(tagged) if t[2].split('\t')[0] == f[0] and t[2].split('\t')[1] == f[1]), default=len(tagged) - 1)
    tagged.insert(last + 1, ('new', j, line)); names.add(f[2].lower())
new_lines = [t[2] for t in tagged]
new_off = offsets(new_lines)
old_to_new = {old_off[t[1]]: new_off[k] for k, t in enumerate(tagged) if t[0] == 'old'}
new_index = {t[1]: new_off[k] for k, t in enumerate(tagged) if t[0] == 'new'}
# the console wrote the added lines one after another; work out each one's offset there to match the barcodes
cpos, p = {}, None
end_of_old = old_off[-1] + len(kinds[-1].encode('latin-1')) + 1 if kinds else 0
p = end_of_old
for j, f in enumerate(added): cpos[p] = j; p += len('\t'.join(f).encode('latin-1')) + 1
open(os.path.join(sd, 'KINDS.TSV'), 'w', encoding='latin-1', newline='').write('\n'.join(new_lines) + '\n')
# TYPES: same lines, new counts and starts
types = read_lines(os.path.join(sd, 'TYPES.TSV'))
out = []
for l in types:
    f = l.split('\t')
    idx = [k for k, t in enumerate(new_lines) if t.split('\t')[0] == f[0] and t.split('\t')[1] == f[1]]
    if idx: f[2], f[3] = str(len(idx)), str(new_off[idx[0]])
    out.append('\t'.join(f))
open(os.path.join(sd, 'TYPES.TSV'), 'w', encoding='latin-1', newline='').write('\n'.join(out) + '\n')
codes_out = []
for l in read_lines(os.path.join(sd, 'CODES.TSV')):
    f = l.split('\t'); f[1] = str(old_to_new[int(f[1])]); codes_out.append('\t'.join(f))
for c, pos in codes:
    if pos in cpos and cpos[pos] in new_index: codes_out.append(c + '\t' + str(new_index[cpos[pos]]))
    else: print('barcode not matched to an added item:', c)
open(os.path.join(sd, 'CODES.TSV'), 'w', encoding='latin-1', newline='').write('\n'.join(codes_out) + '\n')
print(len(new_index), 'items added. The old files are in', backup)
