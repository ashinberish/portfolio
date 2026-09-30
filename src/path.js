// Terrain, road and river are all functions of (x, z) that repeat every PERIOD
// along z, so the world can be built once and shifted as the car drives on.
const TAU = Math.PI * 2;
export const PERIOD = 240;
export const ROAD_HALF_WIDTH = 1.7;

// Sum of gentle waves; every wavelength divides PERIOD so the road loops seamlessly.
const ROAD_WAVES = [
  [6, 240, 0],
  [3.5, 80, 1],
  [1.4, 48, 2],
];

export function roadX(z) {
  let x = 0;
  for (const [a, p, ph] of ROAD_WAVES) x += a * Math.sin((TAU * z) / p + ph);
  return x;
}

// dx/dz of the road.
export function roadSlope(z) {
  let d = 0;
  for (const [a, p, ph] of ROAD_WAVES) d += ((a * TAU) / p) * Math.cos((TAU * z) / p + ph);
  return d;
}

// The river keeps to the valley floor beside the road.
export function riverX(z) {
  return roadX(z) + 11 + 3 * Math.sin((TAU * z) / 120 + 0.5);
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

// Rolling hills that flatten out along the road and dip into a river bed.
export function heightAt(x, z) {
  const dRoad = Math.abs(x - roadX(z));
  const dRiver = Math.abs(x - riverX(z));
  const a = TAU * z;
  const n =
    1.2 * Math.sin(x * 0.07 + 2 * Math.sin(a / 240)) +
    0.9 * Math.sin(a / 80 + x * 0.05) +
    0.5 * Math.sin(x * 0.19 + a / 60) +
    0.3 * Math.sin(a / 30 - x * 0.13);
  const d = Math.min(dRoad, dRiver);
  const hills = Math.max(0.3, 1.8 + n) * 1.3 + Math.max(0, d - 12) * 0.12;
  const bed = 0.45 * (1 - smooth(1.8, 3.4, dRiver));
  return smooth(3.2, 16, d) * hills - bed;
}
