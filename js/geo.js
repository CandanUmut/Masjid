// Location helpers. GPS never leaves the device except for an optional, cached
// reverse-geocode lookup to show a friendly place name.
import { deviceTimeZone } from "./time.js";

export function geoSupported() {
  return "geolocation" in navigator;
}

export async function geoPermission() {
  try {
    const p = await navigator.permissions?.query({ name: "geolocation" });
    return p?.state || "unknown"; // granted | denied | prompt
  } catch {
    return "unknown";
  }
}

export function getPosition({ timeout = 12000, maximumAge = 5 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!geoSupported()) return reject(Object.assign(new Error("unsupported"), { code: "unsupported" }));
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: round(pos.coords.latitude, 5),
          lng: round(pos.coords.longitude, 5),
          accuracy: pos.coords.accuracy,
          tz: deviceTimeZone(),
        }),
      (err) => reject(Object.assign(new Error(err.message), { code: ["", "denied", "unavailable", "timeout"][err.code] || "error" })),
      { enableHighAccuracy: false, timeout, maximumAge }
    );
  });
}

const REV_KEY = "masjid.revgeo.v1";

export async function reverseGeocode(lat, lng, lang = "en") {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)},${lang}`;
  const cache = readJson(REV_KEY, {});
  if (cache[key]) return cache[key];
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=${encodeURIComponent(lang)}`;
  const j = await fetchJson(url, 6000);
  const name = j.city || j.locality || j.principalSubdivision || "";
  const out = {
    name,
    sub: [j.principalSubdivision !== name ? j.principalSubdivision : "", j.countryName].filter(Boolean).join(", "),
    cc: j.countryCode || null,
  };
  const keys = Object.keys(cache);
  if (keys.length > 50) delete cache[keys[0]];
  cache[key] = out;
  writeJson(REV_KEY, cache);
  return out;
}

export async function searchPlaces(q, lang = "en") {
  const query = String(q || "").trim();
  if (query.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=${encodeURIComponent(lang)}&format=json`;
  const j = await fetchJson(url, 8000);
  return (j.results || []).map((r) => ({
    name: r.name,
    sub: [r.admin1, r.country].filter(Boolean).join(", "),
    lat: round(r.latitude, 5),
    lng: round(r.longitude, 5),
    tz: r.timezone || "UTC",
    cc: r.country_code || null,
  }));
}

export function distanceKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function fetchJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function round(n, d) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function readJson(key, dflt) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? dflt;
  } catch {
    return dflt;
  }
}

function writeJson(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* storage full or blocked */
  }
}
