import * as THREE from 'three';
import { palette } from './palette.js';

// Everything in the world scrolls along -x and wraps inside [-SPAN/2, SPAN/2].
const SPAN = 90;
const ROAD_WIDTH = 3.4;

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });

// Deterministic PRNG so the layout is the same on every load.
function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const wrap = (x) => ((((x + SPAN / 2) % SPAN) + SPAN) % SPAN) - SPAN / 2;

export function createWorld() {
  const world = new THREE.Group();
  const scrollers = [];
  const rand = rng(7);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat(palette.ground));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  world.add(ground);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(400, ROAD_WIDTH), mat(palette.road));
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  road.receiveShadow = true;
  world.add(road);

  for (const z of [-ROAD_WIDTH / 2 - 0.1, ROAD_WIDTH / 2 + 0.1]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(400, 0.08, 0.2), mat(palette.curb));
    curb.position.set(0, 0.04, z);
    curb.receiveShadow = true;
    world.add(curb);
  }

  // Center dashes.
  const dashCount = 30;
  const dashes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.1, 0.02, 0.14),
    mat(palette.roadLine),
    dashCount,
  );
  dashes.receiveShadow = true;
  world.add(dashes);
  const dashX = Array.from({ length: dashCount }, (_, i) => (i / dashCount) * SPAN);
  const m = new THREE.Matrix4();

  // Scenery.
  const trunkGeo = new THREE.CylinderGeometry(0.1, 0.14, 0.7, 6);
  const trunkMat = mat(palette.trunk);
  const blobGeo = new THREE.IcosahedronGeometry(1, 0);
  const coneGeo = new THREE.ConeGeometry(0.75, 1.5, 7);
  const foliageMats = palette.foliage.map((c) => mat(c, { flatShading: true }));
  const rockMat = mat(palette.rock, { flatShading: true });

  const makeTree = () => {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.35;
    g.add(trunk);
    const fMat = foliageMats[Math.floor(rand() * foliageMats.length)];
    if (rand() < 0.5) {
      const top = new THREE.Mesh(blobGeo, fMat);
      top.scale.setScalar(0.6 + rand() * 0.3);
      top.position.y = 1.15;
      top.rotation.set(rand() * 3, rand() * 3, 0);
      g.add(top);
    } else {
      const top = new THREE.Mesh(coneGeo, fMat);
      top.position.y = 1.35;
      g.add(top);
    }
    g.scale.setScalar(0.8 + rand() * 0.6);
    return g;
  };

  const makeRock = () => {
    const r = new THREE.Mesh(blobGeo, rockMat);
    r.scale.set(0.3 + rand() * 0.3, 0.2 + rand() * 0.2, 0.3 + rand() * 0.3);
    r.position.y = 0.1;
    r.rotation.y = rand() * 3;
    return r;
  };

  for (let i = 0; i < 70; i++) {
    const side = rand() < 0.5 ? -1 : 1;
    const item = rand() < 0.78 ? makeTree() : makeRock();
    item.position.x = rand() * SPAN - SPAN / 2;
    item.position.z = side * (ROAD_WIDTH / 2 + 1 + rand() * 14);
    item.rotation.y = rand() * Math.PI * 2;
    world.add(item);
    scrollers.push({ obj: item, factor: 1 });
  }

  // Clouds drift a bit slower than the ground for a touch of parallax.
  const cloudMat = mat(palette.cloud, {
    flatShading: true,
    roughness: 1,
    emissive: palette.cloud,
    emissiveIntensity: 0.55,
  });
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < puffs; j++) {
      const p = new THREE.Mesh(blobGeo, cloudMat);
      p.scale.setScalar(0.5 + rand() * 0.6);
      p.position.set(j * 0.8 - puffs * 0.4, rand() * 0.3, rand() * 0.5);
      cloud.add(p);
    }
    cloud.position.set(rand() * SPAN - SPAN / 2, 5 + rand() * 3, -6 - rand() * 18);
    world.add(cloud);
    scrollers.push({ obj: cloud, factor: 0.35 });
  }

  world.traverse((o) => {
    if (o.isMesh && o !== ground && o !== road && o !== dashes && o.material !== cloudMat) {
      o.castShadow = true;
    }
  });

  let offset = 0;
  function update(dt, speed) {
    const dx = speed * dt;
    offset += dx;
    for (let i = 0; i < dashCount; i++) {
      m.makeTranslation(wrap(dashX[i] - offset), 0.02, 0);
      dashes.setMatrixAt(i, m);
    }
    dashes.instanceMatrix.needsUpdate = true;
    for (const s of scrollers) s.obj.position.x = wrap(s.obj.position.x - dx * s.factor);
  }

  update(0, 0);
  return { object: world, update };
}
