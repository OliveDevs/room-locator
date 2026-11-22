// A small 3D copy of the Room Locator model. Click a shelf to pick it.
// Room3D.init(holder, room, countOnShelf, onPick, opts) -> { mark(list), retint(), resize() }
//   list = [{unit, shelf, kind: 'pick' | 'from' | 'now' | 'moved'}]   opts.blink: marked shelves flash
//   opts: spin, fill, tint (paler boards hold fewer things), focus (a unit code to turn towards), colors, idleTip,
//         unitColors ({code: 0xRRGGBB}: each unit in its own colour)
window.Room3D = {
  init(holder, room, countOnShelf, onPick, opts) {
    opts = opts || {};
    if (!window.THREE || !THREE.OrbitControls) return null;
    const W = 200, D = 150, STEP = 7, BOARD = 5;                    // room size (the same numbers the console's map uses), shelf spacing
    const COLOR = { wood: 0xdcbf94, woodDark: 0xc9a877, floor: 0x2444b8, rail: 0xf4f4f0, pick: 0x2f9e58, from: 0xe08a1e, now: 0xe08a1e, moved: 0x3f73d9, hover: 0xfff2c4, ...(opts.colors || {}) };
    // how full a board is: pale when empty, deep wood at 8 things or more
    const EMPTY = new THREE.Color(0xf6efe3), FULL = new THREE.Color(0xa06d36);
    let tintOn = opts.tint && !opts.tintOff;
    const tintFor = (u, n) => EMPTY.clone().lerp(FULL, Math.min(1, countOnShelf(u, n) / 8)).multiplyScalar(n % 2 ? 1 : 0.95).getHex();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 2, 1, 2000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    holder.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 0.72));
    const sun = new THREE.DirectionalLight(0xffffff, 0.55); sun.position.set(-80, 220, 160); scene.add(sun);

    const floor = new THREE.Mesh(new THREE.BoxGeometry(W + 12, 6, D + 12), new THREE.MeshLambertMaterial({ color: COLOR.floor }));
    floor.position.set(0, -3, 0); scene.add(floor);

    const shelves = [];                                              // every clickable board
    const label = (text, x, y, z) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 96;
      const g = c.getContext('2d'); g.font = '600 44px -apple-system, "Segoe UI", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(255,255,255,.94)'; const w = Math.min(500, g.measureText(text).width + 36);
      g.fillRect(256 - w / 2, 10, w, 76); g.fillStyle = '#20201e'; g.fillText(text, 256, 50);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
      s.scale.set(44, 8.25, 1); s.position.set(x, y, z); s.renderOrder = 5; scene.add(s);
    };
    // Doodads stands on top of Under the Desk, and the Cables unit is a two-shelf cabinet with a counter (shelf 3) and a
    // pegboard behind it (shelf 4), as in the model in Lending
    const und = room.units.find(u => u.code === 'UND');
    const SHIFT = { AUDW: -6, LP: -6, PV: -6 };                     // the left-wall units sit a little further left here, clear of Audio
    room.units.filter(u => u.rect && u.shelves).forEach(u => {
      const [x1, y1, x2, y2] = u.rect.map((v, i) => i % 2 ? v : v + (SHIFT[u.code] || 0)), w = Math.max(8, x2 - x1), d = Math.max(8, y2 - y1);
      const cx = (x1 + x2) / 2 - W / 2, cz = (y1 + y2) / 2 - D / 2;
      const base = u.code === 'DOO' && und ? und.shelves * STEP : 0;
      const peg = u.code === 'CBL' && u.shelves >= 4;
      for (let n = 1; n <= u.shelves; n++) {
        const board = !u.boards || !u.boards.length || u.boards.includes(n) || n === 1;
        const own = opts.unitColors && opts.unitColors[u.code];
        const mat = new THREE.MeshLambertMaterial({ color: own ? new THREE.Color(own).multiplyScalar(n % 2 ? 1 : 0.9).getHex() : n % 2 ? COLOR.wood : COLOR.woodDark, transparent: !board, opacity: board ? 1 : 0.35 });
        let m;
        if (peg && n === 4) { m = new THREE.Mesh(new THREE.BoxGeometry(w - 1, STEP * 2, 1.6), mat); m.position.set(cx, 3 * STEP + STEP, cz + d / 2 - 0.8); }   // the pegboard, standing at the back
        else { m = new THREE.Mesh(new THREE.BoxGeometry(w - 1, BOARD, d - 1), mat); m.position.set(cx, base + (n - 1) * STEP + BOARD / 2, cz); }
        m.userData = { unit: u.code, shelf: n, name: u.name, board, plain: m.material.color.getHex() }; m.userData.base = board && tintOn ? tintFor(u.code, n) : m.userData.plain;
        scene.add(m); shelves.push(m);
      }
      const height = peg ? 3 * STEP : u.shelves * STEP;
      const top = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), new THREE.MeshLambertMaterial({ color: opts.unitColors && opts.unitColors[u.code] ? new THREE.Color(opts.unitColors[u.code]).multiplyScalar(0.8).getHex() : COLOR.woodDark }));
      top.position.set(cx, base + height - 0.6, cz); scene.add(top);
      label(u.code === 'UND' ? 'Under the Desk' : u.name, cx, base + (peg ? 5 * STEP : height) + (u.code === 'UND' ? -2 : 9), cz + (u.code === 'UND' ? -d / 2 - 4 : 0));
    });

    // what else stands in the room (not clickable): the front desk, the mannequin and the two carts by the left wall
    const at = (x, z) => [x - W / 2, z - D / 2];
    [[66.6, 105.7, 140.8, 119], [127.4, 119, 140.8, 150]].forEach(([a, b, c, d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(c - a, 20, d - b), new THREE.MeshLambertMaterial({ color: 0xe9e4da, transparent: true, opacity: 0.85 }));
      const [x, z] = at((a + c) / 2, (b + d) / 2); m.position.set(x, 10, z); scene.add(m);
    });
    { const [x, z] = at(87, 130); label('Front desk', x, 30, z); }
    { const dark = new THREE.MeshLambertMaterial({ color: 0x1d1d1f }), [x, z] = at(11, 124);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 30, 16), dark); body.position.set(x, 21, z); scene.add(body);
      const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 8, 8), dark); legs.position.set(x, 4, z); scene.add(legs);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 1, 16), dark); base.position.set(x, 0.5, z); scene.add(base);
      const head = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 12), dark); head.position.set(x, 39, z); scene.add(head);
      label('Mannequin', x, 50, z); }
    [117, 130.5].forEach((cz, i) => { const [x, z] = at(20.4, cz), wood = new THREE.MeshLambertMaterial({ color: COLOR.woodDark });
      const tub = new THREE.Mesh(new THREE.BoxGeometry(6, 9, 10), wood); tub.position.set(x, 7, z); scene.add(tub);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 1), wood); handle.position.set(x, 14, z - 4.5); scene.add(handle);
      [-3.5, 3.5].forEach(dz => { const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 7, 12), new THREE.MeshLambertMaterial({ color: 0x333333 })); wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 1.6, z + dz); scene.add(wheel); });
      if (!i) label('Carts', x, 24, z + 6); });

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(-8, 16, -6); controls.enablePan = false; controls.minDistance = 90; controls.maxDistance = 520;
    controls.maxPolarAngle = Math.PI / 2 - 0.08; controls.enableDamping = true;
    if (opts.spin) { controls.autoRotate = true; controls.autoRotateSpeed = 0.8; renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false; }); }
    camera.position.set(-40, 120, 205);
    const aim = opts.focus && room.units.find(u => u.code === opts.focus && u.rect);
    if (aim) {                                                       // turn towards one unit, from the side of the room it faces
      const [x1, y1, x2, y2] = aim.rect.map((v, i) => i % 2 ? v : v + (SHIFT[aim.code] || 0)), cx = (x1 + x2) / 2 - W / 2, cz = (y1 + y2) / 2 - D / 2;
      controls.target.set(cx * 0.6, 14, cz * 0.6);
      const away = new THREE.Vector3(-cx, 0, -cz); if (away.length() < 1) away.set(0, 0, 1); away.normalize();
      camera.position.set(cx * 0.6 + away.x * 185, 125, cz * 0.6 + away.z * 185 + 40);
    }

    const marks = new Map();
    // opts.blink: the marked shelf flashes, like the lit dot on the flat map (not for people who turned motion down)
    const blinks = !!opts.blink && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); let blinkOff = false;
    const paint = () => shelves.forEach(m => {
      const k = marks.get(m.userData.unit + '-' + m.userData.shelf);
      m.material.color.setHex(m === hovered ? COLOR.hover : k && !(blinks && blinkOff) ? COLOR[k] : m.userData.base);
    });
    let hovered = null;
    const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
    const hit = e => {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      const h = ray.intersectObjects(shelves)[0];
      return h ? h.object : null;
    };
    const tip = document.createElement('p'); tip.className = 'room3d-tip'; holder.appendChild(tip);
    const describe = m => m ? m.userData.name + ', shelf ' + m.userData.shelf + ' · ' + (n => n ? n + (n === 1 ? ' thing' : ' things') : 'empty')(countOnShelf(m.userData.unit, m.userData.shelf)) : (opts.idleTip || 'Drag to turn the room. Click a shelf to pick it.');
    renderer.domElement.addEventListener('pointermove', e => { const m = hit(e); if (m !== hovered) { hovered = m; renderer.domElement.style.cursor = m ? 'pointer' : 'grab'; tip.textContent = describe(m); paint(); } });
    renderer.domElement.addEventListener('pointerleave', () => { hovered = null; tip.textContent = describe(null); paint(); });
    let down = null;
    renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
    renderer.domElement.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;      // a drag turns the room, it does not pick
      const m = hit(e); if (m && onPick) onPick(m.userData.unit, m.userData.shelf);
    });
    tip.textContent = describe(null);

    // a narrow view (a phone held upright) stands further back so the whole room fits, until someone turns it themselves
    const baseOff = camera.position.clone().sub(controls.target).multiplyScalar(opts.far || 1); let touched = false;   // opts.far: stand further back
    renderer.domElement.addEventListener('pointerdown', () => { touched = true; });
    const size = () => { const w = holder.clientWidth, h = opts.fill ? window.innerHeight : Math.round(Math.min(460, Math.max(260, w * 0.5))); if (!w) return; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
      if (!touched) camera.position.copy(controls.target).add(baseOff.clone().multiplyScalar(camera.aspect < 1.8 ? 1 + (1.8 - camera.aspect) * 0.9 : 1)); };
    size(); window.addEventListener('resize', size);
    (function loop() { requestAnimationFrame(loop); if (holder.offsetParent !== null) {
      if (blinks && marks.size) { const off = performance.now() % 1000 >= 600; if (off !== blinkOff) { blinkOff = off; paint(); } }
      controls.update(); renderer.render(scene, camera); } })();

    const retint = () => { shelves.forEach(m => { m.userData.base = m.userData.board && tintOn ? tintFor(m.userData.unit, m.userData.shelf) : m.userData.plain; }); paint(); };
    return { retint, setTint(on) { tintOn = !!on; retint(); }, mark(list) { marks.clear(); (list || []).forEach(x => x && x.unit && x.shelf && marks.set(x.unit + '-' + x.shelf, x.kind || 'pick')); paint(); }, resize: size };
  }
};
