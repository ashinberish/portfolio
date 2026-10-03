import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { palette } from './palette.js';

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra });

const box = (w, h, d, r, material) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), material);

// A soft ellipsoid — the building block for the car's rounded shapes.
const ball = (rx, ry, rz, material) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material);
  m.scale.set(rx, ry, rz);
  return m;
};

const WHEEL_RADIUS = 0.28;

// A little red Mini Cooper convertible: rounded body, folded top, a driver
// behind the wheel. Local +x is forward.
export function createCar() {
  const car = new THREE.Group();
  const body = new THREE.Group();
  car.add(body);

  const paint = mat(palette.carBody, { roughness: 0.3, metalness: 0.15 });
  const trim = mat(palette.carTrim, { roughness: 0.4 });
  const dark = mat(palette.tire, { roughness: 0.9 });
  const chrome = mat(palette.hub, { roughness: 0.25, metalness: 0.6 });
  const seatMat = mat(palette.seat, { roughness: 0.7 });
  const skin = mat(palette.skin, { roughness: 0.6 });
  const shirt = mat(palette.shirt, { roughness: 0.8 });
  const glassMat = mat(palette.glass, { roughness: 0.1, transparent: true, opacity: 0.4 });

  // Boxy-but-soft Mini body: an upright rounded hull, not a slab or a bubble.
  const hull = box(2.12, 0.66, 1.22, 0.2, paint);
  hull.position.y = 0.58;
  body.add(hull);

  // A gently crowned bonnet panel across the front half.
  const bonnet = box(0.86, 0.14, 1.12, 0.1, paint);
  bonnet.position.set(0.64, 0.86, 0);
  body.add(bonnet);

  // Modest rounded wheel arches — flush fender bulges, not balloons.
  for (const x of [-0.72, 0.74]) {
    for (const z of [-0.63, 0.63]) {
      const flare = ball(0.36, 0.3, 0.1, paint);
      flare.position.set(x, 0.42, z);
      body.add(flare);
    }
  }

  // Twin white bonnet stripes running up the hood.
  for (const z of [-0.12, 0.12]) {
    const stripe = box(1.0, 0.02, 0.1, 0.01, trim);
    stripe.position.set(0.5, 0.94, z);
    body.add(stripe);
  }

  // Open cockpit: a dark recessed tub the seats and driver sit in.
  const tub = box(1.0, 0.12, 1.0, 0.06, dark);
  tub.position.set(-0.14, 0.88, 0);
  body.add(tub);

  // Folded soft top stacked on the rear deck.
  const softTop = ball(0.24, 0.1, 0.54, dark);
  softTop.position.set(-0.82, 1.0, 0);
  body.add(softTop);

  // Two cream seats.
  for (const z of [-0.26, 0.26]) {
    const cushion = box(0.34, 0.1, 0.34, 0.05, seatMat);
    cushion.position.set(-0.2, 0.9, z);
    const back = box(0.1, 0.38, 0.34, 0.05, seatMat);
    back.rotation.z = 0.18;
    back.position.set(-0.4, 1.06, z);
    const rest = ball(0.07, 0.08, 0.14, seatMat);
    rest.position.set(-0.45, 1.3, z);
    body.add(cushion, back, rest);
  }

  // Steering wheel (right-hand drive).
  const steering = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 8, 18), dark);
  steering.rotation.y = Math.PI / 2;
  steering.rotation.x = 0.55;
  steering.position.set(0.14, 1.02, 0.26);
  body.add(steering);

  // A driver behind the wheel.
  const driver = new THREE.Group();
  const torso = box(0.26, 0.36, 0.3, 0.11, shirt);
  torso.position.y = 0.2;
  const neck = ball(0.07, 0.08, 0.07, skin);
  neck.position.y = 0.4;
  const head = ball(0.14, 0.15, 0.14, skin);
  head.position.y = 0.54;
  const hair = ball(0.15, 0.12, 0.15, dark);
  hair.position.y = 0.58;
  driver.add(torso, neck, head, hair);
  for (const s of [-1, 1]) {
    const arm = box(0.32, 0.1, 0.1, 0.05, shirt);
    arm.rotation.z = 0.35;
    arm.position.set(0.18, 0.28, s * 0.13);
    driver.add(arm);
  }
  driver.position.set(-0.22, 0.95, 0.26);
  body.add(driver);

  // Raked windscreen in a black frame.
  const screen = new THREE.Group();
  screen.rotation.z = 0.5;
  screen.position.set(0.34, 0.9, 0);
  const glass = box(0.03, 0.32, 1.0, 0.01, glassMat);
  glass.position.y = 0.16;
  const header = box(0.06, 0.05, 1.08, 0.02, dark);
  header.position.y = 0.33;
  screen.add(glass, header);
  for (const z of [-0.52, 0.52]) {
    const post = box(0.05, 0.34, 0.04, 0.015, dark);
    post.position.set(0, 0.17, z);
    screen.add(post);
  }
  body.add(screen);

  // Door mirrors with white caps.
  for (const z of [-0.68, 0.68]) {
    const mirror = ball(0.05, 0.05, 0.08, trim);
    mirror.position.set(0.26, 0.98, z);
    body.add(mirror);
  }

  // Thin black sills along the bottom of the doors.
  for (const z of [-0.62, 0.62]) {
    const sill = box(0.8, 0.07, 0.05, 0.03, dark);
    sill.position.set(-0.05, 0.33, z);
    body.add(sill);
  }

  // Chrome bumpers and a wide rounded grille with horizontal bars.
  for (const x of [-1.1, 1.1]) {
    const bumper = box(0.1, 0.1, 1.14, 0.05, chrome);
    bumper.position.set(x, 0.4, 0);
    body.add(bumper);
  }
  const grille = box(0.06, 0.26, 0.56, 0.07, dark);
  grille.position.set(1.08, 0.58, 0);
  body.add(grille);
  for (const yy of [0.5, 0.58, 0.66]) {
    const bar = box(0.03, 0.025, 0.52, 0.01, chrome);
    bar.position.set(1.11, yy, 0);
    body.add(bar);
  }

  // Big round headlights on the fenders; tall tail lights.
  const headGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.08, 20);
  headGeo.rotateZ(Math.PI / 2);
  const ringGeo = new THREE.TorusGeometry(0.135, 0.025, 8, 20);
  ringGeo.rotateY(Math.PI / 2);
  const headMat = mat(palette.headlight, { emissive: palette.headlight, emissiveIntensity: 0.3 });
  const tailMat = mat(palette.taillight, { emissive: palette.taillight, emissiveIntensity: 0.3 });
  const tailGeo = new RoundedBoxGeometry(0.06, 0.2, 0.12, 2, 0.03);
  for (const z of [-0.45, 0.45]) {
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(1.06, 0.74, z);
    const ring = new THREE.Mesh(ringGeo, chrome);
    ring.position.set(1.1, 0.74, z);
    body.add(head, ring);
    const tail = new THREE.Mesh(tailGeo, tailMat);
    tail.position.set(-1.08, 0.68, z);
    body.add(tail);
  }

  const tireGeo = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.24, 20);
  tireGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.26, 12);
  hubGeo.rotateX(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.3, 0.05, 0.25);
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
  beam.position.set(1.1, 0.72, 0);
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
