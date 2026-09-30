import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { riverX, roadSlope, roadX } from './path.js';

// Boats drifting down the river and cyclists riding the other way down the road.

const WATER_Y = -0.14;
const ROAD_Y = 0.03;
// Everything wraps inside this window around the car (negative = ahead).
const AHEAD = 170;
const BEHIND = 14;

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...extra });

const mod = (a, n) => ((a % n) + n) % n;

// Heading for something travelling toward +z along a curve with slope dx/dz.
// Local +x is forward, matching the wagon.
const yawToward = (slope) => Math.atan2(-1, slope);

function shadows(obj) {
  obj.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
}

// --- Boats ------------------------------------------------------------------

const hullGeo = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
const rimGeo = new THREE.TorusGeometry(1, 0.05, 6, 28);

function hull(length, width, depth, color, rimColor) {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(hullGeo, mat(color, { side: THREE.DoubleSide }));
  shell.scale.set(length, depth, width);
  const rim = new THREE.Mesh(rimGeo, mat(rimColor));
  rim.scale.set(length, width, 1);
  rim.rotation.x = Math.PI / 2;
  g.add(shell, rim);
  return g;
}

function paddler(shirt) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.22, 4, 8), mat(shirt));
  body.position.y = 0.28;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), mat(0xf1c7a5));
  head.position.y = 0.58;
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf2ecde));
  hat.position.y = 0.6;
  g.add(body, head, hat);
  return g;
}

function sailboat(lantern) {
  const g = new THREE.Group();
  g.add(hull(0.95, 0.38, 0.3, 0xf2ecde, 0x4f86b8));
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.7, 6), mat(0x8a6448));
  mast.position.set(0.1, 0.85, 0);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0, 1.35);
  shape.lineTo(-0.85, 0);
  shape.closePath();
  const sail = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat(0xffffff, { side: THREE.DoubleSide }));
  sail.position.set(0.07, 0.25, 0);
  const jibShape = new THREE.Shape();
  jibShape.moveTo(0, 0);
  jibShape.lineTo(0, 1.1);
  jibShape.lineTo(0.6, 0);
  jibShape.closePath();
  const jib = new THREE.Mesh(new THREE.ShapeGeometry(jibShape), mat(0xe98a4f, { side: THREE.DoubleSide }));
  jib.position.set(0.13, 0.25, 0);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), lantern);
  light.position.set(0.1, 1.72, 0);
  // Sails pivot around the mast, trimmed out to catch the wind.
  const rig = new THREE.Group();
  rig.position.set(0.1, 0, 0);
  sail.position.x -= 0.1;
  jib.position.x -= 0.1;
  rig.add(sail, jib);
  g.add(mast, rig, light);
  return { object: g, sway: rig };
}

function rowboat() {
  const g = new THREE.Group();
  g.add(hull(0.85, 0.42, 0.28, 0xb0784c, 0x7a5a42));
  const bench = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.78), mat(0x7a5a42));
  bench.position.y = 0.02;
  const rower = paddler(0x4f86b8);
  rower.position.set(-0.05, -0.05, 0);
  const oarGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.2, 5);
  oarGeo.rotateX(Math.PI / 2);
  oarGeo.translate(0, 0, 0.6);
  const bladeGeo = new THREE.BoxGeometry(0.16, 0.02, 0.25);
  bladeGeo.translate(0, 0, 1.12);
  const oarMat = mat(0xc9ad85);
  const oars = [1, -1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.12, side * 0.36);
    const oar = new THREE.Group();
    oar.add(new THREE.Mesh(oarGeo, oarMat), new THREE.Mesh(bladeGeo, oarMat));
    if (side < 0) oar.rotation.y = Math.PI;
    pivot.add(oar);
    g.add(pivot);
    return pivot;
  });
  g.add(bench, rower);
  return { object: g, oars };
}

