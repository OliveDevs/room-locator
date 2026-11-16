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

Promise.all([fetch('data.json?v=20261116a').then(r => r.json()), fetch('room.json?v=20261116a').then(r => r.json())]).then(([data, room]) => {
  const kinds = data.kinds, units = room.units, types = room.types || [];
  const unitBy = Object.fromEntries(units.map(u => [u.code, u]));
  const lit = units.filter(u => u.shelves > 0);
  const hasBoard = (u, n) => n === 1 || !u.boards || !u.boards.length || u.boards.includes(n);
  const boardBelow = (u, n) => { while (n > 1 && !hasBoard(u, n)) n--; return n; };
  const onShelf = (code, n) => { const u = unitBy[code]; return kinds.filter(k => k.u === code && u && u.shelves && boardBelow(u, k.s) === n); };
  const placeName = (code, n) => { const u = unitBy[code]; if (!u) return code; return u.shelves ? u.name + ', shelf ' + n : u.name + ' (ask at the desk)'; };

  // ---- tabs
  const tabs = ['move', 'shelf', 'add', 'sync'];
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
    status.textContent = 'Downloaded data.json with ' + name + '. Now hand the file over using the steps below.';
    $('add-handoff').hidden = false;
    $('add-handoff').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    lastNote = 'Please add this to the Room Locator website.\n\nItem: ' + name + '\nCategory: ' + CAT_ORDER[t[0]] + ' / ' + t[1] +
      '\nGoes to: ' + item.w + '\nCopies: ' + item.x + '\nIts page code: ' + item.h +
      '\n\nThe data.json file is attached. Put it in github.com/OliveDevs/room-locator (replace the one that is there) and commit.';
  });
  let lastNote = '';
  $('copy-handoff').addEventListener('click', () => {
    const note = $('handoff-note');
    if (!lastNote) { note.textContent = 'Download the file first.'; return; }
    navigator.clipboard.writeText(lastNote)
      .then(() => { note.textContent = 'Copied. Paste it into an email or a message, and attach the data.json you downloaded.'; })
      .catch(() => { note.textContent = lastNote; });
  });

  // ---- from the console: its change list (MOVES.TSV) as QR pages "RLSYNC|page|pages|total" + lines with | for tabs
  // The console plays the lines back in order; this does the same to the website's copy, then offers the two files to upload.
  const pages = {}; let pageCount = 0, stream = null, scanning = false;
  const video = $('sync-video'), canvas = $('sync-canvas');
  function showPages() {
    if (!pageCount) { $('sync-pages').textContent = ''; return; }
    const got = Object.keys(pages).length;
    $('sync-pages').textContent = 'Pages scanned: ' + [...Array(pageCount).keys()].map(i => (pages[i + 1] ? '✓ ' : '– ') + (i + 1)).join('   ') + (got === pageCount ? '' : '   (show the console the next page: Down)');
  }
  function stopCamera() { scanning = false; if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; video.hidden = true; $('sync-stop').hidden = true; $('sync-start').hidden = false; }
  function readPage(text) {
    const lines = text.replace(/\r/g, '').split('\n');
    const head = lines[0].split('|');
    if (head[0] !== 'RLSYNC') return false;
    const p = Number(head[1]), n = Number(head[2]);
    if (pageCount && n !== pageCount) { Object.keys(pages).forEach(k => delete pages[k]); }
    pageCount = n; pages[p] = { total: Number(head[3]), lines: lines.slice(1).filter(Boolean) };
    showPages();
    if (Object.keys(pages).length === pageCount) { stopCamera(); const all = []; for (let i = 1; i <= pageCount; i++) all.push(...pages[i].lines); apply(all.map(l => l.split('|'))); }
    return true;
  }
  function tick() {
    if (!scanning) return;
    if (video.readyState >= 2) {
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(video, 0, 0);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR && jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (code && code.data) readPage(code.data);
    }
    requestAnimationFrame(tick);
  }
  $('sync-start').addEventListener('click', async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream; video.hidden = false; await video.play();
      scanning = true; $('sync-start').hidden = true; $('sync-stop').hidden = false; status.textContent = ''; tick();
    } catch (e) { status.textContent = 'The camera did not start. Allow camera access, or use "Paste instead".'; }
  });
  $('sync-stop').addEventListener('click', stopCamera);
  $('sync-use-paste').addEventListener('click', () => {
    const text = $('sync-paste').value.replace(/\r/g, '');
    if (text.startsWith('RLSYNC')) { text.split(/\n(?=RLSYNC)/).forEach(readPage); return; }
    apply(text.split('\n').filter(l => l.trim() && !l.startsWith('@')).map(l => l.split(/\t|\|/)));
  });

  let outData = null, outRoom = null;
  function apply(lines) {
    const d = JSON.parse(JSON.stringify(data)), r = JSON.parse(JSON.stringify(room));
    const ub = Object.fromEntries(r.units.map(u => [u.code, u]));
    const synced = r.synced || { lines: 0, first: '' };
    const firstText = lines.length ? lines[0].join('|') : '';
    let start = synced.lines && synced.first === firstText && synced.lines <= lines.length ? synced.lines : 0;
    const count = { I: 0, S: 0, X: 0, U: 0, B: 0, A: 0 }, notes = [];
    const byH = Object.fromEntries(d.kinds.map(k => [k.h, k]));
    const inRange = (s, lo, hi) => s >= Number(lo) && s <= Number(hi);
    for (const f of lines.slice(start)) {
      const t = f[0].length === 1 ? f[0].toUpperCase() : 'I';
      if (t === 'I') { const k = byH[f[0].toLowerCase()]; if (k) { k.u = f[1]; k.s = Number(f[2]); count.I++; } else notes.push('Not on the website yet: item ' + f[0]); }
      else if (t === 'S') { d.kinds.forEach(k => { if (k.u === f[1] && inRange(k.s, f[2], f[3])) { k.u = f[4]; k.s = Number(f[5]); } }); count.S++; }
      else if (t === 'X') { d.kinds.forEach(k => { if (k.u === f[1] && inRange(k.s, f[2], f[3])) { k.u = f[4]; k.s = Number(f[5]); } else if (k.u === f[4] && inRange(k.s, f[5], f[6])) { k.u = f[1]; k.s = Number(f[2]); } }); count.X++; }
      else if (t === 'U') { const a = ub[f[1]], b = ub[f[2]]; if (a && b) { for (const key of ['first', 'shelves', 'rect']) [a[key], b[key]] = [b[key], a[key]]; count.U++; } }
      else if (t === 'B') { const u = ub[f[1]], n = Number(f[2]); if (u) { const set = new Set(u.boards && u.boards.length ? u.boards : [...Array(u.shelves).keys()].map(i => i + 1)); if (f[3] === '1') set.add(n); else if (n > 1) set.delete(n); u.boards = [...set].sort((x, y) => x - y); count.B++; } }
      else if (t === 'A') {
        const name = f[3], h = nameCode(name);
        if (!byH[h]) { const k = { n: name, c: CAT_ORDER[Number(f[1])] || 'Cables & More', t: f[2], x: Number(f[6]) || 1, in: true, d: '', h, u: f[4], s: Number(f[5]) }; d.kinds.push(k); byH[h] = k; count.A++; }
      }
    }
    const names = Object.fromEntries(r.units.map(u => [u.code, u.name]));
    for (const k of d.kinds) { const u = ub[k.u]; k.w = u && u.shelves && k.s ? names[k.u] + ', shelf ' + boardBelowIn(u, k.s) : (names[k.u] || k.u); }
    d.kinds.sort((a, b) => a.n.localeCompare(b.n));
    r.synced = { lines: lines.length, first: firstText };
    r.source = 'Room Locator console, changes brought over on ' + new Date().toISOString().slice(0, 10);
    outData = d; outRoom = r;
    const done = lines.length - start;
    const list = [];
    if (start) list.push(start + ' changes were already on the website; ' + done + ' new.');
    if (!done) list.push('Nothing new since the last time.');
    if (count.I) list.push(count.I + (count.I === 1 ? ' thing moved' : ' things moved'));
    if (count.S) list.push(count.S + (count.S === 1 ? ' whole shelf moved' : ' whole shelves moved'));
    if (count.X) list.push(count.X + (count.X === 1 ? ' pair of shelves swapped' : ' pairs of shelves swapped'));
    if (count.U) list.push(count.U + (count.U === 1 ? ' pair of units traded places' : ' pairs of units traded places'));
    if (count.B) list.push(count.B + (count.B === 1 ? ' shelf board put in or taken out' : ' shelf boards put in or taken out'));
    if (count.A) list.push(count.A + (count.A === 1 ? ' new item (its guide page starts plain; add details later)' : ' new items (their guide pages start plain; add details later)'));
    notes.forEach(n => list.push(n));
    $('sync-summary').innerHTML = list.map(x => '<li>' + esc(x) + '</li>').join('');
    $('sync-result').hidden = false;
  }
  const boardBelowIn = (u, n) => { while (n > 1 && u.boards && u.boards.length && !u.boards.includes(n)) n--; return n; };
  const download = (obj, name) => { const blob = new Blob([JSON.stringify(obj, null, 2) + '\n'], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  $('sync-data').addEventListener('click', () => outData && download(outData, 'data.json'));
  $('sync-room').addEventListener('click', () => outRoom && download(outRoom, 'room.json'));
  window.__rlSync = { readPage, apply: lines => { apply(lines); return { data: outData, room: outRoom }; } };   // (for testing)
}).catch(err => { console.error(err); status.textContent = 'Could not load the inventory. Open this page from the published site or a local web server.'; });
