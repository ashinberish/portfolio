import * as THREE from 'three';
import { moods } from './palette.js';
import { glowTexture } from './terrain.js';

const smoothstep = THREE.MathUtils.smoothstep;

const keys = Object.keys(moods.day);
const mood = Object.fromEntries(keys.map((k) => [k, new THREE.Color()]));
const colorsOf = (m) => Object.fromEntries(keys.map((k) => [k, new THREE.Color(m[k])]));
const night = colorsOf(moods.night);
const dusk = colorsOf(moods.dusk);
const day = colorsOf(moods.day);

// Blend night → dusk → day by the sun's height (-1..1).
function moodFor(elevation) {
  const [a, b, t] =
    elevation < 0
      ? [night, dusk, smoothstep(elevation, -0.28, 0)]
      : [dusk, day, smoothstep(elevation, 0, 0.35)];
  for (const k of keys) mood[k].copy(a[k]).lerp(b[k], t);
  return mood;
}

export function createSky(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const domeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 horizon;
      varying vec3 vDir;
      void main() {
        float h = pow(clamp(vDir.y * 2.2, 0.0, 1.0), 0.7);
        gl_FragColor = vec4(mix(horizon, top, h), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), domeMat);
  dome.renderOrder = -1;
  group.add(dome);

  // Stars.
  const starPos = [];
  for (let i = 0; i < 700; i++) {
    const v = new THREE.Vector3().randomDirection();
    v.y = Math.abs(v.y) * 0.9 + 0.08;
    v.normalize().multiplyScalar(420);
    starPos.push(v.x, v.y, v.z);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2,
    sizeAttenuation: false,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  group.add(new THREE.Points(starGeo, starMat));

  // Sun and moon discs with a soft glow.
  const disc = (color, size, glowSize) => {
    const g = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.CircleGeometry(size, 32),
      new THREE.MeshBasicMaterial({ color, fog: false, transparent: true, depthWrite: false }),
    );
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color,
        fog: false,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    glow.scale.setScalar(glowSize);
    g.add(glow, core);
    group.add(g);
    return { g, core, glow };
  };
  const sunDisc = disc(0xfff1c9, 12, 90);
  const moonDisc = disc(0xf4f1ff, 8, 45);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.5);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 80 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  const moon = new THREE.DirectionalLight(0x9fb3ff, 0);
  scene.add(moon, moon.target);

  scene.fog = new THREE.Fog(0xffffff, 45, 190);
  const white = new THREE.Color(0xffffff);

  const sunDir = new THREE.Vector3();
  const moonDir = new THREE.Vector3();
  const lightDir = new THREE.Vector3();

  // hour: 0..24 local time. Returns how "night" it is (0 day → 1 night) and the mood colours.
  function update(hour, camera, focus) {
    const angle = ((hour - 6) / 24) * Math.PI * 2; // 6am sunrise, noon top, 6pm sunset
    const elevation = Math.sin(angle);
    const m = moodFor(elevation);

    group.position.copy(camera.position);
    domeMat.uniforms.top.value.copy(m.skyTop);
    domeMat.uniforms.horizon.value.copy(m.horizon);
    scene.fog.color.copy(m.horizon);

    const nightness = 1 - smoothstep(elevation, -0.2, 0.15);
    starMat.opacity = smoothstep(nightness, 0.4, 1);

    // Discs arc across the sky ahead of the viewer.
    sunDir.set(-Math.cos(angle) * 0.9, Math.sin(angle) * 0.3 + 0.06, -1).normalize();
    moonDir.set(Math.cos(angle) * 0.9, -Math.sin(angle) * 0.3 + 0.06, -1).normalize();
    sunDisc.g.position.copy(sunDir).multiplyScalar(400);
    moonDisc.g.position.copy(moonDir).multiplyScalar(400);
    sunDisc.g.lookAt(camera.position);
    moonDisc.g.lookAt(camera.position);
    sunDisc.core.material.color.copy(m.sun).lerp(white, 0.4);
    sunDisc.glow.material.color.copy(m.sun);
    sunDisc.g.visible = sunDir.y > 0.02;
    moonDisc.g.visible = moonDir.y > 0.02;

    hemi.color.copy(m.hemiSky);
    hemi.groundColor.copy(m.hemiGround);
    hemi.intensity = 0.55 + (1 - nightness) * 1.0;

    // Light comes from behind the camera so the faces we see are lit.
    lightDir.set(-Math.cos(angle) * 0.7, Math.max(elevation, 0.15), 0.8).normalize();
    sun.color.copy(m.sun);
    sun.intensity = smoothstep(elevation, -0.05, 0.2) * 2.3;
    sun.position.copy(focus).addScaledVector(lightDir, 40);
    sun.target.position.copy(focus);

    lightDir.set(Math.cos(angle) * 0.7, Math.max(-elevation, 0.3), 0.8).normalize();
    moon.intensity = nightness * 0.6;
    moon.position.copy(focus).addScaledVector(lightDir, 40);
    moon.target.position.copy(focus);

    return { nightness, mood: m };
  }

  return { update };
}
