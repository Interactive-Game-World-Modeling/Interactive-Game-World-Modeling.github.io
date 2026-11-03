// The island in the masthead: a small rule-based world, rebuilt from one seed. No model is involved.
import * as THREE from './vendor/three.module.min.js';

const canvas = document.getElementById('world');
const statusEl = document.getElementById('world-status');
const buildBtn = document.getElementById('world-build');
const resetBtn = document.getElementById('world-reset');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const SEED_X = 4.3, SEED_Z = 7.1;
const SIZE = 28;
const FLOOR = 0.84, ROOF = 0.6, MAX_FLOORS = 4;
const STORAGE_KEY = 'igw-town-v2';
const ROOFS = ['#2F62C9', '#DE4B2F', '#13897F'].map((c) => new THREE.Color(c));
const WALLS = ['#FFFBF0', '#FBF0DC', '#FFEBDC'].map((c) => new THREE.Color(c));
const LEAVES = ['#2F8F47', '#237A3F', '#3FA34D'].map((c) => new THREE.Color(c));
const SAND = new THREE.Color('#F5E1AF');
const GRASS = ['#86C552', '#74B846'].map((c) => new THREE.Color(c));
const HILL = ['#67AD40', '#74B846'].map((c) => new THREE.Color(c));
const WINDOW = new THREE.Color('#23404F');
const DOOR = new THREE.Color('#6B4326');

const hash = (x, y) => {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
};
const noise = (x, y) => {
  const i = Math.floor(x), j = Math.floor(y), f = x - i, g = y - j;
  const u = f * f * (3 - 2 * f), v = g * g * (3 - 2 * g);
  return (hash(i, j) * (1 - u) + hash(i + 1, j) * u) * (1 - v) + (hash(i, j + 1) * (1 - u) + hash(i + 1, j + 1) * u) * v;
};

// Terrain from the seed. Levels: 0 water, 1 sand, 2 grass, 3 hill.
const TOPS = [0, 0.28, 0.62, 1.05];
const grid = [];
for (let x = 0; x < SIZE; x++) {
  grid[x] = [];
  for (let z = 0; z < SIZE; z++) {
    const dx = (x - SIZE / 2 + 0.5) / (SIZE / 2), dz = (z - SIZE / 2 + 0.5) / (SIZE / 2);
    const d = Math.hypot(dx, dz) + (noise(x * 0.24 + SEED_X, z * 0.24 + SEED_Z) - 0.5) * 0.5;
    const level = d < 0.3 ? 3 : d < 0.62 ? 2 : d < 0.78 ? 1 : 0;
    grid[x][z] = { x, z, wx: x - SIZE / 2 + 0.5, wz: z - SIZE / 2 + 0.5, level, top: TOPS[level], rise: 1, wait: 0, house: null, tree: null };
  }
}
const cell = (x, z) => (grid[x] && grid[x][z]) || null;
const land = grid.flat().filter((c) => c.level > 0);
const buildable = land.filter((c) => c.level >= 2);
const CENTER = { x: -1, z: 1 };
const fromCenter = (c) => Math.hypot(c.wx - CENTER.x, c.wz - CENTER.z);

// Three neighborhoods around the center, one per roof color.
const district = (c) => {
  const around = (Math.atan2(c.wz - CENTER.z, c.wx - CENTER.x) + Math.PI) / (Math.PI * 2);
  return Math.floor(around * ROOFS.length + noise(c.x * 0.4 + 2, c.z * 0.4 + 8) * 0.9) % ROOFS.length;
};

function seedTown() {
  for (const c of buildable) {
    c.house = null;
    c.tree = null;
    const dist = fromCenter(c);
    if (dist < 6.2 && noise(c.x * 0.5 + 11, c.z * 0.5 + 3) > 0.5) {
      const floors = Math.min(3, 1 + Math.floor(hash(c.x + 3, c.z) * 2) + (dist < 2.6 ? 1 : 0));
      c.house = {
        floors,
        shown: floors,
        wait: 0,
        roof: district(c),
        wall: Math.floor(hash(c.x, c.z + 5) * 3),
      };
    } else if (hash(c.x + 9, c.z + 2) > 0.62) {
      c.tree = { size: 0.8 + hash(c.x, c.z) * 0.6, shown: 1, wait: 0, leaf: Math.floor(hash(c.z, c.x) * 3), spin: hash(c.x, c.z) * 3 };
    }
  }
}
seedTown();