function kayak() {
  const g = new THREE.Group();
  g.add(hull(1.0, 0.22, 0.2, 0xe2574c, 0x26303d));
  const rider = paddler(0xf6c35b);
  rider.position.y = -0.08;
  const paddle = new THREE.Group();
  paddle.position.set(0.05, 0.32, 0);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.3, 5), mat(0x26303d));
  shaft.rotation.x = Math.PI / 2;
  paddle.add(shaft);
  for (const z of [-0.65, 0.65]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.22), mat(0xf2ecde));
    blade.position.z = z;
    paddle.add(blade);
  }
  g.add(rider, paddle);
  return { object: g, paddle };
}

// --- Bicycles -----------------------------------------------------------------

const Y_AXIS = new THREE.Vector3(0, 1, 0);

function bicycle(jersey, frameColor, lamp) {
  const g = new THREE.Group();
  const frameMat = mat(frameColor);
  const dark = mat(0x26303d, { roughness: 0.9 });
  const R = 0.3;
  const wheels = [];
  for (const x of [-0.42, 0.42]) {
    const wheel = new THREE.Group();
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.03, 6, 20), dark));
    for (let k = 0; k < 3; k++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(R * 2, 0.012, 0.012), mat(0xdfe6ee));
      spoke.rotation.z = (k * Math.PI) / 3;
      wheel.add(spoke);
    }
    wheel.position.set(x, R, 0);
    g.add(wheel);
    wheels.push(wheel);
  }

  // Frame tubes between key points (in the bike's x/y plane).
  const P = {
    rear: new THREE.Vector3(-0.42, R, 0),
    front: new THREE.Vector3(0.42, R, 0),
    crank: new THREE.Vector3(-0.02, 0.26, 0),
    seat: new THREE.Vector3(-0.14, 0.66, 0),
    head: new THREE.Vector3(0.3, 0.68, 0),
  };
  const tube = (a, b, r = 0.022, m = frameMat) => {
    const len = a.distanceTo(b);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), m);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(Y_AXIS, b.clone().sub(a).normalize());
    g.add(mesh);
  };
  tube(P.rear, P.crank);
  tube(P.rear, P.seat);
  tube(P.crank, P.seat);
  tube(P.crank, P.head);
  tube(P.seat, P.head);
  tube(P.front, P.head.clone().add(new THREE.Vector3(0, 0.12, 0)));
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 6), dark);
  bar.rotation.x = Math.PI / 2;
  bar.position.set(0.33, 0.82, 0);
  const saddle = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.05, 0.1, 2, 0.02), dark);
  saddle.position.set(-0.15, 0.7, 0);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), lamp);
  light.position.set(0.4, 0.72, 0);
  g.add(bar, saddle, light);

  // Rider leaning over the bars.
  const jerseyMat = mat(jersey);
  const skin = mat(0xf1c7a5);
  const hip = new THREE.Vector3(-0.12, 0.8, 0);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.3, 4, 8), jerseyMat);
  torso.position.set(0.03, 1.02, 0);
  torso.rotation.z = -0.85;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), skin);
  head.position.set(0.24, 1.25, 0);
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(0xf2ecde),
  );
  helmet.position.set(0.23, 1.27, 0);
  g.add(torso, head, helmet);
  for (const z of [-0.1, 0.1]) tube(new THREE.Vector3(0.15, 1.12, z), new THREE.Vector3(0.33, 0.82, z * 1.6), 0.035, jerseyMat);

  // Legs go from hip to the pedals; updated every frame as the cranks turn.
  const legGeo = new THREE.CylinderGeometry(0.045, 0.04, 1, 6);
  const legs = [0, Math.PI].map((phase, i) => {
    const leg = new THREE.Mesh(legGeo, mat(0x26303d));
    g.add(leg);
    return { leg, phase, z: i === 0 ? 0.09 : -0.09 };
  });
  const pedal = new THREE.Vector3();
  const hipZ = new THREE.Vector3();
  const dir = new THREE.Vector3();

  function pedalTo(angle) {
    for (const l of legs) {
      const a = angle + l.phase;
      pedal.set(P.crank.x + Math.cos(a) * 0.13, P.crank.y + Math.sin(a) * 0.13, l.z);
      hipZ.set(hip.x, hip.y, l.z * 0.8);
      dir.subVectors(pedal, hipZ);
      l.leg.scale.set(1, dir.length(), 1);
      l.leg.position.copy(hipZ).addScaledVector(dir, 0.5);
      l.leg.quaternion.setFromUnitVectors(Y_AXIS, dir.normalize());
    }
  }

  return { object: g, wheels, pedalTo, radius: R };
}

