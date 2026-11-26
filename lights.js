// The light board: managers draw what the console's lights do when it wakes up, watch it play here, and send it to
// the console with one code (RL:LIGHTS). Up to 4 pictures of 81 lights, 16 colours. The console keeps it on its SD card.
(() => {
  const box = document.getElementById('lights'); if (!box) return;
  const $ = id => document.getElementById(id);
  // the same 16 colours the console has, in the same order (0 = off)
  const COLORS = ['#000000', '#ff0000', '#ff5a00', '#ffc800', '#00c800', '#00b4a0', '#0050ff', '#7800ff', '#ff2896', '#ffffff', '#ffb46e', '#64ff64', '#64c8ff', '#500000', '#003c00', '#000050'];
  const NAMES = ['Off', 'Red', 'Orange', 'Yellow', 'Green', 'Teal', 'Blue', 'Purple', 'Pink', 'White', 'Warm white', 'Light green', 'Light blue', 'Dim red', 'Dim green', 'Dim blue'];
  const SPEED_MS = { 1: 1200, 2: 700, 3: 350 };
  const N = 81, MAX = 4;
  let units = [], frames = [new Uint8Array(N)], at = 0, color = 1, speed = 2, twinkle = false, playing = null, cells = [];

  const keep = { get() { try { return JSON.parse(localStorage.getItem('rl-lights') || 'null'); } catch (e) { return null; } },
                 set(v) { try { localStorage.setItem('rl-lights', JSON.stringify(v)); } catch (e) {} } };
  function remember() { keep.set({ frames: frames.map(f => Array.from(f)), speed, twinkle }); }
  function recall() {
    const v = keep.get(); if (!v || !Array.isArray(v.frames) || !v.frames.length) return;
    frames = v.frames.slice(0, MAX).map(f => { const a = new Uint8Array(N); (f || []).slice(0, N).forEach((x, i) => { a[i] = x & 15; }); return a; });
    speed = [1, 2, 3].includes(v.speed) ? v.speed : 2; twinkle = !!v.twinkle;
  }

  // ---- what the console will get ----
  function code() {
    const bytes = [];
    frames.forEach(f => { for (let i = 0; i < N; i += 2) bytes.push((f[i] << 4) | (i + 1 < N ? f[i + 1] : 0)); });
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'; let out = '', acc = 0, have = 0;
    bytes.forEach(b => { acc = (acc << 8) | b; have += 8; while (have >= 6) { have -= 6; out += A[(acc >> have) & 63]; } acc &= (1 << have) - 1; });
    if (have) out += A[(acc << (6 - have)) & 63];
    return 'RL:LIGHTS:' + frames.length + speed + (twinkle ? 1 : 0) + ':' + out;
  }
  const dim = hex => '#' + [1, 3, 5].map(i => (parseInt(hex.slice(i, i + 2), 16) >> 3).toString(16).padStart(2, '0')).join('');
  // a light on the page: off is a quiet grey so the board still reads as a board
  function paint(el, v, dipped) {
    el.style.background = v ? (dipped ? dim(COLORS[v]) : COLORS[v]) : '';
    el.classList.toggle('on', !!v);
  }

  // ---- the board ----
  function drawBoard() {
    const board = $('lights-board'); board.innerHTML = ''; cells = new Array(N).fill(null);
    units.filter(u => u.shelves > 0).sort((a, b) => a.first - b.first).forEach(u => {
      const col = document.createElement('div'); col.className = 'lights-unit';
      const stack = document.createElement('div'); stack.className = 'lights-stack';
      for (let s = 0; s < u.shelves; s++) {
        const i = u.first + s; if (i >= N) break;
        const b = document.createElement('button'); b.type = 'button'; b.className = 'lights-cell'; b.dataset.i = i;
        b.dataset.where = u.name + ', shelf ' + (s + 1);
        stack.appendChild(b); cells[i] = b;
      }
      const name = document.createElement('button'); name.type = 'button'; name.className = 'lights-name'; name.textContent = u.code; name.title = 'Colour all of ' + u.name;
      name.setAttribute('aria-label', 'Colour all of ' + u.name);
      name.addEventListener('click', () => { if (playing) stop(); for (let s = 0; s < u.shelves; s++) if (u.first + s < N) frames[at][u.first + s] = color; show(); remember(); });
      col.appendChild(stack); col.appendChild(name); board.appendChild(col);
    });
    show();
  }
  function show() {
    cells.forEach((el, i) => { if (!el) return; const v = frames[at][i]; paint(el, v, false); el.setAttribute('aria-label', el.dataset.where + ': ' + NAMES[v]); el.title = el.dataset.where; });
    drawTabs(); $('lights-code').hidden = true;
  }
  function setLight(i) { if (i == null || isNaN(i) || frames[at][i] === color) return; frames[at][i] = color; paint(cells[i], color, false); cells[i].setAttribute('aria-label', cells[i].dataset.where + ': ' + NAMES[color]); $('lights-code').hidden = true; }
  function wireBoard() {
    const board = $('lights-board'); let down = false;
    const hit = e => { const el = document.elementFromPoint(e.clientX, e.clientY); return el && el.classList.contains('lights-cell') ? +el.dataset.i : null; };
    board.addEventListener('pointerdown', e => { const i = hit(e); if (i == null) return; if (playing) stop(); down = true; setLight(i); e.preventDefault(); });
    board.addEventListener('pointermove', e => { if (down) { const i = hit(e); if (i != null) setLight(i); } });
    const up = () => { if (down) { down = false; remember(); } };
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    board.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('lights-cell')) { e.preventDefault(); if (playing) stop(); setLight(+e.target.dataset.i); remember(); } });
  }

  // ---- colours, pictures, settings ----
  function drawPalette() {
    const p = $('lights-palette'); p.innerHTML = '';
    COLORS.forEach((c, v) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'lights-swatch' + (v === color ? ' picked' : '') + (v ? '' : ' off');
      if (v) b.style.background = c; else b.textContent = 'Off'; b.title = NAMES[v]; b.setAttribute('aria-label', NAMES[v]); b.setAttribute('aria-pressed', v === color);
      b.addEventListener('click', () => { color = v; drawPalette(); });
      p.appendChild(b);
    });
    $('lights-picked').textContent = NAMES[color] + (color ? '' : ' (rubs a light out)');
  }
  function drawTabs() {
    const t = $('lights-pictures'); t.innerHTML = '';
    frames.forEach((f, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'lights-tab' + (i === at ? ' picked' : ''); b.textContent = 'Picture ' + (i + 1); b.setAttribute('aria-pressed', i === at);
      b.addEventListener('click', () => { if (playing) stop(); at = i; show(); });
      t.appendChild(b);
    });
    $('lights-add').hidden = frames.length >= MAX; $('lights-drop').hidden = frames.length < 2;
    $('lights-speed-row').hidden = frames.length < 2;
  }
  function starters(kind) {
    const live = units.filter(u => u.shelves > 0).sort((a, b) => a.first - b.first);
    const make = fn => { const f = new Uint8Array(N); live.forEach((u, ui) => { for (let s = 0; s < u.shelves; s++) if (u.first + s < N) f[u.first + s] = fn(u.first + s, ui, s); }); return f; };
    if (kind === 'christmas') return { frames: [make(i => i % 5 === 4 ? 9 : i % 2 ? 4 : 1), make(i => i % 5 === 4 ? 9 : i % 2 ? 1 : 4)], speed: 2, twinkle: true };
    if (kind === 'halloween') return { frames: [make((i, u) => u % 2 ? 7 : 2), make((i, u) => u % 2 ? 2 : 7)], speed: 2, twinkle: false };
    if (kind === 'cmu') return { frames: [make((i, u) => u % 2 ? 9 : 1), make((i, u) => u % 2 ? 1 : 9)], speed: 1, twinkle: false };
    if (kind === 'winter') return { frames: [make(i => [6, 12, 9][i % 3])], speed: 2, twinkle: true };
    if (kind === 'rainbow') { const r = [1, 2, 3, 4, 5, 6, 7, 8]; return { frames: [0, 2, 4, 6].map(k => make((i, u) => r[(u + k) % 8])), speed: 3, twinkle: false }; }
    return { frames: [new Uint8Array(N)], speed: 2, twinkle: false };
  }

  // ---- play it here the way the console will ----
  function stop() { if (playing) { clearInterval(playing); playing = null; } $('lights-play').textContent = 'Play it here'; show(); }
  function play() {
    if (playing) { stop(); return; }
    const each = SPEED_MS[speed], whole = Math.max(4000, each * frames.length * 2), began = performance.now();
    $('lights-play').textContent = 'Stop';
    const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    playing = setInterval(() => {
      const t = performance.now() - began; if (t >= whole) { stop(); return; }
      const f = frames[Math.floor(t / each) % frames.length], beat = Math.floor(t / 160) & 255;
      cells.forEach((el, i) => { if (el) paint(el, f[i], twinkle && !still && f[i] && ((i * 7 + beat * 13) & 255) % 5 === 0); });
    }, 40);
  }

  function showCode(text, note) {
    if (playing) stop();
    const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
    $('lights-qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 4, scalable: true });
    $('lights-qr').dataset.code = text; $('lights-code-note').textContent = note; $('lights-code').hidden = false;
    $('lights-code').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function wire() {
    wireBoard();
    $('lights-add').addEventListener('click', () => { if (frames.length >= MAX) return; if (playing) stop(); frames.splice(at + 1, 0, new Uint8Array(frames[at])); at++; show(); remember(); });
    $('lights-drop').addEventListener('click', () => { if (frames.length < 2) return; if (playing) stop(); frames.splice(at, 1); at = Math.min(at, frames.length - 1); show(); remember(); });
    $('lights-fill').addEventListener('click', () => { if (playing) stop(); frames[at].fill(color); show(); remember(); });
    $('lights-speed').addEventListener('change', e => { speed = +e.target.value; if (playing) stop(); $('lights-code').hidden = true; remember(); });
    $('lights-twinkle').addEventListener('change', e => { twinkle = e.target.checked; if (playing) stop(); $('lights-code').hidden = true; remember(); });
    $('lights-start').addEventListener('change', e => {
      const k = e.target.value; e.target.value = ''; if (!k) return; if (playing) stop();
      const s = starters(k); frames = s.frames; speed = s.speed; twinkle = s.twinkle; at = 0;
      $('lights-speed').value = speed; $('lights-twinkle').checked = twinkle; show(); remember();
    });
    $('lights-play').addEventListener('click', play);
    $('lights-make').addEventListener('click', () => {
      if (!frames.some(f => f.some(v => v))) { $('lights-code-note').textContent = 'Every light is off. Colour at least one light first.'; $('lights-qr').innerHTML = ''; $('lights-code').hidden = false; return; }
      showCode(code(), 'Hold this up to the scanner on the side of the console and type the staff PIN if it asks. The console says “Saved” and plays your design each time it wakes up.');
    });
    $('lights-usual').addEventListener('click', () => showCode('RL:LIGHTS:0', 'Scan this at the console to go back to the usual wave of light. Your drawing stays here on this device.'));
  }

  async function start() {
    try { const r = await fetch('room.json', { cache: 'no-cache' }); units = (await r.json()).units || []; } catch (e) { units = []; }
    if (!units.some(u => u.shelves > 0)) { $('lights-board').textContent = 'The room map did not load. Reload the page.'; return; }
    recall(); $('lights-speed').value = speed; $('lights-twinkle').checked = twinkle;
    drawPalette(); drawBoard(); wire();
  }
  let started = false;
  box.addEventListener('toggle', () => { if (box.open && !started) { started = true; start(); } if (!box.open && playing) stop(); });
})();