function restoreSaved() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return;
  }
  if (!Array.isArray(saved)) return;
  for (const [x, z, floors, roof] of saved) {
    const c = cell(x, z);
    if (!c || c.level < 2) continue;
    c.tree = null;
    c.house = { floors, shown: floors, wait: 0, roof, wall: Math.floor(hash(x, z + 5) * 3) };
  }
}
function save() {
  const list = buildable.filter((c) => c.house).map((c) => [c.x, c.z, c.house.floors, c.house.roof]);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* storage may be blocked; the town still works for this visit */
  }
}
restoreSaved();

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
} catch {
  document.documentElement.classList.add('world-fallback');
  throw new Error('WebGL unavailable');
}
// A slow load may already have shown the still image; the live island takes over from here.
document.documentElement.classList.remove('world-fallback');
renderer.setClearAlpha(0);
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, -200, 300);
cam.position.set(34, 30, 34);
cam.lookAt(0, 0, 0);
cam.updateMatrixWorld();

scene.add(new THREE.HemisphereLight('#E4F2FF', '#E6DCC8', 1.55));
const sun = new THREE.DirectionalLight('#FFF1DA', 2.35);
sun.position.set(26, 42, 9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 110 });
sun.shadow.bias = -0.0008;
sun.shadow.radius = 3;
scene.add(sun);

const flat = (color = '#ffffff') => new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, flatShading: true });
const box = new THREE.BoxGeometry(1, 1, 1);
const pool = (geo, mat, n, cast = true) => {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.castShadow = cast;
  m.receiveShadow = true;
  m.frustumCulled = false;
  m.count = 0;
  scene.add(m);
  return m;
};
const roofGeo = new THREE.ConeGeometry(0.74, ROOF, 4);
roofGeo.rotateY(Math.PI / 4);
const tiles = pool(box, flat(), land.length);
const walls = pool(box, flat(), SIZE * SIZE * MAX_FLOORS);
const panes = pool(box, flat(), SIZE * SIZE * MAX_FLOORS * 4, false);
const roofs = pool(roofGeo, flat(), SIZE * SIZE);
const trunks = pool(new THREE.CylinderGeometry(0.08, 0.1, 0.4, 6), flat('#7A5532'), SIZE * SIZE);
const crowns = pool(new THREE.IcosahedronGeometry(0.46, 0), flat(), SIZE * SIZE);

const shore = new THREE.ShadowMaterial({ opacity: 0.16 });
const seaPlane = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), shore);
seaPlane.rotation.x = -Math.PI / 2;
seaPlane.receiveShadow = true;
scene.add(seaPlane);

const foamTiles = grid.flat().filter((c) => c.level === 0 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => (cell(c.x + a, c.z + b) || {}).level > 0));
const flatPlane = new THREE.PlaneGeometry(1, 1);
flatPlane.rotateX(-Math.PI / 2);
const foam = new THREE.InstancedMesh(flatPlane, new THREE.MeshBasicMaterial({ color: '#9FDCE8', transparent: true, opacity: 0.42, depthWrite: false }), foamTiles.length);
const dummy = new THREE.Object3D();
foamTiles.forEach((c, i) => {
  dummy.position.set(c.wx, 0.012, c.wz);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  foam.setMatrixAt(i, dummy.matrix);
});
foam.frustumCulled = false;
scene.add(foam);

// Boats drift in open water, clear of the page text. Positions are screen offsets from the island's center.
const hullMat = flat('#FFF8EA');
const sailMat = new THREE.MeshStandardMaterial({ color: '#FFFDF6', roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
const sailGeo = new THREE.BufferGeometry();
sailGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.62, 0, 0, 0, 1.15, 0], 3));
sailGeo.computeVertexNormals();
const ROOT2 = Math.SQRT1_2;
const boats = [[0.3, 'top', 0.2], [-0.36, 'top', 2.1], [-0.36, 'bottom', 4.2]].map(([along, edge, phase]) => {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(box, hullMat);
  hull.scale.set(1.05, 0.2, 0.42);
  hull.position.y = 0.1;
  const sail = new THREE.Mesh(sailGeo, sailMat);
  sail.position.set(-0.28, 0.2, 0);
  g.add(hull, sail);
  g.rotation.y = Math.PI / 4;
  scene.add(g);
  return { g, along, edge, phase, across: 0, deep: 0 };
});
function placeBoats(now) {
  for (const b of boats) {
    const a = b.across + Math.sin(now * 0.00011 + b.phase) * 1.3;
    b.g.position.set((a - b.deep) * ROOT2, 0, (-a - b.deep) * ROOT2);
  }
}

