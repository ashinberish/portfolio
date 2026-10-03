import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { palette } from './palette.js';

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra });

const box = (w, h, d, r, material) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), material);

const WHEEL_RADIUS = 0.3;

// A little red Mini Cooper: white roof, bonnet stripes, round headlights.
// Local +x is forward.
export function createCar() {
  const car = new THREE.Group();
  const body = new THREE.Group();
  car.add(body);

  const paint = mat(palette.carBody, { roughness: 0.35, metalness: 0.1 });
  const trim = mat(palette.carTrim, { roughness: 0.4 });
  const dark = mat(palette.tire, { roughness: 0.9 });
  const chrome = mat(palette.hub, { roughness: 0.25, metalness: 0.6 });
  const glassMat = mat(palette.glass, { roughness: 0.15 });

  // Short, wide body sitting on the wheels.
  const chassis = box(2.3, 0.52, 1.24, 0.2, paint);
  chassis.position.y = 0.6;
  body.add(chassis);

  // Black sill and wheel-arch trims.
  for (const z of [-0.6, 0.6]) {
    const sill = box(1.0, 0.1, 0.06, 0.03, dark);
    sill.position.set(-0.02, 0.4, z);
    body.add(sill);
  }
  const archGeo = new THREE.TorusGeometry(0.36, 0.05, 6, 20, Math.PI);
  for (const x of [-0.72, 0.74]) {
    for (const z of [-0.6, 0.6]) {
      const arch = new THREE.Mesh(archGeo, dark);
      arch.position.set(x, 0.3, z);
      body.add(arch);
    }
  }

  // Upright glasshouse with blacked-out pillars and a "floating" white roof.
  const glass = box(1.36, 0.38, 1.1, 0.1, glassMat);
  glass.position.set(-0.3, 1.04, 0);
  body.add(glass);
  for (const x of [-0.95, 0.35]) {
    for (const z of [-0.53, 0.53]) {
      const pillar = box(0.1, 0.38, 0.08, 0.03, dark);
      pillar.position.set(x, 1.04, z);
      body.add(pillar);
    }
  }
  const roof = box(1.46, 0.09, 1.16, 0.04, trim);
  roof.position.set(-0.3, 1.26, 0);
  body.add(roof);

  // Twin white bonnet stripes, continued over the roof.
  for (const z of [-0.13, 0.13]) {
    const stripe = box(0.72, 0.02, 0.12, 0.01, trim);
    stripe.position.set(0.76, 0.865, z);
    body.add(stripe);
    const roofStripe = box(1.36, 0.02, 0.12, 0.01, paint);
    roofStripe.position.set(-0.3, 1.31, z);
    body.add(roofStripe);
  }

  // Side mirrors, red with white caps.
  for (const z of [-0.68, 0.68]) {
    const mirror = box(0.08, 0.1, 0.14, 0.03, trim);
    mirror.position.set(0.3, 0.92, z);
    body.add(mirror);
  }

  // Bumpers and the hexagonal grille.
  for (const x of [-1.16, 1.16]) {
    const bumper = box(0.1, 0.12, 1.2, 0.05, chrome);
    bumper.position.set(x, 0.42, 0);
    body.add(bumper);
  }
  const grilleGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 6);
  grilleGeo.rotateZ(Math.PI / 2);
  const grille = new THREE.Mesh(grilleGeo, dark);
  grille.scale.set(1, 0.7, 1.3);
  grille.position.set(1.15, 0.6, 0);
  body.add(grille);

  // Big round headlights with chrome rings; tall tail lights.
  const headGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.06, 20);
  headGeo.rotateZ(Math.PI / 2);
  const ringGeo = new THREE.TorusGeometry(0.125, 0.025, 6, 20);
  ringGeo.rotateY(Math.PI / 2);
  const headMat = mat(palette.headlight, { emissive: palette.headlight, emissiveIntensity: 0.3 });
  const tailMat = mat(palette.taillight, { emissive: palette.taillight, emissiveIntensity: 0.3 });
  const tailGeo = new RoundedBoxGeometry(0.05, 0.2, 0.12, 2, 0.02);
  for (const z of [-0.4, 0.4]) {
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(1.14, 0.7, z);
    const ring = new THREE.Mesh(ringGeo, chrome);
    ring.position.set(1.16, 0.7, z);
    body.add(head, ring);
    const tail = new THREE.Mesh(tailGeo, tailMat);
    tail.position.set(-1.15, 0.7, z);
    body.add(tail);
  }

  const tireGeo = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.24, 20);
  tireGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.26, 12);
  hubGeo.rotateX(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.36, 0.06, 0.25);
  const hubMat = mat(palette.hub);

  const wheels = [];
  for (const x of [-0.72, 0.74]) {
    for (const z of [-0.54, 0.54]) {
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
  beam.position.set(1.2, 0.72, 0);
  beam.target.position.set(8, 0, 0);
  car.add(beam, beam.target);

  // Headlights blink along with the horn.
  let flash = 0;
  function honk() {
    flash = 0.45;
  }

  function update(t, dt, speed, yawRate, night) {
    for (const wheel of wheels) wheel.rotation.z -= (speed * dt) / WHEEL_RADIUS;

    // Bumpy dirt road, and a lean out of the bends.
    body.position.y = Math.abs(Math.sin(t * 13)) * 0.025 + Math.sin(t * 3.1) * 0.012;
    const lean = THREE.MathUtils.clamp(yawRate * 0.12, -0.08, 0.08);
    body.rotation.x += (lean - body.rotation.x) * Math.min(1, dt * 4);
    body.rotation.z = Math.sin(t * 7) * 0.012;

    flash = Math.max(0, flash - dt);
    const blink = flash > 0 && (flash > 0.3 || flash < 0.2) ? 1 : 0;
    beam.intensity = night * 30 + blink * 25;
    headMat.emissiveIntensity = 0.3 + night * 2 + blink * 3;
    tailMat.emissiveIntensity = 0.3 + night * 1.5;
  }

  return { object: car, update, honk };
}
