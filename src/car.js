import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { palette } from './palette.js';

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra });

const WHEEL_RADIUS = 0.3;

export function createCar() {
  const car = new THREE.Group();
  const body = new THREE.Group();
  car.add(body);

  const chassis = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.62, 1.25, 4, 0.24), mat(palette.carBody));
  chassis.position.y = 0.62;
  body.add(chassis);

  // Dark glass band slightly wider than the cabin reads as a wrap-around window.
  const glass = new THREE.Mesh(
    new RoundedBoxGeometry(1.24, 0.34, 1.07, 4, 0.14),
    mat(palette.glass, { roughness: 0.2 }),
  );
  glass.position.set(-0.12, 1.08, 0);
  body.add(glass);

  const cabin = new THREE.Mesh(new RoundedBoxGeometry(1.18, 0.62, 1.02, 4, 0.22), mat(palette.carCabin));
  cabin.position.set(-0.15, 1.1, 0);
  body.add(cabin);

  const lightGeo = new RoundedBoxGeometry(0.08, 0.16, 0.26, 2, 0.04);
  const headMat = mat(palette.headlight, { emissive: palette.headlight, emissiveIntensity: 0.6 });
  const tailMat = mat(palette.taillight, { emissive: palette.taillight, emissiveIntensity: 0.4 });
  for (const z of [-0.38, 0.38]) {
    const head = new THREE.Mesh(lightGeo, headMat);
    head.position.set(1.1, 0.7, z);
    body.add(head);
    const tail = new THREE.Mesh(lightGeo, tailMat);
    tail.position.set(-1.1, 0.7, z);
    body.add(tail);
  }

  const bumperGeo = new RoundedBoxGeometry(0.16, 0.14, 1.1, 2, 0.06);
  const bumperMat = mat(palette.carCabin);
  for (const x of [-1.12, 1.12]) {
    const bumper = new THREE.Mesh(bumperGeo, bumperMat);
    bumper.position.set(x, 0.42, 0);
    body.add(bumper);
  }

  const tireGeo = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.26, 20);
  tireGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.28, 12);
  hubGeo.rotateX(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.34, 0.06, 0.27);
  const tireMat = mat(palette.tire, { roughness: 0.9 });
  const hubMat = mat(palette.hub);

  const wheels = [];
  for (const x of [-0.7, 0.72]) {
    for (const z of [-0.58, 0.58]) {
      const wheel = new THREE.Group();
      wheel.add(new THREE.Mesh(tireGeo, tireMat));
      wheel.add(new THREE.Mesh(hubGeo, hubMat));
      wheel.add(new THREE.Mesh(spokeGeo, tireMat));
      wheel.position.set(x, WHEEL_RADIUS, z);
      car.add(wheel);
      wheels.push(wheel);
    }
  }

  car.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  // Exhaust puffs: a small recycled pool of spheres.
  const puffGeo = new THREE.IcosahedronGeometry(0.14, 1);
  const puffs = [];
  for (let i = 0; i < 10; i++) {
    const puff = new THREE.Mesh(
      puffGeo,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0 }),
    );
    puff.userData.life = 1;
    car.add(puff);
    puffs.push(puff);
  }
  let puffTimer = 0;
  let puffIndex = 0;

  function update(t, dt, speed) {
    for (const wheel of wheels) wheel.rotation.z -= (speed * dt) / WHEEL_RADIUS;

    // Engine rumble + gentle lane sway.
    body.position.y = Math.abs(Math.sin(t * 18)) * 0.025;
    body.rotation.z = Math.sin(t * 9) * 0.012;
    const sway = Math.sin(t * 0.6);
    car.position.z = sway * 0.35;
    car.rotation.y = -Math.cos(t * 0.6) * 0.04;
    body.rotation.x = -sway * 0.02;

    puffTimer -= dt;
    if (puffTimer <= 0) {
      puffTimer = 0.14;
      const p = puffs[puffIndex++ % puffs.length];
      p.userData.life = 0;
      p.position.set(-1.2, 0.38, -0.3);
    }
    for (const p of puffs) {
      if (p.userData.life >= 1) continue;
      p.userData.life = Math.min(1, p.userData.life + dt * 1.6);
      const life = p.userData.life;
      p.position.x -= speed * 0.35 * dt;
      p.position.y += dt * 0.5;
      p.scale.setScalar(0.6 + life * 1.6);
      p.material.opacity = 0.85 * (1 - life);
    }
  }

  return { object: car, update };
}
