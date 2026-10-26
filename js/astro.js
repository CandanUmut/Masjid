// Small astronomy helpers for the visuals (not for prayer times — those come from adhan-js).
// Accurate to a fraction of a degree, which is plenty for drawing the sky.

const RAD = Math.PI / 180;

// Sun altitude in degrees at instant `date` for an observer at lat/lng (NOAA approximation).
export function sunAltitude(date, lat, lng) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * RAD;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * n) * RAD;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const gmst = (280.46061837 + 360.98564736629 * n) % 360;
  const ha = (gmst + lng) * RAD - ra;
  const phi = lat * RAD;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha));
  return alt / RAD;
}

// Moon phase: 0 = new, 0.5 = full. Mean synodic month from a known new moon (6 Jan 2000 18:14 UTC).
export function moonPhase(date) {
  const synodic = 29.530588853;
  const days = (date.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000;
  return (((days / synodic) % 1) + 1) % 1;
}

// SVG path for the lit part of the moon in a circle of radius r centred at (cx, cy).
export function moonPath(phase, cx, cy, r) {
  const waxing = phase < 0.5;
  const k = Math.cos(phase * 2 * Math.PI); // 1 new → -1 full → 1 new
  const rx = Math.abs(k) * r;
  const sweepOuter = waxing ? 1 : 0;
  const sweepInner = (waxing ? k > 0 : k < 0) ? 0 : 1;
  return `M${cx} ${cy - r} A${r} ${r} 0 0 ${sweepOuter} ${cx} ${cy + r} A${rx} ${r} 0 0 ${sweepInner} ${cx} ${cy - r}Z`;
}

// --- Sky colour from the real sun altitude -------------------------------------------------
// Stops are [altitude, top colour, horizon colour]. Evening light is warmer than morning light.
const MORNING = [
  [-90, "#05081a", "#0c1230"],
  [-18, "#070b22", "#141a3d"],
  [-12, "#0d1640", "#272a66"],
  [-6, "#1b2a68", "#6a5aa6"],
  [-2, "#2c4588", "#d98a9a"],
  [1, "#3d68b8", "#f2a77e"],
  [6, "#3f7fd0", "#f4cd92"],
  [15, "#2f7fdc", "#9fd0f5"],
  [90, "#1c6fe0", "#7cc2f8"],
];
const EVENING = [
  [-90, "#05081a", "#0c1230"],
  [-18, "#070b22", "#161a40"],
  [-12, "#10164a", "#33276b"],
  [-6, "#252466", "#9a4f86"],
  [-2, "#3b3a86", "#ec7a62"],
  [1, "#4a5ea8", "#f69457"],
  [6, "#3f74c6", "#f7b46a"],
  [15, "#2f7fdc", "#a9d2f2"],
  [90, "#1c6fe0", "#7cc2f8"],
];

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  const A = hex(a);
  const B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`;
}

export function skyColors(alt, evening = false) {
  const stops = evening ? EVENING : MORNING;
  let i = 0;
  while (i < stops.length - 2 && alt > stops[i + 1][0]) i++;
  const [a0, t0, h0] = stops[i];
  const [a1, t1, h1] = stops[i + 1];
  const t = Math.min(1, Math.max(0, (alt - a0) / (a1 - a0)));
  return { top: mix(t0, t1, t), horizon: mix(h0, h1, t), night: alt < -6 };
}

// Altitude samples across a local day, for drawing the sun's path.
export function sunPath(lat, lng, startMs, endMs, steps = 144) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const ms = startMs + ((endMs - startMs) * i) / steps;
    out.push({ ms, alt: sunAltitude(new Date(ms), lat, lng) });
  }
  return out;
}
