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

const norm = (x) =>
  String(x || "")
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i");

// Cities (Open-Meteo). People type names in their own language ("Londra", "Kahire"), so we ask in the
// UI language, the device language and English, merge, and rank: exact name first, then by size.
async function searchCities(query, lang) {
  const device = String(navigator.language || "en").slice(0, 2).toLowerCase();
  const langs = [...new Set([lang, device, "en"])].slice(0, 3);
  const responses = await Promise.allSettled(
    langs.map((l) =>
      fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=${encodeURIComponent(l)}&format=json`, 8000)
    )
  );
  if (responses.every((r) => r.status === "rejected")) throw responses[0].reason;
  const nq = norm(query);
  const byId = new Map();
  for (const r of responses) {
    if (r.status !== "fulfilled") continue;
    for (const p of r.value.results || []) {
      const prev = byId.get(p.id);
      if (!prev) byId.set(p.id, { p, exact: norm(p.name) === nq, prefix: norm(p.name).startsWith(nq) });
      else if (norm(p.name) === nq) prev.exact = true;
    }
  }
  return [...byId.values()]
    .sort((a, b) => b.exact - a.exact || b.prefix - a.prefix || (b.p.population || 0) - (a.p.population || 0))
    .map(({ p: r, exact }) => ({
      name: r.name,
      sub: [r.admin1, r.country].filter(Boolean).join(", "),
      lat: round(r.latitude, 5),
      lng: round(r.longitude, 5),
      tz: r.timezone || "UTC",
      cc: r.country_code || null,
      type: "city",
      exact,
    }));
}

// Streets, buildings and masjids (Photon, OpenStreetMap). No time zone in the answer: resolved on pick.
async function searchAddresses(query, lang) {
  const l = ["en", "de", "fr"].includes(lang) ? `&lang=${lang}` : "";
  const j = await fetchJson(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=8${l}`, 8000);
  return (j.features || [])
    .filter((f) => f.geometry?.coordinates && !["bus_stop", "platform", "station"].includes(f.properties?.osm_value))
    .map((f) => {
      const p = f.properties || {};
      const numberFirst = ["US", "CA", "GB", "AU", "NZ", "IE", "FR", "IN", "ZA", "SG", "MY"].includes(String(p.countrycode).toUpperCase());
      const street = (numberFirst ? [p.housenumber, p.street] : [p.street, p.housenumber]).filter(Boolean).join(" ");
      const name = p.name || street || p.city || p.county || "";
      const area = [p.name && street ? street : "", p.district || p.locality, p.city && p.city !== name ? p.city : "", p.country]
        .filter(Boolean)
        .join(", ");
      const [lng, lat] = f.geometry.coordinates;
      const worship = p.osm_value === "place_of_worship" || p.osm_value === "mosque";
      return { name, sub: area, lat: round(lat, 5), lng: round(lng, 5), tz: null, cc: p.countrycode || null, type: worship ? "mosque" : "address" };
    })
    .filter((x) => x.name);
}

// One search box for everything: cities first when the query is a city name, addresses and masjids
// otherwise ("350 5th Ave", "East London Mosque"). Near-duplicates are dropped.
export async function searchPlaces(q, lang = "en") {
  const query = String(q || "").trim();
  if (query.length < 2) return [];
  const [cities, addresses] = await Promise.allSettled([searchCities(query, lang), query.length >= 3 ? searchAddresses(query, lang) : Promise.resolve([])]);
  if (cities.status === "rejected" && addresses.status === "rejected") throw cities.reason;
  const c = cities.status === "fulfilled" ? cities.value : [];
  const a = addresses.status === "fulfilled" ? addresses.value : [];
  const looksLikeAddress = /\d/.test(query) || query.includes(",") || /\b(mosque|masjid|cami|camii|mescid|jami|street|st|ave|road|rd|cad|sok)\b/i.test(query);
  const ordered = looksLikeAddress ? [...a, ...c] : [...c.filter((x) => x.exact), ...a.slice(0, 3), ...c.filter((x) => !x.exact), ...a.slice(3)];
  const out = [];
  for (const x of ordered) {
    // Same place twice, or many things registered at one address (shops, radio stations…): keep one.
    if (out.some((y) => (distanceKm(x, y) < 0.3 && norm(x.name) === norm(y.name)) || (x.type !== "city" && y.type !== "city" && x.sub && x.sub === y.sub && distanceKm(x, y) < 0.05))) continue;
    out.push(x);
    if (out.length >= 10) break;
  }
  return out;
}

// Fill in what an address result lacks (time zone) before it is saved.
export async function completePlace(f) {
  if (f.tz) return f;
  const { tz } = await timezoneFor(f.lat, f.lng);
  return { ...f, tz };
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
