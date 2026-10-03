import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Little propeller monoplanes crossing the sky ahead of the car.

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0, ...extra });

const box = (w, h, d, r, material) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), material);

const mod = (a, n) => ((a % n) + n) % n;
const SPAN = 240; // planes wrap within ±SPAN/2 of the camera

// Local +x is the nose, +y up, +z the right wing.
function monoplane(bodyColor, accentColor) {
  const g = new THREE.Group();
  const body = mat(bodyColor);
  const accent = mat(accentColor);
  const dark = mat(0x26303d, { roughness: 0.8 });

  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.7, 6, 12), body);
  fuselage.rotation.z = Math.PI / 2;
  fuselage.scale.set(1, 1, 0.9);
  g.add(fuselage);

  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.3, 14), accent);
  cowl.rotation.z = -Math.PI / 2;
  cowl.position.x = 1.08;
  g.add(cowl);

  const cockpit = box(0.6, 0.26, 0.46, 0.1, mat(0x243a5a, { roughness: 0.15 }));
  cockpit.position.set(0.25, 0.32, 0);
  g.add(cockpit);

  const wing = box(0.75, 0.08, 3.6, 0.04, accent);
  wing.position.set(0.25, -0.12, 0);
  g.add(wing);

  const stab = box(0.42, 0.05, 1.3, 0.02, accent);
  stab.position.set(-1.12, 0.08, 0);
  const fin = box(0.5, 0.6, 0.06, 0.03, accent);
  fin.position.set(-1.14, 0.4, 0);
  g.add(stab, fin);

  // Landing gear.
  for (const z of [-0.4, 0.4]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 5), dark);
    strut.position.set(0.55, -0.42, z * 0.8);
    strut.rotation.x = z > 0 ? -0.35 : 0.35;
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.07, 12), dark);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(0.55, -0.62, z);
    g.add(strut, wheel);
  }

  // Propeller spins about the nose axis.
  const prop = new THREE.Group();
  prop.position.x = 1.27;
  prop.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat(0xf2ecde)));
  const blade = new THREE.Mesh(new RoundedBoxGeometry(0.05, 1.15, 0.12, 2, 0.02), dark);
  prop.add(blade);
  // A faint disc so the spin reads as motion blur.
  const blur = new THREE.Mesh(
    new THREE.CircleGeometry(0.58, 20),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
  );
  blur.rotation.y = Math.PI / 2;
  prop.add(blur);
  g.add(prop);

  // Navigation lights: red left, green right, white tail strobe.
  const light = (color, x, y, z) => {
    const m = mat(color, { emissive: color, emissiveIntensity: 0 });
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), m);
    s.position.set(x, y, z);
    g.add(s);
    return m;
  };
  const lights = {
    left: light(0xff4d5e, 0.25, -0.1, -1.82),
    right: light(0x5dff9a, 0.25, -0.1, 1.82),
    strobe: light(0xffffff, -1.2, 0.72, 0),
  };

  g.traverse((o) => {
    if (o.isMesh && o !== blur) o.castShadow = true;
  });
  return { object: g, prop, lights };
}

export function createPlanes() {
  const group = new THREE.Group();
  const planes = [
    { ...monoplane(0xf2ecde, 0xe2574c), x: -50, y: 17, z: -70, speed: 9, dir: 1, phase: 0 },
    { ...monoplane(0xf6c35b, 0x4f86b8), x: 60, y: 22, z: -115, speed: 7.5, dir: -1, phase: 2.2 },
  ];
  for (const p of planes) {
    p.object.scale.setScalar(1.4);
    group.add(p.object);
  }

  const listener = new THREE.Vector3();
  const sound = { level: 0, pan: 0 };

  // Returns how loud and where the nearest plane is, for the engine drone.
  function update(t, dt, carZ, cameraPos, night) {
    sound.level = 0;
    for (const p of planes) {
      p.x = cameraPos.x + mod(p.x - cameraPos.x + p.dir * p.speed * dt + SPAN / 2, SPAN) - SPAN / 2;
      const climb = Math.cos(t * 0.45 + p.phase);
      const y = p.y + Math.sin(t * 0.45 + p.phase) * 1.8;
      p.object.position.set(p.x, y, carZ + p.z);
      // Gentle banking and nose following the climb.
      p.object.rotation.set(Math.sin(t * 0.6 + p.phase) * 0.12, p.dir > 0 ? 0 : Math.PI, climb * 0.08);
      p.prop.rotation.x += dt * 40;

      p.lights.left.emissiveIntensity = night * 3;
      p.lights.right.emissiveIntensity = night * 3;
      p.lights.strobe.emissiveIntensity = night * (mod(t + p.phase, 1.4) < 0.08 ? 6 : 0);

      const d = listener.copy(p.object.position).distanceTo(cameraPos);
      const level = Math.max(0, 1 - d / 150) ** 2;
      if (level > sound.level) {
        sound.level = level;
        sound.pan = Math.max(-1, Math.min(1, (p.x - cameraPos.x) / 50));
      }
    }
    return sound;
  }

  return { object: group, update };
}
