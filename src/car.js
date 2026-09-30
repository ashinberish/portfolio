import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { palette } from './palette.js';

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra });

const box = (w, h, d, r, material) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), material);

const WHEEL_RADIUS = 0.36;

// A chunky little SUV. Local +x is forward.
export function createCar() {
  const car = new THREE.Group();
  const body = new THREE.Group();
  car.add(body);

  const paint = mat(palette.carBody);
  const trim = mat(palette.carTrim);
  const dark = mat(palette.tire, { roughness: 0.9 });
  const glassMat = mat(palette.glass, { roughness: 0.15 });

  const chassis = box(2.15, 0.6, 1.3, 0.2, paint);
  chassis.position.y = 0.78;
  body.add(chassis);

  // Dark glass band slightly wider than the cabin reads as wrap-around windows.
  const glass = box(1.5, 0.38, 1.24, 0.12, glassMat);
  glass.position.set(-0.18, 1.3, 0);
  body.add(glass);

  const cabin = box(1.44, 0.6, 1.18, 0.14, paint);
  cabin.position.set(-0.18, 1.3, 0);
  body.add(cabin);

  const roof = box(1.5, 0.12, 1.24, 0.06, trim);
  roof.position.set(-0.18, 1.62, 0);
  body.add(roof);

  // Roof rack with a little cargo box.
  for (const z of [-0.45, 0.45]) {
    const rail = box(1.3, 0.07, 0.07, 0.03, dark);
    rail.position.set(-0.18, 1.73, z);
    body.add(rail);
  }
  const cargo = box(0.8, 0.26, 0.7, 0.1, trim);
  cargo.position.set(-0.28, 1.88, 0);
  body.add(cargo);

  // Chunky bumpers / skid plates.
  for (const x of [-1.1, 1.1]) {
    const bumper = box(0.22, 0.2, 1.22, 0.08, dark);
    bumper.position.set(x, 0.55, 0);
    body.add(bumper);
  }
  const grille = box(0.06, 0.2, 0.5, 0.04, dark);
  grille.position.set(1.08, 0.86, 0);
  body.add(grille);

  const headGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16);
  headGeo.rotateZ(Math.PI / 2);
  const headMat = mat(palette.headlight, { emissive: palette.headlight, emissiveIntensity: 0.4 });
  const tailMat = mat(palette.taillight, { emissive: palette.taillight, emissiveIntensity: 0.4 });
  const tailGeo = new RoundedBoxGeometry(0.06, 0.22, 0.14, 2, 0.03);
  for (const z of [-0.42, 0.42]) {
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(1.08, 0.88, z);
    body.add(head);
    const tail = new THREE.Mesh(tailGeo, tailMat);
    tail.position.set(-1.08, 0.9, z * 1.1);
    body.add(tail);
  }

  const tireGeo = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.3, 20);
  tireGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.32, 12);
  hubGeo.rotateX(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.42, 0.07, 0.31);
  const hubMat = mat(palette.hub);

  const makeWheel = () => {
    const wheel = new THREE.Group();
    wheel.add(new THREE.Mesh(tireGeo, dark));
    wheel.add(new THREE.Mesh(hubGeo, hubMat));
    wheel.add(new THREE.Mesh(spokeGeo, dark));
    return wheel;
  };

  const wheels = [];
  for (const x of [-0.68, 0.7]) {
    for (const z of [-0.62, 0.62]) {
      const wheel = makeWheel();
      wheel.position.set(x, WHEEL_RADIUS, z);
      car.add(wheel);
      wheels.push(wheel);
    }
  }

  // Spare wheel on the tailgate.
  const spare = makeWheel();
  spare.rotation.y = Math.PI / 2;
  spare.scale.setScalar(0.8);
  spare.position.set(-1.2, 1.0, 0);
  body.add(spare);

  car.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  // Headlight beam for night time.
  const beam = new THREE.SpotLight(0xfff0c8, 0, 22, 0.55, 0.7, 1.2);
  beam.position.set(1.1, 0.9, 0);
  beam.target.position.set(7, 0, 0);
  car.add(beam, beam.target);

  let leanTarget = 0;

  function update(t, dt, speed, yawRate, night) {
    for (const wheel of wheels) wheel.rotation.z -= (speed * dt) / WHEEL_RADIUS;

    // Engine rumble, and lean out of the corners.
    body.position.y = Math.abs(Math.sin(t * 16)) * 0.025;
    leanTarget = THREE.MathUtils.clamp(yawRate * 0.06, -0.12, 0.12);
    body.rotation.x += (leanTarget - body.rotation.x) * Math.min(1, dt * 6);
    body.rotation.z = Math.sin(t * 9) * 0.01;

    beam.intensity = night * 30;
    headMat.emissiveIntensity = 0.4 + night * 2;
    tailMat.emissiveIntensity = 0.4 + night * 1.5;
  }

  return { object: car, update };
}