// Pointer feedback.
const ghost = new THREE.Mesh(flatPlane, new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.4, depthWrite: false }));
ghost.visible = false;
scene.add(ghost);
const ringGeo = new THREE.RingGeometry(0.42, 0.5, 40);
ringGeo.rotateX(-Math.PI / 2);
const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, depthWrite: false }));
scene.add(ring);
let ringBorn = -1;

const m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), rot = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0);
const set = (mesh, i, x, y, z, sx, sy, sz, color, spin = 0) => {
  pos.set(x, y, z);
  scl.set(sx, sy, sz);
  rot.setFromAxisAngle(yAxis, spin);
  m4.compose(pos, rot, scl);
  mesh.setMatrixAt(i, m4);
  if (color) mesh.setColorAt(i, color);
};
function rebuild() {
  let t = 0, w = 0, p = 0, r = 0, k = 0;
  for (const c of land) {
    const h = Math.max(c.top * c.rise, 0.001);
    const color = c.level === 1 ? SAND : (c.level === 2 ? GRASS : HILL)[Math.floor(hash(c.x, c.z) * 2)];
    set(tiles, t++, c.wx, h / 2, c.wz, 1, h, 1, color);
  }
  for (const c of buildable) {
    const base = c.top * c.rise;
    if (c.house) {
      const s = c.house.shown, full = Math.floor(s + 1e-3), part = s - full;
      const wall = WALLS[c.house.wall];
      for (let f = 0; f < Math.ceil(s - 1e-3); f++) {
        const height = f < full ? FLOOR : FLOOR * part;
        const y = base + f * FLOOR;
        set(walls, w++, c.wx, y + height / 2, c.wz, 0.92, height, 0.92, wall);
        if (f < full) {
          const mid = y + FLOOR * 0.52;
          set(panes, p++, c.wx + 0.465, mid, c.wz - 0.2, 0.02, 0.28, 0.2, WINDOW);
          set(panes, p++, c.wx + 0.465, mid, c.wz + 0.2, 0.02, 0.28, 0.2, WINDOW);
          set(panes, p++, c.wx + 0.2, mid, c.wz + 0.465, 0.2, 0.28, 0.02, WINDOW);
          if (f === 0) set(panes, p++, c.wx - 0.2, y + 0.24, c.wz + 0.465, 0.22, 0.48, 0.02, DOOR);
          else set(panes, p++, c.wx - 0.2, mid, c.wz + 0.465, 0.2, 0.28, 0.02, WINDOW);
        }
      }
      const rs = Math.min(1, s * 2);
      set(roofs, r++, c.wx, base + s * FLOOR + (ROOF * rs) / 2, c.wz, rs, rs, rs, ROOFS[c.house.roof]);
    }
    if (c.tree) {
      const s = c.tree.size * c.tree.shown;
      if (s > 0.01) {
        set(trunks, k, c.wx, base + 0.2 * s, c.wz, s, s, s);
        set(crowns, k++, c.wx, base + 0.62 * s, c.wz, s, s * 1.15, s, LEAVES[c.tree.leaf], c.tree.spin);
      }
    }
  }
  tiles.count = t; walls.count = w; panes.count = p; roofs.count = r; trunks.count = k; crowns.count = k;
  for (const m of [tiles, walls, panes, roofs, trunks, crowns]) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
  renderer.shadowMap.needsUpdate = true;
}

function countHouses() {
  return buildable.filter((c) => c.house).length;
}
function updateCount() {
  canvas.dataset.houses = countHouses();
}
function say(text) {
  if (statusEl) statusEl.textContent = text;
}

// One assembly on load: land rises from the center out, then the town grows.
function assemble() {
  for (const c of land) {
    c.rise = 0;
    c.wait = fromCenter(c) * 34;
  }
  for (const c of buildable) {
    const w = 320 + fromCenter(c) * 60;
    if (c.house) {
      c.house.shown = 0;
      c.house.wait = w;
    }
    if (c.tree) {
      c.tree.shown = 0;
      c.tree.wait = w + 120;
    }
  }
}

