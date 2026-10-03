import * as THREE from 'three';

// Opening shot: the camera starts high above a sea of clouds with the name
// against the sky, holds for a moment, then glides down through the clouds
// into the chase view behind the wagon.

const HOLD = 1.8; // seconds above the clouds
const DESCENT = 3.4; // seconds to glide down
const CLOUD_Y = 30;
const HIGH = 60;

const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export function createIntro(scene) {
  const skip = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = rng(17);

  // A blanket of flattened puffs, instanced so it costs one draw call.
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.35,
    roughness: 1,
    flatShading: true,
    transparent: true,
  });
  const count = 220;
  const sea = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), material, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const r = 4 + rand() * 7;
    p.set((rand() * 2 - 1) * 110, CLOUD_Y + (rand() - 0.5) * 4, 40 - rand() * 200);
    s.set(r * (1.2 + rand() * 0.6), r * (0.35 + rand() * 0.2), r);
    m.compose(p, q.setFromEuler(e.set(0, rand() * Math.PI, 0)), s);
    sea.setMatrixAt(i, m);
  }
  scene.add(sea);

  let time = 0;
  let done = skip;
  sea.visible = !skip;

  const fromPos = new THREE.Vector3();
  const fromLook = new THREE.Vector3();

  // Blend the camera from the sky shot into the normal pose (pos/look are updated in place).
  function update(dt, carZ, pos, look, mood) {
    if (done) return;
    time += dt;
    const k = easeInOut(THREE.MathUtils.clamp((time - HOLD) / DESCENT, 0, 1));

    sea.position.set(pos.x, 0, carZ);
    material.color.copy(mood.cloud);
    material.emissive.copy(mood.cloud);
    // Thin out as the camera dives in, so passing through reads as mist, then melt away.
    material.opacity = 1 - THREE.MathUtils.smoothstep(k, 0.38, 0.85);
    material.depthWrite = material.opacity > 0.99;

    // Looking out over the cloud tops, a touch above the horizon.
    fromPos.set(pos.x, HIGH, carZ + 26);
    fromLook.set(look.x, HIGH + 2, carZ - 70);
    pos.lerpVectors(fromPos, pos, k);
    look.lerpVectors(fromLook, look, k);

    if (k >= 1) {
      done = true;
      sea.visible = false;
      sea.geometry.dispose();
      material.dispose();
      scene.remove(sea);
    }
  }

  return { update, get done() { return done; } };
}
