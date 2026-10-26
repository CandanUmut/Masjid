// Location helpers. GPS never leaves the device except for an optional, cached
// reverse-geocode lookup to show a friendly place name.
import { deviceTimeZone, tzOffsetMinutes } from "./time.js";

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
const MOSQUE_NAME = /mosque|masjid|mescid|cami|jami|moschee|mosquée|mezquita|moskee|musalla|islamic|مسجد|جامع|مصلى/i;

// With `near` (rounded to ~10 km) nearby results come first; `worship` limits results to places of worship.
async function searchAddresses(query, lang, { near = null, worship = false } = {}) {
  const l = ["en", "de", "fr"].includes(lang) ? `&lang=${lang}` : "";
  const bias = near ? `&lat=${near.lat.toFixed(1)}&lon=${near.lng.toFixed(1)}` : "";
  const tag = worship ? "&osm_tag=amenity:place_of_worship" : "";
  const j = await fetchJson(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=8${l}${bias}${tag}`, 8000);
  return (j.features || [])
    .filter((f) => f.geometry?.coordinates && !["bus_stop", "platform", "station"].includes(f.properties?.osm_value))
    .map((f) => {
      const p = f.properties || {};
      const numberFirst = ["US", "CA", "GB", "AU", "NZ", "IE", "FR", "IN", "ZA", "SG", "MY"].includes(String(p.countrycode).toUpperCase());
      const street = (numberFirst ? [p.housenumber, p.street] : [p.street, p.housenumber]).filter(Boolean).join(" ");
      // Typed a house number? Then the address is what was asked for, and the shop there is the detail.
      const wantsAddress = /\d/.test(query) && p.housenumber && p.street && p.name && !["place_of_worship", "mosque"].includes(p.osm_value);
      const name = wantsAddress ? street : p.name || street || p.city || p.county || "";
      const area = [wantsAddress ? p.name : p.name && street ? street : "", p.district || p.locality, p.city && p.city !== name ? p.city : "", p.country]
        .filter(Boolean)
        .join(", ");
      const [lng, lat] = f.geometry.coordinates;
      // OSM's place_of_worship covers every faith; only names that say "mosque" get the mosque treatment.
      // A building or landmark named "… Camii" is a mosque too (often tagged as tourism/historic in OSM).
      const mosque =
        p.osm_value === "mosque" ||
        (p.osm_value === "place_of_worship" && MOSQUE_NAME.test(name)) ||
        (Boolean(p.name) && !["highway", "place", "boundary", "railway", "shop", "office", "amenity"].includes(p.osm_key) && MOSQUE_NAME.test(p.name));
      return { name, sub: area, lat: round(lat, 5), lng: round(lng, 5), tz: null, cc: p.countrycode || null, type: mosque ? "mosque" : "address" };
    })
    .filter((x) => x.name);
}

// Words that mean "this is an address or a building", in the languages people search in.
const ADDRESS_WORD = /(^|[\s,])(mosque|masjid|mescid|cami|camii|jami|jamia|islamic|street|st\.?|ave\.?|avenue|road|rd\.?|blvd|lane|drive|dr\.?|cad(desi)?\.?|cd\.?|sok(ak|ağı)?\.?|sk\.?|mah(alle(si)?)?\.?|bulvar[ıi]?|rue|strasse|straße|str\.?|calle|via|شارع|مسجد|جامع)(?=$|[\s,])/iu;

const MOSQUE_WORD = /(^|[\s,])(mosque|masjid|mescidi?|camii?|jami|jamia|مسجد|جامع)(?=$|[\s,])/giu;

// One search box for everything: cities first when the query is a city name, addresses and masjids
// otherwise ("350 5th Ave", "East London Mosque"). Near-duplicates are dropped. Results are cached
// for the session, so typing back and forth doesn't repeat requests.
const searchCache = new Map();
export async function searchPlaces(q, lang = "en", near = null) {
  const query = String(q || "").trim();
  if (query.length < 2) return [];
  const cacheKey = `${lang}|${near ? `${near.lat.toFixed(1)},${near.lng.toFixed(1)}` : ""}|${norm(query)}`;
  if (searchCache.has(cacheKey)) return searchCache.get(cacheKey);
  // "Fatih Camii": also ask for places of worship named "Fatih", which finds the mosque itself.
  const mosqueName = MOSQUE_WORD.test(query) ? query.replace(MOSQUE_WORD, " ").replace(/\s+/g, " ").trim() : "";
  MOSQUE_WORD.lastIndex = 0;
  const cityP = searchCities(query, lang);
  const [addresses, mosques] = await Promise.allSettled([
    query.length >= 3 ? searchAddresses(query, lang, { near }) : Promise.resolve([]),
    mosqueName.length >= 2 ? searchAddresses(mosqueName, lang, { near, worship: true }) : Promise.resolve([]),
  ]);
  // Never wait long for one slow provider: once addresses are in, cities get a short grace period.
  const haveAddresses = addresses.status === "fulfilled" && addresses.value.length > 0;
  const [cities] = await Promise.allSettled([haveAddresses ? Promise.race([cityP, new Promise((r) => setTimeout(() => r([]), 1500))]) : cityP]);
  if (cities.status === "rejected" && addresses.status === "rejected") throw cities.reason;
  const c = cities.status === "fulfilled" ? cities.value : [];
  // Mosques: nearby ones first (within ~30 km, closest first), then the rest in relevance order.
  const fromWorship = mosques.status === "fulfilled" ? mosques.value.filter((x) => x.type === "mosque") : [];
  const fromAddresses = addresses.status === "fulfilled" ? addresses.value : [];
  let a = [...fromWorship, ...fromAddresses];
  if (near && mosqueName) {
    // Looking for a mosque: every mosque result, from either request, nearest first.
    const d = (x) => distanceKm(near, x);
    const rank = (x) => (d(x) < 30 ? d(x) : 1e6);
    const ms = a.filter((x) => x.type === "mosque").sort((x, y) => rank(x) - rank(y));
    a = [...ms, ...a.filter((x) => x.type !== "mosque")];
  }
  const looksLikeAddress = /\d/.test(query) || query.includes(",") || ADDRESS_WORD.test(query);
  const ordered = looksLikeAddress ? [...a, ...c] : [...c.filter((x) => x.exact), ...a.slice(0, 3), ...c.filter((x) => !x.exact), ...a.slice(3)];
  const out = [];
  for (const x of ordered) {
    // Same place twice, or many things registered at one address (shops, radio stations…): keep one.
    const dup = (y) =>
      (norm(x.name) === norm(y.name) && (distanceKm(x, y) < 0.3 || (x.sub && x.sub === y.sub))) ||
      (x.type !== "city" && y.type !== "city" && x.sub && x.sub === y.sub && distanceKm(x, y) < 0.05) ||
      // One building, two names ("Blue Mosque" / "Sultanahmet Camii")
      (x.type === "mosque" && y.type === "mosque" && distanceKm(x, y) < 0.15);
    if (out.some(dup)) continue;
    out.push(x);
    if (out.length >= 10) break;
  }
  if (searchCache.size > 40) searchCache.delete(searchCache.keys().next().value);
  searchCache.set(cacheKey, out);
  return out;
}

// Fill in what an address result lacks (time zone) before it is saved.
export async function completePlace(f) {
  if (f.tz) return f;
  // A country with one time zone needs no network at all: picking stays instant.
  if (f.cc) {
    const g = await guessTimeZone(f.lat, f.lng, f.cc);
    if (!g.approximate) return { ...f, tz: g.tz };
  }
  const { tz } = await timezoneFor(f.lat, f.lng, f.cc);
  return { ...f, tz };
}

// IANA time zone for coordinates. Online: Open-Meteo (rounded position), with one retry when it is
// busy. Otherwise the bundled zone table: exact for single-zone countries, the nearest zone's city
// elsewhere (flagged approximate so the UI can ask the user to confirm).
const tzCache = new Map();
export async function timezoneFor(lat, lng, cc = null) {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  if (tzCache.has(key)) return tzCache.get(key);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const j = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}&timezone=auto&forecast_days=1`, 3000);
      if (j.timezone && j.timezone !== "GMT") {
        const res = { tz: j.timezone, approximate: false };
        tzCache.set(key, res);
        return res;
      }
      break;
    } catch (e) {
      if (attempt === 0 && /HTTP (429|5\d\d)/.test(e.message)) await new Promise((r) => setTimeout(r, 900));
      else break;
    }
  }
  return guessTimeZone(lat, lng, cc);
}

export async function guessTimeZone(lat, lng, cc = null) {
  try {
    const { ZONES } = await import("./tzdata.js");
    const all = ZONES.split(";").map((r) => {
      const [c, la, lo, tz] = r.split(",");
      return { cc: c, lat: Number(la), lng: Number(lo), tz };
    });
    const same = cc ? all.filter((z) => z.cc === String(cc).toUpperCase()) : [];
    // Never a zone whose clock is far from the sun's (e.g. across the date line).
    const solar = lng / 15;
    const pool = (same.length ? same : all).filter((z) => same.length === 1 || Math.abs(tzOffsetMinutes(Date.now(), z.tz) / 60 - solar) <= 3);
    let best = null;
    let bestKm = Infinity;
    for (const z of pool) {
      const d = distanceKm({ lat, lng }, z);
      if (d < bestKm) [best, bestKm] = [z, d];
    }
    // One zone for the whole country is the answer; otherwise the nearest zone city is a good guess.
    if (best && (same.length || bestKm < 1000)) return { tz: best.tz, approximate: same.length !== 1 };
  } catch {
    /* table unavailable */
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
