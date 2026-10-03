import * as THREE from 'three';
import './style.css';
import { createCar } from './car.js';
import { createTerrain } from './terrain.js';
import { createWorld } from './world.js';
import { createSky } from './sky.js';
import { createAudio } from './audio.js';
import { createTraffic } from './traffic.js';
import { createPlanes } from './planes.js';
import { createCursor } from './cursor.js';
import { createIntro } from './intro.js';
import { roadSlope, roadX } from './path.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);

const terrain = createTerrain();
scene.add(terrain.object);
const world = createWorld();
scene.add(world.object);
const sky = createSky(scene);
const intro = createIntro(scene);
const car = createCar();
scene.add(car.object);
const traffic = createTraffic();
scene.add(traffic.object);
const planes = createPlanes();
scene.add(planes.object);

createCursor();

// Dust puffs live in world space so they trail behind on bends.
const puffGeo = new THREE.IcosahedronGeometry(0.14, 1);
const puffs = Array.from({ length: 12 }, () => {
  const puff = new THREE.Mesh(
    puffGeo,
    new THREE.MeshStandardMaterial({ color: 0xe8dcc6, roughness: 1, transparent: true, opacity: 0 }),
  );
  puff.userData.life = 1;
  scene.add(puff);
  return puff;
});
let puffTimer = 0;
let puffIndex = 0;
const exhaust = new THREE.Vector3(-1.35, 0.3, 0.3);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPEED = reducedMotion ? 2.5 : 6.5;

// Remembered preferences (wrapped: storage can be unavailable or throw).
const store = {
  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage unavailable; the setting still works for this visit.
    }
  },
};

// --- Day / night -------------------------------------------------------------
// Follows the visitor's local time until they flip the switch; the choice is remembered.
const toggle = document.querySelector('.daynight');
const MODE_HOUR = { day: 13, night: 23 };
const localHour = () => {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
};
const savedMode = store.get('daynight');
let mode = Object.hasOwn(MODE_HOUR, savedMode ?? '') ? savedMode : 'auto';
// A remembered choice starts there directly, without gliding through the clock.
let hour = mode === 'auto' ? localHour() : MODE_HOUR[mode];
let isNight = null;

toggle.addEventListener('click', () => {
  mode = isNight ? 'day' : 'night';
  store.set('daynight', mode);
});

function setNight(night) {
  if (night === isNight) return;
  isNight = night;
  document.body.classList.toggle('is-night', night);
  toggle.setAttribute('aria-checked', String(night));
  document.querySelector('meta[name="theme-color"]').content = night ? '#1d2a52' : '#d6ebf7';
}
if (mode !== 'auto') setNight(mode === 'night');

// --- Sound -------------------------------------------------------------------
// Off by default; remembers the choice, but browsers still need a gesture to start.
const audio = createAudio();
const soundButton = document.querySelector('.sound');
function setSound(on) {
  audio.setEnabled(on);
  soundButton.setAttribute('aria-pressed', String(on));
  soundButton.setAttribute('aria-label', on ? 'Mute sound' : 'Play sound');
  store.set('sound', on ? 'on' : 'off');
}
soundButton.addEventListener('click', () => setSound(!audio.enabled));
if (store.get('sound') === 'on') {
  const resume = (e) => {
    if (e.target.closest?.('.sound')) return; // the button handles itself
    if (!audio.enabled) setSound(true);
  };
  window.addEventListener('pointerdown', resume, { once: true });
  window.addEventListener('keydown', resume, { once: true });
}

// --- Horn ----------------------------------------------------------------------
// Honk by clicking the wagon or pressing H; it also greets passing cyclists.
function honk() {
  car.honk();
  audio.horn();
}
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let pointerOverCar = false;
let pointerDirty = false;
let lastPointer = null;
function hitsCar(e) {
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObject(car.object, true).length > 0;
}
canvas.addEventListener('pointermove', (e) => {
  lastPointer = e;
  pointerDirty = true;
});
canvas.addEventListener('pointerdown', (e) => {
  if (hitsCar(e)) honk();
});
window.addEventListener('keydown', (e) => {
  if ((e.key === 'h' || e.key === 'H') && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) honk();
});

