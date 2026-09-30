import * as THREE from 'three';
import { palette } from './palette.js';
import { PERIOD, ROAD_HALF_WIDTH, heightAt, riverX, roadSlope, roadX, smooth } from './path.js';

// Everything here is built for z in [BUILD_FROM, BUILD_TO] and shifted by whole
// PERIODs so it always surrounds the car.
const BUILD_FROM = 40;
const BUILD_TO = -2 * PERIOD + 40;
const HALF_WIDTH = 120;

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...extra });

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function canvasTexture(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const hex = (c) => `#${new THREE.Color(c).getHexString()}`;

export const glowTexture = (() => {
  const t = canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
})();

// A flat strip following centre(z) with the given half width, draped y above 0.
function ribbon(centre, halfWidth, y, tile) {
  const pos = [];
  const uv = [];
  const idx = [];
  const step = 0.5;
  const steps = Math.round((BUILD_FROM - BUILD_TO) / step);
  // Arc length of one period, so the texture repeats a whole number of times per period.
  let periodLen = 0;
  for (let z = 0; z > -PERIOD; z -= step) periodLen += Math.hypot(centre(z - step) - centre(z), step);
  const repeats = Math.max(1, Math.round(periodLen / tile));
  let arc = 0;
  let prevX = centre(BUILD_FROM);
  for (let k = 0; k <= steps; k++) {
    const z = BUILD_FROM - k * step;
    const x = centre(z);
    if (k > 0) arc += Math.hypot(x - prevX, step);
    prevX = x;
    const slope = (centre(z - 0.05) - centre(z + 0.05)) / 0.1; // dx per unit travelled toward -z
    const n = Math.hypot(1, slope);
    const sx = 1 / n;
    const sz = slope / n;
    pos.push(x + sx * halfWidth, y, z + sz * halfWidth, x - sx * halfWidth, y, z - sz * halfWidth);
    const v = (arc / periodLen) * repeats;
    uv.push(0, v, 1, v);
    if (k > 0) {
      const a = (k - 1) * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function createTerrain() {
  const group = new THREE.Group();
  const rand = rng(21);

  // --- Ground -----------------------------------------------------------------
  const cols = 110;
  const rows = 260;
  const groundGeo = new THREE.PlaneGeometry(HALF_WIDTH * 2, BUILD_FROM - BUILD_TO, cols, rows);
  groundGeo.rotateX(-Math.PI / 2);
  groundGeo.translate(0, 0, (BUILD_FROM + BUILD_TO) / 2);
  const gp = groundGeo.attributes.position;
  const colors = new Float32Array(gp.count * 3);
  const grass = palette.grass.map((c) => new THREE.Color(c));
  const sand = new THREE.Color(palette.sand);
  const shoulder = new THREE.Color(palette.shoulder);
  const col = new THREE.Color();
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i);
    const z = gp.getZ(i);
    const h = heightAt(x, z);
    gp.setY(i, h);
    // Patchy meadow colours, lighter on hilltops, sandy by the river.
    const patch = 0.5 + 0.5 * Math.sin(x * 0.21 + Math.sin((z * Math.PI * 2) / 60) * 2);
    col.copy(grass[0]).lerp(grass[1], patch * 0.8).lerp(grass[2], smooth(2, 7, h) * 0.7);
    col.lerp(shoulder, (1 - smooth(ROAD_HALF_WIDTH + 0.2, ROAD_HALF_WIDTH + 1.6, Math.abs(x - roadX(z)))) * 0.8);
    col.lerp(sand, 1 - smooth(2.6, 3.8, Math.abs(x - riverX(z))));
    colors.set([col.r, col.g, col.b], i * 3);
  }
  groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  groundGeo.computeVertexNormals();
  const groundMat = mat(0xffffff, { vertexColors: true, flatShading: true });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  group.add(ground);

  // --- Dirt road --------------------------------------------------------------
  const dirtTex = canvasTexture(128, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    // Soft edges fade into the grass.
    const edge = ctx.createLinearGradient(0, 0, w, 0);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(0.12, 'rgba(0,0,0,1)');
    edge.addColorStop(0.88, 'rgba(0,0,0,1)');
    edge.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hex(palette.dirt);
    ctx.fillRect(0, 0, w, h);
    // Tyre tracks.
    ctx.fillStyle = hex(palette.dirtDark);
    for (const x of [0.3, 0.7]) ctx.fillRect(w * x - 7, 0, 14, h);
    // Pebbles.
    const r = rng(5);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(90,70,50,0.25)';
      ctx.beginPath();
      ctx.arc(r() * w, r() * h, 1 + r() * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, w, h);
  });
  const road = new THREE.Mesh(
    ribbon(roadX, ROAD_HALF_WIDTH, 0.03, 5),
    mat(0xffffff, { map: dirtTex, transparent: true, depthWrite: false, roughness: 1 }),
  );
  road.receiveShadow = true;
  group.add(road);

  // --- River --------------------------------------------------------------------
  const waterTex = canvasTexture(64, 256, (ctx, w, h) => {
    ctx.fillStyle = hex(palette.water);
    ctx.fillRect(0, 0, w, h);
    const r = rng(3);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 16; i++) ctx.fillRect(8 + r() * (w - 20), r() * h, 3, 12 + r() * 20);
  });
  const water = new THREE.Mesh(
    ribbon(riverX, 2.7, -0.14, 8),
    mat(0xffffff, { map: waterTex, roughness: 0.2, transparent: true, opacity: 0.92 }),
  );
  water.receiveShadow = true;
  group.add(water);

  // --- Forest (instanced) ---------------------------------------------------
  const items = [];
  const tryPlace = (x, z, kind) => {
    if (Math.abs(x - roadX(z)) < ROAD_HALF_WIDTH + 2.2) return false;
    if (Math.abs(x - riverX(z)) < 4) return false;
    items.push({ x, z, kind, s: 0.8 + rand() * 0.7, r: rand() * Math.PI * 2, c: rand() });
    return true;
  };
  let placed = 0;
  while (placed < 420) {
    const z = -rand() * PERIOD;
    const side = rand() < 0.5 ? -1 : 1;
    const x = roadX(z) + side * (3.5 + Math.pow(rand(), 1.4) * 95);
    const k = rand();
    const kind = k < 0.58 ? 'pine' : k < 0.78 ? 'leafy' : k < 0.9 ? 'bush' : 'rock';
    if (tryPlace(x, z, kind)) placed++;
  }
  // Copy each item into every period we built.
  const all = [];
  for (const it of items) {
    for (let k = -1; k <= 2; k++) {
      const z = it.z - k * PERIOD;
      if (z <= BUILD_FROM && z >= BUILD_TO) all.push({ ...it, z, y: heightAt(it.x, z) - 0.05 });
    }
  }

  const count = (kinds) => all.filter((i) => kinds.includes(i.kind)).length;
  const trunkGeo = new THREE.CylinderGeometry(0.1, 0.15, 0.8, 6);
  trunkGeo.translate(0, 0.4, 0);
  const coneGeo = new THREE.ConeGeometry(1, 1, 7);
  const blobGeo = new THREE.IcosahedronGeometry(1, 0);
  const instanced = (geo, material, n) => {
    const m = new THREE.InstancedMesh(geo, material, n);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const trunks = instanced(trunkGeo, mat(palette.trunk, { flatShading: true }), count(['pine', 'leafy']));
  const cones = instanced(coneGeo, mat(0xffffff, { flatShading: true }), count(['pine']) * 3);
  const blobs = instanced(blobGeo, mat(0xffffff, { flatShading: true }), count(['leafy', 'bush']) * 2);
  const rocks = instanced(blobGeo, mat(palette.rock, { flatShading: true }), count(['rock']));

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const pines = palette.pine.map((c) => new THREE.Color(c));
  const leafy = palette.leafy.map((c) => new THREE.Color(c));
  const put = (im, i, x, y, z, sx, sy, sz, ry = 0, rx = 0) => {
    q.setFromEuler(e.set(rx, ry, 0));
    im.setMatrixAt(i, m4.compose(v.set(x, y, z), q, sc.set(sx, sy, sz)));
  };
  let ti = 0;
  let ci = 0;
  let bi = 0;
  let ri = 0;
  for (const it of all) {
    const { x, y, z, s, r } = it;
    if (it.kind === 'pine') {
      put(trunks, ti++, x, y, z, s, s, s, r);
      const c = pines[Math.floor(it.c * pines.length)];
      for (let tier = 0; tier < 3; tier++) {
        const w = (0.95 - tier * 0.22) * s;
        cones.setColorAt(ci, c);
        put(cones, ci++, x, y + (0.95 + tier * 0.55) * s, z, w, 1.1 * s, w, r + tier);
      }
    } else if (it.kind === 'leafy') {
      put(trunks, ti++, x, y, z, s, s * 1.2, s, r);
      const c = leafy[Math.floor(it.c * leafy.length)];
      blobs.setColorAt(bi, c);
      put(blobs, bi++, x, y + 1.35 * s, z, 0.75 * s, 0.7 * s, 0.75 * s, r, r);
      blobs.setColorAt(bi, c);
      put(blobs, bi++, x + 0.35 * s, y + 1.05 * s, z + 0.2 * s, 0.5 * s, 0.45 * s, 0.5 * s, r * 2, r);
    } else if (it.kind === 'bush') {
      const c = leafy[Math.floor(it.c * leafy.length)];
      blobs.setColorAt(bi, c);
      put(blobs, bi++, x, y + 0.2, z, 0.55 * s, 0.4 * s, 0.55 * s, r, r);
      blobs.setColorAt(bi, c);
      put(blobs, bi++, x + 0.4 * s, y + 0.15, z, 0.4 * s, 0.3 * s, 0.4 * s, r, r * 2);
    } else {
      put(rocks, ri++, x, y + 0.1, z, 0.5 * s, 0.35 * s, 0.45 * s, r, r * 0.3);
    }
  }

  // --- Lanterns along the road ------------------------------------------------
  const postGeo = new THREE.BoxGeometry(0.12, 1.6, 0.12);
  postGeo.translate(0, 0.8, 0);
  const lanternGeo = new THREE.BoxGeometry(0.22, 0.28, 0.22);
  const postMat = mat(palette.lanternPost);
  const lanternMat = mat(palette.lanternGlow, { emissive: palette.lanternGlow, emissiveIntensity: 0.1 });
  const haloMat = new THREE.SpriteMaterial({
    map: glowTexture,
    color: palette.lanternGlow,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const poolMat = new THREE.MeshBasicMaterial({
    map: glowTexture,
    color: palette.lanternGlow,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const poolGeo = new THREE.PlaneGeometry(6, 6);
  poolGeo.rotateX(-Math.PI / 2);
  for (let z = 0, n = 0; z > BUILD_TO; z -= 20, n++) {
    for (const zz of [z, z + PERIOD]) {
      // The loop already covers both built periods; the copy only fills the strip behind z = 0.
      if (zz > BUILD_FROM || (zz !== z && zz <= 0)) continue;
      const side = n % 2 === 0 ? 1 : -1;
      const x = roadX(zz) + side * 2.6 * Math.hypot(1, roadSlope(zz));
      const lamp = new THREE.Group();
      lamp.position.set(x, heightAt(x, zz), zz);
      const post = new THREE.Mesh(postGeo, postMat);
      post.castShadow = true;
      const lantern = new THREE.Mesh(lanternGeo, lanternMat);
      lantern.position.y = 1.75;
      const halo = new THREE.Sprite(haloMat);
      halo.scale.setScalar(2);
      halo.position.y = 1.75;
      const pool = new THREE.Mesh(poolGeo, poolMat);
      pool.position.set(-side * 1.2, 0.06, 0);
      lamp.add(post, lantern, halo, pool);
      group.add(lamp);
    }
  }

  const waterOffset = waterTex.offset;
  function applyMood(m, night) {
    lanternMat.emissiveIntensity = 0.1 + night * 3;
    haloMat.opacity = night * 0.9;
    poolMat.opacity = night * 0.5;
    groundMat.color.copy(m.groundTint);
  }

  function update(t, carZ) {
    group.position.z = -PERIOD * Math.floor(-carZ / PERIOD);
    waterOffset.y = t * 0.2;
  }

  return { object: group, update, applyMood };
}
