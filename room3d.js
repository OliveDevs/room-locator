// A small 3D copy of the Room Locator model. Click a shelf to pick it.
// Room3D.init(holder, room, countOnShelf, onPick) -> { mark(list) }   list = [{unit, shelf, kind: 'pick' | 'from' | 'now'}]
window.Room3D = {
  init(holder, room, countOnShelf, onPick) {
    if (!window.THREE || !THREE.OrbitControls) return null;
    const W = 200, D = 150, STEP = 7, BOARD = 5;                    // room size (the same numbers the console's map uses), shelf spacing
    const COLOR = { wood: 0xdcbf94, woodDark: 0xc9a877, floor: 0x2444b8, rail: 0xf4f4f0, pick: 0x2f9e58, from: 0xe08a1e, now: 0xe08a1e, hover: 0xfff2c4 };
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
    room.units.filter(u => u.rect && u.shelves).forEach(u => {
      const [x1, y1, x2, y2] = u.rect, w = Math.max(8, x2 - x1), d = Math.max(8, y2 - y1);
      const cx = (x1 + x2) / 2 - W / 2, cz = (y1 + y2) / 2 - D / 2;
      for (let n = 1; n <= u.shelves; n++) {
        const board = !u.boards || !u.boards.length || u.boards.includes(n) || n === 1;
        const m = new THREE.Mesh(new THREE.BoxGeometry(w - 1, BOARD, d - 1), new THREE.MeshLambertMaterial({ color: n % 2 ? COLOR.wood : COLOR.woodDark, transparent: !board, opacity: board ? 1 : 0.35 }));
        m.position.set(cx, (n - 1) * STEP + BOARD / 2, cz);
        m.userData = { unit: u.code, shelf: n, name: u.name, base: m.material.color.getHex() };
        scene.add(m); shelves.push(m);
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), new THREE.MeshLambertMaterial({ color: COLOR.woodDark }));
      top.position.set(cx, u.shelves * STEP - 0.6, cz); scene.add(top);
      label(u.name, cx, u.shelves * STEP + 9, cz);
    });

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(-8, 16, -6); controls.enablePan = false; controls.minDistance = 90; controls.maxDistance = 520;
    controls.maxPolarAngle = Math.PI / 2 - 0.08; controls.enableDamping = true;
    camera.position.set(-40, 120, 205);

    const marks = new Map();
    const paint = () => shelves.forEach(m => {
      const k = marks.get(m.userData.unit + '-' + m.userData.shelf);
      m.material.color.setHex(m === hovered ? COLOR.hover : k ? COLOR[k] : m.userData.base);
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
    const describe = m => m ? m.userData.name + ', shelf ' + m.userData.shelf + ' · ' + (n => n ? n + (n === 1 ? ' thing' : ' things') : 'empty')(countOnShelf(m.userData.unit, m.userData.shelf)) : 'Drag to turn the room. Click a shelf to pick it.';
    renderer.domElement.addEventListener('pointermove', e => { const m = hit(e); if (m !== hovered) { hovered = m; renderer.domElement.style.cursor = m ? 'pointer' : 'grab'; tip.textContent = describe(m); paint(); } });
    renderer.domElement.addEventListener('pointerleave', () => { hovered = null; tip.textContent = describe(null); paint(); });
    let down = null;
    renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
    renderer.domElement.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;      // a drag turns the room, it does not pick
      const m = hit(e); if (m) onPick(m.userData.unit, m.userData.shelf);
    });
    tip.textContent = describe(null);

    const size = () => { const w = holder.clientWidth, h = Math.round(Math.min(460, Math.max(260, w * 0.5))); renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    size(); window.addEventListener('resize', size);
    (function loop() { requestAnimationFrame(loop); if (holder.offsetParent !== null) { controls.update(); renderer.render(scene, camera); } })();

    return { mark(list) { marks.clear(); (list || []).forEach(x => x && x.unit && x.shelf && marks.set(x.unit + '-' + x.shelf, x.kind || 'pick')); paint(); }, resize: size };
  }
};
