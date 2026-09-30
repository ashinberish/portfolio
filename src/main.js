import * as THREE from 'three';
import './style.css';
import { palette } from './palette.js';
import { createCar } from './car.js';
import { createWorld } from './world.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(palette.sky);
scene.fog = new THREE.Fog(palette.sky, 28, 60);

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
const cameraBase = new THREE.Vector3(-10, 10, 20);
const lookTarget = new THREE.Vector3(1.5, 3.6, 0);

scene.add(new THREE.HemisphereLight(0xfff6ee, 0xa9c9a0, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-8, 16, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 20;
sun.shadow.camera.bottom = -20;
sun.shadow.radius = 4;
sun.shadow.bias = -0.0005;
scene.add(sun);

const world = createWorld();
scene.add(world.object);

const car = createCar();
scene.add(car.object);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPEED = reducedMotion ? 2 : 7;

// Subtle camera parallax following the pointer.
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
  // Widen and pull back a little on portrait screens so the road still reads.
  const narrow = Math.max(0, 1 - camera.aspect);
  camera.fov = 30 + narrow * 30;
  distance = 1 + narrow * 0.8;
  scene.fog.near = 28 * distance;
  scene.fog.far = 60 * distance;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const timer = new THREE.Timer();
timer.connect(document);
const offset = new THREE.Vector3();
let t = 0;
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 1 / 20);
  t += dt;

  world.update(dt, SPEED);
  car.update(t, dt, SPEED);

  parallax.lerp(pointer, 1 - Math.pow(0.02, dt));
  camera.position
    .copy(cameraBase)
    .multiplyScalar(distance)
    .add(offset.set(parallax.x * 1.5, -parallax.y * 0.8, 0));
  camera.lookAt(lookTarget);

  renderer.render(scene, camera);
});