export function createTraffic() {
  const group = new THREE.Group();
  const lantern = mat(0xffcf7a, { emissive: 0xffcf7a, emissiveIntensity: 0.2 });
  const bikeLamp = mat(0xfff3c4, { emissive: 0xfff3c4, emissiveIntensity: 0.2 });

  const sail = sailboat(lantern);
  const row = rowboat();
  const kay = kayak();
  const boats = [
    { ...sail, z: -40, speed: 0.9, lane: -0.6, phase: 0 },
    { ...row, z: -95, speed: 0.6, lane: 0.7, phase: 2 },
    { ...kay, z: -140, speed: 1.4, lane: -0.2, phase: 4 },
  ];
  for (const b of boats) {
    b.object.scale.setScalar(1.5);
    shadows(b.object);
    group.add(b.object);
  }

  const bikes = [
    { ...bicycle(0xe98a4f, 0x4f86b8, bikeLamp), z: -60, speed: 3.4, phase: 0 },
    { ...bicycle(0xf6c35b, 0xe2574c, bikeLamp), z: -130, speed: 2.8, phase: 1.5 },
  ];
  for (const b of bikes) {
    b.object.scale.setScalar(1.25);
    shadows(b.object);
    group.add(b.object);
  }

  // Keep something at z inside the window around the car.
  const wrapZ = (z, carZ) => carZ + mod(z - carZ + AHEAD, AHEAD + BEHIND) - AHEAD;

  function update(t, dt, carZ, night) {
    lantern.emissiveIntensity = 0.2 + night * 3;
    bikeLamp.emissiveIntensity = 0.2 + night * 3;

    for (const b of boats) {
      b.z = wrapZ(b.z + b.speed * dt, carZ);
      const slope = (riverX(b.z + 0.1) - riverX(b.z - 0.1)) / 0.2;
      const x = riverX(b.z) + b.lane;
      const bob = Math.sin(t * 1.8 + b.phase);
      b.object.position.set(x, WATER_Y + 0.02 + bob * 0.025, b.z);
      b.object.rotation.set(Math.sin(t * 1.3 + b.phase) * 0.05, yawToward(slope), bob * 0.02);
      if (b.sway) b.sway.rotation.y = 0.7 + Math.sin(t * 0.7 + b.phase) * 0.12;
      if (b.oars) {
        const stroke = t * 2.4 + b.phase;
        b.oars.forEach((oar, i) => {
          const side = i === 0 ? 1 : -1;
          oar.rotation.y = side * Math.sin(stroke) * 0.5;
          oar.rotation.x = side * (0.25 + Math.cos(stroke) * 0.15);
        });
      }
      if (b.paddle) {
        const stroke = t * 2.8 + b.phase;
        b.paddle.rotation.x = Math.sin(stroke) * 0.5;
        b.paddle.rotation.y = Math.cos(stroke) * 0.25;
      }
    }

    for (const b of bikes) {
      b.z = wrapZ(b.z + b.speed * dt, carZ);
      const slope = roadSlope(b.z);
      // Oncoming lane: to the left of the wagon's direction of travel.
      const x = roadX(b.z) - 0.8 * Math.hypot(1, slope);
      b.object.position.set(x, ROAD_Y + Math.abs(Math.sin(t * 9 + b.phase)) * 0.01, b.z);
      b.object.rotation.set(0, yawToward(slope), 0);
      const turned = (b.speed * t) / b.radius;
      for (const w of b.wheels) w.rotation.z = -turned;
      b.pedalTo(-turned * 0.45 + b.phase);
    }
  }

  return { object: group, update };
}
