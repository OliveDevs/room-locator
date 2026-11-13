// Staff tools: make the RL: codes the Room Locator console reads (v5.4 and later), and prepare a new item's guide entry.
// Code formats (the console checks every part and asks for the staff PIN before it changes anything):
//   RL:MOVE:<6-letter item code>:<UNIT>-<shelf>
//   RL:SHELF:<UNIT>-<shelf>:<UNIT>-<shelf>        add :SWAP on the end to swap the two shelves
//   RL:ADD:<type number>|<UNIT>-<shelf>|<copies>|<name>     type number = its line in the console's TYPES.TSV, 0 first
// Every code must stay under 60 characters: the scanner hands the console 64 at a time.
const CAT_ORDER = ['Photo & Video', 'Audio', 'Lighting', 'Computing', 'Virtual Reality', 'Soft Tech', 'Shop & Tools', 'Cables & More'];
const MAX_CODE = 60;
const $ = id => document.getElementById(id);
const status = $('staff-status');
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const lines = value => value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
function nameCode(name) {                        // FNV-1a over the name's bytes, last 24 bits: the same code the console and item pages use
  let h = 2166136261;
  for (const b of new TextEncoder().encode(name)) { h ^= b; h = Math.imul(h, 16777619) >>> 0; }
  return (h & 0xffffff).toString(16).padStart(6, '0');
}

