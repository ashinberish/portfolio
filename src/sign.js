import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import fontData from './fonts/droid_sans_bold.typeface.json';

// A Hollywood-style sign of big white letters on a hillside at the end of the
// valley. It travels with the car (like the mountains) so it's always in view.

const HILL = { z: -178, y: -3, rx: 120, ry: 26, rz: 45 };
const SIGN_ANGLE = (42 * Math.PI) / 180; // where on the hill's slope the sign stands
const NAME_SIZE = 9;
const TITLE_SIZE = 3.2;
const CONDENSE = 0.82;
const TRACKING = 0.1;

const font = new FontLoader().parse(fontData);

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export function createSign(name, title) {
  const group = new THREE.Group();
  const rand = rng(9);

  // --- Hill -------------------------------------------------------------------
  const hillGeo = new THREE.SphereGeometry(1, 30, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const hp = hillGeo.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    // Rough it up a little for a low-poly look, keeping the rim on the ground.
    if (hp.getY(i) > 0.05) {
      hp.setX(i, hp.getX(i) + (rand() - 0.5) * 0.04);
      hp.setY(i, hp.getY(i) + (rand() - 0.5) * 0.05);
      hp.setZ(i, hp.getZ(i) + (rand() - 0.5) * 0.04);
    }
  }
  hillGeo.computeVertexNormals();
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x6f9f7e, flatShading: true, roughness: 1, fog: false });
  const hill = new THREE.Mesh(hillGeo, hillMat);
  hill.scale.set(HILL.rx, HILL.ry, HILL.rz);
  hill.position.set(0, HILL.y, HILL.z);
  hill.receiveShadow = true;
  group.add(hill);

  // --- Letters ----------------------------------------------------------------
  const letterMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.45,
    emissive: 0xfff1d6,
    emissiveIntensity: 0,
    fog: false,
  });
  const scaffoldMat = new THREE.MeshStandardMaterial({ color: 0x5b6470, roughness: 0.9, fog: false });

  const sign = new THREE.Group();
  sign.position.set(0, HILL.y + HILL.ry * Math.sin(SIGN_ANGLE), HILL.z + HILL.rz * Math.cos(SIGN_ANGLE));
  sign.rotation.x = -0.12; // lean back into the hill
  group.add(sign);

  const glyphs = fontData.glyphs;
  const advance = (ch, size) => ((glyphs[ch]?.ha ?? glyphs[' '].ha) * size) / fontData.resolution;

  function makeWord(text, size) {
    const letters = [];
    let x = 0;
    for (const ch of text.toUpperCase()) {
      if (ch !== ' ' && glyphs[ch]) {
        const geo = new TextGeometry(ch, {
          font,
          size,
          depth: size * 0.12,
          curveSegments: 4,
          bevelEnabled: true,
          bevelThickness: size * 0.02,
          bevelSize: size * 0.012,
          bevelSegments: 2,
        });
        geo.scale(CONDENSE, 1, 1);
        const mesh = new THREE.Mesh(geo, letterMat);
        mesh.castShadow = true;
        // Hollywood charm: every letter slightly askew.
        mesh.userData = { x, tilt: (rand() - 0.5) * 0.07, lift: (rand() - 0.5) * size * 0.04, delay: 0 };
        letters.push(mesh);
      }
      x += advance(ch, size) * CONDENSE + size * TRACKING;
    }
    return { letters, width: x - size * TRACKING, size };
  }

  const nameWords = name.trim().split(/\s+/).map((w) => makeWord(w, NAME_SIZE));
  const nameFull = makeWord(name.trim(), NAME_SIZE);
  const titleRow = makeWord(title.trim(), TITLE_SIZE);

  const rows = new THREE.Group();
  sign.add(rows);
  const scaffold = new THREE.Group();
  sign.add(scaffold);
  const postGeo = new THREE.BoxGeometry(0.18, 1, 0.18);
  const beamGeo = new THREE.BoxGeometry(1, 0.16, 0.16);

  let stacked = null;
  let reveal = [];

  // Lay out rows bottom-up: title on the lowest row, then the name.
  function layout(stack) {
    if (stack === stacked) return;
    stacked = stack;
    rows.clear();
    scaffold.clear();
    const nameRows = stack ? nameWords.slice().reverse() : [nameFull];
    const all = [titleRow, ...nameRows];
    let y = 0;
    let widest = 0;
    reveal = [];
    all.forEach((row, i) => {
      const rowGroup = new THREE.Group();
      rowGroup.position.set(-row.width / 2, y, 0);
      for (const l of row.letters) {
        l.position.set(l.userData.x, l.userData.lift, 0);
        l.rotation.z = l.userData.tilt;
        rowGroup.add(l);
      }
      rows.add(rowGroup);
      // Scaffolding behind each row down to the hill.
      const beam = new THREE.Mesh(beamGeo, scaffoldMat);
      beam.scale.x = row.width;
      beam.position.set(0, y + row.size * 0.3, -0.35);
      scaffold.add(beam);
      const legs = Math.max(2, Math.round(row.width / 5));
      for (let k = 0; k <= legs; k++) {
        const post = new THREE.Mesh(postGeo, scaffoldMat);
        const h = y + row.size * 0.9 + 2;
        post.scale.y = h;
        post.position.set(-row.width / 2 + (row.width * k) / legs, h / 2 - 2, -0.4);
        post.castShadow = true;
        scaffold.add(post);
      }
      widest = Math.max(widest, row.width);
      y += row.size + (i === 0 ? 2.2 : 1.6);
    });
    // Name letters rise first, then the title.
    [...nameRows.flatMap((r) => r.letters), ...titleRow.letters].forEach((l, i) => reveal.push({ l, delay: 0.5 + i * 0.08 }));
    sign.userData.width = widest;
  }

  const hazeTarget = new THREE.Color();
  const signWorld = new THREE.Vector3();
  const hillBase = new THREE.Color(0x6f9f7e);

  function applyMood(m, night) {
    // Far away, so blend toward the horizon by hand (fog is off for the sign).
    hillMat.color.copy(hillBase).multiply(m.groundTint).lerp(hazeTarget.copy(m.horizon), 0.45);
    letterMat.color.set(0xffffff).lerp(hazeTarget.copy(m.horizon), 0.12);
    scaffoldMat.color.set(0x5b6470).lerp(hazeTarget.copy(m.horizon), 0.35);
    // The sign is floodlit at night.
    letterMat.emissiveIntensity = night * 0.85;
  }

  // The letter-raising intro runs on wall-clock time; skipped for reduced motion.
  const start = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? -1e6 : performance.now();
  const view = new THREE.Vector3();
  let centreX = null;

  function update(carZ, camera) {
    // Keep the sign centred on the camera's line of sight (the camera sits off to one side).
    camera.getWorldDirection(view);
    const signZ = carZ + sign.position.z;
    const targetX = camera.position.x + (view.x * (signZ - camera.position.z)) / Math.min(view.z, -1e-3);
    centreX = centreX === null ? targetX : centreX + (targetX - centreX) * 0.05;
    group.position.set(centreX, 0, carZ);

    // Portrait screens stack the name; always scale to fit the view.
    layout(camera.aspect < 0.9);
    const distance = camera.position.distanceTo(sign.getWorldPosition(signWorld));
    const halfWidth = distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    sign.scale.setScalar(Math.min(1, (halfWidth * 2 * 0.86) / sign.userData.width));

    const clock = (performance.now() - start) / 1000;
    for (const { l, delay } of reveal) {
      const k = Math.min(1, Math.max(0, (clock - delay) / 0.6));
      // Spring up with a little overshoot.
      const s = k === 1 ? 1 : 1 - Math.pow(1 - k, 3) + Math.sin(k * Math.PI) * 0.15;
      l.scale.y = Math.max(0.001, s);
    }
  }

  return { object: group, update, applyMood };
}