// --- Camera ------------------------------------------------------------------
const pointer = new THREE.Vector2();
const parallax = new THREE.Vector2();
window.addEventListener('pointermove', (e) => {
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
});

let distance = 1;
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Widen and pull back a little on portrait screens.
  const narrow = Math.max(0, 1 - camera.aspect);
  camera.fov = 42 + narrow * 20;
  distance = 1 + narrow * 0.6;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// --- Loop --------------------------------------------------------------------
const timer = new THREE.Timer();
timer.connect(document);
const carPos = new THREE.Vector3();
const lookAt = new THREE.Vector3();
let t = 0;
let yaw = null;
let camX = roadX(0);
let lookX = camX;

renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 1 / 20);
  t += dt;

  // Time of day: glide forward through the clock toward the target hour.
  const target = mode === 'auto' ? localHour() : MODE_HOUR[mode];
  const ahead = (((target - hour) % 24) + 24) % 24;
  hour = (hour + Math.min(ahead, Math.max(ahead * dt * 1.5, dt * 2))) % 24;
  if (ahead > 12 && mode === 'auto') hour = target; // clock went backwards (e.g. DST)

  // Drive along the winding road at a steady speed.
  const slope = roadSlope(carPos.z);
  carPos.z -= (SPEED * dt) / Math.hypot(1, slope);
  // Keep to the right-hand lane; cyclists come the other way on the left.
  carPos.x = roadX(carPos.z) + 0.7 * Math.hypot(1, roadSlope(carPos.z));
  // Local +x is the car's nose; travel direction is (-slope, -1) in xz.
  const newYaw = Math.atan2(1, -roadSlope(carPos.z));
  let yawRate = 0;
  if (yaw !== null) {
    yawRate = Math.atan2(Math.sin(newYaw - yaw), Math.cos(newYaw - yaw)) / Math.max(dt, 1e-3);
  }
  yaw = newYaw;
  car.object.position.copy(carPos);
  car.object.rotation.y = yaw;

  const { nightness, mood } = sky.update(hour, camera, carPos);
  terrain.applyMood(mood, nightness);
  world.applyMood(mood, nightness);
  setNight(nightness > 0.5);
  car.update(t, dt, SPEED, yawRate, nightness);

  puffTimer -= dt;
  if (puffTimer <= 0) {
    puffTimer = 0.1;
    const p = puffs[puffIndex++ % puffs.length];
    p.userData.life = 0;
    car.object.localToWorld(p.position.copy(exhaust));
  }
  for (const p of puffs) {
    if (p.userData.life >= 1) continue;
    p.userData.life = Math.min(1, p.userData.life + dt * 1.3);
    p.position.y += dt * 0.5;
    p.scale.setScalar(0.6 + p.userData.life * 2.2);
    p.material.opacity = 0.7 * (1 - p.userData.life);
  }

  // Chase camera: low and behind, easing sideways and glancing down the road ahead.
  const ease = Math.min(1, dt * 1.8);
  camX += (carPos.x - camX) * ease;
  lookX += (roadX(carPos.z - 26) * 0.6 + carPos.x * 0.4 - lookX) * ease;
  parallax.lerp(pointer, 1 - Math.pow(0.02, dt));
  // Sits off to the right for a three-quarter view of the wagon.
  const camPos = camera.position.set(
    camX + 6 + parallax.x * 1.2,
    (4 - parallax.y * 0.5) * distance,
    carPos.z + 12.5 * distance,
  );
  lookAt.set(lookX, 2.3, carPos.z - 30);
  intro.update(dt, carPos.z, camPos, lookAt, mood);
  camera.lookAt(lookAt);

  terrain.update(t, carPos.z);
  world.update(t, dt, carPos, camX);
  if (traffic.update(t, dt, carPos.z, nightness) && Math.random() < 0.7) honk();

  // The wagon is clickable: show the hover cursor over it (checked once per frame).
  if (pointerDirty) {
    pointerDirty = false;
    pointerOverCar = hitsCar(lastPointer);
    document.documentElement.classList.toggle('cursor-over-car', pointerOverCar);
  }
  const planeSound = planes.update(t, dt, carPos.z, camera.position, nightness);
  audio.update(t, yawRate, nightness, planeSound);
  renderer.render(scene, camera);
});
