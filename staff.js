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
// ---- the key, shared behind a website passcode
// So that the key does not have to be pasted on every phone, a device that has it can lock it with a passcode (staff can
// use the same digits as the console's PIN) and save the locked copy to the site as key.json. Any other device then
// only needs the passcode. The key is locked with AES-GCM; the lock is made from the passcode with PBKDF2 (600,000 rounds).
// A 4-digit passcode can be guessed by trying all 10,000, so the locked copy is only as safe as the passcode is long.
const lockBytes = async (pass, salt) => crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600000 }, await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))), unb64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
// key.json holds up to two locked copies: "pass" opens with a passcode someone types, "console" opens with the long
// website pass the console carries in its staff codes (so nobody types anything).
// The live site takes about a minute to show a file this page just saved. Until then, use the copy that was saved
// (remembered for 5 minutes), so a second save right after the first cannot drop what the first one wrote.
let justLocked = null, justLockedAt = 0;
const readLocked = () => justLocked && Date.now() - justLockedAt < 300000 ? Promise.resolve(JSON.parse(justLocked)) : fetch('key.json?x=' + Date.now()).then(r => r.ok ? r.json() : null).catch(() => null);
async function lockKey(pass, slot) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const box = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await lockBytes(pass, salt), new TextEncoder().encode(keep.get('rl-key')));
  const all = (await readLocked()) || {}; const out = { note: 'The site key, locked. Made by the staff page.' };
  if (all.salt) out.pass = { salt: all.salt, iv: all.iv, box: all.box };          // (the first version of this file had one copy at the top)
  for (const name of ['pass', 'console', 'owner', 'manager', 'expires']) if (all[name]) out[name] = all[name];
  out[slot] = { salt: b64(salt), iv: b64(iv), box: b64(box) };
  return out;
}
const slotOf = (all, slot) => all && (all[slot] || (slot === 'pass' && all.salt ? all : null));
// what a locked copy holds, or null when the pass does not open it (nothing on this device changes)
async function openLocked(all, pass, slot) {
  const locked = slotOf(all, slot); if (!locked) return null;
  try { return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(locked.iv) }, await lockBytes(pass, unb64(locked.salt)), unb64(locked.box))); } catch (e) { return null; }
}
// Two kinds of staff (Nov 21): managers (Lending's managers and the project's owner) and student staff. Both can move,
// add and edit things. Only managers change passcodes, link the console or reset the website. A device is a manager's
// when it signed in with the owner or manager passcode, or someone pasted the GitHub key on it.
// (This is a lock on the page: everyone signed in uses the same GitHub key underneath.)
const isManager = () => keep.get('rl-role') === 'manager';
// the folds at the bottom sit in three groups (Records, Settings, Manuals and help): opening one opens its group too
const openFold = el => { for (let d = el; d; d = d.parentElement && d.parentElement.closest('details')) d.open = true; };
// a name or initials this device signs its changes with in Change history (optional, set under Passcode and sign-out)
const byMe = () => keep.get('rl-name') ? { by: keep.get('rl-name').slice(0, 24) } : {};

