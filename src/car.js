import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { palette } from './palette.js';

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra });

const box = (w, h, d, r, material) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), material);

const WHEEL_RADIUS = 0.3;

// A little road-trip station wagon with wood panelling and a canoe on the roof.
// Local +x is forward.
export function createCar() {
  const car = new THREE.Group();
  const body = new THREE.Group();
  car.add(body);

  const paint = mat(palette.carBody);
  const trim = mat(palette.carTrim);
  const wood = mat(palette.wood, { roughness: 0.8 });
  const dark = mat(palette.tire, { roughness: 0.9 });
  const glassMat = mat(palette.glass, { roughness: 0.15 });

  const chassis = box(2.5, 0.5, 1.22, 0.18, paint);
  chassis.position.y = 0.62;
  body.add(chassis);

  // Wood side panels.
  for (const z of [-0.615, 0.615]) {
    const panel = box(1.7, 0.24, 0.04, 0.02, wood);
    panel.position.set(-0.3, 0.64, z);
    body.add(panel);
  }

  // Long wagon cabin: dark glass band slightly proud of the pillars.
  const glass = box(1.72, 0.34, 1.14, 0.1, glassMat);
  glass.position.set(-0.36, 1.07, 0);
  body.add(glass);
  const cabin = box(1.66, 0.5, 1.08, 0.12, paint);
  cabin.position.set(-0.38, 1.07, 0);
  body.add(cabin);
  const roof = box(1.74, 0.09, 1.16, 0.04, trim);
  roof.position.set(-0.38, 1.35, 0);
  body.add(roof);

  // Roof rack and canoe.
  for (const x of [-0.95, 0.15]) {
    const bar = box(0.07, 0.07, 1.1, 0.03, dark);
    bar.position.set(x, 1.44, 0);
    body.add(bar);
  }
  const canoeGeo = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const canoe = new THREE.Mesh(canoeGeo, mat(palette.canoe, { side: THREE.DoubleSide }));
  canoe.scale.set(1.3, 0.22, 0.3);
  canoe.rotation.x = Math.PI; // hull up
  canoe.position.set(-0.4, 1.5, 0);
  body.add(canoe);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.06, 6, 32),
    mat(palette.wood, { roughness: 0.8 }),
  );
  rim.scale.set(1.3, 0.3, 1);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(-0.4, 1.5, 0);
  body.add(rim);

  // Bumpers.
  for (const x of [-1.27, 1.27]) {
    const bumper = box(0.12, 0.14, 1.16, 0.05, trim);
    bumper.position.set(x, 0.46, 0);
    body.add(bumper);
  }
  const grille = box(0.05, 0.16, 0.5, 0.03, dark);
  grille.position.set(1.25, 0.68, 0);
  body.add(grille);

  const headGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.06, 16);
  headGeo.rotateZ(Math.PI / 2);
  const headMat = mat(palette.headlight, { emissive: palette.headlight, emissiveIntensity: 0.3 });
  const tailMat = mat(palette.taillight, { emissive: palette.taillight, emissiveIntensity: 0.3 });
  const tailGeo = new RoundedBoxGeometry(0.05, 0.18, 0.14, 2, 0.02);
  for (const z of [-0.42, 0.42]) {
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(1.25, 0.72, z);
    body.add(head);
    const tail = new THREE.Mesh(tailGeo, tailMat);
    tail.position.set(-1.25, 0.72, z);
    body.add(tail);
  }

  const tireGeo = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.24, 20);
  tireGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.26, 12);
  hubGeo.rotateX(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.36, 0.06, 0.25);
  const hubMat = mat(palette.hub);

  const wheels = [];
  for (const x of [-0.82, 0.8]) {
    for (const z of [-0.56, 0.56]) {
      const wheel = new THREE.Group();
      wheel.add(new THREE.Mesh(tireGeo, dark), new THREE.Mesh(hubGeo, hubMat), new THREE.Mesh(spokeGeo, dark));
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

  // Headlight beam for night time.
  const beam = new THREE.SpotLight(0xfff0c8, 0, 24, 0.5, 0.7, 1.2);
  beam.position.set(1.3, 0.75, 0);
  beam.target.position.set(8, 0, 0);
  car.add(beam, beam.target);

  function update(t, dt, speed, yawRate, night) {
    for (const wheel of wheels) wheel.rotation.z -= (speed * dt) / WHEEL_RADIUS;

    // Bumpy dirt road, and a lean out of the bends.
    body.position.y = Math.abs(Math.sin(t * 13)) * 0.025 + Math.sin(t * 3.1) * 0.012;
    const lean = THREE.MathUtils.clamp(yawRate * 0.12, -0.08, 0.08);
    body.rotation.x += (lean - body.rotation.x) * Math.min(1, dt * 4);
    body.rotation.z = Math.sin(t * 7) * 0.012;

    beam.intensity = night * 30;
    headMat.emissiveIntensity = 0.3 + night * 2;
    tailMat.emissiveIntensity = 0.3 + night * 1.5;
  }

  return { object: car, update };
}
