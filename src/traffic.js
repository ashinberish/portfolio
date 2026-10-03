import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { riverX, roadSlope, roadX } from './path.js';

// Boats drifting down the river and cyclists riding the other way down the road.

const WATER_Y = -0.14;
const ROAD_Y = 0.03;
const BOAT_SCALE = 1.5;
// Everything wraps inside this window around the car (negative = ahead).
const AHEAD = 170;
const BEHIND = 14;

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...extra });

const mod = (a, n) => ((a % n) + n) % n;

// Heading for something travelling toward +z along a curve with slope dx/dz.
// Local +x is forward, matching the car.
const yawToward = (slope) => Math.atan2(-1, slope);

function shadows(obj) {
  obj.traverse((o) => {
    if (o.isMesh && !o.userData.noShadow) o.castShadow = o.receiveShadow = true;
  });
}

// --- Toy people -----------------------------------------------------------------

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const limbGeo = new THREE.CapsuleGeometry(1, 1, 3, 8); // radius/length set per limb via scale
const jointGeo = new THREE.SphereGeometry(1, 10, 8);
const SKIN_TONES = [0xf1c7a5, 0xd9a07a, 0xa8714e, 0x7c4f33];

// Stretch a capsule between two points. The shared geometry is a unit capsule
// (radius 1, straight length 1, total height 3), so scale y to a third of the span.
function placeLimb(mesh, a, b, radius) {
  const dir = mesh.userData.dir || (mesh.userData.dir = new THREE.Vector3());
  dir.subVectors(b, a);
  const len = dir.length();
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.scale.set(radius, Math.max(0.001, len / 3), radius);
  mesh.quaternion.setFromUnitVectors(Y_AXIS, dir.normalize());
}

// Two-bone IK: returns the joint (knee/elbow) between root and end, bending toward `bend`.
function solveJoint(root, end, l1, l2, bend, out) {
  const d = Math.min(root.distanceTo(end), l1 + l2 - 1e-3);
  const dir = new THREE.Vector3().subVectors(end, root).normalize();
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  // Component of `bend` perpendicular to the limb.
  const perp = bend.clone().addScaledVector(dir, -bend.dot(dir)).normalize();
  return out.copy(root).addScaledVector(dir, a).addScaledVector(perp, h);
}

