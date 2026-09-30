import * as THREE from 'three';
import './style.css';
import { createCar } from './car.js';
import { createTerrain } from './terrain.js';
import { createWorld } from './world.js';
import { createSky } from './sky.js';
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
const car = createCar();
scene.add(car.object);

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

// --- Day / night -------------------------------------------------------------
// Follows the visitor's local time until they flip the switch.
const toggle = document.querySelector('.daynight');
let mode = 'auto';
const localHour = () => {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
};
let hour = localHour();
let isNight = null;

toggle.addEventListener('click', () => {
  mode = isNight ? 'day' : 'night';
});

function setNight(night) {
  if (night === isNight) return;
  isNight = night;
  document.body.classList.toggle('is-night', night);
  toggle.setAttribute('aria-checked', String(night));
  document.querySelector('meta[name="theme-color"]').content = night ? '#1d2a52' : '#d6ebf7';
}

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
  const target = mode === 'auto' ? localHour() : mode === 'day' ? 13 : 23;
  const ahead = (((target - hour) % 24) + 24) % 24;
  hour = (hour + Math.min(ahead, Math.max(ahead * dt * 1.5, dt * 2))) % 24;
  if (ahead > 12 && mode === 'auto') hour = target; // clock went backwards (e.g. DST)

  // Drive along the winding road at a steady speed.
  const slope = roadSlope(carPos.z);
  carPos.z -= (SPEED * dt) / Math.hypot(1, slope);
  carPos.x = roadX(carPos.z);
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
  camera.position.set(
    camX + 6 + parallax.x * 1.2,
    (4 - parallax.y * 0.5) * distance,
    carPos.z + 12.5 * distance,
  );
  camera.lookAt(lookAt.set(lookX, 2.3, carPos.z - 30));

  terrain.update(t, carPos.z);
  world.update(t, dt, carPos, camX);
  renderer.render(scene, camera);
});
