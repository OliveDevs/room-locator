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

// ---- saving straight to the website
// The site is plain files on GitHub, so "saving" means writing data.json / room.json into the repository. GitHub only lets
// someone do that with a key (a "fine-grained token" made for this one repository). The key is typed in once per phone or
// laptop and stays in that browser; it is never put in the page or the repository.
const REPO = 'OliveDevs/room-locator', BRANCH = 'main', API = 'https://api.github.com/repos/' + REPO;
const keep = { get: k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }, set: (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} } };
const gh = (path, opts = {}) => fetch(API + path, { ...opts, headers: { Authorization: 'Bearer ' + keep.get('rl-key'), Accept: 'application/vnd.github+json', ...(opts.headers || {}) } });
const toBase64 = text => { const bytes = new TextEncoder().encode(text); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
let afterKey = null;
function askForKey(why) { const box = $('connect'); box.hidden = false; $('connect-why').textContent = why || ''; box.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
async function checkKey() {
  const r = await gh('');
  if (r.status === 401) return 'GitHub does not know this key. Copy it again, all of it.';
  if (!r.ok) return 'GitHub answered ' + r.status + '. Check that the key is for the room-locator repository.';
  const info = await r.json();
  return info.permissions && info.permissions.push ? '' : 'This key can read the site but not change it. It needs Contents: Read and write.';
}
// files = { 'data.json': object, ... }. Returns true when every file is on the website.
async function publish(files, message, button) {
  if (!keep.get('rl-key')) { afterKey = () => button ? button.click() : publish(files, message, button); askForKey('Saving to the website needs the site key on this device, once.'); return false; }
  const label = button ? button.textContent : ''; if (button) { button.disabled = true; button.textContent = 'Saving...'; }
  try {
    const stamp = new Date().toISOString();
    for (const [path, value] of Object.entries(files)) {
      if (path === 'data.json' || path === 'room.json') value.published = stamp;
      const now = await gh('/contents/' + path + '?ref=' + BRANCH);
      if (now.status === 401 || now.status === 403) { keep.set('rl-key', null); afterKey = () => button ? button.click() : publish(files, message, button); askForKey('The saved key no longer works. Paste a new one.'); return false; }
      const sha = now.ok ? (await now.json()).sha : undefined;
      const put = await gh('/contents/' + path, { method: 'PUT', body: JSON.stringify({ message, content: toBase64(JSON.stringify(value, null, 2) + '\n'), sha, branch: BRANCH }) });
      if (!put.ok) throw Error('GitHub answered ' + put.status + ' for ' + path);
    }
    // the site itself takes about a minute to show new files; until then this browser uses the copy it just saved
    const fresh = JSON.parse(keep.get('rl-fresh') || '{}'); fresh.at = Date.now(); Object.assign(fresh, Object.fromEntries(Object.entries(files).filter(([p]) => p === 'data.json' || p === 'room.json')));
    keep.set('rl-fresh', JSON.stringify(fresh));
    status.textContent = 'Saved to the website. Everyone sees it in about a minute.';
    return true;
  } catch (err) { status.textContent = 'Not saved: ' + err.message + '. Nothing on the website changed for that file. Try again, or use the download.'; return false; }
  finally { if (button) { button.disabled = false; button.textContent = label; } }
}
$('connect-save').addEventListener('click', async () => {
  const value = $('connect-key').value.trim(); if (!value) return;
  keep.set('rl-key', value); $('connect-why').textContent = 'Checking...';
  const problem = await checkKey().catch(() => 'Could not reach GitHub. Check the internet connection.');
  if (problem) { keep.set('rl-key', null); $('connect-why').textContent = problem; return; }
  $('connect').hidden = true; $('connect-key').value = ''; status.textContent = 'This device can now save to the website.'; dispatchEvent(new Event('rl-key-changed'));
  if (afterKey) { const go = afterKey; afterKey = null; go(); }
});
$('connect-forget').addEventListener('click', () => { keep.set('rl-key', null); $('connect').hidden = true; status.textContent = 'The key was removed from this device.'; dispatchEvent(new Event('rl-key-changed')); });

Promise.all([fetch('data.json?v=' + Date.now()).then(r => r.json()), fetch('room.json?v=' + Date.now()).then(r => r.json())]).then(([data, room]) => {
  // just saved from this browser and the site has not caught up yet: use the saved copy (for a quarter of an hour at most)
  try { const fresh = JSON.parse(keep.get('rl-fresh') || 'null');
    if (fresh && Date.now() - fresh.at < 15 * 60 * 1000) { if (fresh['data.json'] && fresh['data.json'].published > (data.published || '')) data = fresh['data.json']; if (fresh['room.json'] && fresh['room.json'].published > (room.published || '')) room = fresh['room.json']; }
    else if (fresh) keep.set('rl-fresh', null);
  } catch (e) {}
  const kinds = data.kinds, units = room.units, types = room.types || [];
  const unitBy = Object.fromEntries(units.map(u => [u.code, u]));
  const lit = units.filter(u => u.shelves > 0);
  const hasBoard = (u, n) => n === 1 || !u.boards || !u.boards.length || u.boards.includes(n);
  const boardBelow = (u, n) => { while (n > 1 && !hasBoard(u, n)) n--; return n; };
  const onShelf = (code, n) => { const u = unitBy[code]; return kinds.filter(k => k.u === code && u && u.shelves && boardBelow(u, k.s) === n); };
  const placeName = (code, n) => { const u = unitBy[code]; if (!u) return code; return u.shelves ? u.name + ', shelf ' + n : u.name + ' (ask at the desk)'; };

  // ---- tabs
  const tabs = ['move', 'shelf', 'add', 'edit', 'sync'];
  tabs.forEach(t => $('tab-' + t).addEventListener('click', () => {
    tabs.forEach(o => { $('tab-' + o).setAttribute('aria-selected', o === t); $('tool-' + o).hidden = o !== t; });
    $('code-out').hidden = !made.length || t === 'sync'; status.textContent = '';
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
  // Every code made this visit is kept in a list, so several changes can be set up first and then shown to the console
  // one after another: the PIN is typed once, then it is scan, Select, Next.
  const made = []; let madeAt = -1;
  function drawCode() {
    const c = made[madeAt]; if (!c) { $('code-out').hidden = true; return; }
    const qr = qrcode(0, 'M'); qr.addData(c.code); qr.make();
    $('qr').innerHTML = qr.createSvgTag({ cellSize: 8, margin: 4, scalable: true });
    $('code-title').textContent = c.title; $('code-what').textContent = c.what; $('code-text').textContent = c.code; $('code-extra').textContent = c.extra || '';
    $('code-many').hidden = made.length < 2;
    $('code-count').textContent = 'Code ' + (madeAt + 1) + ' of ' + made.length;
    $('code-prev').disabled = madeAt === 0; $('code-next').disabled = madeAt === made.length - 1;
    $('code-out').hidden = false;
  }
  function showCode(code, title, what, extra) {
    if (code.length >= MAX_CODE) { status.textContent = 'That code is too long for the scanner (' + code.length + ' characters). Use a shorter name.'; $('code-out').hidden = true; return; }
    const had = made.findIndex(c => c.code === code);
    if (had >= 0) madeAt = had; else { made.push({ code, title, what, extra }); madeAt = made.length - 1; }
    status.textContent = made.length > 1 ? 'Added. ' + made.length + ' codes are ready: set up more, or show them to the console one after another.' : '';
    drawCode(); $('code-out').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('code-prev').addEventListener('click', () => { if (madeAt > 0) { madeAt--; drawCode(); } });
  $('code-next').addEventListener('click', () => { if (madeAt < made.length - 1) { madeAt++; drawCode(); } });
  $('code-clear').addEventListener('click', () => { made.length = 0; madeAt = -1; drawCode(); status.textContent = 'The list of codes is empty.'; });

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
    if (u === k.u && unitBy[u].shelves && boardBelow(unitBy[u], s) === boardBelow(unitBy[u], k.s)) { status.textContent = 'It is already on that shelf. Click the shelf it is moving to.'; $('code-out').hidden = true; return; }
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
  // Since console v5.8 each QR page is a web address: this page, then #RLSYNC~page~pages~total!line!line with ~ for tab,
  // ! for the end of a line and %20-style codes for anything else. A phone camera opens it and the page reads itself.
  const fromAddress = text => { const at = text.indexOf('#RLSYNC'); if (at < 0) return text; try { return decodeURIComponent(text.slice(at + 1).replace(/~/g, '|').replace(/!/g, '\n')); } catch (e) { return text; } };
  // Every scan with the camera opens this page afresh, so the pages scanned so far are kept on the phone for half an hour.
  const KEEP = 'rl-sync-pages';
  const remember = () => { try { localStorage.setItem(KEEP, JSON.stringify({ at: Date.now(), pageCount, pages })); } catch (e) {} };
  try { const kept = JSON.parse(localStorage.getItem(KEEP) || 'null'); if (kept && Date.now() - kept.at < 30 * 60 * 1000) { pageCount = kept.pageCount; Object.assign(pages, kept.pages); } } catch (e) {}
  function readPage(text) {
    const lines = fromAddress(text).replace(/\r/g, '').split('\n');
    const head = lines[0].split('|');
    if (head[0] !== 'RLSYNC') return false;
    const p = Number(head[1]), n = Number(head[2]), total = Number(head[3]);
    if (pageCount && (n !== pageCount || Object.values(pages).some(x => x.total !== total))) { Object.keys(pages).forEach(k => delete pages[k]); }   // a different list: start over
    pageCount = n; pages[p] = { total, lines: lines.slice(1).filter(Boolean) };
    remember();
    showPages();
    if (Object.keys(pages).length === pageCount) { stopCamera(); const all = []; for (let i = 1; i <= pageCount; i++) all.push(...pages[i].lines); apply(all.map(l => l.split('|'))).then(() => { try { localStorage.removeItem(KEEP); } catch (e) {} }).catch(() => { status.textContent = 'Could not load the Nov 16 backup. Check the internet connection and scan again.'; }); }
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
  // The console's list is EVERY change since the Nov 16 setup, so the website is rebuilt from scratch each time:
  // the Nov 16 backup, then every line in order. That way a change taken back on the console disappears here too, and an
  // empty list (after Start over on the console) puts the website back to the setup. What only the website knows about an
  // item (photo, manual link, description) is carried over.
  let baseline = null, autoTimer = 0, cameFromConsole = false;
  $('sync-auto-cancel').addEventListener('click', () => { clearInterval(autoTimer); $('sync-auto').hidden = true; status.textContent = 'Not saved. Press Save these changes to the website when you are ready.'; });
  const loadBaseline = async () => baseline || (baseline = await Promise.all([fetch('backup/2026-11-16/data.json?x=' + Date.now()).then(x => x.json()), fetch('backup/2026-11-16/room.json?x=' + Date.now()).then(x => x.json())]));
  async function apply(lines) {
    const [baseData, baseRoom] = await loadBaseline();
    const d = JSON.parse(JSON.stringify(baseData)), r = JSON.parse(JSON.stringify(baseRoom));
    const nowBy = Object.fromEntries(kinds.map(k => [k.h, k]));
    for (const k of d.kinds) { const now = nowBy[k.h]; if (!now) continue; for (const key of ['p', 'r', 'd', 'g', 'tips']) { if (now[key] !== undefined) k[key] = JSON.parse(JSON.stringify(now[key])); else delete k[key]; } }
    const ub = Object.fromEntries(r.units.map(u => [u.code, u]));
    const firstText = lines.length ? lines[0].join('|') : '';
    const start = 0;
    const count = { I: 0, S: 0, X: 0, U: 0, B: 0, A: 0, C: 0 }, notes = [];
    const byH = Object.fromEntries(d.kinds.map(k => [k.h, k]));
    const inRange = (s, lo, hi) => s >= Number(lo) && s <= Number(hi);
    for (const f of lines.slice(start)) {
      const t = f[0].length === 1 ? f[0].toUpperCase() : 'I';
      if (t === 'I') { const k = byH[f[0].toLowerCase()]; if (k) { k.u = f[1]; k.s = Number(f[2]); count.I++; } else notes.push('Not on the website yet: item ' + f[0]); }
      else if (t === 'S') { d.kinds.forEach(k => { if (k.u === f[1] && inRange(k.s, f[2], f[3])) { k.u = f[4]; k.s = Number(f[5]); } }); count.S++; }
      else if (t === 'X') { d.kinds.forEach(k => { if (k.u === f[1] && inRange(k.s, f[2], f[3])) { k.u = f[4]; k.s = Number(f[5]); } else if (k.u === f[4] && inRange(k.s, f[5], f[6])) { k.u = f[1]; k.s = Number(f[2]); } }); count.X++; }
      else if (t === 'U') { const a = ub[f[1]], b = ub[f[2]]; if (a && b) { for (const key of ['first', 'shelves', 'rect']) [a[key], b[key]] = [b[key], a[key]]; count.U++; } }
      else if (t === 'B') { const u = ub[f[1]], n = Number(f[2]); if (u) { const set = new Set(u.boards && u.boards.length ? u.boards : [...Array(u.shelves).keys()].map(i => i + 1)); if (f[3] === '1') set.add(n); else if (n > 1) set.delete(n); u.boards = [...set].sort((x, y) => x - y); count.B++; } }
      else if (t === 'C') { const k = byH[(f[1] || '').toLowerCase()]; if (k) { k.x = Number(f[2]) || k.x; count.C++; } }
      else if (t === 'A') {
        const name = f[3], h = nameCode(name);
        if (!byH[h]) { const now = nowBy[h] || {}; const k = { n: name, c: CAT_ORDER[Number(f[1])] || 'Cables & More', t: f[2], x: Number(f[6]) || 1, in: true, d: now.d || '', h, u: f[4], s: Number(f[5]) }; for (const key of ['p', 'r', 'g']) if (now[key] !== undefined) k[key] = now[key]; d.kinds.push(k); byH[h] = k; count.A++; }
      }
    }
    const names = Object.fromEntries(r.units.map(u => [u.code, u.name]));
    for (const k of d.kinds) { const u = ub[k.u]; k.w = u && u.shelves && k.s ? names[k.u] + ', shelf ' + boardBelowIn(u, k.s) : (names[k.u] || k.u); k.in = !!(u && u.shelves && k.s); }
    d.kinds.sort((a, b) => a.n.localeCompare(b.n));
    r.synced = { lines: lines.length, first: firstText, at: new Date().toISOString() };
    r.source = 'Room Locator console, changes brought over on ' + new Date().toISOString().slice(0, 10);
    outData = d; outRoom = r;
    const list = [];
    const moved = d.kinds.filter(k => { const b = nowBy[k.h]; return !b || b.u !== k.u || b.s !== k.s || b.x !== k.x; }).length + kinds.filter(k => !byH[k.h]).length;
    list.push(lines.length ? 'The console has ' + lines.length + (lines.length === 1 ? ' change' : ' changes') + ' since the Nov 16 setup. Saving makes the website match it exactly.' : 'The console has no changes. Saving puts the website back to the Nov 16 setup.');
    list.push(moved ? moved + (moved === 1 ? ' item page will change.' : ' item pages will change.') : 'The website already matches: nothing will change.');
    if (count.C) list.push(count.C + (count.C === 1 ? ' count changed' : ' counts changed'));
    if (count.I) list.push(count.I + (count.I === 1 ? ' thing moved' : ' things moved'));
    if (count.S) list.push(count.S + (count.S === 1 ? ' whole shelf moved' : ' whole shelves moved'));
    if (count.X) list.push(count.X + (count.X === 1 ? ' pair of shelves swapped' : ' pairs of shelves swapped'));
    if (count.U) list.push(count.U + (count.U === 1 ? ' pair of units traded places' : ' pairs of units traded places'));
    if (count.B) list.push(count.B + (count.B === 1 ? ' shelf board put in or taken out' : ' shelf boards put in or taken out'));
    if (count.A) list.push(count.A + (count.A === 1 ? ' new item (its guide page starts plain; add details later)' : ' new items (their guide pages start plain; add details later)'));
    notes.forEach(n => list.push(n));
    $('sync-summary').innerHTML = list.map(x => '<li>' + esc(x) + '</li>').join('');
    $('sync-result').hidden = false;
    // Scanned straight from the console on a device that has the key: save by itself after a 5-second count, so keeping
    // the website in step is one scan and nothing else. Cancel stops it; nothing to change means nothing is saved.
    clearInterval(autoTimer); $('sync-auto').hidden = true;
    if (cameFromConsole && moved && keep.get('rl-key')) {
      let left = 5; $('sync-auto').hidden = false;
      const tick = () => { $('sync-auto-text').textContent = 'Saving to the website in ' + left + '...'; if (left-- <= 0) { clearInterval(autoTimer); $('sync-auto').hidden = true; $('sync-publish').click(); } };
      tick(); autoTimer = setInterval(tick, 1000);
    }
  }
  const boardBelowIn = (u, n) => { while (n > 1 && u.boards && u.boards.length && !u.boards.includes(n)) n--; return n; };
  const download = (obj, name) => { const blob = new Blob([JSON.stringify(obj, null, 2) + '\n'], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  $('sync-publish').addEventListener('click', async e => { if (!outData) return; if (await publish({ 'data.json': outData, 'room.json': outRoom }, 'Website matched to the console (staff page)', e.target)) { $('sync-saved').hidden = false; setTimeout(() => location.reload(), 2500); } });
  $('web-reset').addEventListener('click', async e => {
    if (!confirm('Put the website back to the Nov 16 setup? Every change brought over from the console since then, and every edit made here, is taken off the website.')) return;
    const [d, r] = await Promise.all([fetch('backup/2026-11-16/data.json?x=' + Date.now()).then(x => x.json()), fetch('backup/2026-11-16/room.json?x=' + Date.now()).then(x => x.json())]);
    if (await publish({ 'data.json': d, 'room.json': r }, 'Website back to the Nov 16 setup (staff page)', e.target)) setTimeout(() => location.reload(), 1500);
  });
  $('sync-data').addEventListener('click', () => outData && download(outData, 'data.json'));
  $('sync-room').addEventListener('click', () => outRoom && download(outRoom, 'room.json'));
  // ---- the 3D room: click a shelf instead of using the two menus
  const card = $('room3d-card'), help = $('room3d-help');
  let activeTab = 'move', shelfStep = 'from';
  const fire = el => el.dispatchEvent(new Event('change', { bubbles: true }));
  const setPlace = (unitSel, shelfSel, u, n) => { unitSel.value = u; fire(unitSel); shelfSel.value = String(n); fire(shelfSel); };
  const view3d = window.Room3D && Room3D.init($('room3d'), room, (u, n) => onShelf(u, boardBelow(unitBy[u], n)).length, (u, n) => {
    if (activeTab === 'move') setPlace(mf.elements.unit, mf.elements.shelf, u, n);
    else if (activeTab === 'add') setPlace(af.elements.unit, af.elements.shelf, u, n);
    else if (activeTab === 'shelf') {
      if (shelfStep === 'from') { setPlace(sf.elements.fromUnit, sf.elements.fromShelf, u, n); shelfStep = 'to'; }
      else { setPlace(sf.elements.toUnit, sf.elements.toShelf, u, n); shelfStep = 'from'; }
    }
    refresh3d(); showShelf(u, n);
  });
  // what is on the shelf that was clicked, with a button to start moving any of it
  const contents = $('shelf-contents');
  function showShelf(u, n) {
    const unit = unitBy[u], board = boardBelow(unit, n), things = onShelf(u, board);
    contents.innerHTML = '<h3>' + esc(placeName(u, board)) + '</h3>' + (things.length
      ? '<ul>' + things.map(k => '<li><span>' + esc(k.n) + (k.x > 1 ? ' <small>× ' + k.x + '</small>' : '') + '</span><button type="button" data-move="' + esc(k.n) + '">Move this</button></li>').join('') + '</ul>'
      : '<p>Nothing is on this shelf.</p>');
    contents.hidden = false;
  }
  contents.addEventListener('click', e => {
    const name = e.target && e.target.dataset && e.target.dataset.move; if (!name) return;
    if (activeTab !== 'move') $('tab-move').click();
    mf.elements.thing.value = name; mf.elements.thing.dispatchEvent(new Event('input', { bubbles: true }));
    refresh3d();
    $('room3d-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  function refresh3d() {
    if (!view3d) return;
    const marks = [];
    if (activeTab === 'move') {
      const k = pickedItem(); if (k && unitBy[k.u] && unitBy[k.u].shelves) marks.push({ unit: k.u, shelf: boardBelow(unitBy[k.u], k.s), kind: 'now' });
      marks.push({ unit: mf.elements.unit.value, shelf: Number(mf.elements.shelf.value), kind: 'pick' });
      help.textContent = k ? 'Orange is where ' + k.n + ' is now. Click the shelf it is moving to (it turns green), then press Make the console code.' : 'Click any shelf to see what is on it and move something from there. Or type the item in the box below.';
    } else if (activeTab === 'shelf') {
      marks.push({ unit: sf.elements.fromUnit.value, shelf: Number(sf.elements.fromShelf.value), kind: 'from' });
      marks.push({ unit: sf.elements.toUnit.value, shelf: Number(sf.elements.toShelf.value), kind: 'pick' });
      help.textContent = shelfStep === 'from' ? 'Click the shelf you are emptying (orange), then the shelf its things go to (green).' : 'Now click the shelf its things go to (green).';
    } else if (activeTab === 'add') {
      marks.push({ unit: af.elements.unit.value, shelf: Number(af.elements.shelf.value), kind: 'pick' });
      help.textContent = 'Click the shelf the new item will live on.';
    }
    view3d.mark(marks);
  }
  if (view3d) {
    card.hidden = false; view3d.resize();
    tabs.forEach(t => $('tab-' + t).addEventListener('click', () => { activeTab = t; shelfStep = 'from'; card.hidden = t === 'sync' || t === 'edit'; if (!card.hidden) { view3d.resize(); refresh3d(); } }));
    [mf, sf, af].forEach(f => { f.addEventListener('change', refresh3d); f.addEventListener('input', refresh3d); });
    refresh3d();
  }
  // opened by pointing a phone camera at the console's "To the website" code: go straight to that tab and take the page in
  // ---- the status line at the top: is the website in step with the console, and can this device save
  const drawHomeStatus = () => {
    const sy = room.synced, when = sy && sy.at ? new Date(sy.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
    $('home-sync').textContent = sy && sy.at ? 'Website last matched the console ' + when + ', with ' + sy.lines + (sy.lines === 1 ? ' change' : ' changes') + ' since the Nov 16 setup.' : 'The website is at the Nov 16 setup. No console changes have been brought over yet.';
    $('home-key').textContent = keep.get('rl-key') ? 'This device can save to the website.' : 'This device cannot save to the website yet.';
    $('home-key-set').textContent = keep.get('rl-key') ? 'Forget the key' : 'Set up saving';
  };
  drawHomeStatus();
  $('home-sync-go').addEventListener('click', () => { $('tab-sync').click(); $('tool-sync').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('home-key-set').addEventListener('click', () => { if (keep.get('rl-key')) { keep.set('rl-key', null); drawHomeStatus(); } else askForKey('Paste the site key once and this device can save.'); });
  addEventListener('rl-key-changed', drawHomeStatus);
  const takeAddress = () => {
    if (!location.hash.startsWith('#RLSYNC')) return;
    $('tab-sync').click(); cameFromConsole = true;
    const ok = readPage(location.href);
    history.replaceState(null, '', location.pathname);
    if (ok && Object.keys(pages).length < pageCount) status.textContent = 'Got it. On the console press Down for the next page and point the camera at it.';
  };
  takeAddress(); addEventListener('hashchange', takeAddress);   // (hashchange: the camera reused a tab that already had this page open)
  // ---- edit an item that is already on the website: its photo, manual link and description
  const ef = $('edit-form'), preview = $('edit-preview');
  let photos = null; fetch('photos.json?v=20261116h').then(r => r.json()).then(p => { photos = p; }).catch(() => {});
  const editItem = () => kinds.find(k => k.n.toLowerCase() === ef.elements.thing.value.trim().toLowerCase());
  const showPreview = url => { preview.innerHTML = url ? '<img src="' + esc(url) + '" alt="" referrerpolicy="no-referrer"><span>This is the photo the page shows now.</span>' : '<span>This item has no photo yet.</span>'; };
  ef.elements.thing.addEventListener('input', () => {
    const k = editItem(); $('edit-fields').hidden = !k; $('edit-handoff').hidden = true; if (!k) return;
    const shared = photos && photos.images[photos.items[k.n]];
    ef.elements.photo.value = k.p ? k.p.url : ''; ef.elements.credit.value = k.p ? k.p.artist || '' : ''; ef.elements.crediturl.value = k.p && k.p.page !== '#' ? k.p.page || '' : '';
    ef.elements.nophoto.checked = false;
    ef.elements.manualname.value = k.r && k.r[0] ? k.r[0][0] : ''; ef.elements.manual.value = k.r && k.r[0] ? k.r[0][1] : '';
    ef.elements.description.value = k.d || ''; ef.elements.copies.value = k.x || 1;
    showPreview(k.p ? k.p.url : shared ? shared.url : '');
  });
  ef.elements.photo.addEventListener('change', () => { if (ef.elements.photo.value.trim()) showPreview(ef.elements.photo.value.trim()); });
  const editedData = () => {
    const k = editItem(); if (!k) { status.textContent = 'Pick the item from the list first.'; return null; }
    const f = ef.elements, url = f.photo.value.trim(), link = f.manual.value.trim();
    if (link && !/^https?:\/\//.test(link)) { status.textContent = 'The manual link has to start with https://'; return; }
    const d = JSON.parse(JSON.stringify(data)), item = d.kinds.find(x => x.h === k.h);
    if (f.nophoto.checked) item.p = { none: true };
    else if (url) item.p = { url, page: f.crediturl.value.trim() || '#', artist: f.credit.value.trim() || 'IDeATe Lending', license: 'Photo source' };
    else delete item.p;
    if (link) item.r = [[f.manualname.value.trim() || 'Manual', link]].concat((item.r || []).slice(1)); else if (item.r && !f.manualname.value.trim()) delete item.r;
    if (f.description.value.trim()) item.d = f.description.value.trim(); else item.d = '';
    const copies = Number(f.copies.value); if (copies >= 1) item.x = Math.floor(copies);
    return d;
  };
  $('edit-download').addEventListener('click', () => { const d = editedData(); if (!d) return; download(d, 'data.json'); status.textContent = ''; $('edit-handoff').hidden = false; $('edit-handoff').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
  $('edit-publish').addEventListener('click', async e => {
    const d = editedData(); if (!d) return; const k = editItem(), copies = d.kinds.find(x => x.h === k.h).x;
    if (!(await publish({ 'data.json': d }, 'Edit ' + k.n + ' (staff page)', e.target))) return;
    if (copies !== k.x) { k.x = copies; showCode('RL:COUNT:' + k.h + ':' + copies, 'Show this to the console too', k.n + ': Lending now has ' + copies + '. The website is saved; this tells the console.', 'Without this the console keeps showing the old count.'); }
    else setTimeout(() => location.reload(), 1500);
  });
  $('edit-count-code').addEventListener('click', () => { const k = editItem(); if (!k) { status.textContent = 'Pick the item from the list first.'; return; } const n = Math.floor(Number(ef.elements.copies.value)); if (!(n >= 1 && n <= 250)) { status.textContent = 'The count has to be between 1 and 250.'; return; } showCode('RL:COUNT:' + k.h + ':' + n, 'Show this to the console', k.n + ': Lending now has ' + n + '.', 'This changes the count on the console only. Save to the website changes it there.'); });
  window.__rlSync = { readPage, apply: async lines => { await apply(lines); return { data: outData, room: outRoom }; } };   // (for testing)
}).catch(err => { console.error(err); status.textContent = 'Could not load the inventory. Open this page from the published site or a local web server.'; });