async function unlockKey(pass, slot = 'pass') {
  const all = await readLocked();
  if (slot === 'pass') for (const top of ['owner', 'manager']) if (slotOf(all, top)) { const mine = await openLocked(all, pass, top); if (mine !== null) { keep.set('rl-key', mine); keep.set('rl-role', 'manager'); keep.set('rl-slot', top + ':' + slotOf(all, top).salt); return ''; } }   // a manager's passcode works in the same box
  if (!slotOf(all, slot)) return slot === 'pass' ? 'No passcode has been set up for this site yet. Paste the key instead, then set one up.' : 'This console is not linked to the website yet.';
  const plain = await openLocked(all, pass, slot);
  if (plain === null) return slot === 'pass' ? 'That passcode is not right.' : 'The console\'s website pass does not match the website any more. Link the console again.';
  keep.set('rl-key', plain); keep.set('rl-role', 'staff'); keep.set('rl-slot', slot + ':' + slotOf(all, slot).salt); return '';
}
// A device remembers which passcode opened the key (rl-slot). When a manager sets that passcode again, every device that
// signed in with the old one is signed out the next time it opens this page, so a new passcode really shuts the old one out.
// (A device signed in by pasting the GitHub key has no passcode behind it and stays signed in.)
const passcodeGone = async () => {
  const mine = keep.get('rl-slot'); if (!mine || !keep.get('rl-key')) return false;
  const all = await readLocked(); if (!all) return false;                         // offline: leave it alone
  const [name, salt] = mine.split(':'); const now = slotOf(all, name);
  if (now && now.salt === salt) return false;
  keep.set('rl-key', null); keep.set('rl-role', null); keep.set('rl-slot', null); return true;
};
// After a passcode or the console's pass opened the locked copy: does GitHub still take the key inside? A key that has
// run out (or was deleted on GitHub) is the one thing a passcode cannot fix, so the message says what to do.
const DEAD_KEY = 'The passcode is right, but the site key behind it has run out or was replaced on GitHub. Someone with the GitHub account needs to paste a new key: open "Check everything" at the bottom of this page for the steps.';
const checkUnlocked = async () => { const r = await gh('').catch(() => null); if (!r) return 'Could not reach GitHub. Check the internet connection.'; if (r.status === 401) return DEAD_KEY; return checkKey(); };
let afterKey = null, cameWithPass = false;
function askForKey(why) {
  const box = $('connect'); box.hidden = false; $('connect-pass').focus({ preventScroll: true }); $('connect-why').textContent = why || ''; box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // Say what will actually work on this site right now, so nobody types a passcode that was never set up
  readLocked().then(all => {
    const hasPass = !!slotOf(all, 'pass'), hasConsole = !!slotOf(all, 'console');
    $('connect-passrow').hidden = !hasPass; $('connect-unlock').hidden = !hasPass;
    $('connect-how').textContent = hasConsole ? 'Easiest: on the console, go down to the grey bar, press Select and type the staff PIN. Scan the code that comes up with this phone. It signs this phone in by itself and it stays signed in.' + (hasPass ? ' Or type the staff passcode below (it is not the console\'s PIN).' : '')
      : hasPass ? 'Type the staff passcode. It is not the console\'s PIN.'
      : 'Saving has not been set up on this site yet, so there is no passcode to type (the console\'s PIN does not work here). The person with the GitHub account does this once: open the line below and paste the site key. The page then shows a code for the console, and after that phones sign in just by scanning the console.';
    if (!hasPass && !hasConsole) box.querySelector('details').open = true;
  });
}
async function checkKey() {
  const r = await gh('');
  if (r.status === 401) return 'GitHub does not know this key. Copy it again, all of it.';
  if (!r.ok) return 'GitHub answered ' + r.status + '. Check that the key is for the room-locator repository.';
  const info = await r.json();
  return info.permissions && info.permissions.push ? '' : 'This key can read the site but not change it. It needs Contents: Read and write.';
}
async function publishTogether(files, message, blobs) {
  async function gitJson(path, method = 'GET', body) {
    const response = await gh('/git/' + path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) {
      if (response.status === 401) throw Error(DEAD_KEY);
      if (response.status === 403) throw Error('GitHub denied this write. Check the site key or repository permissions');
      if (method === 'PATCH' && (response.status === 409 || response.status === 422)) {
        throw Error('The branch could not be updated. Reload and review the latest data before trying again');
      }
      throw Error('GitHub returned ' + response.status + ' while preparing the website update');
    }
    return response.json();
  }
  const ref = 'heads/' + BRANCH;
  const head = (await gitJson('ref/' + ref)).object.sha;
  const base = await gitJson('commits/' + head);
  const entries = Object.entries(files).map(([path, value]) => ({
    path, mode: '100644', type: 'blob', content: JSON.stringify(value, null, 2) + '\n'
  }));
  for (const [path, content] of Object.entries(blobs || {})) entries.push({ path, mode: '100644', type: 'blob', sha: (await gitJson('blobs', 'POST', { content, encoding: 'base64' })).sha });   // pictures
  const tree = await gitJson('trees', 'POST', { base_tree: base.tree.sha, tree: entries });
  const commit = await gitJson('commits', 'POST', { tree: tree.sha, parents: [head], message });
  await gitJson('refs/' + ref, 'PATCH', { sha: commit.sha, force: false });
}
// ---- records kept with every save (Nov 22)
// Editions: one file a day on which the item list changed, holding the whole list as it was at the end of that day
// (editions/2026-11-22.json, listed in editions/index.json). The staff page can show any of them next to today's.
// History: pending.json keeps the newest changes; older ones move to history/<year>.json, so nothing is ever dropped.
// A file that is not there yet reads as null; a read that fails throws, and then that save simply adds no records.
async function readRecord(name) {
  const r = await gh('/contents/' + name + '?ref=' + BRANCH + '&x=' + Date.now(), { headers: { Accept: 'application/vnd.github.raw+json' } });
  if (r.status === 404) return null; if (!r.ok) throw Error('records'); return r.json();
}
const dayId = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const editionOf = (d, at) => ({ note: 'The item list as it was. One line per item: code, name, category, type, how many (0 = taken out), unit, shelf, where it said, not found in an audit (1).', at, items: d.kinds.map(k => [k.h, k.n, k.c, k.t, k.x === 0 ? 0 : (k.x || 1), k.u, k.s || 0, k.w || '', k.nf ? 1 : 0].join('\t')) });
const HISTORY_KEEP = 150, HISTORY_MOVE_AT = 250;
async function withRecords(files) {
  try {
    const d = files['data.json'];
    if (d && Array.isArray(d.kinds)) {
      const now = new Date(), id = dayId(now), idx = (await readRecord('editions/index.json')) || { editions: [] };
      const list = (Array.isArray(idx.editions) ? idx.editions : []).filter(e => e && e.id !== id);
      list.unshift({ id, at: now.toISOString(), items: d.kinds.filter(k => k.x !== 0).length });
      files['editions/' + id + '.json'] = editionOf(d, now.toISOString());
      files['editions/index.json'] = { note: 'Every saved edition of the item list, newest first. Written by the staff page.', editions: list };
    }
    const p = files['pending.json'];
    if (p && Array.isArray(p.history) && p.history.length > HISTORY_MOVE_AT) {
      const old = p.history.slice(HISTORY_KEEP), years = {};
      for (const x of old) { const y = String(new Date(x.at).getFullYear() || 'older'); (years[y] = years[y] || []).push(x); }
      const idx = (await readRecord('history/index.json')) || { years: [] }, known = new Set(Array.isArray(idx.years) ? idx.years : []), out = {};
      for (const y of Object.keys(years)) { const was = (await readRecord('history/' + y + '.json')) || { history: [] }; out['history/' + y + '.json'] = { note: 'Changes from ' + y + ', newest first. Moved here from pending.json by the staff page.', history: years[y].concat(Array.isArray(was.history) ? was.history : []) }; known.add(y); }
      Object.assign(files, out); files['history/index.json'] = { note: 'The years that have a history file.', years: [...known].sort().reverse() };
      p.history = p.history.slice(0, HISTORY_KEEP);
      dispatchEvent(new CustomEvent('rl-archived', { detail: old }));   // the page that is open keeps showing them
    }
  } catch (e) { for (const k of Object.keys(files)) if (/^(editions|history)\//.test(k)) delete files[k]; }   // records are extra: a save never fails because of them
  return files;
}
// Returns true when the branch contains the update.
async function publish(files, message, button, blobs) {
  if (!keep.get('rl-key')) { afterKey = () => button ? button.click() : publish(files, message, button, blobs); askForKey('Saving to the website needs the staff passcode on this device, once.'); return false; }
  const label = button ? button.textContent : ''; if (button) { button.disabled = true; button.textContent = 'Saving...'; }
  try {
    const stamp = new Date().toISOString();
    await withRecords(files);
    const entries = Object.entries(files);
    for (const [path, value] of entries) if (path === 'data.json' || path === 'room.json' || path === 'pending.json') value.published = stamp;
    if (entries.length > 1 || blobs) await publishTogether(files, message, blobs);
    else for (const [path, value] of entries) {
      const now = await gh('/contents/' + path + '?ref=' + BRANCH);
      if (now.status === 401 || now.status === 403) { keep.set('rl-key', null); afterKey = () => button ? button.click() : publish(files, message, button, blobs); askForKey('The saved key no longer works. Paste a new one.'); return false; }
      const sha = now.ok ? (await now.json()).sha : undefined;
      const put = await gh('/contents/' + path, { method: 'PUT', body: JSON.stringify({ message, content: toBase64(JSON.stringify(value, null, 2) + '\n'), sha, branch: BRANCH }) });
      if (!put.ok) throw Error('GitHub answered ' + put.status + ' for ' + path);
    }
    // the site itself takes about a minute to show new files; until then this browser uses the copy it just saved
    const fresh = JSON.parse(keep.get('rl-fresh') || '{}'); fresh.at = Date.now(); Object.assign(fresh, Object.fromEntries(Object.entries(files).filter(([p]) => p === 'data.json' || p === 'room.json' || p === 'pending.json')));
    keep.set('rl-fresh', JSON.stringify(fresh));
    if (files['key.json']) { justLocked = JSON.stringify(files['key.json']); justLockedAt = Date.now();
      const mine = keep.get('rl-slot'), name = mine.split(':')[0], now = name && slotOf(files['key.json'], name); if (now) keep.set('rl-slot', name + ':' + now.salt); }   // this device set its own passcode again: it stays signed in
    status.textContent = 'Saved to the website. Everyone sees it in about a minute.';
    return true;
  } catch (err) { status.textContent = 'Could not confirm the website save: ' + err.message + '. Check the website before retrying, or use the download.'; return false; }
  finally { if (button) { button.disabled = false; button.textContent = label; } }
}
$('connect-save').addEventListener('click', async () => {
  const value = $('connect-key').value.trim(); if (!value) return;
  keep.set('rl-key', value); $('connect-why').textContent = 'Checking...';
  const problem = await checkKey().catch(() => 'Could not reach GitHub. Check the internet connection.');
  if (problem) { keep.set('rl-key', null); $('connect-why').textContent = problem; return; }
  $('connect-key').value = ''; keep.set('rl-role', 'manager'); keep.set('rl-slot', null); dispatchEvent(new Event('rl-key-changed'));
  // A new key makes the locked copies on the site stale (they hold the old key). Renew what this device can:
  // the passcode copy if the passcode was typed here too, the console's copy if this phone came from the console's code.
  const all = (await readLocked()) || {}, pass = $('connect-newpass').value, cpass = keep.get('rl-cpass'), expires = $('connect-expires').value, did = [], left = [];
  let out = null, firstLink = false;
  try {
    if (pass.length >= 10) { out = await lockKey(pass, 'pass'); did.push('the staff passcode'); } else if (slotOf(all, 'pass')) left.push('The staff passcode still opens the OLD key: set the passcode again under "Passcode and sign-out".');
    if (cpass && (!slotOf(all, 'console') || await openLocked(all, cpass, 'console') !== null)) {
      const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
      const box = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await lockBytes(cpass, salt), new TextEncoder().encode(value));
      out = out || await lockKey(cpass, 'console'); out.console = { salt: b64(salt), iv: b64(iv), box: b64(box) }; did.push('the console\'s link (nothing to do at the console)');
    } else if (!slotOf(all, 'console')) firstLink = true;
    else if (slotOf(all, 'console')) left.push('The console\'s link still holds the OLD key: press "Link the console again" (under Passcode and sign-out) and show the new code to the console, or open this page from the console\'s Staff page code and paste the key there.');
    if (slotOf(all, 'owner')) left.push('Your own passcode still opens the OLD key: set it again under "Passcode and sign-out".');
    if (slotOf(all, 'manager')) left.push('The manager passcode still opens the OLD key: set it again under "Passcode and sign-out".');
    if (/^\d{4}-\d\d-\d\d$/.test(expires)) { out = out || { note: 'The site key, locked. Made by the staff page.', ...Object.fromEntries(['pass', 'console', 'owner', 'manager'].filter(n => slotOf(all, n)).map(n => [n, slotOf(all, n)])) }; out.expires = expires; }
    else if (out) delete out.expires;                              // a new key with no date given: the old date no longer applies
  } catch (e) { out = null; left.push('The locked copies could not be renewed on this browser.'); }
  $('connect-newpass').value = ''; $('connect').hidden = true;
  const saved = out ? await publish({ 'key.json': out }, 'Site key renewed (staff page)') : true;
  status.textContent = 'This device can now save to the website.' + (out && saved && did.length ? ' Renewed for everyone else too: ' + did.join(' and ') + '.' : '') + (out && !saved ? ' The locked copies were NOT renewed: try again from "Check everything".' : '') + (left.length ? ' ' + left.join(' ') : '');
  dispatchEvent(new Event('rl-key-changed'));
  if (afterKey) { const go = afterKey; afterKey = null; go(); }
  else if (firstLink) {                                            // first time on this site: go straight on to linking the console, the step that makes every phone automatic
    $('device').hidden = false; openFold($('device')); $('link-console').click(); $('share').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});
const keyReady = () => { $('connect').hidden = true; status.textContent = 'This device can now save to the website.'; dispatchEvent(new Event('rl-key-changed')); if (afterKey) { const go = afterKey; afterKey = null; go(); } };
$('connect-unlock').addEventListener('click', async () => {
  const pass = $('connect-pass').value; if (!pass) return;
  $('connect-why').textContent = 'Checking...';
  const problem = await unlockKey(pass) || await checkUnlocked();
  if (problem) { keep.set('rl-key', null); $('connect-why').textContent = problem; return; }
  $('connect-pass').value = ''; keyReady();
});
$('share-save').addEventListener('click', async e => {
  const pass = $('share-pass').value, again = $('share-pass2').value;
  if (!keep.get('rl-key')) { $('share-why').textContent = 'This device needs the key first.'; return; }
  if (!isManager()) { $('share-why').textContent = 'Only a Lending manager can change the staff passcode.'; return; }
  // the locked key sits in the public repository, so a short passcode can be guessed by trying every one: at least 10 characters
  if (pass.length < 10) { $('share-why').textContent = 'Use at least 10 characters. A few words together works well, like "blue tripod on shelf four".'; return; }
  if (pass !== again) { $('share-why').textContent = 'The two do not match.'; return; }
  if (await publish({ 'key.json': await lockKey(pass, 'pass') }, 'Site key locked with the staff passcode (staff page)', e.target)) { $('share-pass').value = $('share-pass2').value = ''; $('share-why').textContent = 'Saved. In about a minute the new passcode works on any device, and the old one stops working. Devices already signed in stay signed in.'; }
});
// the owner passcode is only set from staff.html#owner, so the page shows staff a single passcode
$('manager-save').addEventListener('click', async e => {
  const pass = $('manager-pass').value, again = $('manager-pass2').value;
  if (!keep.get('rl-key') || !isManager()) { $('manager-why').textContent = 'Only a Lending manager can set this.'; return; }
  if (pass.length < 10) { $('manager-why').textContent = 'Use at least 10 characters.'; return; }
  if (pass !== again) { $('manager-why').textContent = 'The two do not match.'; return; }
  if (await publish({ 'key.json': await lockKey(pass, 'manager') }, 'Site key locked with the manager passcode (staff page)', e.target)) { $('manager-pass').value = $('manager-pass2').value = ''; $('manager-why').textContent = 'Saved. In about a minute this passcode signs a device in as a manager, from the same box as the staff passcode.'; }
});
// what this device may do: managers see the passcodes, the console link and the website reset; student staff do not
const drawRole = () => {
  const m = isManager(), signed = !!keep.get('rl-key');
  document.querySelectorAll('.manager-only').forEach(el => { el.hidden = !m; });
  $('role-note').textContent = !signed ? '' : m ? 'This device is signed in as a manager.' : 'This device is signed in as student staff. Changing passcodes, linking the console and resetting the website are for Lending managers.';
};
addEventListener('rl-key-changed', drawRole); setTimeout(drawRole, 0);
// the Manuals link at the top opens that section
const showManuals = () => { const id = { '#manuals': 'manuals', '#log': 'log' }[location.hash]; if (id) { openFold($(id)); $(id).scrollIntoView({ block: 'start' }); } };   // (the header links to Change history and Manuals)
addEventListener('hashchange', showManuals); setTimeout(showManuals, 0);
const showOwner = () => { if (location.hash === '#owner' && keep.get('rl-key') && isManager()) { $('owner-box').hidden = false; $('device').hidden = false; openFold($('device')); $('owner-box').scrollIntoView({ block: 'center' }); } };
addEventListener('hashchange', showOwner); setTimeout(showOwner, 800);
$('owner-save').addEventListener('click', async e => {
  const pass = $('owner-pass').value, again = $('owner-pass2').value;
  if (!keep.get('rl-key') || !isManager()) { $('owner-why').textContent = 'This device needs to be signed in by a manager first.'; return; }
  if (pass.length < 8) { $('owner-why').textContent = 'Use at least 8 characters.'; return; }
  if (pass !== again) { $('owner-why').textContent = 'The two do not match.'; return; }
  if (await publish({ 'key.json': await lockKey(pass, 'owner') }, 'Site key locked with the owner passcode (staff page)', e.target)) { $('owner-pass').value = $('owner-pass2').value = ''; $('owner-why').textContent = 'Saved. In about a minute this passcode works in the same box as the staff passcode, on any device. Changing the staff passcode does not change it.'; }
});
$('link-console').addEventListener('click', async e => {
  if (!keep.get('rl-key')) { $('share-why').textContent = 'This device needs the key first.'; return; }
  if (!isManager()) { $('share-why').textContent = 'Only a Lending manager can link the console.'; return; }
  const letters = 'abcdefghjkmnpqrstuvwxyz23456789', pick = crypto.getRandomValues(new Uint8Array(20));
  const pass = [...pick].map(n => letters[n % letters.length]).join('');
  if (!(await publish({ 'key.json': await lockKey(pass, 'console') }, 'Site key locked with the console\'s website pass (staff page)', e.target))) return;
  $('link-code').hidden = false; keep.set('rl-cpass', pass);
  const qr = qrcode(0, 'M'); qr.addData('RL:WEB:' + pass); qr.make(); $('link-qr').innerHTML = qr.createSvgTag({ cellSize: 8, margin: 4, scalable: true });
  $('share-why').textContent = 'Saved. Now show this code to the console\'s scanner and type the staff PIN there.';
});
$('connect-forget').addEventListener('click', () => { keep.set('rl-key', null); keep.set('rl-role', null); keep.set('rl-slot', null); $('connect').hidden = true; status.textContent = 'The key was removed from this device.'; dispatchEvent(new Event('rl-key-changed')); });

// The newest copy of a file: straight from the repository when it answers (the public pages lag about a minute behind
// a save), otherwise the public copy.
async function latest(name, isIt) {
  try {
    const res = await fetch(API + '/contents/' + name + '?ref=' + BRANCH + '&x=' + Date.now(), { headers: { Accept: 'application/vnd.github.raw+json', ...(keep.get('rl-key') ? { Authorization: 'Bearer ' + keep.get('rl-key') } : {}) } });
    if (res.ok) { const got = await res.json(); if (isIt(got)) return got; }
  } catch (e) {}
  const res = await fetch(name + '?x=' + Date.now()); return res.ok ? res.json() : null;
}
// pending.json: changes saved to the website first that the console has not taken in yet, and a history of every change
const cleanPend = p => ({ note: 'Changes saved to the website first, waiting for the console, and the history of changes. Written by the staff page.', waiting: Array.isArray(p && p.waiting) ? p.waiting.filter(e => e && e.id && typeof e.code === 'string') : [], history: Array.isArray(p && p.history) ? p.history.filter(Boolean).slice(0, 2000) : [], ...(p && p.published ? { published: p.published } : {}) });
const readPending = async () => cleanPend(await latest('pending.json', g => g && Array.isArray(g.waiting)).catch(() => null));

Promise.all([fetch('data.json?v=' + Date.now()).then(r => r.json()), fetch('room.json?v=' + Date.now()).then(r => r.json()), fetch('pending.json?v=' + Date.now()).then(r => r.ok ? r.json() : null).catch(() => null)]).then(([data, room, pendIn]) => {
  // just saved from this browser and the site has not caught up yet: use the saved copy (for a quarter of an hour at most)
  try { const fresh = JSON.parse(keep.get('rl-fresh') || 'null');
    if (fresh && Date.now() - fresh.at < 15 * 60 * 1000) { if (fresh['data.json'] && fresh['data.json'].published > (data.published || '')) data = fresh['data.json']; if (fresh['room.json'] && fresh['room.json'].published > (room.published || '')) room = fresh['room.json']; if (fresh['pending.json'] && fresh['pending.json'].published > ((pendIn && pendIn.published) || '')) pendIn = fresh['pending.json']; }
    else if (fresh) keep.set('rl-fresh', null);
  } catch (e) {}
  const kinds = data.kinds, units = room.units, types = room.types || [];
  let pend = cleanPend(pendIn);
  const unitBy = Object.fromEntries(units.map(u => [u.code, u]));
  const lit = units.filter(u => u.shelves > 0);
  const hasBoard = (u, n) => n === 1 || !u.boards || !u.boards.length || u.boards.includes(n);
  const boardBelow = (u, n) => { while (n > 1 && !hasBoard(u, n)) n--; return n; };
  const gone = k => k.x === 0;                // taken out of Lending (a count of 0, v5.51): kept in the list so it can go back
  const onShelf = (code, n) => { const u = unitBy[code]; return kinds.filter(k => !gone(k) && k.u === code && u && u.shelves && boardBelow(u, k.s) === n); };
  const placeName = (code, n) => { const u = unitBy[code]; if (!u) return code; return u.shelves ? u.name + ', shelf ' + n : u.name + ' (ask at the desk)'; };
  const searchName = value => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();
  function itemMatches(query, withGone) {
    const words = query.split(/\s+/);
    return kinds.filter(item => (withGone || !gone(item)) && words.every(word => searchName(item.n).includes(word)));
  }
  function showItemMatches(tool, matches, onSelect) {
    const list = $(tool + '-matches');
    list.replaceChildren();
    const shown = matches.slice(0, 12);
    $(tool + '-search-status').textContent = !shown.length ? 'No matches. Try a shorter name.' :
      matches.length > shown.length ? 'Showing the first 12 matches. Type more to narrow the list.' : 'Select an item.';
    for (const item of shown) {
      const row = document.createElement('li'), button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.n;
      button.addEventListener('click', () => onSelect(item));
      row.append(button); list.append(row);
    }
  }

  document.querySelectorAll('.staff-form select').forEach(s => { if (/shelf/i.test(s.name) && !s.options.length) s.disabled = true; });   // nothing to pick until a unit is chosen
  function readPhoto(file) {                                         // shrink a phone photo to at most 1200 px, as a JPEG
    return new Promise((yes, no) => { const i = new Image(); i.onload = () => {
      const scale = Math.min(1, 1200 / Math.max(i.naturalWidth, i.naturalHeight)), w = Math.max(1, Math.round(i.naturalWidth * scale)), h = Math.max(1, Math.round(i.naturalHeight * scale));
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(i, 0, 0, w, h); URL.revokeObjectURL(i.src);
      const url = c.toDataURL('image/jpeg', 0.82), base64 = url.split(',')[1]; yes({ url, base64, w, h, kb: Math.round(base64.length * 0.75 / 1024) });
    }; i.onerror = () => no(Error('unreadable')); i.src = URL.createObjectURL(file); });
  }
  // ---- tabs
  const tabs = ['move', 'shelf', 'many', 'add', 'edit', 'kits', 'sync'];
  tabs.forEach(t => $('tab-' + t).addEventListener('click', () => {
    if ($('tab-' + t).getAttribute('aria-selected') === 'false' && playTimer) stopPlay(false);
    if (t !== 'sync' && stream) stopCamera();
    tabs.forEach(o => { $('tab-' + o).setAttribute('aria-selected', o === t); $('tool-' + o).hidden = o !== t; });
    $('code-out').hidden = !made.length || t === 'sync'; status.textContent = '';
  }));
  // ---- student staff access (Nov 21): managers choose which tools student staff can use. access.json holds what is
  // turned off; everything is on until a manager turns it off. Managers always see everything.
  const ACCESS = [['move', 'Move an item'], ['shelf', 'Move a shelf'], ['many', 'Move several'], ['add', 'Add an item'], ['edit', 'Edit an item'], ['remove', 'Take an item out of Lending (off unless a manager turns it on)'], ['kits', 'Edit kits'], ['sync', 'Sync website'], ['undo', 'Undo changes waiting for the console']];
  const OFF_BY_DEFAULT = ['remove'];          // risky enough that a manager has to switch it on for student staff
  let access = {};
  const allowed = k => isManager() || (OFF_BY_DEFAULT.includes(k) ? access[k] === true : access[k] !== false);
  function applyAccess() {
    tabs.forEach(t => { $('tab-' + t).hidden = !allowed(t); });
    $('edit-remove-box').hidden = !allowed('remove');
    const on = document.querySelector('.tool-tabs [aria-selected="true"]');
    if (on && on.hidden) { const first = tabs.find(t => allowed(t)); if (first) $('tab-' + first).click(); else tabs.forEach(o => { $('tool-' + o).hidden = true; }); }
    const off = ACCESS.filter(([k]) => !OFF_BY_DEFAULT.includes(k) && access[k] === false).map(([, n]) => n);
    $('access-note').hidden = isManager() || !off.length;
    $('access-note').textContent = 'Turned off for student staff by a Lending manager: ' + off.join(', ') + '.';
    $('access-list').innerHTML = ACCESS.map(([k, n]) => '<label class="access-row"><input type="checkbox" data-access="' + k + '"' + ((OFF_BY_DEFAULT.includes(k) ? access[k] === true : access[k] !== false) ? ' checked' : '') + '> ' + esc(n) + '</label>').join('');
    if (typeof drawCode === 'function' && made.length) drawCode();
    if (typeof drawNotFound === 'function') drawNotFound();
  }
  fetch('access.json?v=' + Date.now()).then(r => r.ok ? r.json() : {}).catch(() => ({})).then(a => { access = (a && a.student) || {}; applyAccess(); });
  addEventListener('rl-key-changed', () => applyAccess());
  $('access-save').addEventListener('click', async e => {
    if (!isManager()) { $('access-why').textContent = 'Only a Lending manager can change this.'; return; }
    const next = {}; $('access-list').querySelectorAll('[data-access]').forEach(b => { const k = b.dataset.access; if (OFF_BY_DEFAULT.includes(k)) { if (b.checked) next[k] = true; } else if (!b.checked) next[k] = false; });
    if (await publish({ 'access.json': { note: 'What student staff can use on the staff page. Anything set to false is turned off. Set by a manager on the staff page.', student: next } }, 'Student staff access changed (staff page)', e.target)) { access = next; applyAccess(); $('access-why').textContent = 'Saved. Student staff see the change the next time they open the staff page.'; }
  });

  // ---- shared pickers
  function unitOptions(select, list, blank) {
    select.innerHTML = (blank ? '<option value="">' + blank + '</option>' : '') + list.map(u => '<option value="' + esc(u.code) + '">' + esc(u.name) + (u.shelves ? '' : ' (no lights)') + '</option>').join('');
  }
  function shelfOptions(select, code, keep) {
    const u = unitBy[code];
    select.disabled = !u;
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
  let afterSend = false;                      // the camera was opened by this page right after the last code went to the console
  const made = []; let madeAt = -1;          // madeAt: which CODE (step) is on screen, see steps()
  // ---- one code for the whole list (console v5.44): RL:Q:<id>:<how many>:<check>:<change>*<change>*...
  // The console works through the changes in the order they are listed, so anything can ride together. A code holds
  // about 12 changes (the scanner has to read it off a phone); more than that become a second code. New items (RL:ADD)
  // are always scanned on their own, because the console asks for their barcode.
  const BIG_BODY = 240; let sendNonce = Math.floor(Math.random() * 250);
  const canBatch = c => /^RL:(MOVE|SHELF|COUNT|FOUND):/.test(c.code);
  function steps() {
    const out = []; let cur = null;
    for (const c of made) {
      if (!canBatch(c)) { out.push({ items: [c], code: c.code }); cur = null; continue; }
      const part = c.code.slice(3).toUpperCase();
      if (!cur || cur.body.length + part.length + 1 > BIG_BODY || cur.items.length === 64) { cur = { items: [], body: '' }; out.push(cur); }
      cur.items.push(c); cur.body += (cur.body ? '*' : '') + part;
    }
    for (const s of out) {
      if (s.code) continue;
      if (s.items.length === 1) { s.code = s.items[0].code; continue; }
      let x = 1, y = 0; for (let i = 0; i < s.body.length; i++) { x = (x + s.body.charCodeAt(i)) % 251; y = (y + x) % 251; }
      const check = (y << 8) | x, id = (check + sendNonce) % 255 + 1;
      s.code = 'RL:Q:' + id.toString(16).toUpperCase().padStart(2, '0') + ':' + s.items.length + ':' + check.toString(16).toUpperCase().padStart(4, '0') + ':' + s.body; s.big = true;
    }
    return out;
  }
  function drawCode() {
    const all = steps(); if (!all.length) { madeAt = -1; $('code-out').hidden = true; return; }
    madeAt = Math.max(0, Math.min(madeAt, all.length - 1));
    const s = all[madeAt], c = s.items[0];
    const qr = qrcode(0, 'M'); if (s.big) qr.addData(s.code, 'Alphanumeric'); else qr.addData(s.code); qr.make();
    $('qr').innerHTML = qr.createSvgTag({ cellSize: 8, margin: 4, scalable: true });
    $('qr').classList.toggle('qr-big', !!s.big);
    $('code-title').textContent = s.big ? s.items.length + ' changes in one code' : c.title;
    $('code-what').textContent = s.big ? 'One scan sends them all.' : c.what;
    $('code-how-last').textContent = s.big ? 'The console shows how many it saved.' : 'Check the screen, then press Select.';
    $('code-text').textContent = s.code; $('code-extra').textContent = s.big ? '' : c.extra || '';
    $('code-many').hidden = all.length < 2;
    $('code-count').textContent = 'Code ' + (madeAt + 1) + ' of ' + all.length;
    $('code-prev').disabled = madeAt === 0; $('code-next').disabled = madeAt === all.length - 1;
    $('code-done').textContent = all.length > 1 && madeAt < all.length - 1 ? 'The console took it: next code' : 'The console took it';
    $('code-done').hidden = !!playTimer;
    drawAll(all);
    $('code-out').hidden = false;
  }
  $('code-done').addEventListener('click', async e => {
    const all = steps(), s = all[madeAt]; if (!s) return;
    const ids = s.items.filter(c => c.id).map(c => c.id);
    if (ids.length && !(await markSent(ids, e.target))) return;
    for (const c of s.items) if (!c.id && made.includes(c)) made.splice(made.indexOf(c), 1);
    sendNonce++;
    const left = steps().length;
    drawCode();
    if (left) { status.textContent = 'Good. ' + left + (left === 1 ? ' more code' : ' more codes') + ' to show.'; return; }
    // nothing left to show the console: go straight on to the website, with this page's own camera
    afterSend = true; $('tab-sync').click(); $('sync-start').click();
    status.textContent = 'All sent. Now press Select on the console and point this phone at its code.';
    $('staff-status').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  // ---- send the whole list in one go (console v5.15): each code becomes a numbered part, RL:B:<id>:<part>/<parts>:<code>,
  // and the parts are shown one after another, round and round, until staff say the console has them all.
  let playTimer = null, playAt = 0, playParts = [], playSent = [], lastBatch = 0;
  // The console saves each part as it arrives, in whatever order the scanner catches them. So one round only holds changes
  // whose order cannot matter: the same item is not moved or counted twice, and a whole-shelf move never shares a round
  // with a single-item move or with another shelf move that touches the same shelf. Whatever is left goes in the next round.
  const touches = code => { const f = code.split(':'); return f[1] === 'MOVE' ? ['item ' + f[2], 'single'] : f[1] === 'COUNT' ? ['count ' + f[2]] : ['shelf ' + f[2], 'shelf ' + f[3], 'whole']; };
  function nextRound() {
    const round = [], used = new Set();
    for (const c of made.filter(canBatch)) {
      const t = touches(c.code);
      if (round.length === 64 || t.some(k => k === 'single' ? used.has('whole') : k === 'whole' ? used.has('single') : used.has(k))) break;
      t.forEach(k => used.add(k)); round.push(c);
    }
    return round;
  }
  function drawAll(all) {
    const box = $('code-all'), now = all[madeAt];
    box.hidden = !made.length || !!playTimer;
    if (box.hidden) return;
    const saved = made.filter(c => c.id).length;
    $('code-all-title').textContent = made.length + (made.length === 1 ? ' change' : ' changes') + ' waiting for the console';
    $('code-all-what').textContent = (saved ? (saved === made.length ? 'All saved on the website already. ' : saved + ' saved on the website already. ') + 'Undo takes a change back off the website too. ' : '') + (all.length > 1 ? 'Too many for one code. The ones in this code are in bold.' : '');
    $('code-all-go').hidden = !(now && now.big);
    $('code-all-list').innerHTML = made.map((c, i) => '<li data-code="' + esc(c.code) + '" class="' + (now.items.includes(c) ? 'in-code' : 'not-in-code') + '"><span><strong>' + esc(c.title) + '</strong> ' + esc(c.what) + (all.length > 1 && !now.items.includes(c) ? ' <em>(code ' + (all.findIndex(s => s.items.includes(c)) + 1) + ')</em>' : '') + (c.id ? ' <span class="saved-tag">On the website</span>' : '') + '</span>' + (c.id && !allowed('undo') ? '' : '<button type="button" class="remove-code" data-remove-code="' + i + '" aria-label="' + esc((c.id ? 'Undo ' : 'Remove ') + c.title) + '">' + (c.id ? 'Undo' : 'Remove') + '</button>') + '</li>').join('');
    $('code-clear').hidden = made.some(c => c.id) && !allowed('undo');
  }
  $('code-all-list').addEventListener('click', async e => {
    const button = e.target.closest('[data-remove-code]');
    if (!button) return;
    const index = Number(button.dataset.removeCode), c = made[index]; if (!c) return;
    if (c.id) { await undoSaved([c.id], button); return; }
    made.splice(index, 1);
    drawCode();
    const next = $('code-all-list').querySelectorAll('button');
    (next[Math.min(index, next.length - 1)] || $('tab-move')).focus();
    status.textContent = made.length ? 'Removed.' : 'The list is empty.';
  });
  $('code-add-more').addEventListener('click', () => {
    const tab = document.querySelector('.tool-tabs [aria-selected="true"]');
    tab.focus();
    tab.scrollIntoView({ block: 'center' });
  });
  async function stopPlay(finished) {
    if (playTimer) clearInterval(playTimer); playTimer = null;
    $('code-play').hidden = true; $('code-how').hidden = false;
    if (finished) {
      const ids = playSent.filter(c => c.id).map(c => c.id);
      for (let i = made.length - 1; i >= 0; i--) if (playSent.includes(made[i]) && !made[i].id) made.splice(i, 1);
      if (ids.length && !(await markSent(ids))) { playSent = []; drawCode(); return; }
      madeAt = made.length ? 0 : -1; sendNonce++; const left = made.filter(canBatch).length;
      status.textContent = left ? 'Sent. ' + left + ' more to send: the code below holds them.' : 'All sent. To bring the website up to date, press Select on the console and scan the code it shows with this phone.';
    }
    playSent = [];
    drawCode();
  }
  function showPart() {
    const p = playParts[playAt]; const qr = qrcode(0, 'M'); qr.addData(p.code); qr.make();
    $('qr').innerHTML = qr.createSvgTag({ cellSize: 8, margin: 4, scalable: true });
    $('code-title').textContent = 'Sending ' + playParts.length + ' changes'; $('code-what').textContent = p.title + ': ' + p.what;
    $('code-text').textContent = p.code; $('code-extra').textContent = '';
    $('code-play-count').textContent = 'Showing ' + (playAt + 1) + ' of ' + playParts.length;
  }
  $('code-all-go').addEventListener('click', () => {
    const ok = nextRound();
    // each round gets a number the console has not just seen (it tells a new round from a repeat by this number), remembered across reloads
    let last = 0; try { last = Number(localStorage.getItem('rl-batch')) || 0; } catch (e) { }
    if (!(last >= 1 && last <= 255)) last = lastBatch;
    const idNumber = (last + Math.floor(Math.random() * 254)) % 255 + 1; lastBatch = idNumber; try { localStorage.setItem('rl-batch', String(idNumber)); } catch (e) { }
    const id = idNumber.toString(16).padStart(2, '0');
    playParts = ok.map((c, i) => ({ code: 'RL:B:' + id + ':' + (i + 1) + '/' + ok.length + ':' + c.code.slice(3), title: c.title, what: c.what }));
    const long = playParts.find(p => p.code.length > 71); if (long) { status.textContent = 'One change is too long to send in a batch: ' + long.title + '. Show that one on its own.'; return; }
    playSent = ok; playAt = 0; $('code-all').hidden = true; $('code-many').hidden = true; $('code-done').hidden = true; $('code-play').hidden = false; $('code-how').hidden = true; $('qr').classList.remove('qr-big');
    showPart(); playTimer = setInterval(() => { playAt = (playAt + 1) % playParts.length; showPart(); }, 2300);   // the scanner ignores a repeat of the same code within 2 seconds
    $('code-out').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('code-play-done').addEventListener('click', () => stopPlay(true));
  $('code-play-stop').addEventListener('click', () => stopPlay(false));
  function showCode(code, title, what, extra, reveal = true) {
    if (code.length >= MAX_CODE) { status.textContent = 'That code is too long for the scanner (' + code.length + ' characters). Use a shorter name.'; $('code-out').hidden = true; return; }
    if (playTimer) stopPlay(false);
    $('ack').hidden = true;                    // an answer for the console from an earlier sync is no longer the thing to show
    let c = made.find(m => m.code === code);
    if (!c) { c = { code, title, what, extra }; made.push(c); }
    madeAt = canBatch(c) ? 0 : steps().findIndex(s => s.items.includes(c));   // codes are sent in order, so the first one is the one to show
    status.textContent = made.length > 1 ? 'Added. ' + made.length + ' changes on the list.' : '';
    if (reveal) {
      drawCode();
      $('code-out').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  $('code-prev').addEventListener('click', () => { if (madeAt > 0) { madeAt--; drawCode(); } });
  $('code-next').addEventListener('click', () => { madeAt++; drawCode(); });
  $('code-clear').addEventListener('click', async e => {
    if (playTimer) stopPlay(false);
    const ids = made.filter(c => c.id).map(c => c.id);
    if (ids.length && !confirm('Undo ' + (ids.length === 1 ? 'this change' : 'all ' + ids.length + ' changes') + ' on the website too? The console never got ' + (ids.length === 1 ? 'it.' : 'them.'))) return;
    if (ids.length && !(await undoSaved(ids, e.target))) return;
    for (let i = made.length - 1; i >= 0; i--) if (!made[i].id) made.splice(i, 1);
    madeAt = -1; drawCode(); status.textContent = 'The list is empty.';
  });

  // ---- move a thing
  const mf = $('move-form');
  unitOptions(mf.elements.unit, units, 'Choose a unit');
  const pickedItem = () => kinds.find(k => !gone(k) && searchName(k.n) === searchName(mf.elements.thing.value));
  mf.elements.thing.addEventListener('input', () => {
    const k = pickedItem();
    const query = searchName(mf.elements.thing.value);
    $('move-search-results').hidden = !query || !!k;
    if (query && !k) showItemMatches('move', itemMatches(query), item => {
      mf.elements.thing.value = item.n;
      mf.elements.thing.dispatchEvent(new Event('input', { bubbles: true }));
      mf.elements.unit.focus({ preventScroll: true });
    });
    else $('move-search-status').textContent = '';
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
    saveChanges([{ code: 'RL:MOVE:' + k.h + ':' + u + '-' + s, title: 'Move ' + k.n, what: 'From ' + placeName(k.u, k.s) + ' to ' + placeName(u, unitBy[u].shelves ? boardBelow(unitBy[u], s) : 0) + '.' }], e.submitter).then(ok => { if (ok) mf.elements.thing.dispatchEvent(new Event('input', { bubbles: true })); });
  });

  // ---- move several things: tick what leaves a shelf, pick where it goes, and each becomes a move on the list
  const yf = $('many-form');
  unitOptions(yf.elements.fromUnit, lit, 'Choose a unit'); unitOptions(yf.elements.toUnit, units, 'Choose a unit');
  const manyList = () => {
    const c = yf.elements.fromUnit.value, n = Number(yf.elements.fromShelf.value), things = c && n ? onShelf(c, boardBelow(unitBy[c], n)) : [];
    $('many-list').innerHTML = !c || !n ? '' : !things.length ? '<p class="tool-note">This shelf is empty on this copy of the room.</p>' :
      '<p class="tool-note">' + things.length + ' items on this shelf. <button type="button" class="link-button" id="many-all">Select all</button> <button type="button" class="link-button" id="many-none">Clear selection</button></p>' +
      things.map(k => '<label class="many-item"><input type="checkbox" name="pick" value="' + esc(k.h) + '"> ' + esc(k.n) + (k.x > 1 ? ' <small>(' + k.x + ' copies)</small>' : '') + '</label>').join('');
    const set = on => $('many-list').querySelectorAll('input').forEach(i => { i.checked = on; });
    if ($('many-all')) { $('many-all').addEventListener('click', () => set(true)); $('many-none').addEventListener('click', () => set(false)); }
  };
  yf.elements.fromUnit.addEventListener('change', () => { shelfOptions(yf.elements.fromShelf, yf.elements.fromUnit.value); manyList(); });
  yf.elements.fromShelf.addEventListener('change', manyList);
  yf.elements.toUnit.addEventListener('change', () => shelfOptions(yf.elements.toShelf, yf.elements.toUnit.value));
  yf.addEventListener('submit', e => {
    e.preventDefault();
    const picked = [...$('many-list').querySelectorAll('input:checked')].map(i => kinds.find(k => k.h === i.value)).filter(Boolean);
    const u = yf.elements.toUnit.value, s = Number(yf.elements.toShelf.value || 0);
    if (!picked.length) { status.textContent = 'Tick at least one thing.'; return; }
    if (!unitBy[u]) { status.textContent = 'Choose where they go.'; return; }
    const dest = unitBy[u].shelves ? boardBelow(unitBy[u], s) : 0, from = yf.elements.fromUnit.value;
    if (u === from && dest === boardBelow(unitBy[from], Number(yf.elements.fromShelf.value))) { status.textContent = 'That is the shelf they are already on.'; return; }
    saveChanges(picked.map(k => ({ code: 'RL:MOVE:' + k.h + ':' + u + '-' + s, title: 'Move ' + k.n, what: 'From ' + placeName(k.u, k.s) + ' to ' + placeName(u, dest) + '.' })), e.submitter).then(ok => { if (ok) manyList(); });
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
    saveChanges([{ code: 'RL:SHELF:' + a + '-' + an + ':' + b + '-' + bn + (swap ? ':SWAP' : ''), title: swap ? 'Swap two shelves' : 'Move a whole shelf',
      what: (swap ? 'Swap ' : 'Move everything on ') + placeName(a, boardBelow(unitBy[a], an)) + (swap ? ' with ' : ' to ') + placeName(b, bnb) + '.' }], e.submitter).then(ok => { if (ok) shelfNow(); });
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
    const same = kinds.find(k => k.n.toLowerCase() === name.toLowerCase());
    if (same && gone(same)) return 'That item was taken out of Lending. To bring it back, find it under Edit an item and press Put it back in Lending.';
    if (same) return 'That item is already in the list. Move it instead.';
    if (kinds.some(k => k.h === nameCode(name))) return 'That name clashes with another item’s code. Add a word to the name.';
    if (f.type.value === '') return 'Choose a category and type.';
    if (!unitBy[f.unit.value]) return 'Choose where it goes.';
    const n = Number(f.copies.value); if (!Number.isInteger(n) || n < 1 || n > 250) return 'Copies must be a whole number from 1 to 250.';
    if (addCode().length >= MAX_CODE) return 'The name is too long for the code. Shorten it.';
    return '';
  }
  // Both buttons put the item on the website straight away and add its console code to the list. The second also saves
  // the guide-page details filled in below (photo, description, checklists).
  const ADD_HOW = 'On the console: scan this, type the PIN, scan the item’s barcode sticker (or skip), then press Select.';
  let addPhoto = null;
  async function addItem(button, withGuide) {
    // added a moment ago with the first button, details filled in after: this only saves the details
    const h = nameCode(af.elements.name.value.trim()), again = withGuide && kinds.some(k => k.h === h) && pend.waiting.some(e => e.item && e.item.h === h);
    const problem = again ? '' : checkAdd(); if (problem) { status.textContent = problem; return; }
    const f = af.elements, name = f.name.value.trim(), t = types[Number(f.type.value)], u = unitBy[f.unit.value], s = Number(f.shelf.value || 0);
    if (withGuide && f.manual.value.trim() && !/^https:\/\//.test(f.manual.value.trim())) { status.textContent = 'The manual link has to start with https://'; return; }
    const item = { n: name, c: CAT_ORDER[t[0]], t: t[1], x: Number(f.copies.value), w: placeName(u.code, s && u.shelves ? boardBelow(u, s) : 0), in: true, d: '', h: nameCode(name), u: u.code, s };
    let blob;
    if (withGuide) {
      item.d = f.description.value.trim();
      const need = lines(f.need.value), start = lines(f.start.value), tips = lines(f.tips.value);
      if (need.length) item.need = need; if (start.length) item.start = start; if (tips.length) item.tips = tips;
      if (f.manual.value.trim()) item.r = [['Official maker instructions', f.manual.value.trim()]];
      if (addPhoto) { const path = 'photos/' + item.h + '-' + Date.now().toString(36) + '.jpg'; item.p = { url: path, w: addPhoto.w, h: addPhoto.h, own: true, artist: f.credit.value.trim() || 'IDeATe Lending staff' }; blob = { [path]: addPhoto.base64 }; }
      else if (f.photo.value.trim()) item.p = { url: f.photo.value.trim(), page: f.crediturl.value.trim() || '#', artist: f.credit.value.trim() || 'IDeATe Lending', license: 'Photo source' };
    }
    const ok = again ? await saveChanges([], button, { needKey: true, blobs: blob, message: 'Guide page for ' + name + ' (staff page)', edit: fd => { const k = fd.kinds.find(x => x.h === h); if (k) for (const key of ['d', 'need', 'start', 'tips', 'r', 'p']) if (item[key] !== undefined) k[key] = item[key]; } })
      : await saveChanges([{ code: addCode(), item, title: 'Add ' + name, what: CAT_ORDER[t[0]] + ' / ' + t[1] + ', ' + f.copies.value + (f.copies.value === '1' ? ' copy' : ' copies') + ', goes to ' + placeName(u.code, s && u.shelves ? boardBelow(u, s) : 0) + '.', extra: ADD_HOW }], button, { needKey: withGuide, blobs: blob, message: 'Add ' + name + ' (staff page, waiting for the console)' });
    if (!ok) return;
    if (withGuide) { addPhoto = null; f.photofile.value = ''; $('add-photo-note').textContent = ''; }
    else document.querySelector('.add-extra').open = true;
  }
  af.addEventListener('submit', e => { e.preventDefault(); addItem(e.submitter, false); });
  af.elements.photofile.addEventListener('change', async () => {
    addPhoto = null; if (!af.elements.photofile.files[0]) return;
    try { addPhoto = await readPhoto(af.elements.photofile.files[0]); $('add-photo-note').textContent = 'Photo ready (' + addPhoto.kb + ' KB).'; }
    catch (err) { af.elements.photofile.value = ''; $('add-photo-note').textContent = 'That file could not be read as a picture. Try a JPEG or PNG.'; }
  });
  $('add-publish').addEventListener('click', e => addItem(e.target, true));

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
  const fromAddress = text => { const at = text.indexOf('RLSYNC~'); if (at < 0 || text.indexOf('#') < 0) return text; try { return decodeURIComponent(text.slice(at).replace(/~/g, '|').replace(/!/g, '\n')); } catch (e) { return text; } };
  // Every scan with the camera opens this page afresh, so the pages scanned so far are kept on the phone for half an hour.
  const KEEP = 'rl-sync-pages';
  const remember = () => { try { localStorage.setItem(KEEP, JSON.stringify({ at: Date.now(), pageCount, pages })); } catch (e) {} };
  try { const kept = JSON.parse(localStorage.getItem(KEEP) || 'null'); if (kept && Date.now() - kept.at < 30 * 60 * 1000) { pageCount = kept.pageCount; Object.assign(pages, kept.pages); } } catch (e) {}
  function readPage(text) {
    const lines = fromAddress(text).replace(/\r/g, '').split('\n');
    const head = lines[0].split('|');
    if (head[0] !== 'RLSYNC') return false;
    const p = Number(head[1]), n = Number(head[2]), total = Number(head[3]);
    const from = head.length >= 6 ? Number(head[4]) : 0, tag = head.length >= 6 ? Number(head[5]) : null;   // console v5.46: only the changes after `from`; `tag` is where they end
    const epoch = head.length >= 7 && Number.isInteger(Number(head[6])) ? Number(head[6]) : 0;                 // console v5.51: how many times it has tidied up (its list starts again each time)
    if (head.length >= 6 && !(Number.isInteger(from) && Number.isInteger(tag) && from >= 0 && tag >= from)) return false;
    if (![p, n, total].every(Number.isInteger) || p < 1 || p > n || n > 255 || total < 0 || n > Math.max(1, total)) return false;
    if (pageCount && (n !== pageCount || Object.values(pages).some(x => x.total !== total || x.tag !== tag))) { Object.keys(pages).forEach(k => delete pages[k]); }   // a different list: start over
    pageCount = n; pages[p] = { total, tag, epoch, lines: lines.slice(1).filter(Boolean) };
    remember();
    showPages();
    if (Object.keys(pages).length === pageCount) {
      stopCamera();
      const all = [];
      for (let i = 1; i <= pageCount; i++) all.push(...pages[i].lines);
      Object.keys(pages).forEach(k => delete pages[k]);
      pageCount = 0;
      try { localStorage.removeItem(KEEP); } catch (e) {}
      if (all.length !== total) {
        status.textContent = 'The scanned pages do not match. Scan all pages again, starting at page 1.';
        return false;
      }
      apply(all.map(l => l.split('|')), from, tag, epoch).catch(() => { status.textContent = 'Could not load the website\'s files. Check the internet connection and scan again.'; });
    }
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
      const camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if ($('tab-sync').getAttribute('aria-selected') !== 'true') {
        camera.getTracks().forEach(track => track.stop());
        return;
      }
      stream = camera;
      video.srcObject = stream; video.hidden = false; await video.play();
      scanning = true; cameFromConsole = true; $('sync-start').hidden = true; $('sync-stop').hidden = false; if (!afterSend) status.textContent = ''; afterSend = false; tick();
    } catch (e) { status.textContent = afterSend ? 'All sent. Now press Select on the console and scan its code with this phone\'s camera.' : 'The camera did not start. Allow camera access, or point the phone\'s own camera at the console.'; afterSend = false; }
  });
  $('sync-stop').addEventListener('click', stopCamera);
  $('sync-use-paste').addEventListener('click', () => {
    $('tab-sync').click(); $('tool-sync').scrollIntoView({ block: 'start' });
    const text = $('sync-paste').value.replace(/\r/g, '');
    if (text.startsWith('RLSYNC')) { text.split(/\n(?=RLSYNC)/).forEach(readPage); return; }
    apply(text.split('\n').filter(l => l.trim() && !l.startsWith('@')).map(l => l.split(/\t|\|/)));
  });

  let outData = null, outRoom = null, outPend = null, outBase = null;
  // The console's list is EVERY change since the Nov 16 setup, so the website is rebuilt from scratch each time:
  // the Nov 16 backup, then every line in order. That way a change taken back on the console disappears here too, and an
  // empty list (after Start over on the console) puts the website back to the setup. What only the website knows about an
  // item (photo, manual link, description) is carried over.
  let baseline = null, autoTimer = 0, cameFromConsole = false;
  $('sync-auto-cancel').addEventListener('click', () => { clearInterval(autoTimer); $('sync-auto').hidden = true; status.textContent = 'Not saved. Press Save when you are ready.'; });
  // The starting point the console's list is played over. To begin with it is the Nov 16 setup (backup/2026-11-16).
  // Each time the console tidies up (folds its changes into its own files and empties its list), the website takes
  // its own state at that moment as the new starting point (base/data.json, base/room.json) and remembers which
  // tidy-up it belongs to (synced.epoch in room.json).
  const loadBaseline = async epoch => {
    if (baseline && baseline.epoch === epoch) return baseline.files;
    const files = epoch ? await Promise.all([latest('base/data.json', g => g && Array.isArray(g.kinds)), latest('base/room.json', g => g && Array.isArray(g.units))])
      : await Promise.all([fetch('backup/2026-11-16/data.json?x=' + Date.now()).then(x => x.json()), fetch('backup/2026-11-16/room.json?x=' + Date.now()).then(x => x.json())]);
    if (!files[0] || !files[1]) throw Error('files');
    baseline = { epoch, files }; return files;
  };
  const baseName = r => r && r.synced && r.synced.epoch ? 'the last tidy-up' + (r.synced.baseAt ? ' (' + new Date(r.synced.baseAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ')' : '') : 'the Nov 16 setup';
  // ---- the answer back to the console (v5.46). The console only counts changes as "on the website" when it scans this.
  function showAck(code, title, what) {
    const qr = qrcode(0, 'M'); qr.addData(code); qr.make();
    $('ack-qr').innerHTML = qr.createSvgTag({ cellSize: 8, margin: 4, scalable: true }); $('ack-qr').dataset.code = code;
    $('ack-title').textContent = title; $('ack-what').textContent = what; $('ack').hidden = false;
    $('ack').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const ackGot = tag => showAck('RL:GOT:' + tag, 'Last step: show this to the console', 'Hold this up to the console\'s scanner so it knows the website is updated.');
  $('ack-done').addEventListener('click', () => { $('ack').hidden = true; });
  let syncTag = null;
  async function apply(lines, from = 0, tag = null, epoch = null) {   // epoch null: a pasted list, taken as following the website's own starting point
    syncTag = tag; $('ack').hidden = true; outBase = null;
    const allLines = lines.length;
    // Straight from the repository when it answers: the public pages lag about a minute behind a save, and a second
    // sync inside that minute would otherwise be judged against the website as it was before the first one.
    const [liveData, liveRoom, livePend] = await Promise.all([latest('data.json', g => g && Array.isArray(g.kinds)), latest('room.json', g => g && Array.isArray(g.units)), readPending()]);
    if (!liveData || !liveRoom) throw Error('files');
    const siteEpoch = (liveRoom.synced && liveRoom.synced.epoch) || 0; if (epoch === null) epoch = siteEpoch;
    const tidied = epoch !== siteEpoch;    // the console tidied up since the website last synced
    const have = tidied ? 0 : liveRoom.synced && Number.isInteger(liveRoom.synced.bytes) ? liveRoom.synced.bytes : -1;   // how far into the console's list the website already is
    const adding = from > 0;                    // the console sent only what is new: add it to the website as it is now
    let newBase = null;
    if (tidied) {
      // The console only tidies up once the website has its whole list, so the website as it is now (without the
      // changes still waiting for the console) is exactly what the console folded into its files: the new starting point.
      const bd = JSON.parse(JSON.stringify(liveData)), br = JSON.parse(JSON.stringify(liveRoom));
      rewind(bd, br, JSON.parse(JSON.stringify(livePend.waiting)));
      const names = Object.fromEntries(br.units.map(u => [u.code, u.name])), bub = Object.fromEntries(br.units.map(u => [u.code, u]));
      for (const k of bd.kinds) { const u = bub[k.u]; k.w = u && u.shelves && k.s ? names[k.u] + ', shelf ' + boardBelowIn(u, k.s) : (names[k.u] || k.u); k.in = !!(u && u.shelves && k.s); }
      delete br.synced; newBase = [bd, br];
    }
    if (adding) {
      // The website may already hold the first few of these (saved, but the console never got the answer). Each line
      // is its letters plus the two that end a line on the console's card, so they can be counted off exactly.
      let skip = have - from, at = 0; const enc = new TextEncoder();
      while (have >= from && have <= tag && skip > 0 && at < lines.length) { skip -= enc.encode(lines[at].join('\t')).length + 2; at++; }
      if (have < from || have > tag || skip !== 0) {
        clearInterval(autoTimer); $('sync-auto').hidden = true; $('sync-result').hidden = true;
        status.textContent = 'The website and the console have lost track of each other. Nothing changed.';
        showAck('RL:RESEND', 'Show this to the console', 'Show this to the console and type the PIN. Then scan the code the console shows.');
        return;
      }
      lines = lines.slice(at);
      if (!lines.length) {
        clearInterval(autoTimer); $('sync-auto').hidden = true; $('sync-result').hidden = true;
        status.textContent = 'The website already has ' + (allLines === 1 ? 'that change' : 'those ' + allLines + ' changes') + '. Nothing to save.';
        ackGot(tag); return;
      }
    }
    const [baseData, baseRoom] = adding ? [liveData, liveRoom] : newBase || await loadBaseline(epoch);
    const d = JSON.parse(JSON.stringify(baseData)), r = JSON.parse(JSON.stringify(baseRoom));
    const nowBy = Object.fromEntries((adding ? liveData.kinds : kinds).map(k => [k.h, k]));
    // changes saved on the website first: take them off (the website as it is holds them), then put back the ones the
    // console still does not have, on top of its list
    const waiting = JSON.parse(JSON.stringify(livePend.waiting));
    if (tidied) waiting.forEach(e => { e.since = 0; });   // the console's list starts again at 0: anything still waiting can turn up anywhere in it
    if (adding) rewind(d, r, waiting);
    else waiting.forEach(e => { if (e.item && nowBy[e.item.h]) e._back = JSON.parse(JSON.stringify(nowBy[e.item.h])); });
    const guideFields = ['p', 'r', 'd', 'g', 'need', 'start', 'tips'];
    for (const k of d.kinds) { const now = nowBy[k.h]; if (!now) continue; for (const key of guideFields) { if (now[key] !== undefined) k[key] = JSON.parse(JSON.stringify(now[key])); else delete k[key]; } }
    const ub = Object.fromEntries(r.units.map(u => [u.code, u]));
    const firstText = lines.length ? lines[0].join('|') : '';
    const start = 0;
    const count = { I: 0, S: 0, X: 0, U: 0, B: 0, A: 0, C: 0, R: 0, N: 0, F: 0 }, notes = [];
    const byH = Object.fromEntries(d.kinds.map(k => [k.h, k]));
    const inRange = (s, lo, hi) => s >= Number(lo) && s <= Number(hi);
    for (const f of lines.slice(start)) {
      const t = f[0].length === 1 ? f[0].toUpperCase() : 'I';
      if (t === 'I') { const k = byH[f[0].toLowerCase()]; if (k) { k.u = f[1]; k.s = Number(f[2]); delete k.nf; count.I++; } else notes.push('Not on the website yet: item ' + f[0]); }
      else if (t === 'N' && f[1] === '*') { d.kinds.forEach(k => { delete k.nf; }); count.F++; }   // the whole not-seen list cleared
      else if (t === 'N') { const k = byH[(f[1] || '').toLowerCase()]; if (k) { if (f[2] === '1') { k.nf = 1; count.N++; } else { delete k.nf; count.F++; } } }   // an audit: not found (1), found again (0)
      else if (t === 'S') { d.kinds.forEach(k => { if (k.u === f[1] && inRange(k.s, f[2], f[3])) { k.u = f[4]; k.s = Number(f[5]); } }); count.S++; }
      else if (t === 'X') { d.kinds.forEach(k => { if (k.u === f[1] && inRange(k.s, f[2], f[3])) { k.u = f[4]; k.s = Number(f[5]); } else if (k.u === f[4] && inRange(k.s, f[5], f[6])) { k.u = f[1]; k.s = Number(f[2]); } }); count.X++; }
      else if (t === 'U') { const a = ub[f[1]], b = ub[f[2]]; if (a && b) { for (const key of ['first', 'shelves', 'rect']) [a[key], b[key]] = [b[key], a[key]]; count.U++; } }
      else if (t === 'B') { const u = ub[f[1]], n = Number(f[2]); if (u) { const set = new Set(u.boards && u.boards.length ? u.boards : [...Array(u.shelves).keys()].map(i => i + 1)); if (f[3] === '1') set.add(n); else if (n > 1) set.delete(n); u.boards = [...set].sort((x, y) => x - y); count.B++; } }
      else if (t === 'C') { const k = byH[(f[1] || '').toLowerCase()], n = Number(f[2]); if (k && Number.isInteger(n) && n >= 0) { k.x = n; if (n === 0) { count.R++; delete k.nf; } else count.C++; } }
      else if (t === 'A') {
        const name = f[3], h = nameCode(name);
        if (!byH[h]) { const now = nowBy[h] || {}; const k = { n: name, c: CAT_ORDER[Number(f[1])] || 'Cables & More', t: f[2], x: Number(f[6]) || 1, in: true, d: '', h, u: f[4], s: Number(f[5]) }; for (const key of guideFields) if (now[key] !== undefined) k[key] = now[key]; d.kinds.push(k); byH[h] = k; count.A++; }
      }
    }
    const enc2 = new TextEncoder(); let off = adding ? have : 0;
    const startAt = lines.map(f => { const o = off; off += enc2.encode(f.join('\t')).length + 2; return o; });
    const ubNow = uBy(r), done = [], back = [], still = [];
    waiting.forEach((e, i) => {
      if (onConsole(e, d, ubNow, lines, startAt, waiting.slice(i + 1))) { done.push(e); return; }
      if (e.sent && tag !== null) { e.sent = false; delete e.sentAt; back.push(e); }
      still.push(e);
    });
    replay(d, r, still);
    const at = stamp();
    outPend = tidy({ waiting: still, history: [...back.map(e => ({ at, title: e.title, what: e.what, did: 'back', ...byMe() })), ...done.map(e => ({ at, title: e.title, what: e.what, did: 'console', ...byMe() })), ...livePend.history] });
    const names = Object.fromEntries(r.units.map(u => [u.code, u.name]));
    for (const k of d.kinds) { const u = ub[k.u]; k.w = u && u.shelves && k.s ? names[k.u] + ', shelf ' + boardBelowIn(u, k.s) : (names[k.u] || k.u); k.in = !!(u && u.shelves && k.s); }
    d.kinds.sort((a, b) => a.n.localeCompare(b.n));
    r.synced = { lines: lines.length, first: firstText, at: new Date().toISOString() };
    if (epoch) { r.synced.epoch = epoch; r.synced.baseAt = tidied ? r.synced.at : (liveRoom.synced && liveRoom.synced.baseAt) || r.synced.at; }
    if (newBase) outBase = { 'base/data.json': newBase[0], 'base/room.json': newBase[1] };
    if (tag !== null) r.synced.bytes = tag;       // how far into the console's list the website now is
    // the shelves whose things changed with this sync, so the staff map can show them in blue
    const changed = new Map(), mark = (code, n) => { const u = ub[code]; if (u && u.shelves && n) { const b = boardBelowIn(u, n); changed.set(code + '-' + b, [code, b]); } };
    for (const k of d.kinds) { const b = nowBy[k.h]; if (!b || b.u !== k.u || b.s !== k.s || b.x !== k.x) { mark(k.u, k.s); if (b) mark(b.u, b.s); } }
    const byEnd = Object.fromEntries(d.kinds.map(k => [k.h, k]));                // and the ones changed on the website first that the console now has
    done.forEach(e => { ((e.undo && e.undo.items) || []).forEach(([h, u, n]) => { mark(u, n); if (byEnd[h]) mark(byEnd[h].u, byEnd[h].s); }); if (e.item && byEnd[e.item.h]) mark(byEnd[e.item.h].u, byEnd[e.item.h].s); });
    r.synced.changed = [...changed.values()].slice(0, 60);
    outPend.history.unshift({ at, title: 'Website synced with the console', what: (lines.length ? lines.length + (lines.length === 1 ? ' change' : ' changes') + ' from the console' : 'No changes from the console') + (changed.size ? ', ' + changed.size + (changed.size === 1 ? ' shelf' : ' shelves') + ' changed.' : '.'), did: 'sync', ...byMe() });
    r.source = 'Room Locator console, changes brought over on ' + new Date().toISOString().slice(0, 10);
    outData = d; outRoom = r;
    const list = [];
    const moved = d.kinds.filter(k => { const b = nowBy[k.h]; return !b || b.u !== k.u || b.s !== k.s || b.x !== k.x || b.w !== k.w || !!b.nf !== !!k.nf; }).length + kinds.filter(k => !byH[k.h]).length;
    const layoutChanged = r.units.some(u => {
      const current = unitBy[u.code];
      return !current || ['first', 'shelves', 'rect', 'boards'].some(key => JSON.stringify(u[key]) !== JSON.stringify(current[key]));
    });
    const needsSave = moved > 0 || layoutChanged || (tag !== null && have !== tag) || done.length > 0 || back.length > 0;
    list.push(adding ? 'The console has ' + lines.length + (lines.length === 1 ? ' new change' : ' new changes') + '. Saving adds ' + (lines.length === 1 ? 'it' : 'them') + ' to the website.' : lines.length ? 'The console has ' + lines.length + (lines.length === 1 ? ' change' : ' changes') + ' since ' + (tidied ? 'its tidy-up' : baseName(liveRoom)) + '. Saving makes the website match it exactly.' : tidied ? 'The console has no changes since its tidy-up. The website already matches it.' : 'The console has no changes. Saving puts the website back to ' + baseName(liveRoom) + '.');
    if (tidied) list.push(epoch === siteEpoch + 1 ? 'The console tidied up: it folded its changes into its own item list. The website now starts from this point too, and Start over goes back to here.' : 'The console and the website disagree about the last tidy-up. The website takes its own item list as the starting point: check a few shelves after saving.');
    if (moved) list.push(moved + (moved === 1 ? ' item page will change.' : ' item pages will change.'));
    if (layoutChanged) list.push('The room map will change.');
    if (!needsSave) list.push('The website already matches the console.');
    if (count.C) list.push(count.C + (count.C === 1 ? ' count changed' : ' counts changed'));
    if (count.R) list.push(count.R + (count.R === 1 ? ' item taken out of Lending' : ' items taken out of Lending'));
    if (count.N) list.push(count.N + (count.N === 1 ? ' thing not seen in an audit: it goes on the Not seen list' : ' things not seen in an audit: they go on the Not seen list'));
    if (count.F) list.push(count.F + (count.F === 1 ? ' thing found again' : ' things found again'));
    if (count.I) list.push(count.I + (count.I === 1 ? ' thing moved' : ' things moved'));
    if (count.S) list.push(count.S + (count.S === 1 ? ' whole shelf moved' : ' whole shelves moved'));
    if (count.X) list.push(count.X + (count.X === 1 ? ' pair of shelves swapped' : ' pairs of shelves swapped'));
    if (count.U) list.push(count.U + (count.U === 1 ? ' pair of units traded places' : ' pairs of units traded places'));
    if (count.B) list.push(count.B + (count.B === 1 ? ' shelf board put in or taken out' : ' shelf boards put in or taken out'));
    if (count.A) list.push(count.A + (count.A === 1 ? ' new item (its guide page starts plain; add details later)' : ' new items (their guide pages start plain; add details later)'));
    notes.forEach(n => list.push(n));
    if (done.length) list.push(done.length + (done.length === 1 ? ' change made on the website first is' : ' changes made on the website first are') + ' now on the console too.');
    if (back.length) list.push(back.length + (back.length === 1 ? ' change the console did not save is' : ' changes the console did not save are') + ' back on the list to show it. Check the console\'s Recent changes first.');
    if (still.length - back.length > 0) list.push((still.length - back.length) + (still.length - back.length === 1 ? ' change saved on the website is' : ' changes saved on the website are') + ' still waiting for the console. The website keeps ' + (still.length - back.length === 1 ? 'it.' : 'them.'));
    $('sync-summary').innerHTML = list.map(x => '<li>' + esc(x) + '</li>').join('');
    $('sync-result').hidden = false;
    // Scanned straight from the console on a device that has the key: save by itself after a 5-second count, so keeping
    // the website in step is one scan and nothing else. Cancel stops it; nothing to change means nothing is saved.
    clearInterval(autoTimer); $('sync-auto').hidden = true;
    if (cameFromConsole && !needsSave) { $('home-done').textContent = 'The website already matches the console.' + (tag !== null ? '' : ' Nothing to do.'); $('home-done').hidden = false; if (tag !== null) ackGot(tag); }
    if (cameFromConsole && needsSave && keep.get('rl-key')) {
      let left = 5; $('sync-auto').hidden = false;
      const tick = () => { $('sync-auto-text').textContent = 'Saving to the website in ' + left + '...'; if (left-- <= 0) { clearInterval(autoTimer); $('sync-auto').hidden = true; $('sync-publish').click(); } };
      tick(); autoTimer = setInterval(tick, 1000);
    }
  }
  const boardBelowIn = (u, n) => { while (n > 1 && u.boards && u.boards.length && !u.boards.includes(n)) n--; return n; };

  // ---- changes saved to the website first (pending.json)
  // A move, a count or a new item goes on the website the moment it is made, and waits in pending.json for the console.
  // Any device shows everything that is waiting as one code, so changes can be made at home and scanned in at the console
  // later. When the console sends its list back, each change it now has is ticked off; the rest are put back on top of the
  // console's list, so a sync never wipes a change the console has not had yet. Each change keeps what it replaced
  // (`undo`), so one can be taken back off the website, in any order, until the console has it.
  const uBy = r => Object.fromEntries(r.units.map(u => [u.code, u]));
  const boardOf = (ub, code, n) => ub[code] && ub[code].shelves ? boardBelowIn(ub[code], n) : n;
  function placeIn(r, k) { const u = uBy(r)[k.u]; k.w = u && u.shelves && k.s ? u.name + ', shelf ' + boardBelowIn(u, k.s) : (u ? u.name : k.u); k.in = !!(u && u.shelves && k.s); }
  function doEntry(d, r, e) {
    const f = e.code.split(':'), by = Object.fromEntries(d.kinds.map(k => [k.h, k])), ub = uBy(r);
    if (f[1] === 'MOVE') { const k = by[f[2]]; if (!k) return null; const [u, s] = f[3].split('-'), undo = { items: [[k.h, k.u, k.s]] }; if (k.nf) { undo.nf = [k.h]; delete k.nf; } k.u = u; k.s = Number(s); placeIn(r, k); return undo; }   // a move says where it is: off the not-found list
    if (f[1] === 'FOUND' && f[2] === 'ALL') { const undo = { nf: d.kinds.filter(k => k.nf).map(k => k.h) }; d.kinds.forEach(k => { delete k.nf; }); return undo; }
    if (f[1] === 'FOUND') { const k = by[f[2]]; if (!k) return null; const undo = { nf: k.nf ? [k.h] : [] }; delete k.nf; return undo; }
    if (f[1] === 'COUNT') { const k = by[f[2]]; if (!k) return null; const undo = { count: [k.h, k.x] }; k.x = Number(f[3]); return undo; }
    if (f[1] === 'SHELF') {
      const [a, an] = f[2].split('-'), [b, bn] = f[3].split('-'), swap = f[4] === 'SWAP', from = boardOf(ub, a, Number(an)), to = boardOf(ub, b, Number(bn)), items = [];
      for (const k of d.kinds) {
        if (k.u === a && boardOf(ub, a, k.s) === from) { items.push([k.h, k.u, k.s]); k.u = b; k.s = to; placeIn(r, k); }
        else if (swap && k.u === b && boardOf(ub, b, k.s) === to) { items.push([k.h, k.u, k.s]); k.u = a; k.s = from; placeIn(r, k); }
      }
      return { items };
    }
    if (f[1] === 'ADD') { const item = e._back || e.item; if (!item || by[item.h]) return { had: true }; d.kinds.push(JSON.parse(JSON.stringify(item))); d.kinds.sort((x, y) => x.n.localeCompare(y.n)); return { added: item.h }; }
    return null;
  }
  function undoEntry(d, r, e) {
    const u = e.undo; if (!u) return;
    const by = Object.fromEntries(d.kinds.map(k => [k.h, k]));
    (u.items || []).forEach(([h, unit, s]) => { const k = by[h]; if (k) { k.u = unit; k.s = s; placeIn(r, k); } });
    (u.nf || []).forEach(h => { if (by[h]) by[h].nf = 1; });
    if (u.count && by[u.count[0]]) by[u.count[0]].x = u.count[1];
    if (u.added) { const i = d.kinds.findIndex(k => k.h === u.added); if (i >= 0) e._back = d.kinds.splice(i, 1)[0]; }   // kept, with any details added since, in case it goes back on
  }
  const rewind = (d, r, list) => { for (let i = list.length - 1; i >= 0; i--) undoEntry(d, r, list[i]); };
  const replay = (d, r, list) => list.forEach(e => { e.undo = doEntry(d, r, e); });
  const tidy = p => cleanPend({ waiting: p.waiting.map(({ _back, ...e }) => e), history: p.history });
  const withLog = async (files, title, what) => { const p = await readPending().catch(() => null); if (p) { p.history.unshift({ at: stamp(), title, what, did: 'edited', ...byMe() }); files['pending.json'] = tidy(p); } return files; };
  const DID = { saved: 'Saved on the website', sent: 'Shown to the console', console: 'The console has it too', undone: 'Undone on the website', back: 'The console did not save it: back on the list', sync: 'Website synced with the console', edited: 'Edited on the website (nothing for the console)', reset: 'Cleared when the website was put back to its starting point' };
  const stamp = () => new Date().toISOString();
  function syncMade() {                       // the list of codes = everything saved and waiting, then anything only on this device
    const local = made.filter(c => !c.id);
    made.length = 0;
    made.push(...pend.waiting.filter(e => !e.sent).map(e => ({ id: e.id, code: e.code, title: e.title, what: e.what, extra: e.extra })), ...local);
  }
  function takeIn(d, p) {                     // the website was just saved: use the saved copy on this page too
    kinds.splice(0, kinds.length, ...d.kinds); data.published = d.published;
    if (p) pend = p;
    syncMade(); madeAt = Math.max(0, madeAt); drawCode(); drawLog(); drawHomeStatus(); drawTodo(); if (typeof drawNotFound === 'function') drawNotFound();   // (the edit tab's no-photo list too: a new item belongs on it)
    if (view3d) { view3d.retint(); refresh3d(); }
    if (typeof drawEmpty === 'function') drawEmpty();
  }
  async function saveChanges(list, button, opts = {}) {
    if (!keep.get('rl-key')) {
      if (opts.needKey) { afterKey = () => button && button.click(); askForKey('Saving to the website needs the staff passcode on this device, once.'); return false; }
      list.forEach((c, i) => showCode(c.code, c.title, c.what, c.extra, i === list.length - 1));
      status.textContent = 'Added to the list on this phone only. This device is not signed in, so the website gets ' + (list.length === 1 ? 'this change' : 'these changes') + ' when the console syncs. Sign in with the staff passcode to save changes to the website first.';
      return true;
    }
    const label = button ? button.textContent : ''; if (button) { button.disabled = true; button.textContent = 'Saving...'; }
    let d = null, p = null;
    try { [d, p] = await Promise.all([latest('data.json', g => g && Array.isArray(g.kinds)), readPending()]); } catch (err) {}
    if (button) { button.disabled = false; button.textContent = label; }
    if (!d || !p) { status.textContent = 'Could not reach the website. Check the internet connection and try again.'; return false; }
    if (opts.edit) opts.edit(d);
    const at = stamp(), since = room.synced && Number.isInteger(room.synced.bytes) ? room.synced.bytes : 0, added = [];
    let already = 0;
    for (const c of list) {
      if (p.waiting.some(w => !w.sent && w.code === c.code)) { already++; continue; }
      const e = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), code: c.code, title: c.title, what: c.what, at, since, sent: false };
      if (c.extra) e.extra = c.extra; if (c.item) e.item = c.item;
      e.undo = doEntry(d, room, e); if (!e.undo) continue;
      p.waiting.push(e); added.push(e);
    }
    if (!added.length && !opts.edit) { status.textContent = already ? 'That change is already on the list, waiting for the console.' : 'That item is not on the website. Reload the page and try again.'; return false; }
    p.history.unshift(...added.map(e => ({ at, title: e.title, what: e.what, did: 'saved', ...byMe() })));
    if (!added.length) p.history.unshift({ at, title: (opts.log && opts.log.title) || (opts.message || 'Edit').replace(/ \(staff page\)$/, ''), what: (opts.log && opts.log.what) || '', did: 'edited', ...byMe() });   // details only: nothing for the console, but it still goes in the history
    const out = tidy(p), files = { 'data.json': d, 'pending.json': out };
    if (!(await publish(files, opts.message || (added.length === 1 ? added[0].title : added.length + ' changes') + ' (staff page, waiting for the console)', button, opts.blobs))) return false;
    takeIn(d, out);
    if (added.length) {
      status.textContent = 'Saved on the website (everyone sees it in about a minute). ' + (made.length === 1 ? 'Show the code below to the console when you are there.' : made.length + ' changes are waiting for the console: the code below has them all.') + (already ? ' One of them was already on the list.' : '');
      $('code-out').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return true;
  }
  async function markSent(ids, button) {      // the console took these: they stay on the website, waiting for its sync
    const p = await readPending().catch(() => null); if (!p) { status.textContent = 'Could not reach the website. Check the internet connection and press it again.'; return false; }
    const at = stamp(), hit = p.waiting.filter(e => ids.includes(e.id) && !e.sent);
    hit.forEach(e => { e.sent = true; e.sentAt = at; });
    p.history.unshift(...hit.map(e => ({ at, title: e.title, what: e.what, did: 'sent', ...byMe() })));
    const out = tidy(p);
    if (hit.length && !(await publish({ 'pending.json': out }, (hit.length === 1 ? hit[0].title : hit.length + ' changes') + ' shown to the console (staff page)', button))) return false;
    pend = out; syncMade(); drawLog(); drawHomeStatus(); return true;
  }
  async function undoSaved(ids, button) {
    let d = null, p = null;
    try { [d, p] = await Promise.all([latest('data.json', g => g && Array.isArray(g.kinds)), readPending()]); } catch (err) {}
    if (!d || !p) { status.textContent = 'Could not reach the website. Check the internet connection and try again.'; return false; }
    const first = p.waiting.findIndex(e => ids.includes(e.id));
    if (first < 0) { pend = p; syncMade(); drawCode(); status.textContent = 'That change is no longer waiting: the list has been brought up to date.'; return false; }
    if (p.waiting.some(e => ids.includes(e.id) && e.sent)) { status.textContent = 'The console already has that change. Undo it on the console (Recent changes), then sync the website.'; return false; }
    const tail = p.waiting.slice(first), gone = tail.filter(e => ids.includes(e.id)), rest = tail.filter(e => !ids.includes(e.id));
    rewind(d, room, tail); replay(d, room, rest);
    p.waiting = p.waiting.slice(0, first).concat(rest);
    const at = stamp(); p.history.unshift(...gone.map(e => ({ at, title: e.title, what: e.what, did: 'undone', ...byMe() })));
    const out = tidy(p);
    if (!(await publish({ 'data.json': d, 'pending.json': out }, 'Undo ' + (gone.length === 1 ? gone[0].title : gone.length + ' changes') + ' (staff page)', button))) return false;
    takeIn(d, out);
    status.textContent = (gone.length === 1 ? 'Undone' : gone.length + ' changes undone') + ' on the website. The console never had ' + (gone.length === 1 ? 'it' : 'them') + ', so there is nothing to do there.';
    return true;
  }
  // Does the console's list hold this change? Its own line for it (after the website's place in the list when the change
  // was made) says so; for a move, a count or a new item, the console already showing the same result counts too.
  function onConsole(e, d, ub, list, startAt, later) {
    const f = e.code.split(':'), seen = test => list.some((line, i) => startAt[i] >= (e.since || 0) && test(line));
    if (f[1] === 'MOVE') {
      const [u, s] = f[3].split('-'), k = d.kinds.find(x => x.h === f[2]), same = (unit, n) => unit === u && boardOf(ub, u, Number(n)) === boardOf(ub, u, Number(s));
      return seen(l => l[0].length > 1 && l[0].toLowerCase() === f[2] && same(l[1], l[2])) || (!!k && same(k.u, k.s) && !later.some(x => x.code.includes(':' + f[2] + ':')));
    }
    if (f[1] === 'FOUND' && f[2] === 'ALL') return seen(l => l[0] === 'N' && l[1] === '*' && l[2] === '0');
    if (f[1] === 'FOUND') { const k = d.kinds.find(x => x.h === f[2]); return seen(l => l[0] === 'N' && (l[1] || '').toLowerCase() === f[2] && l[2] === '0') || (!!k && !k.nf && !later.some(x => x.code === e.code)); }
    if (f[1] === 'COUNT') { const k = d.kinds.find(x => x.h === f[2]); return seen(l => l[0] === 'C' && (l[1] || '').toLowerCase() === f[2] && Number(l[2]) === Number(f[3])) || (!!k && k.x === Number(f[3]) && !later.some(x => x.code.startsWith('RL:COUNT:' + f[2] + ':'))); }
    if (f[1] === 'ADD') return !!e.item && (d.kinds.some(k => k.h === e.item.h) || seen(l => l[0] === 'A' && nameCode(l[3] || '') === e.item.h));
    if (f[1] === 'SHELF') {
      const [a, an] = f[2].split('-'), [b, bn] = f[3].split('-'), swap = f[4] === 'SWAP';
      return seen(l => (l[0] === 'S' || l[0] === 'X') && (l[0] === 'X') === swap && l[1] === a && boardOf(ub, a, Number(l[2])) === boardOf(ub, a, Number(an)) && l[4] === b && boardOf(ub, b, Number(l[5])) === boardOf(ub, b, Number(bn)));
    }
    return false;
  }
  // ---- the change history (at the bottom of the page)
  const when = iso => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  let archived = [], archiveLoaded = false;
  addEventListener('rl-archived', e => { archived = (e.detail || []).concat(archived); });
  function drawLog() {
    const w = pend.waiting;
  $('log-show').hidden = !made.length;
    $('log-waiting').innerHTML = w.length ? w.map(e => '<li><span class="log-when">' + esc(when(e.at)) + '</span><strong>' + esc(e.title) + '</strong> ' + esc(e.what || '') + ' <span class="saved-tag' + (e.sent ? ' sent' : '') + '">' + (e.sent ? 'Shown to the console, waiting for its sync' : 'On the website, waiting for the console') + '</span></li>').join('') : '<li>Nothing is waiting. The website and the console have the same changes.</li>';
    // The last 3 days show as they are. Older ones fold away: one fold for "3+ days ago" (this past month), then a fold
    // for each earlier month this year, then one for each earlier year. Every line keeps its own date. Typing in the box
    // shows every match, from any time.
    const h = pend.history.concat(archived);
    const find = ($('log-find').value || '').trim().toLowerCase(), row = x => '<li><span class="log-when">' + esc(when(x.at)) + '</span><strong>' + esc(x.title) + '</strong> ' + esc(x.what || '') + (x.by ? ' <span class="log-by">by ' + esc(x.by) + '</span>' : '') + (x.did === 'sync' ? '' : ' <em>' + esc(DID[x.did] || x.did || '') + '</em>') + '</li>';
    const list = find ? h.filter(x => [x.title, x.what, x.by, DID[x.did]].join(' ').toLowerCase().includes(find)) : h;
    if (!h.length) { $('log-done').innerHTML = '<p class="tool-note">No changes yet.</p>'; return; }
    if (!list.length) { $('log-done').innerHTML = '<p class="tool-note">Nothing in the history matches that.</p>'; return; }
    if (find) { $('log-done').innerHTML = '<ul class="log-list">' + list.map(row).join('') + '</ul>'; return; }
    const now = new Date(), day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(), groups = [];
    const groupOf = x => { const d = new Date(x.at), t = d.getTime();
      if (t >= day0 - 2 * 864e5) return ['recent', ''];                                      // today and the 2 days before
      if (t >= day0 - 30 * 864e5) return ['month', '3+ days ago'];
      if (d.getFullYear() === now.getFullYear()) return ['m' + d.getMonth(), d.toLocaleDateString([], { month: 'long' })];
      return ['y' + d.getFullYear(), String(d.getFullYear())]; };
    for (const x of list) { const [key, label] = groupOf(x); if (!groups.length || groups[groups.length - 1].key !== key) groups.push({ key, label, items: [] }); groups[groups.length - 1].items.push(x); }
    const open = new Set([...$('log-done').querySelectorAll('details[open]')].map(x => x.dataset.group));
    $('log-done').innerHTML = groups.map(g => g.key === 'recent' ? '<ul class="log-list">' + g.items.map(row).join('') + '</ul>'
      : '<details class="log-day" data-group="' + esc(g.key) + '"' + (open.has(g.key) ? ' open' : '') + '><summary>' + esc(g.label) + ' <span class="tool-note">' + g.items.length + (g.items.length === 1 ? ' change' : ' changes') + '</span></summary><ul class="log-list">' + g.items.map(row).join('') + '</ul></details>').join('')
      + (groups[0].key !== 'recent' ? '' : '');
    if (groups[0].key !== 'recent') $('log-done').insertAdjacentHTML('afterbegin', '<p class="tool-note">Nothing in the last 3 days.</p>');
  }
  $('log-find').addEventListener('input', () => drawLog());
  // older changes live in history/<year>.json: fetched the first time Change history is opened
  $('log').addEventListener('toggle', async () => {
    if (!$('log').open || archiveLoaded) return; archiveLoaded = true;
    try {
      const idx = await fetch('history/index.json?x=' + Date.now()).then(r => r.ok ? r.json() : null); if (!idx || !Array.isArray(idx.years)) return;
      const parts = await Promise.all(idx.years.map(y => fetch('history/' + y + '.json?x=' + Date.now()).then(r => r.ok ? r.json() : null).catch(() => null)));
      const have = new Set(pend.history.map(x => x.at + x.title));
      archived = parts.flatMap(p => (p && Array.isArray(p.history)) ? p.history : []).filter(x => x && !have.has(x.at + x.title)).sort((a, b) => String(b.at).localeCompare(String(a.at)));
      drawLog();
    } catch (e) { archiveLoaded = false; }
  });
  // ---- earlier editions: the item list as it was on any day it changed, next to today's
  const edRow = t => { const f = t.split('\t'); return { h: f[0], n: f[1], c: f[2], t: f[3], x: Number(f[4]), u: f[5], s: Number(f[6]), w: f[7], nf: f[8] === '1' }; };
  let edition = null;
  const csvOf = rows => '\ufeff' + rows.map(r => r.map(v => { const t = String(v == null ? '' : v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }).join(',')).join('\r\n') + '\r\n';
  const saveCsv = (csv, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  function drawEdition() {
    const box = $('edition-view'); if (!edition) { box.innerHTML = ''; return; }
    const then = edition.items, thenBy = Object.fromEntries(then.map(k => [k.h, k])), nowBy = Object.fromEntries(kinds.map(k => [k.h, k]));
    const inNow = k => k && k.x !== 0, moved = [], counts = [], added = [], goneNow = [];
    for (const k of then) { if (k.x === 0) continue; const n = nowBy[k.h]; if (!inNow(n)) { goneNow.push(k); continue; } if (n.u !== k.u || (n.s || 0) !== k.s) moved.push([k, n]); if ((n.x || 1) !== k.x) counts.push([k, n]); }
    for (const n of kinds) { if (!inNow(n)) continue; const k = thenBy[n.h]; if (!k || k.x === 0) added.push(n); }
    const line = (title, rows) => rows.length ? '<h3>' + esc(title) + ' <span class="tool-note">' + rows.length + '</span></h3><ul class="log-list">' + rows.slice(0, 200).map(r => '<li>' + r + '</li>').join('') + (rows.length > 200 ? '<li class="tool-note">and ' + (rows.length - 200) + ' more: the spreadsheet has them all</li>' : '') + '</ul>' : '';
    const find = ($('edition-find').value || '').trim().toLowerCase(), hits = find ? then.filter(k => k.x !== 0 && (k.n + ' ' + k.w + ' ' + k.t + ' ' + k.c).toLowerCase().includes(find)) : [];
    const day = new Date(edition.at).toLocaleDateString([], { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }), total = then.filter(k => k.x !== 0).length;
    box.innerHTML = '<p><strong>' + esc(day) + '</strong>: ' + total + ' items in Lending. Today: ' + kinds.filter(inNow).length + '.</p>'
      + (find ? line('Then: matching \u201c' + find + '\u201d', hits.map(k => '<strong>' + esc(k.n) + '</strong> ' + esc(k.w) + (k.x > 1 ? ', ' + k.x + ' of them' : ''))) || '<p class="tool-note">Nothing in that edition matches.</p>'
        : (moved.length || counts.length || added.length || goneNow.length ? '' : '<p class="tool-note">Nothing has changed since then.</p>')
        + line('Moved since then', moved.map(([k, n]) => '<strong>' + esc(k.n) + '</strong> was at ' + esc(k.w) + ', now at ' + esc(n.w || n.u)))
        + line('Added since then', added.map(n => '<strong>' + esc(n.n) + '</strong> ' + esc(n.w || n.u)))
        + line('No longer in Lending', goneNow.map(k => '<strong>' + esc(k.n) + '</strong> was at ' + esc(k.w)))
        + line('Count changed', counts.map(([k, n]) => '<strong>' + esc(k.n) + '</strong> was ' + k.x + ', now ' + (n.x || 1))));
    $('edition-tools').hidden = false;
  }
  async function loadEditions() {
    const pick = $('edition-pick'); if (pick.dataset.ready) return;
    const idx = await latest('editions/index.json', g => g && Array.isArray(g.editions)).catch(() => null), list = (idx && idx.editions) || [];
    pick.innerHTML = '<option value="">Pick a day...</option>' + list.map(e => '<option value="' + esc(e.id) + '">' + esc(new Date(e.at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })) + (e.label ? ' \u2013 ' + esc(e.label) : '') + ' \u00b7 ' + e.items + ' items</option>').join('');
    $('edition-why').textContent = list.length ? '' : 'No editions saved yet. One is kept for every day the item list changes.';
    pick.dataset.ready = '1';
  }
  $('editions').addEventListener('toggle', () => { if ($('editions').open) loadEditions(); });
  $('edition-pick').addEventListener('change', async e => {
    edition = null; $('edition-tools').hidden = true; $('edition-find').value = ''; drawEdition(); if (!e.target.value) return;
    $('edition-why').textContent = 'Loading...';
    const got = await latest('editions/' + e.target.value + '.json', g => g && Array.isArray(g.items)).catch(() => null);
    if (!got || !Array.isArray(got.items)) { $('edition-why').textContent = 'Could not load that edition. Check the internet connection.'; return; }
    $('edition-why').textContent = ''; edition = { id: e.target.value, at: got.at, items: got.items.map(edRow) }; drawEdition();
  });
  $('edition-find').addEventListener('input', drawEdition);
  $('edition-get').addEventListener('click', () => { if (!edition) return;
    saveCsv(csvOf([['Item', 'Category', 'Type', 'How many', 'Unit', 'Shelf (1 = bottom)', 'Where it lived', 'Status']].concat(edition.items.slice().sort((a, b) => (a.x === 0) - (b.x === 0) || a.u.localeCompare(b.u) || a.s - b.s || a.n.localeCompare(b.n)).map(k => [k.n, k.c, k.t, k.x, (unitBy[k.u] || {}).name || k.u, k.s || '', k.w, k.x === 0 ? 'Taken out of Lending' : k.nf ? 'Not seen in the last audit' : 'In Lending']))), 'IDeATe Lending inventory as of ' + edition.id + '.csv'); });
  const download = (obj, name) => { const blob = new Blob([JSON.stringify(obj, null, 2) + '\n'], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  $('sync-publish').addEventListener('click', async e => { if (!outData) return; if (await publish({ 'data.json': outData, 'room.json': outRoom, ...(outPend ? { 'pending.json': outPend } : {}), ...(outBase || {}) }, 'Website matched to the console (staff page)', e.target)) { $('sync-saved').hidden = false; try { sessionStorage.setItem('rl-done', syncTag !== null ? 'Saved. The site updates in about a minute. One last step below.' : 'Saved. The site updates in about a minute. Nothing else to do.'); if (syncTag !== null) sessionStorage.setItem('rl-ack', String(syncTag)); } catch (err) { } setTimeout(() => location.reload(), 2500); } });
  // after that reload, say plainly that it worked (the page used to come back looking as if nothing had happened)
  try { const done = sessionStorage.getItem('rl-done'); if (done) { sessionStorage.removeItem('rl-done'); $('home-done').textContent = done; $('home-done').hidden = false; } const ack = sessionStorage.getItem('rl-ack'); if (ack !== null) { sessionStorage.removeItem('rl-ack'); if (ack === 'RESEND') showAck('RL:RESEND', 'Does the console still hold changes?', 'The website is reset. To put the console\'s changes back on it, show the console this code and type the PIN, then scan the code it shows. To clear the console too, use Start over there.'); else ackGot(ack); } } catch (err) { }
  $('web-reset-word').addEventListener('input', e => { $('web-reset').disabled = e.target.value.trim().toUpperCase() !== 'START OVER'; });
  $('web-reset').addEventListener('click', async e => {
    if ($('web-reset-word').value.trim().toUpperCase() !== 'START OVER' || !isManager()) return;
    const epoch = (room.synced && room.synced.epoch) || 0, name = baseName(room);
    if (!confirm('Put the website back to ' + name + '? This removes every change and edit made since then.')) return;
    let d, r; try { [d, r] = (await loadBaseline(epoch)).map(x => JSON.parse(JSON.stringify(x))); } catch (err) { status.textContent = 'Could not load the starting point. Check the internet connection and try again.'; return; }
    if (epoch) r.synced = { lines: 0, first: '', at: new Date().toISOString(), bytes: 0, epoch, baseAt: room.synced.baseAt };
    const p = await readPending().catch(() => cleanPend(null)), at = stamp();
    p.history.unshift(...p.waiting.map(x => ({ at, title: x.title, what: x.what, did: 'reset', ...byMe() }))); p.waiting = [];
    if (await publish({ 'data.json': d, 'room.json': r, 'pending.json': tidy(p) }, 'Website back to ' + name + ' (staff page)', e.target)) { try { sessionStorage.setItem('rl-ack', 'RESEND'); } catch (err) { } setTimeout(() => location.reload(), 1500); }
  });
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
  }, {});
  // what is on the shelf that was clicked, with a button to start moving any of it
  const contents = $('shelf-contents');
  function showShelf(u, n) {
    const unit = unitBy[u], board = boardBelow(unit, n), things = onShelf(u, board);
    contents.innerHTML = '<h3>' + esc(placeName(u, board)) + '</h3>' + (things.length
      ? '<ul>' + things.map(k => '<li><span>' + esc(k.n) + (k.x > 1 ? ' <small>× ' + k.x + '</small>' : '') + '</span>' + (allowed('move') ? '<button type="button" data-move="' + esc(k.n) + '">Move this</button>' : '') + '</li>').join('') + '</ul>'
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
  // under the map: which shelves have nothing on them (room for something new)
  function drawEmpty() {
    const list = []; for (const u of lit) { const e = []; for (let n = 1; n <= u.shelves; n++) if (hasBoard(u, n) && !onShelf(u.code, n).length) e.push(n); if (e.length) list.push(u.name + ': ' + e.join(', ')); }
    $('empty-shelves').textContent = list.length ? 'Empty shelves: ' + list.join(' \u00b7 ') + '.' : 'No shelf is empty.';
  }
  drawEmpty();
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
    card.hidden = false;
    card.addEventListener('toggle', () => { if (card.open && !card.hidden) { view3d.resize(); refresh3d(); } });
    tabs.forEach(t => $('tab-' + t).addEventListener('click', () => { activeTab = t; shelfStep = 'from'; card.hidden = !['move', 'shelf', 'add'].includes(t); if (!card.hidden && card.open) { view3d.resize(); refresh3d(); } }));
    [mf, sf, af].forEach(f => { f.addEventListener('change', refresh3d); f.addEventListener('input', refresh3d); });
    refresh3d();
  }
  // opened by pointing a phone camera at the console's "To the website" code: go straight to that tab and take the page in
  // ---- the status line at the top: is the website in step with the console, and can this device save
  const drawHomeStatus = () => {
    const sy = room.synced, when = sy && sy.at ? new Date(sy.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
    $('home-sync').textContent = when ? 'Last website sync: ' + when + '.' : 'Website shows the Nov 16 setup.'; $('web-reset').textContent = 'Put the website back to ' + baseName(room);
    const wait = pend.waiting.filter(e => !e.sent).length, sent = pend.waiting.length - wait;
    $('home-wait').textContent = wait ? wait + (wait === 1 ? ' change is' : ' changes are') + ' on the website, waiting for the console.' : sent ? 'The console took ' + sent + (sent === 1 ? ' change' : ' changes') + ' from the website. Sync the website so it knows.' : '';
    $('home-wait-show').hidden = !wait; $('home-wait').parentElement.hidden = !$('home-wait').textContent;
    $('home-key').textContent = keep.get('rl-key') ? 'This device can save.' : 'To publish, enter the PIN at the console’s grey bar and scan its Staff page QR.';
    $('home-key-set').textContent = 'No console nearby? Use the passcode'; $('home-key-set').hidden = !!keep.get('rl-key');
    $('device').hidden = !keep.get('rl-key');
  };
  drawHomeStatus();
  $('home-key-set').addEventListener('click', () => { if (keep.get('rl-key')) { keep.set('rl-key', null); keep.set('rl-role', null); keep.set('rl-slot', null); drawHomeStatus(); } else askForKey('Type the staff passcode and this device can save.'); });
  $('device-signout').addEventListener('click', () => { keep.set('rl-key', null); keep.set('rl-role', null); keep.set('rl-slot', null); drawRole(); drawHomeStatus(); status.textContent = 'This device is signed out.'; });
  addEventListener('rl-key-changed', drawHomeStatus);
  $('device-name').value = keep.get('rl-name'); $('device-name').addEventListener('change', e => { keep.set('rl-name', e.target.value.trim() || null); status.textContent = e.target.value.trim() ? 'Your changes from this device now show \u201c' + e.target.value.trim() + '\u201d in Change history.' : 'Changes from this device no longer show a name.'; });
  passcodeGone().then(gone => { if (!gone) return; drawRole(); drawHomeStatus(); dispatchEvent(new Event('rl-key-changed')); status.textContent = 'A manager changed the passcode this device signed in with, so it was signed out. Sign in again with the new passcode, or scan the console.'; }).catch(() => {});
  // ---- "Check everything": one button that looks at each link in the chain and says in plain words what is fine and
  // what is not. It only reads; the one thing it can change (renewing the locked copies of the key) has its own button.
  const health = $('health'), line = (state, text) => { const li = document.createElement('li'); li.className = 'health-' + state; li.textContent = (state === 'ok' ? 'OK: ' : state === 'bad' ? 'Problem: ' : state === 'warn' ? 'Look at this: ' : '') + text; health.appendChild(li); };
  const dayText = d => new Date(d + 'T12:00:00').toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  const daysTo = d => Math.ceil((new Date(d + 'T23:59:59') - Date.now()) / 86400000);
  async function checkEverything() {
    openFold($('checks')); health.innerHTML = ''; $('health-renew').hidden = true; $('health-steps').hidden = true; const go = $('health-go'); go.disabled = true; go.textContent = 'Checking...';
    const get = (path) => fetch(path + '?x=' + Date.now()).then(r => r.ok ? r.json() : null).catch(() => null);
    // 1. the files every page reads
    const [d, r, p, h, k] = await Promise.all(['data.json', 'room.json', 'photos.json', 'howto.json', 'kits.json'].map(get));
    const missing = [['data.json', d], ['room.json', r], ['photos.json', p], ['howto.json', h], ['kits.json', k]].filter(x => !x[1]).map(x => x[0]);
    if (missing.length) line('bad', 'Could not load ' + missing.join(', ') + '. Check the connection and retry. If the files are still missing, ask the site maintainer to check the deployment.');
    else line('ok', 'The website\'s files load: ' + d.kinds.length + ' items, ' + r.units.length + ' units, ' + k.kits.length + ' kits.');
    // 2. the inventory agrees with itself, and with the codes the console makes
    if (d && r) {
      const units = new Map(r.units.map(u => [u.code, u])), codes = new Map(), wrong = [];
      for (const it of d.kinds) {
        const u = units.get(it.u);
        if (!u) wrong.push(it.n + ' is on a unit that does not exist (' + it.u + ')'); else if (u.shelves ? it.s < 1 || it.s > u.shelves : it.s > 0) wrong.push(it.n + ' is on shelf ' + it.s + ' of ' + u.name + ', which has ' + u.shelves);
        if (it.h !== nameCode(it.n) && it.h !== nameCode(it.n.slice(0, 58))) wrong.push(it.n + ' has a page code that does not match its name');   // (the console keeps the first 58 letters of a name)
        if (codes.has(it.h)) wrong.push(it.n + ' and ' + codes.get(it.h) + ' share a page code'); codes.set(it.h, it.n);
      }
      if (k) for (const kit of k.kits) for (const part of kit.parts) for (const name of part.pick || []) if (!d.kinds.some(it => it.n === name)) wrong.push('the kit "' + kit.name + '" lists ' + name + ', which is not in the inventory');
      if (wrong.length) line('bad', wrong.length + (wrong.length === 1 ? ' item needs fixing: ' : ' items need fixing: ') + wrong.slice(0, 5).join('; ') + (wrong.length > 5 ? '; and ' + (wrong.length - 5) + ' more' : '') + '.');
      else line('ok', 'Every item is on a real shelf, every page code matches the code the console makes, and every kit part exists.');
    }
    // 3. the site key on this device
    const locked = await readLocked(); let keyWorks = false;
    if (!keep.get('rl-key')) line('note', 'This device is not signed in, so it cannot save. Type the staff passcode (or open this page from the console\'s Staff page code) to check the key.');
    else {
      const res = await gh('').catch(() => null);
      if (!res) line('warn', 'GitHub could not be reached, so the key could not be checked. Check the internet connection and try again.');
      else if (res.status === 401) { line('bad', 'GitHub no longer takes the site key (it ran out or was deleted). Nobody can save until a new one is pasted: the steps are below.'); $('health-steps').hidden = false; $('health-steps').open = true; }
      else if (!res.ok) line('bad', 'GitHub answered ' + res.status + ' for the site key. It may be for a different repository: the steps to make a new one are below.');
      else { const info = await res.json(); if (info.permissions && info.permissions.push) { keyWorks = true; line('ok', 'The site key works: this device can save to the website.'); } else line('bad', 'The site key can read the site but not change it. It needs Contents: Read and write. Make a new one with the steps below.'); }
      if (res && !res.ok) $('health-steps').hidden = false;
    }
    // 4. when the key runs out (GitHub does not tell a web page, so the date is the one typed when the key was pasted)
    if (locked && locked.expires) { const n = daysTo(locked.expires);
      if (n < 0) line(keyWorks ? 'warn' : 'bad', 'The site key was due to run out on ' + dayText(locked.expires) + '.' + (keyWorks ? ' It still works, so the date on file is old: paste the key again with its real date.' : ''));
      else if (n <= 21) { line('warn', 'The site key runs out on ' + dayText(locked.expires) + ' (' + n + (n === 1 ? ' day' : ' days') + '). Make a new one before then: the steps are below.'); $('health-steps').hidden = false; }
      else line('ok', 'The site key is good until ' + dayText(locked.expires) + '.'); }
    else line('note', 'No run-out date is on file for the site key. GitHub emails the account owner about a week before a key runs out. To get a warning here too, paste the key again with its date (steps below).');
    // 5. the locked copies other devices use
    const me = keep.get('rl-key'), cpass = keep.get('rl-cpass'); let stale = false;
    if (!slotOf(locked, 'pass')) line('note', 'No staff passcode is set up. That is fine if staff always come in through the console\'s code.');
    else line('ok', 'A staff passcode is set up for devices away from the console.' + (keyWorks ? ' (This page cannot tell whether it still opens the current key without the passcode: if a device says the key has run out, set the passcode again.)' : ''));
    if (!slotOf(locked, 'console')) line('warn', 'The console is not linked to the website. Phones that scan its codes cannot save until someone presses "Link the console again" (under Passcode and sign-out) and shows the code to the console.');
    else if (!cpass) line('note', 'The console has been linked. To test that link, scan the console\'s Staff page code (the last spots on its map) with this phone and press Check everything again.');
    else { const inside = await openLocked(locked, cpass, 'console');
      if (inside === null) line('bad', 'The console\'s website pass does not open the website\'s copy any more. Press "Link the console again" (under Passcode and sign-out) and show the new code to the console.');
      else if (keyWorks && inside !== me) { stale = true; line('bad', 'The console\'s link holds an older site key than this device. Press "Renew the console\'s link" below (nothing to do at the console).'); }
      else if (!keyWorks) line('note', 'The console\'s pass opens the website\'s copy. Whether the key inside still works is checked once this device is signed in.');
      else line('ok', 'The console\'s link works: a phone that scans the console\'s Staff page code or To the website code can save.'); }
    $('health-renew').hidden = !stale;
    // 6. is the live site showing the last save
    if (keyWorks && d) { const res = await gh('/contents/data.json?ref=' + BRANCH, { headers: { Accept: 'application/vnd.github.raw+json' } }).catch(() => null), saved = res && res.ok ? await res.json().catch(() => null) : null;
      if (!saved) line('warn', 'Could not compare the live site with the last save.');
      else if ((saved.published || '') === (d.published || '')) line('ok', 'The live website is showing the latest save' + (d.published ? ' (' + new Date(d.published).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ')' : '') + '.');
      else { const mins = saved.published ? Math.round((Date.now() - new Date(saved.published)) / 60000) : 0; line(mins > 10 ? 'bad' : 'warn', mins > 10 ? 'A save made ' + mins + ' minutes ago is still not showing on the live website. GitHub may be having trouble publishing: check the repository\'s Actions tab.' : 'A save from the last few minutes is still on its way to the live website. Check again in a minute.'); } }
    // 8. what this page cannot see
    const sy = r && r.synced;
    line('note', 'This page cannot see the console itself. ' + (sy && sy.at ? 'The website last matched it ' + new Date(sy.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + '. ' : '') + 'On the console, the "Send to website" spot on the map shows how many changes are waiting: 0 means the two match.');
    go.disabled = false; go.textContent = 'Check again';
  }
  $('health-go').addEventListener('click', () => checkEverything().catch(e => { line('bad', 'The check itself stopped: ' + e.message); $('health-go').disabled = false; $('health-go').textContent = 'Check again'; }));
  $('health-renew').addEventListener('click', async e => {
    if (!isManager()) { status.textContent = 'Only a Lending manager can renew the console\'s link.'; return; }
    const cpass = keep.get('rl-cpass'); if (!cpass || !keep.get('rl-key')) return;
    if (await publish({ 'key.json': await lockKey(cpass, 'console') }, 'Console link renewed with the current site key (staff page)', e.target)) { status.textContent = 'The console\'s link was renewed. Phones that scan its codes can save again in about a minute.'; e.target.hidden = true; }
  });
  $('health-paste').addEventListener('click', () => { askForKey('Paste the new key below, with its run-out date and the staff passcode.'); document.querySelector('#connect details').open = true; });
  // a quiet warning at the top when the key is close to running out, without anyone pressing anything
  readLocked().then(all => { if (all && all.expires && daysTo(all.expires) <= 21) { $('home-expiry').hidden = false; $('home-expiry').onclick = () => { openFold($('checks')); $('checks').scrollIntoView({ behavior: 'smooth' }); }; $('home-expiry').textContent = daysTo(all.expires) < 0 ? 'The site key was due to run out on ' + dayText(all.expires) + '. Press Check everything.' : 'The site key runs out on ' + dayText(all.expires) + '. Press Check everything for how to renew it.'; } });
  const unlockFromAddress = async () => {
    const m = /(?:^#|&)k=([A-Za-z0-9]{8,20})(?:&|$)/.exec(location.hash); if (!m) return;
    const rest = location.hash.slice(1).split('&').filter(part => !part.startsWith('k=')).join('&');
    history.replaceState(null, '', location.pathname + (rest ? '#' + rest : ''));          // the pass does not stay in the address bar or the history
    keep.set('rl-cpass', m[1]); cameWithPass = true;                 // remembered so a new site key can be locked for the console again from this phone
    if (keep.get('rl-key')) {                                      // this phone already has a key: keep it unless GitHub no longer takes it
      const r = await gh('').catch(() => null); if (!r || r.status !== 401) return;
      keep.set('rl-key', null);
    }
    status.textContent = 'Opened from the console. Unlocking...';
    const problem = await unlockKey(m[1], 'console') || await checkUnlocked();
    if (problem) { keep.set('rl-key', null); status.textContent = problem; dispatchEvent(new Event('rl-key-changed')); return; }
    status.textContent = 'Opened from the console: this phone can save to the website.'; dispatchEvent(new Event('rl-key-changed'));
  };
  const takeAddress = () => {
    if (!location.hash.startsWith('#RLSYNC')) return;
    $('tab-sync').click(); cameFromConsole = true;
    const ok = readPage(location.href);
    history.replaceState(null, '', location.pathname);
    if (ok && Object.keys(pages).length < pageCount) status.textContent = 'Got it. Press Down on the console and scan the next page.';
  };
  const fromConsoleCode = () => unlockFromAddress().then(takeAddress);
  fromConsoleCode(); addEventListener('hashchange', fromConsoleCode);   // (hashchange: the camera reused a tab that already had this page open)
  // ---- kits: a project and the pieces it needs (kits.json). Each piece lists the items that work for it, first choice first.
  // The website's kit pages and the console's kit code are made from this file, so nothing changes on the console.
  const kf = $('kit-form'), kitPick = $('kit-pick'), kitParts = $('kit-parts');
  let kitList = [], kit = null, kitDeleteArmed = false;
  const kitSlug = name => { const base = searchName(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'kit'; let id = base, n = 2; while (kitList.some(k => k.id === id && k !== kit.orig)) id = base + '-' + n++; return id; };
  async function latestKits() {                                    // the copy on GitHub when this device can read it, so two people never overwrite each other
    if (keep.get('rl-key')) { const r = await gh('/contents/kits.json?ref=' + BRANCH, { headers: { Accept: 'application/vnd.github.raw+json' } }).catch(() => null); if (r && r.ok) return (await r.json()).kits; }
    return (await fetch('kits.json?v=' + Date.now()).then(r => r.json())).kits;
  }
  function drawKitPick(selectId) {
    kitPick.innerHTML = '<option value="">Pick a kit...</option>' + kitList.map(k => '<option value="' + esc(k.id) + '">' + esc(k.name) + '</option>').join('');
    kitPick.value = selectId || '';
  }
  function drawKitParts() {
    kitParts.innerHTML = kit.parts.map((p, i) => '<fieldset class="kit-part" data-i="' + i + '"><legend>Piece ' + (i + 1) + '</legend>' +
      '<label>What it is for<input data-role value="' + esc(p.role) + '" placeholder="Recorder, Two microphones, Something to hold them..."></label>' +
      (p.pick.length ? '<ol class="kit-picks">' + p.pick.map((n, j) => '<li><span' + (kinds.some(k => k.n === n) ? '' : ' class="kit-missing"') + '>' + esc(n) + (kinds.some(k => k.n === n) ? '' : ' (not in the inventory)') + '</span> ' + (j ? '<button type="button" class="link-button" data-first="' + j + '">Make first</button> ' : '') + '<button type="button" class="link-button" data-unpick="' + j + '">Remove</button></li>').join('') + '</ol>' : '<p class="tool-note">No items yet. Add at least one.</p>') +
      '<label>Add an item that works for it<input type="search" data-find placeholder="Type part of the item name" autocomplete="off"></label><ul class="edit-matches" data-matches></ul>' +
      '<p class="kit-part-actions">' + (i ? '<button type="button" class="link-button" data-up>Move up</button> ' : '') + '<button type="button" class="link-button" data-drop>Remove this piece</button></p></fieldset>').join('');
  }
  function openKit(k) {
    kit = k ? { orig: k, id: k.id, name: k.name, why: k.why || '', tip: k.tip || '', parts: k.parts.map(p => ({ role: p.role, pick: [...p.pick] })) } : { orig: null, id: '', name: '', why: '', tip: '', parts: [{ role: '', pick: [] }] };
    kf.elements.name.value = kit.name; kf.elements.why.value = kit.why; kf.elements.tip.value = kit.tip;
    $('kit-delete').hidden = !k; kitDeleteArmed = false; $('kit-delete').textContent = 'Delete this kit';
    $('kit-fields').hidden = false; drawKitParts(); status.textContent = '';
  }
  kitPick.addEventListener('change', () => { const v = kitPick.value; if (!v) { $('kit-fields').hidden = true; kit = null; return; } openKit(v === '+' ? null : kitList.find(k => k.id === v)); if (v === '+') kf.elements.name.focus(); });
  kitParts.addEventListener('input', e => {
    const box = e.target.closest('.kit-part'); if (!box) return; const p = kit.parts[+box.dataset.i];
    if (e.target.matches('[data-role]')) p.role = e.target.value;
    if (e.target.matches('[data-find]')) { const q = searchName(e.target.value), list = box.querySelector('[data-matches]');
      list.innerHTML = q ? itemMatches(q).filter(k => !p.pick.includes(k.n)).slice(0, 8).map(k => '<li><button type="button" data-add="' + esc(k.h) + '">' + esc(k.n) + '</button></li>').join('') || '<li class="tool-note">No matches. Try a shorter name.</li>' : ''; }
  });
  kitParts.addEventListener('click', e => {
    const b = e.target.closest('button'), box = e.target.closest('.kit-part'); if (!b || !box) return;
    const i = +box.dataset.i, p = kit.parts[i];
    if (b.dataset.add) { const k = kinds.find(x => x.h === b.dataset.add); if (k && !p.pick.includes(k.n)) p.pick.push(k.n); }
    else if (b.dataset.unpick !== undefined) p.pick.splice(+b.dataset.unpick, 1);
    else if (b.dataset.first !== undefined) p.pick.unshift(p.pick.splice(+b.dataset.first, 1)[0]);
    else if (b.hasAttribute('data-up')) kit.parts.splice(i - 1, 0, kit.parts.splice(i, 1)[0]);
    else if (b.hasAttribute('data-drop')) { kit.parts.splice(i, 1); if (!kit.parts.length) kit.parts.push({ role: '', pick: [] }); }
    else return;
    drawKitParts();
    if (b.dataset.add) { const again = kitParts.querySelector('.kit-part[data-i="' + i + '"] [data-find]'); if (again) again.focus(); }
  });
  $('kit-new').addEventListener('click', () => { kitPick.value = ''; openKit(null); kf.elements.name.focus(); });
  $('kit-add-part').addEventListener('click', () => { kit.parts.push({ role: '', pick: [] }); drawKitParts(); const last = kitParts.querySelector('.kit-part:last-child [data-role]'); if (last) last.focus(); });
  $('kit-save').addEventListener('click', async e => {
    if (!kit) return;
    kit.name = kf.elements.name.value.trim(); kit.why = kf.elements.why.value.trim(); kit.tip = kf.elements.tip.value.trim();
    const parts = kit.parts.map(p => ({ role: p.role.trim(), pick: p.pick.filter(n => kinds.some(k => k.n === n)) })).filter(p => p.role || p.pick.length);
    const problem = !kit.name ? 'Give the kit a name.' : !parts.length ? 'Add at least one piece.' : parts.some(p => !p.role) ? 'Every piece needs a line saying what it is for.' : parts.some(p => !p.pick.length) ? 'Every piece needs at least one item from the inventory.' : '';
    if (problem) { status.textContent = problem; return; }
    const button = e.target; button.disabled = true;
    try {
      const list = await latestKits();
      const id = kit.orig ? kit.orig.id : kitSlug(kit.name);
      const out = { id, name: kit.name, why: kit.why, parts, tip: kit.tip };
      const at = list.findIndex(k => k.id === id); if (at >= 0) list[at] = out; else list.push(out);
      button.disabled = false;
      if (await publish(await withLog({ 'kits.json': { kits: list } }, 'Kit ' + kit.name, 'Saved its pieces.'), 'Kit "' + kit.name + '" saved (staff page)', button)) {
        kitList = list; drawKitPick(id); openKit(out);
        status.textContent = 'Saved. The kit page updates on the website in about a minute' + (parts.length > 8 ? '. Its console code lights the first 8 pieces.' : '.');
      }
    } catch (err) { status.textContent = 'Could not read the current kits: ' + err.message; }
    finally { button.disabled = false; }
  });
  $('kit-delete').addEventListener('click', async e => {
    if (!kit || !kit.orig) return;
    if (!kitDeleteArmed) { kitDeleteArmed = true; e.target.textContent = 'Press again to delete "' + kit.orig.name + '"'; return; }
    const list = (await latestKits()).filter(k => k.id !== kit.orig.id);
    if (await publish(await withLog({ 'kits.json': { kits: list } }, 'Kit ' + kit.orig.name, 'Deleted.'), 'Kit "' + kit.orig.name + '" deleted (staff page)', e.target)) { kitList = list; drawKitPick(''); $('kit-fields').hidden = true; kit = null; status.textContent = 'Deleted. It leaves the website in about a minute.'; }
  });
  fetch('kits.json?v=' + Date.now()).then(r => r.json()).then(d => { kitList = d.kits || []; drawKitPick(''); }).catch(() => { kitPick.innerHTML = '<option value="">The kits could not be loaded. Reload the page.</option>'; });

  // ---- edit an item that is already on the website: its photo, manual link and description
  const ef = $('edit-form'), preview = $('edit-preview');
  let photos = null; fetch('photos.json?v=20261116h').then(r => r.json()).then(p => { photos = p; }).catch(() => {});
  const editSearch = ef.elements.thing;
  const editResults = $('edit-search-results'), editMatches = $('edit-matches');
  let selectedEditItem = null, matchingEditItems = [];
  const editItem = () => selectedEditItem;
  const showPreview = url => { preview.innerHTML = url ? '<img src="' + esc(url) + '" alt="" referrerpolicy="no-referrer"><span>Current photo.</span>' : '<span>This item has no photo yet.</span>'; };
  // a photo straight from the phone: shrunk here, saved into photos/ in the same step as the item
  let newPhoto = null;
  ef.elements.photofile.addEventListener('change', async () => {
    const note = $('edit-photo-note'); newPhoto = null; if (!ef.elements.photofile.files[0]) return;
    try {
      newPhoto = await readPhoto(ef.elements.photofile.files[0]);
      preview.innerHTML = '<img src="' + newPhoto.url + '" alt=""><span>New photo. Press Save to put it on the site.</span>';
      ef.elements.nophoto.checked = false; note.textContent = 'Photo ready (' + newPhoto.kb + ' KB).';
    } catch (err) { ef.elements.photofile.value = ''; note.textContent = 'That file could not be read as a picture. Try a JPEG or PNG, or take the photo again.'; }
  });
  // what still needs doing: items with no photo at all
  const hasPhoto = k => k.p ? !k.p.none : !!(photos?.lending?.[k.n] || photos?.images?.[photos?.items?.[k.n]]);
  function drawTodo() {
    const none = kinds.filter(k => !gone(k) && !hasPhoto(k));
    $('edit-todo').hidden = !none.length;
    $('edit-todo-title').textContent = none.length + (none.length === 1 ? ' item has' : ' items have') + ' no photo yet';
    $('edit-todo-list').innerHTML = none.map(k => '<li><button type="button" class="link-button" data-todo="' + esc(k.h) + '">' + esc(k.n) + '</button> <span class="tool-note">' + esc(k.w || '') + '</span></li>').join('');
  }
  $('edit-todo-list').addEventListener('click', e => { const b = e.target.closest('[data-todo]'); if (!b) return; const k = kinds.find(x => x.h === b.dataset.todo); if (k) { selectEditItem(k); $('edit-todo').open = false; $('edit-fields').scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
  $('tab-edit').addEventListener('click', drawTodo); drawTodo();
  function selectEditItem(k) {
    selectedEditItem = k;
    editSearch.value = k.n;
    editResults.hidden = true;
    $('edit-search-status').textContent = '';
    $('edit-fields').hidden = false;
    const shared = photos?.lending?.[k.n] || photos?.images?.[photos?.items?.[k.n]];
    ef.elements.photo.value = k.p ? k.p.url : ''; ef.elements.credit.value = k.p ? k.p.artist || '' : ''; ef.elements.crediturl.value = k.p && k.p.page !== '#' ? k.p.page || '' : '';
    ef.elements.nophoto.checked = false; newPhoto = null; ef.elements.photofile.value = ''; $('edit-photo-note').textContent = '';
    ef.elements.manualname.value = k.r && k.r[0] ? k.r[0][0] : ''; ef.elements.manual.value = k.r && k.r[0] ? k.r[0][1] : '';
    ef.elements.description.value = k.d || ''; ef.elements.copies.value = k.x || 1;
    $('edit-gone').hidden = !gone(k); $('edit-back').hidden = !gone(k); $('edit-publish').hidden = gone(k); $('edit-remove-box').hidden = gone(k) || !allowed('remove'); $('edit-remove-box').open = false; $('edit-remove-why').textContent = '';
    ef.elements.good.value = k.g || ''; ef.elements.need.value = (k.need || []).join('\n'); ef.elements.start.value = (k.start || []).join('\n'); ef.elements.tips.value = (k.tips || []).join('\n');
    showPreview(k.p && !k.p.none ? k.p.url : !k.p && shared ? shared.url : '');
  }
  const updateEditSearch = () => {
    selectedEditItem = null;
    $('edit-fields').hidden = true;
    status.textContent = '';
    const query = searchName(editSearch.value);
    editResults.hidden = !query;
    matchingEditItems = [];
    editMatches.replaceChildren();
    $('edit-search-status').textContent = '';
    if (!query) return;
    matchingEditItems = itemMatches(query, true);
    const exact = matchingEditItems.filter(k => searchName(k.n) === query);
    if (exact.length === 1) { selectEditItem(exact[0]); return; }
    showItemMatches('edit', matchingEditItems, item => { selectEditItem(item); preview.focus({ preventScroll: true }); });
  };
  editSearch.addEventListener('input', updateEditSearch);
  editSearch.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    if (matchingEditItems.length === 1 && !selectedEditItem) {
      selectEditItem(matchingEditItems[0]);
      preview.focus({ preventScroll: true });
    }
  });
  ef.addEventListener('submit', e => e.preventDefault());
  ef.elements.photo.addEventListener('change', () => { if (ef.elements.photo.value.trim()) showPreview(ef.elements.photo.value.trim()); });
  const editedData = () => {
    const k = editItem(); if (!k) { status.textContent = 'Pick the item from the list first.'; return null; }
    const f = ef.elements, url = f.photo.value.trim(), link = f.manual.value.trim();
    const copies = f.copies.valueAsNumber;
    if (!Number.isInteger(copies) || copies < 1 || copies > 250) {
      status.textContent = 'Enter a whole count from 1 to 250.';
      f.copies.focus();
      return null;
    }
    if (link && !/^https?:\/\//.test(link)) { status.textContent = 'The manual link has to start with https://'; return; }
    const d = JSON.parse(JSON.stringify(data)), item = d.kinds.find(x => x.h === k.h);
    if (f.nophoto.checked) item.p = { none: true };
    else if (newPhoto) item.p = { url: (newPhoto.path = 'photos/' + k.h + '-' + Date.now().toString(36) + '.jpg'), w: newPhoto.w, h: newPhoto.h, own: true, artist: f.credit.value.trim() || 'IDeATe Lending staff' };
    else if (url && k.p && k.p.url === url) { /* same photo as before: leave it */ }
    else if (url) item.p = { url, page: f.crediturl.value.trim() || '#', artist: f.credit.value.trim() || 'IDeATe Lending', license: 'Photo source' };
    else delete item.p;
    if (link) item.r = [[f.manualname.value.trim() || 'Manual', link]].concat((item.r || []).slice(1)); else if (item.r && !f.manualname.value.trim()) delete item.r;
    if (f.description.value.trim()) item.d = f.description.value.trim(); else item.d = '';
    item.g = f.good.value.trim();
    for (const part of ['need', 'start', 'tips']) { const list = lines(f[part].value); if (list.length) item[part] = list; else delete item[part]; }
    item.x = copies;
    return d;
  };
  $('edit-publish').addEventListener('click', async e => {
    const d = editedData(); if (!d) return; const k = editItem(), copies = d.kinds.find(x => x.h === k.h).x;
    const usePhoto = newPhoto && newPhoto.path && !ef.elements.nophoto.checked ? { [newPhoto.path]: newPhoto.base64 } : undefined;
    // the details go straight on the website; a new count also waits on the list for the console
    const mine = d.kinds.find(x => x.h === k.h), list = copies !== k.x ? [{ code: 'RL:COUNT:' + k.h + ':' + copies, title: 'Count of ' + k.n, what: 'Lending now has ' + copies + ' (was ' + k.x + ').' }] : [];
    const said = { p: 'photo', d: 'description', g: 'good for', need: 'what you need', start: 'first steps', tips: 'tips', r: 'manual link' }, diff = Object.keys(said).filter(x => JSON.stringify(k[x] || null) !== JSON.stringify(mine[x] || null)).map(x => said[x]);
    const ok = await saveChanges(list, e.target, { needKey: true, blobs: usePhoto, log: { title: 'Edit ' + k.n, what: diff.length ? 'Changed the ' + diff.join(', ') + '.' : 'Saved with no changes.' }, message: 'Edit ' + k.n + ' (staff page)', edit: fd => { const i = fd.kinds.findIndex(x => x.h === k.h); if (i >= 0) { const was = fd.kinds[i]; fd.kinds[i] = { ...mine, u: was.u, s: was.s, w: was.w, in: was.in, x: was.x }; } } });
    if (ok && !list.length) setTimeout(() => location.reload(), 1500);
  });
  // ---- taking an item out of Lending (a count of 0, console v5.51), and putting it back
  $('edit-remove').addEventListener('click', async e => {
    const k = editItem(); if (!k) return;
    if (!allowed('remove')) { $('edit-remove-why').textContent = 'A Lending manager has to turn this on for student staff.'; return; }
    if (!confirm('Take ' + k.n + ' out of Lending? Students stop seeing it and the console stops finding it once it scans the code. It can be put back.')) return;
    const ok = await saveChanges([{ code: 'RL:COUNT:' + k.h + ':0', title: 'Take out of Lending: ' + k.n, what: 'Was ' + (k.x || 1) + ' at ' + (k.w || k.u) + '. Students no longer see it.' }], e.target, { needKey: true });
    if (ok) { selectEditItem(kinds.find(x => x.h === k.h) || k); }
  });
  $('edit-back').addEventListener('click', async e => {
    const k = editItem(); if (!k) return;
    const n = ef.elements.copies.valueAsNumber; if (!Number.isInteger(n) || n < 1 || n > 250) { status.textContent = 'Enter how many Lending has, from 1 to 250.'; ef.elements.copies.focus(); return; }
    const ok = await saveChanges([{ code: 'RL:COUNT:' + k.h + ':' + n, title: 'Back in Lending: ' + k.n, what: n + (n === 1 ? ' copy' : ' copies') + ', at ' + (k.w || k.u) + '.' }], e.target, { needKey: true });
    if (ok) { selectEditItem(kinds.find(x => x.h === k.h) || k); }
  });
  // ---- the not-found list (console audits, v5.51): say where each one is, and it comes off
  function drawNotFound() {
    const nf = kinds.filter(k => k.nf && !gone(k)).sort((a, b) => a.n.localeCompare(b.n));
    $('home-nf-line').hidden = !nf.length;
    $('home-nf').textContent = nf.length + (nf.length === 1 ? ' thing was' : ' things were') + ' not seen in the last audit (most are probably checked out).';
    $('notfound').hidden = !nf.length;
    $('nf-list').innerHTML = nf.map(k => '<li class="nf-row"><div><strong>' + esc(k.n) + '</strong><br><span class="tool-note">Listed on ' + esc(k.w || k.u) + '</span></div><div class="sync-actions nf-actions">'
      + '<button type="button" data-nf="here" data-h="' + esc(k.h) + '">It\u2019s there</button>'
      + (allowed('move') ? '<button type="button" class="button-secondary" data-nf="move" data-h="' + esc(k.h) + '">It\u2019s on another shelf</button>' : '')
      + (allowed('remove') ? '<button type="button" class="button-secondary" data-nf="gone" data-h="' + esc(k.h) + '">Gone for good</button>' : '') + '</div></li>').join('');
  }
  $('home-nf-show').addEventListener('click', () => { openFold($('notfound')); $('notfound').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('nf-list').addEventListener('click', async e => {
    const b = e.target.closest('[data-nf]'); if (!b) return; const k = kinds.find(x => x.h === b.dataset.h); if (!k) return;
    if (b.dataset.nf === 'here') { await saveChanges([{ code: 'RL:FOUND:' + k.h, title: 'Found: ' + k.n, what: 'It was on its shelf, ' + (k.w || k.u) + '.' }], b, { needKey: true }); drawNotFound(); return; }
    if (b.dataset.nf === 'move') { if (!allowed('move')) return; $('tab-move').click(); mf.elements.thing.value = k.n; mf.elements.thing.dispatchEvent(new Event('input', { bubbles: true })); $('tool-move').scrollIntoView({ behavior: 'smooth', block: 'start' }); status.textContent = 'Pick the shelf where ' + k.n + ' is, then save. That takes it off the not-found list.'; return; }
    if (b.dataset.nf === 'gone') {
      if (!confirm('Take ' + k.n + ' out of Lending? Students stop seeing it and the console stops finding it once it scans the code. It can be put back.')) return;
      await saveChanges([{ code: 'RL:COUNT:' + k.h + ':0', title: 'Take out of Lending: ' + k.n, what: 'Not found in an audit. Was ' + (k.x || 1) + ' at ' + (k.w || k.u) + '.' }], b, { needKey: true }); drawNotFound();
    }
  });
  $('nf-clear').addEventListener('click', async e => {
    if (!isManager()) return; const n = kinds.filter(k => k.nf && !gone(k)).length; if (!n) return;
    if (!confirm('Clear all ' + n + ' from the list? They keep their shelves. Nothing is taken out of Lending.')) return;
    await saveChanges([{ code: 'RL:FOUND:ALL', title: 'Cleared the not-seen list', what: n + (n === 1 ? ' thing' : ' things') + ' taken off the list.' }], e.target, { needKey: true }); drawNotFound();
  });
  drawNotFound(); addEventListener('rl-key-changed', drawNotFound);
  // ---- the inventory as a spreadsheet (a .csv file: Excel, Numbers and Google Sheets all open it)
  $('inventory-get').addEventListener('click', () => {
    const cell = v => { const t = String(v == null ? '' : v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const site = location.href.replace(/staff\.html.*$/, '');
    const order = new Map(units.map((u, i) => [u.code, i]));
    const rows = kinds.slice().sort((a, b) => (gone(a) - gone(b)) || ((order.get(a.u) ?? 999) - (order.get(b.u) ?? 999)) || ((a.s || 0) - (b.s || 0)) || a.n.localeCompare(b.n)).map(k => {
      const u = unitBy[k.u], shelf = u && u.shelves && k.s ? boardBelow(u, k.s) : '';
      return [k.n, k.c, k.t, gone(k) ? 0 : (k.x || 1), u ? u.name : k.u, shelf, u && u.shelves ? (shelf ? u.name + ', shelf ' + shelf : u.name) : (u ? u.name : k.u) + ' (ask at the desk)', gone(k) ? 'Taken out of Lending' : k.nf ? 'Not seen in the last audit' : 'In Lending', site + '#i' + k.h];
    });
    const head = ['Item', 'Category', 'Type', 'How many', 'Unit', 'Shelf (1 = bottom)', 'Where it lives', 'Status', 'Item page'];
    const csv = '\ufeff' + [head, ...rows].map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'IDeATe Lending inventory ' + new Date().toISOString().slice(0, 10) + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    const waiting = pend.waiting.length;
    $('inventory-why').textContent = rows.length + ' items.' + (waiting ? ' It includes ' + waiting + (waiting === 1 ? ' change' : ' changes') + ' saved on the website that the console doesn\u2019t have yet.' : '');
  });
  $('log-show').addEventListener('click', () => $('home-wait-show').click());
  $('home-wait-show').addEventListener('click', () => { if (!made.length) return; madeAt = 0; drawCode(); $('code-out').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  syncMade(); drawLog(); drawHomeStatus(); if (made.length) { madeAt = 0; drawCode(); }
  window.__rlSync = { readPage, apply: async lines => { await apply(lines); return { data: outData, room: outRoom }; } };   // (for testing)
}).catch(err => { console.error(err); status.textContent = 'Could not load the inventory. Open this page from the published site or a local web server.'; });
