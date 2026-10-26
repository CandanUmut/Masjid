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

// Only a position rounded to 2 decimals (~1 km) is ever sent.
export async function reverseGeocode(lat, lng, lang = "en") {
  const rl = lat.toFixed(2);
  const rg = lng.toFixed(2);
  const key = `${rl},${rg},${lang}`;
  const cache = readJson(REV_KEY, {});
  if (cache[key]) return cache[key];
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${rl}&longitude=${rg}&localityLanguage=${encodeURIComponent(lang)}`;
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

// City search. People type names in their own language ("Londra", "Kahire", "Nueva York"), so we ask in
// the UI language, the device language and English, merge, and rank: exact name first, then by size.
export async function searchPlaces(q, lang = "en") {
  const query = String(q || "").trim();
  if (query.length < 2) return [];
  const device = String(navigator.language || "en").slice(0, 2).toLowerCase();
  const langs = [...new Set([lang, device, "en"])].slice(0, 3);
  const responses = await Promise.allSettled(
    langs.map((l) =>
      fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=${encodeURIComponent(l)}&format=json`, 8000)
    )
  );
  if (responses.every((r) => r.status === "rejected")) throw responses[0].reason;
  const norm = (x) => String(x || "").toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i");
  const nq = norm(query);
  const byId = new Map();
  responses.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    for (const p of r.value.results || []) {
      const prev = byId.get(p.id);
      // Keep the name in the UI language when we have it (the first response).
      if (!prev) byId.set(p.id, { p, exact: norm(p.name) === nq, prefix: norm(p.name).startsWith(nq), first: i });
      else if (norm(p.name) === nq) prev.exact = true;
    }
  });
  return [...byId.values()]
    .sort((a, b) => b.exact - a.exact || b.prefix - a.prefix || (b.p.population || 0) - (a.p.population || 0))
    .slice(0, 8)
    .map(({ p: r }) => ({
      name: r.name,
      sub: [r.admin1, r.country].filter(Boolean).join(", "),
      lat: round(r.latitude, 5),
      lng: round(r.longitude, 5),
      tz: r.timezone || "UTC",
      cc: r.country_code || null,
    }));
}

// IANA time zone for coordinates. Online: Open-Meteo (rounded position). Offline: a UTC offset from
// longitude, flagged as approximate so the UI can ask the user to confirm.
export async function timezoneFor(lat, lng) {
  try {
    const j = await fetchJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}&timezone=auto&forecast_days=1`,
      6000
    );
    if (j.timezone && j.timezone !== "GMT") return { tz: j.timezone, approximate: false };
  } catch {
    /* offline */
  }
  const off = Math.round(lng / 15);
  return { tz: off === 0 ? "UTC" : `Etc/GMT${off > 0 ? "-" : "+"}${Math.abs(off)}`, approximate: true };
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