// A chunky, friendly figure: big head with eyes and hair, rounded limbs.
function makePerson({ top, bottom, skin, hair, hat, hatColor }) {
  const g = new THREE.Group();
  const topMat = mat(top);
  const bottomMat = mat(bottom);
  const skinMat = mat(skin, { roughness: 0.7 });
  const hairMat = mat(hair, { roughness: 0.9 });
  const dark = mat(0x1c2430, { roughness: 0.4 });

  const torso = new THREE.Mesh(limbGeo, topMat);
  const pelvis = new THREE.Mesh(jointGeo, bottomMat);
  pelvis.scale.set(0.12, 0.09, 0.14);

  const head = new THREE.Group();
  const skull = new THREE.Mesh(jointGeo, skinMat);
  skull.scale.set(0.125, 0.13, 0.12);
  head.add(skull);
  // Hair wraps the back and top of the head.
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10, Math.PI * 0.35, Math.PI * 1.3, 0, Math.PI * 0.62), hairMat);
  hairCap.scale.set(0.132, 0.138, 0.128);
  hairCap.rotation.y = Math.PI;
  head.add(hairCap);
  for (const z of [-0.042, 0.042]) {
    const eye = new THREE.Mesh(jointGeo, dark);
    eye.scale.setScalar(0.016);
    eye.position.set(0.115, 0.015, z);
    eye.userData.noShadow = true;
    head.add(eye);
  }
  const nose = new THREE.Mesh(jointGeo, skinMat);
  nose.scale.set(0.022, 0.02, 0.02);
  nose.position.set(0.125, -0.02, 0);
  head.add(nose);
  if (hat === 'helmet') {
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(hatColor, { roughness: 0.35 }));
    helmet.scale.set(0.15, 0.13, 0.14);
    helmet.position.set(-0.01, 0.03, 0);
    head.add(helmet);
  } else if (hat === 'bucket') {
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.09, 14), mat(hatColor));
    crown.position.y = 0.11;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.015, 18), mat(hatColor));
    brim.position.y = 0.07;
    head.add(crown, brim);
  }
  const neckMesh = new THREE.Mesh(limbGeo, skinMat);
  g.add(torso, pelvis, neckMesh, head);

  const upperArms = [0, 1].map(() => new THREE.Mesh(limbGeo, topMat));
  const foreArms = [0, 1].map(() => new THREE.Mesh(limbGeo, skinMat));
  const hands = [0, 1].map(() => {
    const h = new THREE.Mesh(jointGeo, skinMat);
    h.scale.setScalar(0.042);
    return h;
  });
  const thighs = [0, 1].map(() => new THREE.Mesh(limbGeo, bottomMat));
  const shins = [0, 1].map(() => new THREE.Mesh(limbGeo, skinMat));
  const shoes = [0, 1].map(() => {
    const s = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.07, 0.08, 2, 0.03), dark);
    return s;
  });
  g.add(...upperArms, ...foreArms, ...hands, ...thighs, ...shins, ...shoes);

  const shoulder = new THREE.Vector3();
  const joint = new THREE.Vector3();
  const neck = new THREE.Vector3();
  const armBend = new THREE.Vector3();
  const legBend = new THREE.Vector3(1, 0.2, 0);

  // Pose from key points (all in the parent group's space).
  function pose({ hip, chest, handL, handR, footL, footR, elbowOut = 1 }) {
    placeLimb(torso, hip, chest, 0.13);
    pelvis.position.copy(hip);
    neck.subVectors(chest, hip).normalize();
    head.position.copy(chest).addScaledVector(neck, 0.15);
    placeLimb(neckMesh, chest, head.position, 0.045);
    // Look ahead, not along the lean.
    head.rotation.z = -0.15;

    const hands2 = [handL, handR];
    const feet = [footL, footR];
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      shoulder.copy(chest).add(joint.set(0, -0.04, side * 0.15));
      armBend.set(-0.3, -1, side * 0.6 * elbowOut);
      solveJoint(shoulder, hands2[i], 0.2, 0.2, armBend, joint);
      placeLimb(upperArms[i], shoulder, joint, 0.048);
      placeLimb(foreArms[i], joint, hands2[i], 0.04);
      hands[i].position.copy(hands2[i]);

      const hipSide = shoulder.copy(hip).add(joint.set(0, -0.02, side * 0.08));
      solveJoint(hipSide, feet[i], 0.34, 0.34, legBend, joint);
      placeLimb(thighs[i], hipSide, joint, 0.06);
      placeLimb(shins[i], joint, feet[i], 0.05);
      shoes[i].position.copy(feet[i]).add(armBend.set(0.03, -0.01, 0));
    }
  }

  return { object: g, pose, torso, topMat };
}

// --- Boats ------------------------------------------------------------------

const hullGeo = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
const rimGeo = new THREE.TorusGeometry(1, 0.05, 6, 28);
const floorGeo = new THREE.CircleGeometry(1, 24);
floorGeo.rotateX(-Math.PI / 2);

// Open hull with a solid floor above the waterline so the river never shows inside.
function hull(length, width, depth, color, rimColor, floorColor) {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(hullGeo, mat(color, { side: THREE.DoubleSide }));
  shell.scale.set(length, depth, width);
  const rim = new THREE.Mesh(rimGeo, mat(rimColor));
  rim.scale.set(length, width, 1);
  rim.rotation.x = Math.PI / 2;
  const floorY = -0.35;
  const r = Math.sqrt(1 - floorY * floorY) * 0.98;
  const floor = new THREE.Mesh(floorGeo, mat(floorColor, { roughness: 0.9 }));
  floor.scale.set(length * r, 1, width * r);
  floor.position.y = floorY * depth;
  g.add(shell, rim, floor);
  return g;
}

function lifeVest(person, color) {
  const vest = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.26, 0.32, 3, 0.1), mat(color));
  person.object.add(vest);
  return vest;
}

