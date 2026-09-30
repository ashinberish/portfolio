import * as THREE from 'three';
import './style.css';
import { createCar } from './car.js';
import { createWorld } from './world.js';
import { createSky } from './sky.js';
import { pointAt, tangentAt } from './path.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);

const world = createWorld();
scene.add(world.object);
const sky = createSky(scene);
const car = createCar();
scene.add(car.object);

// Exhaust puffs live in world space so they trail behind on corners.
const puffGeo = new THREE.IcosahedronGeometry(0.14, 1);
const puffs = Array.from({ length: 12 }, () => {
  const puff = new THREE.Mesh(
    puffGeo,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0 }),
  );
  puff.userData.life = 1;
  scene.add(puff);
  return puff;
});
let puffTimer = 0;
let puffIndex = 0;
const exhaust = new THREE.Vector3(-1.25, 0.5, 0.35);

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
  document.querySelector('meta[name="theme-color"]').content = night ? '#2c2f60' : '#fde7d3';
}

// --- Camera ------------------------------------------------------------------
const pointer = new THREE.Vector2();
const parallax = new THREE.Vector2();
window.addEventListener('pointermove', (e) => {
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
});

let distance = 1;
let lookAhead = 18;
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Widen and pull back a little on portrait screens so the road still reads.
  const narrow = Math.max(0, 1 - camera.aspect);
  camera.fov = 40 + narrow * 22;
  distance = 1 + narrow * 0.5;
  lookAhead = 18 + narrow * 16;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// --- Loop --------------------------------------------------------------------
const timer = new THREE.Timer();
timer.connect(document);
const carPos = new THREE.Vector3();
const heading = new THREE.Vector3();
const lookAt = new THREE.Vector3();
let s = 0;
let t = 0;
let yaw = null;
let camX = 0;

renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 1 / 20);
  t += dt;

  // Time of day: glide forward through the clock toward the target hour.
  const target = mode === 'auto' ? localHour() : mode === 'day' ? 13 : 23;
  const ahead = (((target - hour) % 24) + 24) % 24;
  hour = (hour + Math.min(ahead, Math.max(ahead * dt * 1.5, dt * 2))) % 24;
  if (ahead > 12 && mode === 'auto') hour = target; // clock went backwards (e.g. DST)

  // Drive.
  s += SPEED * dt;
  pointAt(s, carPos);
  tangentAt(s, heading);
  const newYaw = Math.atan2(-heading.z, heading.x);
  let yawRate = 0;
  if (yaw !== null) {
    yawRate = Math.atan2(Math.sin(newYaw - yaw), Math.cos(newYaw - yaw)) / Math.max(dt, 1e-3);
  }
  yaw = newYaw;
  car.object.position.copy(carPos);
  car.object.rotation.y = yaw;

  const { nightness, mood } = sky.update(hour, camera, carPos);
  world.applyMood(mood, nightness);
  setNight(nightness > 0.5);
  car.update(t, dt, SPEED, yawRate, nightness);

  puffTimer -= dt;
  if (puffTimer <= 0) {
    puffTimer = 0.12;
    const p = puffs[puffIndex++ % puffs.length];
    p.userData.life = 0;
    car.object.localToWorld(p.position.copy(exhaust));
  }
  for (const p of puffs) {
    if (p.userData.life >= 1) continue;
    p.userData.life = Math.min(1, p.userData.life + dt * 1.5);
    p.position.y += dt * 0.6;
    p.scale.setScalar(0.6 + p.userData.life * 1.8);
    p.material.opacity = 0.8 * (1 - p.userData.life);
  }

  // Camera trails behind and above, easing sideways so the zig-zag stays calm.
  camX += (carPos.x * 0.4 - camX) * Math.min(1, dt * 1.5);
  parallax.lerp(pointer, 1 - Math.pow(0.02, dt));
  camera.position.set(
    camX + parallax.x * 1.5,
    (5.5 - parallax.y * 0.6) * distance,
    carPos.z + 15 * distance,
  );
  camera.lookAt(lookAt.set(camX, 0, carPos.z - lookAhead));

  world.update(t, dt, carPos, camX);
  renderer.render(scene, camera);
});