function step(dt) {
  let moving = false;
  const k = 1 - Math.exp(-dt / 110);
  const approach = (o, key, to) => {
    if (o.wait > 0) {
      o.wait -= dt;
      moving = true;
      return;
    }
    const v = o[key] + (to - o[key]) * k;
    if (Math.abs(to - v) < 0.004) o[key] = to;
    else {
      o[key] = v;
      moving = true;
    }
  };
  for (const c of land) if (c.rise !== 1) approach(c, 'rise', 1);
  for (const c of buildable) {
    if (c.house && c.house.shown !== c.house.floors) approach(c.house, 'shown', c.house.floors);
    if (c.tree && c.tree.shown !== 1) approach(c.tree, 'shown', 1);
  }
  return moving;
}

// The rule for roofs: a new house takes the most common color among its neighbors.
function neighborRoof(c) {
  const seen = ROOFS.map(() => 0);
  let best = -1, most = 0;
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const n = cell(c.x + a, c.z + b);
    if (n && n.house && ++seen[n.house.roof] > most) {
      most = seen[n.house.roof];
      best = n.house.roof;
    }
  }
  return best >= 0 ? best : Math.floor(Math.random() * ROOFS.length);
}
function raise(c) {
  const hadTree = !!c.tree;
  c.tree = null;
  c.house = { floors: 1, shown: reduced ? 1 : 0, wait: 0, roof: neighborRoof(c), wall: Math.floor(hash(c.x, c.z + 5) * 3) };
  say(hadTree ? 'Tree cleared, house raised. Its roof follows the neighbors.' : 'House raised. Its roof follows the neighbors.');
  changed();
}
function act(c) {
  if (!c || c.level === 0) {
    say('Too wet to build on. Houses go on grass.');
    return;
  }
  if (c.level === 1) {
    say("Sand can't hold a house. Try the grass.");
    return;
  }
  if (c.house) {
    if (c.house.floors >= MAX_FLOORS) {
      say('Four floors is the limit here.');
      return;
    }
    c.house.floors++;
    if (reduced) c.house.shown = c.house.floors;
    say('Another floor added.');
    changed();
    return;
  }
  raise(c);
}
function changed() {
  save();
  updateCount();
  rebuild();
  wake();
}

function nextPlot() {
  const open = buildable.filter((c) => !c.house && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => (cell(c.x + a, c.z + b) || {}).house));
  if (!open.length) return buildable.find((c) => !c.house) || null;
  return open[Math.floor(Math.random() * open.length)];
}

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const hit = new THREE.Vector3();
function pick(ev) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, cam);
  const { origin: o, direction: d } = raycaster.ray;
  let t = (9 - o.y) / d.y;
  for (let i = 0; i < 420; i++, t += 0.05) {
    hit.copy(d).multiplyScalar(t).add(o);
    if (hit.y <= 0) return { c: null, x: hit.x, z: hit.z };
    const c = cell(Math.round(hit.x + SIZE / 2 - 0.5), Math.round(hit.z + SIZE / 2 - 0.5));
    if (!c || c.level === 0) continue;
    const top = c.top + (c.house ? c.house.floors * FLOOR + ROOF * 0.7 : 0);
    if (hit.y <= top) return { c, x: hit.x, z: hit.z };
  }
  return { c: null, x: hit.x, z: hit.z };
}

canvas.addEventListener('pointermove', (ev) => {
  if (ev.pointerType === 'touch') return;
  const { c } = pick(ev);
  const usable = c && c.level >= 2 && !(c.house && c.house.floors >= MAX_FLOORS);
  ghost.visible = !!(c && c.level >= 2 && !c.house);
  if (ghost.visible) ghost.position.set(c.wx, c.top + 0.012, c.wz);
  canvas.style.cursor = usable ? 'pointer' : 'default';
  wake();
});
canvas.addEventListener('pointerleave', () => {
  ghost.visible = false;
  wake();
});
canvas.addEventListener('click', (ev) => {
  const { c, x, z } = pick(ev);
  act(c);
  if (!c || c.level < 2) {
    ring.position.set(x, c ? c.top + 0.02 : 0.02, z);
    if (!reduced) ringBorn = performance.now();
    wake();
  }
});
if (buildBtn) {
  buildBtn.addEventListener('click', () => {
    const c = nextPlot();
    if (c) raise(c);
    else say('The island is full.');
  });
}
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage may be blocked; the reset still applies to this page */
    }
    seedTown();
    if (!reduced) assemble();
    updateCount();
    say('Town reset to its original seed.');
    rebuild();
    wake();
  });
}

