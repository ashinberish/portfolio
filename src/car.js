import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { palette } from './palette.js';

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra });

const box = (w, h, d, r, material) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), material);

const WHEEL_RADIUS = 0.28;

// A little red Mini Cooper convertible, roof folded down: bonnet stripes,
// big round headlights, cream seats. Local +x is forward.
export function createCar() {
  const car = new THREE.Group();
  const body = new THREE.Group();
  car.add(body);

  const paint = mat(palette.carBody, { roughness: 0.35, metalness: 0.1 });
  const trim = mat(palette.carTrim, { roughness: 0.4 });
  const dark = mat(palette.tire, { roughness: 0.9 });
  const chrome = mat(palette.hub, { roughness: 0.25, metalness: 0.6 });
  const seatMat = mat(palette.seat, { roughness: 0.7 });
  const glassMat = mat(palette.glass, { roughness: 0.1, transparent: true, opacity: 0.4 });

  // Short, wide, rounded lower body with the wheels pushed out to the corners.
  const chassis = box(2.24, 0.5, 1.22, 0.18, paint);
  chassis.position.y = 0.54;
  body.add(chassis);

  // Short bonnet sloping down to the nose, with twin white stripes.
  const bonnet = box(0.82, 0.16, 1.18, 0.07, paint);
  bonnet.rotation.z = -0.1;
  bonnet.position.set(0.72, 0.8, 0);
  for (const z of [-0.13, 0.13]) {
    const stripe = box(0.76, 0.02, 0.12, 0.01, trim);
    stripe.position.set(0, 0.075, z);
    bonnet.add(stripe);
  }
  body.add(bonnet);

  // Open cabin: door tops and rear deck around a dark tub.
  for (const z of [-0.56, 0.56]) {
    const door = box(0.9, 0.2, 0.1, 0.05, paint);
    door.position.set(-0.12, 0.85, z);
    body.add(door);
  }
  const deck = box(0.6, 0.18, 1.2, 0.08, paint);
  deck.position.set(-0.82, 0.84, 0);
  body.add(deck);
  const tub = box(0.9, 0.06, 1.02, 0.02, dark);
  tub.position.set(-0.12, 0.8, 0);
  body.add(tub);

  // Folded soft top stacked on the rear deck.
  const softTop = box(0.36, 0.16, 1.08, 0.07, dark);
  softTop.position.set(-0.8, 0.98, 0);
  body.add(softTop);

  // Front seats and a steering wheel (right-hand drive).
  for (const z of [-0.26, 0.26]) {
    const cushion = box(0.32, 0.1, 0.34, 0.04, seatMat);
    cushion.position.set(-0.18, 0.86, z);
    const back = box(0.1, 0.36, 0.34, 0.04, seatMat);
    back.rotation.z = 0.18;
    back.position.set(-0.38, 1.02, z);
    const rest = box(0.08, 0.12, 0.2, 0.04, seatMat);
    rest.rotation.z = 0.18;
    rest.position.set(-0.43, 1.25, z);
    body.add(cushion, back, rest);
  }
  const steering = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 16), dark);
  steering.rotation.y = Math.PI / 2;
  steering.rotation.x = 0.5;
  steering.position.set(0.12, 1.0, 0.26);
  body.add(steering);

  // Raked windscreen in a black frame.
  const rake = 0.5;
  const screen = new THREE.Group();
  screen.rotation.z = rake;
  screen.position.set(0.32, 0.88, 0);
  const glass = box(0.03, 0.34, 1.06, 0.01, glassMat);
  glass.position.y = 0.17;
  const header = box(0.06, 0.05, 1.14, 0.02, dark);
  header.position.y = 0.35;
  screen.add(glass, header);
  for (const z of [-0.55, 0.55]) {
    const post = box(0.05, 0.36, 0.04, 0.015, dark);
    post.position.set(0, 0.18, z);
    screen.add(post);
  }
  body.add(screen);

  // Door mirrors with white caps.
  for (const z of [-0.66, 0.66]) {
    const mirror = box(0.08, 0.09, 0.14, 0.03, trim);
    mirror.position.set(0.24, 0.98, z);
    body.add(mirror);
  }

  // Black sill and wheel-arch trims.
  for (const z of [-0.6, 0.6]) {
    const sill = box(0.86, 0.08, 0.06, 0.03, dark);
    sill.position.set(-0.02, 0.33, z);
    body.add(sill);
  }
  const archGeo = new THREE.TorusGeometry(0.34, 0.05, 6, 20, Math.PI);
  for (const x of [-0.74, 0.76]) {
    for (const z of [-0.6, 0.6]) {
      const arch = new THREE.Mesh(archGeo, dark);
      arch.position.set(x, 0.28, z);
      body.add(arch);
    }
  }

  // Chrome bumpers and the hexagonal grille.
  for (const x of [-1.14, 1.14]) {
    const bumper = box(0.1, 0.1, 1.18, 0.04, chrome);
    bumper.position.set(x, 0.38, 0);
    body.add(bumper);
  }
  const grilleGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.05, 6);
  grilleGeo.rotateZ(Math.PI / 2);
  const grille = new THREE.Mesh(grilleGeo, dark);
  grille.scale.set(1, 0.65, 1.3);
  grille.position.set(1.13, 0.6, 0);
  body.add(grille);

  // Big round headlights sitting proud of the nose; tall tail lights.
  const headGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.08, 20);
  headGeo.rotateZ(Math.PI / 2);
  const ringGeo = new THREE.TorusGeometry(0.135, 0.025, 6, 20);
  ringGeo.rotateY(Math.PI / 2);
  const headMat = mat(palette.headlight, { emissive: palette.headlight, emissiveIntensity: 0.3 });
  const tailMat = mat(palette.taillight, { emissive: palette.taillight, emissiveIntensity: 0.3 });
  const tailGeo = new RoundedBoxGeometry(0.05, 0.2, 0.12, 2, 0.02);
  for (const z of [-0.4, 0.4]) {
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(1.12, 0.74, z);
    const ring = new THREE.Mesh(ringGeo, chrome);
    ring.position.set(1.15, 0.74, z);
    body.add(head, ring);
    const tail = new THREE.Mesh(tailGeo, tailMat);
    tail.position.set(-1.13, 0.68, z);
    body.add(tail);
  }

  const tireGeo = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.24, 20);
  tireGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.26, 12);
  hubGeo.rotateX(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.3, 0.05, 0.25);
  const hubMat = mat(palette.hub);

  const wheels = [];
  for (const x of [-0.74, 0.76]) {
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
