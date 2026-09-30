import * as THREE from 'three';
import { palette } from './palette.js';

// Far-away things that follow the car: mountain range, clouds and birds.

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...extra });

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const mod = (a, n) => ((a % n) + n) % n;

export function createWorld() {
  const world = new THREE.Group();
  const rand = rng(11);
  const blobGeo = new THREE.IcosahedronGeometry(1, 0);

  // --- Mountains: three layers, paler with distance -----------------------------
  const mountains = new THREE.Group();
  world.add(mountains);
  const layerMats = [0, 1, 2].map(() => mat(0xffffff, { flatShading: true, fog: false }));
  const snowMat = mat(0xffffff, { flatShading: true, fog: false });
  const layers = [
    { count: 16, z: -300, h: [26, 20], spread: 640 },
    { count: 13, z: -250, h: [18, 16], spread: 520 },
    { count: 11, z: -205, h: [10, 10], spread: 440 },
  ];
  layers.forEach((layer, li) => {
    for (let i = 0; i < layer.count; i++) {
      const h = layer.h[0] + rand() * layer.h[1];
      const r = h * (1.2 + rand() * 0.6);
      const x = (i / (layer.count - 1) - 0.5) * layer.spread + (rand() - 0.5) * 30;
      const z = layer.z - rand() * 25;
      const segs = 5 + Math.floor(rand() * 3);
      const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, segs), layerMats[li]);
      peak.position.set(x, h / 2 - 3, z);
      peak.rotation.y = rand() * Math.PI;
      mountains.add(peak);
      if (h > 22) {
        const capH = h * 0.26;
        const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.26 * 1.03, capH, segs), snowMat);
        cap.position.set(x, h - 3 - capH / 2 + 0.05, z);
        cap.rotation.y = peak.rotation.y;
        mountains.add(cap);
      }
    }
  });

  // --- Clouds -------------------------------------------------------------------
  const cloudMat = mat(0xffffff, {
    flatShading: true,
    roughness: 1,
    emissive: 0xffffff,
    emissiveIntensity: 0.4,
  });
  const CLOUD_SPAN = 220;
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rand() * 4);
    for (let j = 0; j < puffs; j++) {
      const pf = new THREE.Mesh(blobGeo, cloudMat);
      pf.scale.set(1.2 + rand() * 1.3, 0.8 + rand() * 0.8, 1 + rand());
      pf.position.set(j * 1.7 - puffs * 0.85, rand() * 0.7, rand() * 1);
      cloud.add(pf);
    }
    cloud.position.set((rand() * 2 - 1) * 90, 16 + rand() * 10, 0);
    cloud.userData = { baseZ: -rand() * CLOUD_SPAN, drift: 0.4 + rand() * 0.6 };
    world.add(cloud);
    clouds.push(cloud);
  }

  // --- Birds --------------------------------------------------------------------
  const birdMat = mat(palette.bird, { flatShading: true });
  const birdBody = new THREE.IcosahedronGeometry(0.16, 0);
  birdBody.scale(2, 0.8, 0.8);
  const wingGeo = new THREE.BoxGeometry(0.28, 0.02, 0.6);
  wingGeo.translate(0, 0, 0.3);
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
      bird.position.set(-row * 0.9, (rand() - 0.5) * 0.3, (b % 2 === 0 ? 1 : -1) * row * 0.8);
      bird.userData = { left, right, phase: rand() * Math.PI * 2 };
      flock.add(bird);
      birds.push(bird);
    }
    flock.position.set((rand() * 2 - 1) * 50, 9 + rand() * 5, 0);
    flock.scale.setScalar(0.8);
    flock.userData = { birds, baseZ: -30 - rand() * 50, speed: 3 + rand() * 2 };
    world.add(flock);
    flocks.push(flock);
  }

  const tmp = new THREE.Color();
  function applyMood(m, night) {
    layerMats[2].color.copy(m.mountain);
    layerMats[1].color.copy(m.mountain).lerp(tmp.copy(m.mountainFar), 0.5);
    layerMats[0].color.copy(m.mountainFar);
    snowMat.color.copy(m.snow);
    cloudMat.color.copy(m.cloud);
    cloudMat.emissive.copy(m.cloud);
    for (const flock of flocks) flock.visible = night < 0.85;
  }

  function update(t, dt, car, cameraX) {
    mountains.position.set(cameraX * 0.9, 0, car.z);

    for (const cloud of clouds) {
      cloud.position.x = mod(cloud.position.x + cloud.userData.drift * dt + 100, 200) - 100;
      cloud.position.z = car.z - 30 - mod(car.z - cloud.userData.baseZ, CLOUD_SPAN);
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