// Frame the island from its real extent, at one fixed viewpoint.
const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
const probe = new THREE.Vector3();
for (const c of land) {
  for (const y of [0, c.top + 3]) {
    for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
      probe.set(c.wx + a, y, c.wz + b);
      const u = probe.dot(right), v = probe.dot(up);
      uMin = Math.min(uMin, u); uMax = Math.max(uMax, u);
      vMin = Math.min(vMin, v); vMax = Math.max(vMax, v);
    }
  }
}
function copyRight() {
  const left = canvas.getBoundingClientRect().left;
  let right = 0;
  for (const el of document.querySelectorAll('.mast-copy h1, .mast-copy .lead, .mast-copy .actions a')) {
    const range = document.createRange();
    range.selectNodeContents(el);
    right = Math.max(right, range.getBoundingClientRect().right - left);
  }
  return right;
}
function layout() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (!W || !H) return;
  renderer.setSize(W, H, false);
  const wide = W >= 1100;
  const islandW = uMax - uMin, islandH = vMax - vMin;
  let px, cx, cy;
  if (wide) {
    const foot = document.querySelector('.mast-foot').offsetHeight + 42;
    const room = W - copyRight() - 16, tall = H - foot - 14;
    px = Math.min(room / islandW, tall / islandH);
    cx = W - 22 - (islandW * px) / 2;
    cy = 14 + tall / 2;
  } else {
    px = Math.min((W * 0.98) / islandW, (H * 0.98) / islandH);
    cx = W / 2;
    cy = H / 2;
  }
  const ox = cx - ((uMin + uMax) / 2) * px, oy = cy + ((vMin + vMax) / 2) * px;
  const half = H / (2 * px);
  cam.left = (-half * W) / H; cam.right = (half * W) / H; cam.top = half; cam.bottom = -half;
  cam.setViewOffset(W, H, W / 2 - ox, H / 2 - oy, W, H);
  cam.updateProjectionMatrix();
  for (const b of boats) {
    const x = cx + b.along * islandW * px;
    const y = b.edge === 'top' ? cy - (islandH * px) / 2 - 22 : cy + (islandH * px) / 2 + 34;
    b.g.visible = wide && y > 44 && y < H - 8;
    b.across = (x - ox) / px;
    b.deep = (oy - y) / px / up.y;
  }
  placeBoats(performance.now());
  wake();
}

// Render on demand; only boats and the assembly keep the loop alive, and only while visible.
let visible = true, raf = 0, lastFrame = 0;
function frame(now) {
  raf = 0;
  const dt = Math.min(now - (lastFrame || now), 80);
  if (dt && dt < 28 && !reduced) {
    raf = requestAnimationFrame(frame);
    return;
  }
  lastFrame = now;
  const moving = step(dt);
  if (moving) rebuild();
  if (!reduced) placeBoats(now);
  if (ringBorn >= 0) {
    const age = (now - ringBorn) / 620;
    if (age >= 1) {
      ring.material.opacity = 0;
      ringBorn = -1;
    } else {
      const e = 1 - Math.pow(1 - age, 3);
      ring.scale.setScalar(1 + e * 2.4);
      ring.material.opacity = 0.9 * (1 - age);
    }
  }
  renderer.render(scene, cam);
  if (!canvas.dataset.ready) {
    canvas.dataset.ready = '1';
    document.documentElement.classList.remove('world-fallback');
    document.documentElement.classList.add('world-live');
  }
  const drifting = !reduced && boats.some((b) => b.g.visible);
  if (visible && (drifting || moving || ringBorn >= 0)) raf = requestAnimationFrame(frame);
}
function wake() {
  if (!raf && visible) raf = requestAnimationFrame(frame);
}
new IntersectionObserver(([e]) => {
  visible = e.isIntersecting;
  if (visible) wake();
}).observe(canvas);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(raf);
    raf = 0;
  } else wake();
});
new ResizeObserver(layout).observe(canvas);
document.fonts?.ready.then(layout);

if (!reduced) assemble();
updateCount();
rebuild();
layout();
wake();