function sailboat(lantern) {
  const depth = 0.3;
  const g = new THREE.Group();
  g.add(hull(0.95, 0.38, depth, 0xf2ecde, 0x4f86b8, 0xb0784c));
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.7, 6), mat(0x8a6448));
  mast.position.set(0.1, 0.85, 0);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0, 1.35);
  shape.lineTo(-0.85, 0);
  shape.closePath();
  const sail = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat(0xffffff, { side: THREE.DoubleSide }));
  sail.position.set(-0.03, 0.25, 0);
  const jibShape = new THREE.Shape();
  jibShape.moveTo(0, 0);
  jibShape.lineTo(0, 1.1);
  jibShape.lineTo(0.6, 0);
  jibShape.closePath();
  const jib = new THREE.Mesh(new THREE.ShapeGeometry(jibShape), mat(0xe98a4f, { side: THREE.DoubleSide }));
  jib.position.set(0.03, 0.25, 0);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), lantern);
  light.position.set(0.1, 1.72, 0);
  // Sails pivot around the mast, trimmed out to catch the wind.
  const rig = new THREE.Group();
  rig.position.set(0.1, 0, 0);
  rig.add(sail, jib);
  g.add(mast, rig, light);

  // A sailor at the tiller.
  const sailor = makePerson({ top: 0xf2ecde, bottom: 0x2d4a6b, skin: SKIN_TONES[1], hair: 0x3b2a20, hat: 'bucket', hatColor: 0xf6c35b });
  sailor.object.scale.setScalar(0.8);
  sailor.object.position.set(-0.55, -0.05, 0);
  const vest = lifeVest(sailor, 0xe2574c);
  const sit = {
    hip: new THREE.Vector3(0, 0.02, 0),
    chest: new THREE.Vector3(0.05, 0.36, 0),
    handL: new THREE.Vector3(-0.12, 0.2, 0.2),
    handR: new THREE.Vector3(0.22, 0.28, -0.12),
    footL: new THREE.Vector3(0.45, -0.12, 0.1),
    footR: new THREE.Vector3(0.45, -0.12, -0.1),
  };
  sailor.pose(sit);
  // Tiller from the stern to the sailor's hand.
  const tillerFrom = new THREE.Vector3(-0.92, 0.02, 0);
  const tillerTo = new THREE.Vector3(-0.646, 0.11, 0.16);
  const tiller = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, tillerFrom.distanceTo(tillerTo), 5), mat(0x8a6448));
  tiller.position.copy(tillerFrom).add(tillerTo).multiplyScalar(0.5);
  tiller.quaternion.setFromUnitVectors(Y_AXIS, tillerTo.clone().sub(tillerFrom).normalize());
  g.add(tiller);
  vest.position.copy(sailor.torso.position);
  vest.quaternion.copy(sailor.torso.quaternion);
  g.add(sailor.object);
  return { object: g, sway: rig, depth };
}

function rowboat() {
  const depth = 0.28;
  const g = new THREE.Group();
  g.add(hull(0.85, 0.42, depth, 0xb0784c, 0x7a5a42, 0x8a6448));
  const bench = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.78), mat(0x7a5a42));
  bench.position.set(-0.1, -0.02, 0);
  g.add(bench);

  // Oars: pivot on the gunwale; the handle end sits inboard for the rower's hands.
  const oarGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.35, 5);
  oarGeo.rotateX(Math.PI / 2);
  oarGeo.translate(0, 0, 0.45);
  const bladeGeo = new THREE.BoxGeometry(0.16, 0.02, 0.25);
  bladeGeo.translate(0, 0, 1.05);
  const oarMat = mat(0xc9ad85);
  const oars = [1, -1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.05, 0.08, side * 0.38);
    const oar = new THREE.Group();
    oar.add(new THREE.Mesh(oarGeo, oarMat), new THREE.Mesh(bladeGeo, oarMat));
    if (side < 0) oar.rotation.y = Math.PI;
    pivot.add(oar);
    g.add(pivot);
    return { pivot, oar, side };
  });

  // The rower faces the stern (-x), as rowers do.
  const rower = makePerson({ top: 0x4f86b8, bottom: 0x3b3f4a, skin: SKIN_TONES[2], hair: 0x1c1410, hat: 'bucket', hatColor: 0x7fb68a });
  rower.object.scale.setScalar(0.8);
  rower.object.rotation.y = Math.PI;
  rower.object.position.set(-0.1, -0.02, 0);
  const vest = lifeVest(rower, 0xf6a13b);
  g.add(rower.object);
  return { object: g, oars, rower, vest, depth };
}

function kayak() {
  const depth = 0.2;
  const g = new THREE.Group();
  g.add(hull(1.0, 0.22, depth, 0xe2574c, 0x26303d, 0x26303d));
  // Spray deck covers the kayak apart from the cockpit.
  const deck = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xe2574c));
  deck.scale.set(1.0, 0.06, 0.22);
  g.add(deck);

  const paddle = new THREE.Group();
  paddle.position.set(0.2, 0.34, 0);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.3, 5), mat(0x26303d));
  shaft.rotation.x = Math.PI / 2;
  paddle.add(shaft);
  for (const z of [-0.65, 0.65]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.22), mat(0xf6c35b));
    blade.position.z = z;
    paddle.add(blade);
  }

  const paddler = makePerson({ top: 0x2f6b56, bottom: 0x26303d, skin: SKIN_TONES[0], hair: 0xc98a3a, hat: 'helmet', hatColor: 0xf6c35b });
  paddler.object.scale.setScalar(0.8);
  paddler.object.position.set(-0.05, -0.05, 0);
  const vest = lifeVest(paddler, 0xf6a13b);
  g.add(paddle, paddler.object);
  return { object: g, paddle, paddler, vest, depth };
}

