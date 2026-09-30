import * as THREE from 'three';
import { palette } from './palette.js';
import {
  AMPLITUDE,
  ROAD_HALF_WIDTH,
  S_PERIOD,
  Z_PERIOD,
  cornerPoint,
  pointAt,
  roadXAt,
  tangentAt,
} from './path.js';

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });

// Deterministic PRNG so the layout is the same on every load.
function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const mod = (a, n) => ((a % n) + n) % n;

function canvasTexture(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const hex = (c) => `#${new THREE.Color(c).getHexString()}`;

export const glowTexture = canvasTexture(64, 64, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
});

// A flat ribbon following `sample(t) -> {point, side}` for t in [0, 1].
function ribbon(steps, sample, halfWidth, vScale) {
  const pos = [];
  const uv = [];
  const idx = [];
  for (let k = 0; k <= steps; k++) {
    const { point, side, v } = sample(k / steps);
    pos.push(point.x + side.x * halfWidth, 0, point.z + side.z * halfWidth);
    pos.push(point.x - side.x * halfWidth, 0, point.z - side.z * halfWidth);
    uv.push(0, v * vScale, 1, v * vScale);
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

// River meanders along the right-hand side, repeating every RIVER_PERIOD in z.
const RIVER_PERIOD = Z_PERIOD * 2;
const riverXAt = (z) => AMPLITUDE + 7 + 2.5 * Math.sin((2 * Math.PI * z) / RIVER_PERIOD);

// Scenery lives in a window around the car and wraps; the window length is a
// multiple of both road and river periods so wrapped items stay off them.
const WINDOW = RIVER_PERIOD * 3;
const AHEAD = WINDOW - 28;

export function createWorld() {
  const world = new THREE.Group();
  const rand = rng(11);

  // Ground follows the car; it is a flat colour so nobody notices.
  const groundMat = mat(0xffffff);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  world.add(ground);

  // --- Road -----------------------------------------------------------------
  const roadTex = canvasTexture(64, 128, (ctx, w, h) => {
    ctx.fillStyle = hex(palette.road);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = hex(palette.roadLine);
    ctx.fillRect(0, 0, 5, h);
    ctx.fillRect(w - 5, 0, 5, h);
    ctx.fillRect(w / 2 - 2, 0, 4, h / 2);
  });
  roadTex.wrapT = THREE.RepeatWrapping;

  const road = new THREE.Group();
  world.add(road);
  const ROAD_BEHIND = 2;
  const ROAD_AHEAD = 7;
  const s0 = -ROAD_BEHIND * S_PERIOD;
  const s1 = ROAD_AHEAD * S_PERIOD;
  const dashes = Math.round(S_PERIOD / 3.2);
  const p = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const side = new THREE.Vector3();
  const roadGeo = ribbon(
    (ROAD_BEHIND + ROAD_AHEAD) * 160,
    (t) => {
      const s = s0 + (s1 - s0) * t;
      pointAt(s, p);
      tangentAt(s, tan);
      side.set(-tan.z, 0, tan.x);
      return { point: p, side, v: s / S_PERIOD };
    },
    ROAD_HALF_WIDTH,
    dashes,
  );
  const roadMesh = new THREE.Mesh(roadGeo, mat(0xffffff, { map: roadTex, roughness: 0.9 }));
  roadMesh.position.y = 0.02;
  roadMesh.receiveShadow = true;
  road.add(roadMesh);

  // Lamp posts on the outside of each corner.
  const postGeo = new THREE.CylinderGeometry(0.06, 0.08, 2.2, 8);
  const armGeo = new THREE.BoxGeometry(0.5, 0.06, 0.06);
  const bulbGeo = new THREE.SphereGeometry(0.14, 12, 8);
  const postMat = mat(palette.lampPost);
  const bulbMat = mat(palette.lampGlow, { emissive: palette.lampGlow, emissiveIntensity: 0.2 });
  const haloMat = new THREE.SpriteMaterial({
    map: glowTexture,
    color: palette.lampGlow,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const poolMat = new THREE.MeshBasicMaterial({
    map: glowTexture,
    color: palette.lampGlow,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const poolGeo = new THREE.PlaneGeometry(6, 6);
  poolGeo.rotateX(-Math.PI / 2);
  const c = new THREE.Vector3();
  for (let i = -2 * ROAD_BEHIND; i <= 2 * ROAD_AHEAD; i++) {
    cornerPoint(i, c);
    const out = Math.sign(c.x);
    const lamp = new THREE.Group();
    lamp.position.set(c.x + out * 2.8, 0, c.z);
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.y = 1.1;
    post.castShadow = true;
    const arm = new THREE.Mesh(armGeo, postMat);
    arm.position.set(-out * 0.22, 2.18, 0);
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(-out * 0.42, 2.08, 0);
    const halo = new THREE.Sprite(haloMat);
    halo.scale.setScalar(2.2);
    halo.position.copy(bulb.position);
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.position.set(-out * 1.2, 0.04, 0);
    lamp.add(post, arm, bulb, halo, pool);
    road.add(lamp);
  }

  // --- River ----------------------------------------------------------------
  const waterTex = canvasTexture(64, 256, (ctx, w, h) => {
    ctx.fillStyle = hex(palette.water);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    const r = rng(3);
    for (let i = 0; i < 14; i++) {
      ctx.fillRect(8 + r() * (w - 20), r() * h, 3, 14 + r() * 18);
    }
  });
  waterTex.wrapT = THREE.RepeatWrapping;

  const river = new THREE.Group();
  world.add(river);
  const RIVER_FROM = 60;
  const RIVER_TO = -(AHEAD + RIVER_PERIOD);
  const riverSample = (t) => {
    const z = RIVER_FROM + (RIVER_TO - RIVER_FROM) * t;
    const x = riverXAt(z);
    const dx = riverXAt(z - 0.1) - x;
    const s = new THREE.Vector3(dx, 0, -0.1).normalize();
    return { point: p.set(x, 0, z), side: side.set(-s.z, 0, s.x), v: -z / RIVER_PERIOD };
  };
  const riverSteps = 400;
  const bank = new THREE.Mesh(ribbon(riverSteps, riverSample, 2.6, 1), mat(palette.sand));
  bank.position.y = 0.01;
  bank.receiveShadow = true;
  const water = new THREE.Mesh(
    ribbon(riverSteps, riverSample, 1.9, 3),
    mat(0xffffff, { map: waterTex, roughness: 0.25 }),
  );
  water.position.y = 0.03;
  water.receiveShadow = true;
  river.add(bank, water);

  // --- Scenery --------------------------------------------------------------
  const trunkGeo = new THREE.CylinderGeometry(0.1, 0.14, 0.7, 6);
  const trunkMat = mat(palette.trunk);
  const blobGeo = new THREE.IcosahedronGeometry(1, 0);
  const coneGeo = new THREE.ConeGeometry(0.75, 1.5, 7);
  const foliageMats = palette.foliage.map((col) => mat(col, { flatShading: true }));
  const rockMat = mat(palette.rock, { flatShading: true });

  const makeTree = () => {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.35;
    g.add(trunk);
    const fMat = foliageMats[Math.floor(rand() * foliageMats.length)];
    const top = new THREE.Mesh(rand() < 0.5 ? blobGeo : coneGeo, fMat);
    if (top.geometry === blobGeo) {
      top.scale.setScalar(0.6 + rand() * 0.3);
      top.position.y = 1.15;
      top.rotation.set(rand() * 3, rand() * 3, 0);
    } else {
      top.position.y = 1.35;
    }
    g.add(top);
    g.scale.setScalar(0.8 + rand() * 0.7);
    return g;
  };

  const makeRock = () => {
    const r = new THREE.Mesh(blobGeo, rockMat);
    r.scale.set(0.3 + rand() * 0.4, 0.2 + rand() * 0.25, 0.3 + rand() * 0.4);
    r.position.y = 0.1;
    return r;
  };

  const scenery = [];
  let placed = 0;
  while (placed < 170) {
    const z = -rand() * WINDOW;
    const x = (rand() * 2 - 1) * 45;
    if (Math.abs(x - roadXAt(z)) < ROAD_HALF_WIDTH + 2.4) continue;
    if (Math.abs(x - riverXAt(z)) < 3.4) continue;
    const item = rand() < 0.8 ? makeTree() : makeRock();
    item.position.set(x, item.position.y, z);
    item.rotation.y = rand() * Math.PI * 2;
    item.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
    item.userData.baseZ = z;
    world.add(item);
    scenery.push(item);
    placed++;
  }

  // --- Mountains ------------------------------------------------------------
  const mountains = new THREE.Group();
  world.add(mountains);
  const mountainMat = mat(0xffffff, { flatShading: true, fog: false });
  const snowMat = mat(0xffffff, { flatShading: true, fog: false });
  const farMat = mat(0xffffff, { flatShading: true, fog: false });
  for (let layer = 0; layer < 2; layer++) {
    const count = layer === 0 ? 11 : 14;
    for (let i = 0; i < count; i++) {
      const h = (layer === 0 ? 22 : 14) + rand() * 16;
      const r = h * (1.3 + rand() * 0.5);
      const x = (i / (count - 1) - 0.5) * 460 + (rand() - 0.5) * 30;
      const z = layer === 0 ? -250 - rand() * 30 : -210 - rand() * 20;
      const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6 + Math.floor(rand() * 3)), layer === 0 ? farMat : mountainMat);
      peak.position.set(x, h / 2 - 2, z);
      peak.rotation.y = rand() * Math.PI;
      mountains.add(peak);
      if (layer === 1 || rand() < 0.7) {
        const capH = h * 0.28;
        const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.28 * 1.02, capH, peak.geometry.parameters.radialSegments), snowMat);
        cap.position.set(x, h - 2 - capH / 2 + 0.05, z);
        cap.rotation.y = peak.rotation.y;
        mountains.add(cap);
      }
    }
  }

  // --- Clouds ---------------------------------------------------------------
  const cloudMat = mat(0xffffff, { flatShading: true, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.35 });
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < puffs; j++) {
      const pf = new THREE.Mesh(blobGeo, cloudMat);
      pf.scale.setScalar(0.9 + rand() * 1.1);
      pf.position.set(j * 1.4 - puffs * 0.7, rand() * 0.6, rand() * 0.8);
      cloud.add(pf);
    }
    cloud.position.set((rand() * 2 - 1) * 60, 9 + rand() * 6, 0);
    cloud.userData.baseZ = -rand() * WINDOW;
    cloud.userData.drift = 0.4 + rand() * 0.6;
    world.add(cloud);
    clouds.push(cloud);
  }

  // --- Birds ----------------------------------------------------------------
  const birdMat = mat(palette.bird, { flatShading: true });
  const birdBody = new THREE.IcosahedronGeometry(0.16, 0);
  birdBody.scale(2, 0.8, 0.8);
  const wingGeo = new THREE.BoxGeometry(0.28, 0.03, 0.55);
  wingGeo.translate(0, 0, 0.28);
  const flocks = [];
  for (let f = 0; f < 4; f++) {
    const flock = new THREE.Group();
    const size = 3 + Math.floor(rand() * 4);
    const birds = [];
    for (let b = 0; b < size; b++) {
      const bird = new THREE.Group();
      bird.add(new THREE.Mesh(birdBody, birdMat));
      const left = new THREE.Mesh(wingGeo, birdMat);
      const right = new THREE.Mesh(wingGeo, birdMat);
      right.rotation.y = Math.PI;
      bird.add(left, right);
      // V formation.
      const row = Math.ceil(b / 2);
      const sideSign = b % 2 === 0 ? 1 : -1;
      bird.position.set(-row * 0.9, (rand() - 0.5) * 0.3, sideSign * row * 0.8);
      bird.userData = { left, right, phase: rand() * Math.PI * 2 };
      flock.add(bird);
      birds.push(bird);
    }
    flock.position.set((rand() * 2 - 1) * 50, 6 + rand() * 4, 0);
    flock.userData = { birds, baseZ: -25 - rand() * 45, speed: 3 + rand() * 2 };
    flock.scale.setScalar(0.75);
    world.add(flock);
    flocks.push(flock);
  }

  const tmp = new THREE.Color();
  const tmp2 = new THREE.Color();
  function applyMood(m, night) {
    groundMat.color.set(m.ground);
    mountainMat.color.set(m.mountain);
    farMat.color.copy(tmp.set(m.mountain).lerp(tmp2.set(m.horizon), 0.35));
    snowMat.color.set(m.snow);
    cloudMat.color.set(m.cloud);
    cloudMat.emissive.set(m.cloud);
    bulbMat.emissiveIntensity = 0.2 + night * 3;
    haloMat.opacity = night * 0.9;
    poolMat.opacity = night * 0.55;
    for (const flock of flocks) flock.visible = night < 0.85;
  }

  function update(t, dt, car, cameraX) {
    ground.position.set(car.x, 0, car.z);

    // Shift the repeating road/river by whole periods so they always surround the car.
    road.position.z = -Z_PERIOD * Math.floor(-car.z / Z_PERIOD);
    river.position.z = -RIVER_PERIOD * Math.floor(-car.z / RIVER_PERIOD);
    waterTex.offset.y = t * 0.25;

    for (const item of scenery) {
      item.position.z = car.z + mod(item.userData.baseZ - car.z + AHEAD, WINDOW) - AHEAD;
    }

    mountains.position.set(cameraX * 0.85, 0, car.z);

    for (const cloud of clouds) {
      cloud.position.x = mod(cloud.position.x + cloud.userData.drift * dt + 70, 140) - 70;
      cloud.position.z = car.z + mod(cloud.userData.baseZ - car.z + AHEAD, WINDOW) - AHEAD;
    }

    for (const flock of flocks) {
      const u = flock.userData;
      flock.position.x = cameraX + mod(flock.position.x - cameraX + u.speed * dt + 55, 110) - 55;
      flock.position.z = car.z + u.baseZ;
      flock.position.y += Math.sin(t * 0.8 + u.baseZ) * dt * 0.3;
      for (const bird of u.birds) {
        const flap = Math.sin(t * 9 + bird.userData.phase) * 0.7;
        bird.userData.left.rotation.x = flap;
        bird.userData.right.rotation.x = -flap;
      }
    }
  }

  return { object: world, update, applyMood };
}