Promise.all([fetch('data.json?v=20261113f').then(r => r.json()), fetch('room.json?v=20261113f').then(r => r.json())]).then(([data, room]) => {
  const kinds = data.kinds, units = room.units, types = room.types || [];
  const unitBy = Object.fromEntries(units.map(u => [u.code, u]));
  const lit = units.filter(u => u.shelves > 0);
  const hasBoard = (u, n) => n === 1 || !u.boards || !u.boards.length || u.boards.includes(n);
  const boardBelow = (u, n) => { while (n > 1 && !hasBoard(u, n)) n--; return n; };
  const onShelf = (code, n) => { const u = unitBy[code]; return kinds.filter(k => k.u === code && u && u.shelves && boardBelow(u, k.s) === n); };
  const placeName = (code, n) => { const u = unitBy[code]; if (!u) return code; return u.shelves ? u.name + ', shelf ' + n : u.name + ' (ask at the desk)'; };

  // ---- tabs
  const tabs = ['move', 'shelf', 'add'];
  tabs.forEach(t => $('tab-' + t).addEventListener('click', () => {
    tabs.forEach(o => { $('tab-' + o).setAttribute('aria-selected', o === t); $('tool-' + o).hidden = o !== t; });
    $('code-out').hidden = true; status.textContent = '';
  }));

  // ---- shared pickers
  function unitOptions(select, list, blank) {
    select.innerHTML = (blank ? '<option value="">' + blank + '</option>' : '') + list.map(u => '<option value="' + esc(u.code) + '">' + esc(u.name) + (u.shelves ? '' : ' (no lights)') + '</option>').join('');
  }
  function shelfOptions(select, code, keep) {
    const u = unitBy[code];
    if (!u) { select.innerHTML = ''; return; }
    if (!u.shelves) { select.innerHTML = '<option value="0">No shelves: ask at the desk</option>'; return; }
    let html = '';
    for (let n = u.shelves; n >= 1; n--) {
      if (!hasBoard(u, n)) { html += '<option value="' + n + '">Groove ' + n + ' (no board: goes on shelf ' + boardBelow(u, n) + ')</option>'; continue; }
      const c = onShelf(code, n).length;
      html += '<option value="' + n + '">Shelf ' + n + (n === 1 ? ', bottom' : n === u.shelves ? ', top' : '') + (c ? ' · ' + c + (c === 1 ? ' thing' : ' things') : ' · empty') + '</option>';
    }
    select.innerHTML = html;
    if (keep && [...select.options].some(o => o.value === String(keep))) select.value = String(keep);
  }

  // ---- the QR code
  function showCode(code, title, what, extra) {
    if (code.length >= MAX_CODE) { status.textContent = 'That code is too long for the scanner (' + code.length + ' characters). Use a shorter name.'; $('code-out').hidden = true; return; }
    const qr = qrcode(0, 'M'); qr.addData(code); qr.make();
    $('qr').innerHTML = qr.createSvgTag({ cellSize: 8, margin: 4, scalable: true });
    $('code-title').textContent = title; $('code-what').textContent = what; $('code-text').textContent = code; $('code-extra').textContent = extra || '';
    status.textContent = ''; $('code-out').hidden = false;
    $('code-out').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---- move a thing
  const mf = $('move-form');
  $('item-list').innerHTML = kinds.map(k => '<option value="' + esc(k.n) + '"></option>').join('');
  unitOptions(mf.elements.unit, units, 'Choose a unit');
  const pickedItem = () => kinds.find(k => k.n.toLowerCase() === mf.elements.thing.value.trim().toLowerCase());
  mf.elements.thing.addEventListener('input', () => {
    const k = pickedItem();
    $('move-now').textContent = k ? 'Now: ' + placeName(k.u, k.s) + (k.x > 1 ? '. All ' + k.x + ' copies move together.' : '.') : '';
    if (k) { mf.elements.unit.value = k.u; shelfOptions(mf.elements.shelf, k.u, k.s); }
  });
  mf.elements.unit.addEventListener('change', () => shelfOptions(mf.elements.shelf, mf.elements.unit.value));
  mf.addEventListener('submit', e => {
    e.preventDefault();
    const k = pickedItem(); if (!k) { status.textContent = 'Pick the item from the list.'; return; }
    const u = mf.elements.unit.value, s = Number(mf.elements.shelf.value || 0);
    if (!unitBy[u]) { status.textContent = 'Choose where it goes.'; return; }
    showCode('RL:MOVE:' + k.h + ':' + u + '-' + s, 'Move ' + k.n, 'From ' + placeName(k.u, k.s) + ' to ' + placeName(u, unitBy[u].shelves ? boardBelow(unitBy[u], s) : 0) + '.');
  });

  // ---- move a whole shelf
  const sf = $('shelf-form');
  unitOptions(sf.elements.fromUnit, lit, 'Choose a unit'); unitOptions(sf.elements.toUnit, lit, 'Choose a unit');
  const shelfNow = () => {
    const c = sf.elements.fromUnit.value, n = Number(sf.elements.fromShelf.value);
    const things = c && n ? onShelf(c, n) : [];
    $('shelf-now').textContent = c && n ? (things.length ? things.length + ' things: ' + things.slice(0, 6).map(k => k.n).join(', ') + (things.length > 6 ? ', and more' : '') : 'This shelf is empty.') : '';
  };
  sf.elements.fromUnit.addEventListener('change', () => { shelfOptions(sf.elements.fromShelf, sf.elements.fromUnit.value); shelfNow(); });
  sf.elements.fromShelf.addEventListener('change', shelfNow);
  sf.elements.toUnit.addEventListener('change', () => shelfOptions(sf.elements.toShelf, sf.elements.toUnit.value));
  sf.addEventListener('submit', e => {
    e.preventDefault();
    const a = sf.elements.fromUnit.value, an = Number(sf.elements.fromShelf.value), b = sf.elements.toUnit.value, bn = Number(sf.elements.toShelf.value);
    if (!a || !an || !b || !bn) { status.textContent = 'Choose both shelves.'; return; }
    const bnb = boardBelow(unitBy[b], bn);
    if (a === b && boardBelow(unitBy[a], an) === bnb) { status.textContent = 'Those are the same shelf.'; return; }
    if (!onShelf(a, boardBelow(unitBy[a], an)).length) { status.textContent = 'The shelf you are moving from is empty on this copy of the room. If the console shows things there, move them on the console.'; return; }
    const swap = sf.elements.how.value === 'swap';
    showCode('RL:SHELF:' + a + '-' + an + ':' + b + '-' + bn + (swap ? ':SWAP' : ''), swap ? 'Swap two shelves' : 'Move a whole shelf',
      (swap ? 'Swap ' : 'Move everything on ') + placeName(a, boardBelow(unitBy[a], an)) + (swap ? ' with ' : ' to ') + placeName(b, bnb) + '.');
  });

  // ---- add a new item
  const af = $('add-form');
  af.elements.category.innerHTML = '<option value="">Choose category</option>' + CAT_ORDER.map((c, i) => '<option value="' + i + '">' + esc(c) + '</option>').join('');
  af.elements.category.addEventListener('change', () => {
    const c = Number(af.elements.category.value);
    af.elements.type.innerHTML = '<option value="">Choose type</option>' + types.map((t, i) => [t, i]).filter(([t]) => t[0] === c && t[1]).map(([t, i]) => '<option value="' + i + '">' + esc(t[1]) + '</option>').join('');
    nameRoom();
  });
  unitOptions(af.elements.unit, units, 'Choose a unit');
  af.elements.unit.addEventListener('change', () => { shelfOptions(af.elements.shelf, af.elements.unit.value); nameRoom(); });
  const addCode = () => {
    const f = af.elements, name = f.name.value.trim();
    return 'RL:ADD:' + f.type.value + '|' + f.unit.value + '-' + (f.shelf.value || 0) + '|' + (Number(f.copies.value) || 1) + '|' + name;
  };
  function nameRoom() {                                   // how many letters are left for the name
    const f = af.elements, used = addCode().length - f.name.value.trim().length, left = MAX_CODE - 1 - used;
    $('name-room').textContent = 'Up to ' + Math.min(left, 39) + ' characters, so the code fits the scanner.';
    f.name.maxLength = Math.min(left, 39);
  }
  ['input', 'change'].forEach(ev => af.addEventListener(ev, nameRoom)); nameRoom();
  function checkAdd() {
    const f = af.elements, name = f.name.value.trim();
    if (!name) return 'Enter the item name.';
    if (/[|\r\n]/.test(name) || /[^\x20-\x7e]/.test(name)) return 'Use plain letters, numbers and punctuation in the name (no | and no accents), so the scanner reads it exactly.';
    if (kinds.some(k => k.n.toLowerCase() === name.toLowerCase())) return 'That item is already in the list. Move it instead.';
    if (kinds.some(k => k.h === nameCode(name))) return 'That name clashes with another item’s code. Add a word to the name.';
    if (f.type.value === '') return 'Choose a category and type.';
    if (!unitBy[f.unit.value]) return 'Choose where it goes.';
    const n = Number(f.copies.value); if (!Number.isInteger(n) || n < 1 || n > 99) return 'Copies must be 1 to 99.';
    if (addCode().length >= MAX_CODE) return 'The name is too long for the code. Shorten it.';
    return '';
  }
  af.addEventListener('submit', e => {
    e.preventDefault();
    const problem = checkAdd(); if (problem) { status.textContent = problem; return; }
    const f = af.elements, name = f.name.value.trim(), t = types[Number(f.type.value)], s = Number(f.shelf.value || 0);
    showCode(addCode(), 'Add ' + name, CAT_ORDER[t[0]] + ' / ' + t[1] + ', ' + f.copies.value + (f.copies.value === '1' ? ' copy' : ' copies') + ', goes to ' + placeName(f.unit.value, s && unitBy[f.unit.value].shelves ? boardBelow(unitBy[f.unit.value], s) : 0) + '.',
      'On the console: scan this, type the PIN, check the details, scan the new item’s barcode sticker (or skip), check the spot, then Select. Its page code will be ' + nameCode(name) + '.');
  });
  $('download-data').addEventListener('click', () => {
    const problem = checkAdd(); if (problem) { status.textContent = problem; return; }
    const f = af.elements, name = f.name.value.trim(), t = types[Number(f.type.value)], u = unitBy[f.unit.value], s = Number(f.shelf.value || 0);
    const item = { n: name, c: CAT_ORDER[t[0]], t: t[1], x: Number(f.copies.value), w: placeName(u.code, s && u.shelves ? boardBelow(u, s) : 0), in: true, d: f.description.value.trim(), h: nameCode(name), u: u.code, s };
    const need = lines(f.need.value), start = lines(f.start.value), tips = lines(f.tips.value);
    if (need.length) item.need = need; if (start.length) item.start = start; if (tips.length) item.tips = tips;
    if (f.manual.value.trim()) item.r = [['Official maker instructions', f.manual.value.trim()]];
    if (f.photo.value.trim()) item.p = { url: f.photo.value.trim(), page: f.crediturl.value.trim() || '#', artist: f.credit.value.trim() || 'IDeATe Lending', license: 'Photo source' };
    const out = { ...data, kinds: [...kinds, item].sort((a, b) => a.n.localeCompare(b.n)) };
    const blob = new Blob([JSON.stringify(out, null, 2) + '\n'], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'data.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Downloaded data.json with ' + name + ' (page code ' + item.h + '). Upload it to the site repository after a check.';
  });
}).catch(err => { console.error(err); status.textContent = 'Could not load the inventory. Open this page from the published site or a local web server.'; });