// --- Bicycles -----------------------------------------------------------------

function bicycle(rider, frameColor, lamp) {
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

  const P = {
    rear: new THREE.Vector3(-0.42, R, 0),
    front: new THREE.Vector3(0.42, R, 0),
    crank: new THREE.Vector3(-0.02, 0.26, 0),
    seat: new THREE.Vector3(-0.14, 0.66, 0),
    head: new THREE.Vector3(0.3, 0.68, 0),
  };
  const tube = (a, b, r = 0.022) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 6), frameMat);
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
  const saddle = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.05, 0.11, 2, 0.02), dark);
  saddle.position.set(-0.15, 0.7, 0);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), lamp);
  light.position.set(0.4, 0.72, 0);
  const basket = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.12, 0.24, 2, 0.03), mat(0xc9ad85));
  basket.position.set(0.42, 0.74, 0);
  g.add(bar, saddle, light, basket);

  const backpack = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.26, 0.24, 3, 0.07), mat(rider.pack));
  g.add(backpack);
  const person = makePerson(rider);
  g.add(person.object);

  const hip = new THREE.Vector3(-0.13, 0.8, 0);
  const chest = new THREE.Vector3(0.1, 1.12, 0);
  const handL = new THREE.Vector3(0.31, 0.84, 0.18);
  const handR = new THREE.Vector3(0.31, 0.84, -0.18);
  const footL = new THREE.Vector3();
  const footR = new THREE.Vector3();

  function pedalTo(angle, t) {
    footL.set(P.crank.x + Math.cos(angle) * 0.13, P.crank.y + Math.sin(angle) * 0.13, 0.1);
    footR.set(P.crank.x + Math.cos(angle + Math.PI) * 0.13, P.crank.y + Math.sin(angle + Math.PI) * 0.13, -0.1);
    // A little body sway with each pedal stroke.
    chest.z = Math.sin(angle) * 0.02;
    chest.y = 1.12 + Math.sin(t * 3) * 0.008;
    person.pose({ hip, chest, handL, handR, footL, footR, elbowOut: 0.6 });
    backpack.position.copy(person.torso.position).add(new THREE.Vector3(-0.14, 0.03, 0));
    backpack.quaternion.copy(person.torso.quaternion);
  }

  return { object: g, wheels, pedalTo, radius: R };
}

