import * as THREE from 'three';

// The road zig-zags toward -z: straight legs at ±45° joined by 90° rounded corners.
export const AMPLITUDE = 7;
export const CORNER_RADIUS = 3.5;
export const ROAD_HALF_WIDTH = 1.7;

const LEG = 2 * AMPLITUDE * Math.SQRT2;
const STRAIGHT = LEG - 2 * CORNER_RADIUS;

// Every two corners the path repeats, shifted by this much along z.
export const Z_PERIOD = 4 * AMPLITUDE;

const corner = (i, out = new THREE.Vector3()) =>
  out.set((((i % 2) + 2) % 2 === 0 ? -1 : 1) * AMPLITUDE, 0, -2 * AMPLITUDE * i);

const dir = (i, out = new THREE.Vector3()) =>
  out.set((((i % 2) + 2) % 2 === 0 ? 1 : -1), 0, -1).normalize();

const _c0 = new THREE.Vector3();
const _c1 = new THREE.Vector3();
const _d0 = new THREE.Vector3();
const _d1 = new THREE.Vector3();
const _p0 = new THREE.Vector3();
const _p2 = new THREE.Vector3();

function bezier(i, w, out) {
  corner(i + 1, _c1);
  _p0.copy(_c1).addScaledVector(dir(i, _d0), -CORNER_RADIUS);
  _p2.copy(_c1).addScaledVector(dir(i + 1, _d1), CORNER_RADIUS);
  const a = (1 - w) * (1 - w);
  const b = 2 * w * (1 - w);
  const c = w * w;
  return out.set(
    a * _p0.x + b * _c1.x + c * _p2.x,
    0,
    a * _p0.z + b * _c1.z + c * _p2.z,
  );
}

// Arc length of one rounded corner (quadratic Bézier), measured once.
const ARC = (() => {
  let len = 0;
  const prev = bezier(0, 0, new THREE.Vector3());
  const next = new THREE.Vector3();
  for (let k = 1; k <= 200; k++) {
    bezier(0, k / 200, next);
    len += next.distanceTo(prev);
    prev.copy(next);
  }
  return len;
})();

const LEG_LENGTH = STRAIGHT + ARC;
// Path distance covered by one Z_PERIOD.
export const S_PERIOD = 2 * LEG_LENGTH;

// Position along the road at distance s. Corners are parametrised linearly,
// which gently slows the car mid-turn like a real driver would.
export function pointAt(s, out = new THREE.Vector3()) {
  const i = Math.floor(s / LEG_LENGTH);
  const u = s - i * LEG_LENGTH;
  if (u < STRAIGHT) {
    return out.copy(corner(i, _c0)).addScaledVector(dir(i, _d0), CORNER_RADIUS + u);
  }
  return bezier(i, (u - STRAIGHT) / ARC, out);
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
export function tangentAt(s, out = new THREE.Vector3()) {
  pointAt(s - 0.05, _a);
  pointAt(s + 0.05, _b);
  return out.subVectors(_b, _a).normalize();
}

// The road's centre x for a given z (a triangle wave), used to keep scenery off it.
export function roadXAt(z) {
  const t = -z / (2 * AMPLITUDE);
  const i = Math.floor(t);
  const f = t - i;
  const from = ((i % 2) + 2) % 2 === 0 ? -AMPLITUDE : AMPLITUDE;
  return from + (-2 * from) * f;
}

// Lamp posts sit on the outside of every corner.
export function cornerPoint(i, out = new THREE.Vector3()) {
  return corner(i, out);
}
