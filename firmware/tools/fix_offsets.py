"""KINDS.TSV lines changed length, so the byte offsets in CODES.TSV and TYPES.TSV must be recomputed."""
import sys
old, new = sys.argv[1], sys.argv[2]            # folders
def offs(path):
    o, p = [], 0
    for l in open(path, 'rb').read().split(b'\n')[:-1]:
        o.append(p); p += len(l) + 1
    return o
oo, no = offs(f'{old}/KINDS.TSV'), offs(f'{new}/KINDS.TSV')
assert len(oo) == len(no)
m = dict(zip(oo, no))
for fn, col in (('CODES.TSV', 1), ('TYPES.TSV', 3)):
    out = []
    for l in open(f'{old}/{fn}', encoding='utf-8').read().split('\n'):
        if l == '': continue
        f = l.split('\t'); f[col] = str(m[int(f[col])]); out.append('\t'.join(f))
    open(f'{new}/{fn}', 'w', encoding='utf-8', newline='').write('\n'.join(out) + '\n')
print('offsets fixed', len(oo))