export function createTraffic() {
  const group = new THREE.Group();
  const lantern = mat(0xffcf7a, { emissive: 0xffcf7a, emissiveIntensity: 0.2 });
  const bikeLamp = mat(0xfff3c4, { emissive: 0xfff3c4, emissiveIntensity: 0.2 });

  const boats = [
    { ...sailboat(lantern), z: -40, speed: 0.9, lane: -0.6, phase: 0 },
    { ...rowboat(), z: -95, speed: 0.6, lane: 0.7, phase: 2 },
    { ...kayak(), z: -140, speed: 1.4, lane: -0.2, phase: 4 },
  ];
  for (const b of boats) {
    b.object.scale.setScalar(BOAT_SCALE);
    shadows(b.object);
    group.add(b.object);
  }

  const bikes = [
    {
      ...bicycle({ top: 0xe98a4f, bottom: 0x26303d, skin: SKIN_TONES[1], hair: 0x2a1c14, hat: 'helmet', hatColor: 0x4f86b8, pack: 0x2f6b56 }, 0x4f86b8, bikeLamp),
      z: -60,
      speed: 3.4,
      phase: 0,
    },
    {
      ...bicycle({ top: 0xf6c35b, bottom: 0x3d5f82, skin: SKIN_TONES[3], hair: 0x120c08, hat: 'helmet', hatColor: 0xf2ecde, pack: 0xe2574c }, 0xe2574c, bikeLamp),
      z: -130,
      speed: 2.8,
      phase: 1.5,
    },
  ];
  for (const b of bikes) {
    b.object.scale.setScalar(1.25);
    shadows(b.object);
    group.add(b.object);
  }

  // Keep something at z inside the window around the car.
  const wrapZ = (z, carZ) => carZ + mod(z - carZ + AHEAD, AHEAD + BEHIND) - AHEAD;
  const m = new THREE.Matrix4();
  const handA = new THREE.Vector3();
  const handB = new THREE.Vector3();
  const rowerSpace = new THREE.Matrix4();

  // Returns true when a cyclist is about to pass the car (time for a friendly honk).
  function update(t, dt, carZ, night) {
    let greet = false;
    lantern.emissiveIntensity = 0.2 + night * 3;
    bikeLamp.emissiveIntensity = 0.2 + night * 3;

    for (const b of boats) {
      b.z = wrapZ(b.z + b.speed * dt, carZ);
      const slope = (riverX(b.z + 0.1) - riverX(b.z - 0.1)) / 0.2;
      const x = riverX(b.z) + b.lane;
      const bob = Math.sin(t * 1.8 + b.phase);
      // Float with the hull a bit under half submerged; its floor stays above the water.
      const floatY = WATER_Y + b.depth * 0.55 * BOAT_SCALE;
      b.object.position.set(x, floatY + bob * 0.02, b.z);
      b.object.rotation.set(Math.sin(t * 1.3 + b.phase) * 0.04, yawToward(slope), bob * 0.015);
      if (b.sway) b.sway.rotation.y = 0.7 + Math.sin(t * 0.7 + b.phase) * 0.12;

      if (b.oars) {
        const stroke = t * 2.4 + b.phase;
        for (const { pivot, side } of b.oars) {
          pivot.rotation.y = side * Math.sin(stroke) * 0.5;
          pivot.rotation.x = side * (0.25 + Math.cos(stroke) * 0.15);
        }
        // Hands on the inboard handle ends, in the rower's own space.
        b.object.updateMatrixWorld(true);
        rowerSpace.copy(b.rower.object.matrix).invert();
        const grip = (o, out) =>
          out.set(0, 0, -0.18).applyMatrix4(m.multiplyMatrices(o.pivot.matrix, o.oar.matrix)).applyMatrix4(rowerSpace);
        const lean = Math.sin(stroke) * 0.06;
        b.rower.pose({
          hip: new THREE.Vector3(0, 0.05, 0),
          chest: new THREE.Vector3(lean, 0.38, 0),
          handL: grip(b.oars[1], handA),
          handR: grip(b.oars[0], handB),
          footL: new THREE.Vector3(0.42, -0.1, 0.1),
          footR: new THREE.Vector3(0.42, -0.1, -0.1),
          elbowOut: 1,
        });
        b.vest.position.copy(b.rower.torso.position);
        b.vest.quaternion.copy(b.rower.torso.quaternion);
      }

      if (b.paddle) {
        const stroke = t * 2.8 + b.phase;
        b.paddle.rotation.x = Math.sin(stroke) * 0.5;
        b.paddle.rotation.y = Math.cos(stroke) * 0.25;
        b.paddle.updateMatrix();
        b.paddler.object.updateMatrix();
        rowerSpace.copy(b.paddler.object.matrix).invert();
        handA.set(0, 0, 0.22).applyMatrix4(b.paddle.matrix).applyMatrix4(rowerSpace);
        handB.set(0, 0, -0.22).applyMatrix4(b.paddle.matrix).applyMatrix4(rowerSpace);
        b.paddler.pose({
          hip: new THREE.Vector3(0, 0.05, 0),
          chest: new THREE.Vector3(0.04, 0.38, Math.sin(stroke) * 0.04),
          handL: handA,
          handR: handB,
          footL: new THREE.Vector3(0.45, -0.05, 0.08),
          footR: new THREE.Vector3(0.45, -0.05, -0.08),
          elbowOut: 1,
        });
        b.vest.position.copy(b.paddler.torso.position);
        b.vest.quaternion.copy(b.paddler.torso.quaternion);
      }
    }

    for (const b of bikes) {
      b.z = wrapZ(b.z + b.speed * dt, carZ);
      const slope = roadSlope(b.z);
      // Oncoming lane: to the left of the car's direction of travel.
      const x = roadX(b.z) - 0.8 * Math.hypot(1, slope);
      b.object.position.set(x, ROAD_Y + Math.abs(Math.sin(t * 9 + b.phase)) * 0.01, b.z);
      b.object.rotation.set(0, yawToward(slope), 0);
      const turned = (b.speed * t) / b.radius;
      for (const w of b.wheels) w.rotation.z = -turned;
      b.pedalTo(-turned * 0.45 + b.phase, t);

      const rel = b.z - carZ;
      if (!b.greeted && rel > -10 && rel < 0) {
        b.greeted = true;
        greet = true;
      } else if (rel < -30) {
        b.greeted = false;
      }
    }
    return greet;
  }

  return { object: group, update };
}
