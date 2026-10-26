// Prayer-time engine: wraps adhan-js with method presets, automatic regional defaults,
// iqama rules and Jumu'ah. Everything runs on-device; no network is ever needed.
import {
  CalculationMethod,
  CalculationParameters,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PolarCircleResolution,
  PrayerTimes,
  Qibla,
  Rounding,
  SunnahTimes,
} from "./vendor/adhan.js";
import { addDays, hijriParts, parseHHMM, weekdayOf, zonedToInstant } from "./time.js";

export const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
export const TIMES = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

// `base` is an adhan preset; otherwise fajr/isha angles (or isha interval in minutes) are used.
export const METHODS = {
  MWL: { base: "MuslimWorldLeague", name: "Muslim World League", fajr: 18, isha: 17 },
  ISNA: { base: "NorthAmerica", name: "ISNA (North America)", fajr: 15, isha: 15 },
  Egypt: { base: "Egyptian", name: "Egyptian General Authority", fajr: 19.5, isha: 17.5 },
  Karachi: { base: "Karachi", name: "Univ. of Islamic Sciences, Karachi", fajr: 18, isha: 18 },
  UmmAlQura: { base: "UmmAlQura", name: "Umm al-Qura, Makkah", fajr: 18.5, ishaInterval: 90 },
  Turkey: { base: "Turkey", name: "Diyanet (Türkiye)", fajr: 18, isha: 17 },
  Dubai: { base: "Dubai", name: "Dubai (UAE)", fajr: 18.2, isha: 18.2 },
  Kuwait: { base: "Kuwait", name: "Kuwait", fajr: 18, isha: 17.5 },
  Qatar: { base: "Qatar", name: "Qatar", fajr: 18, ishaInterval: 90 },
  Gulf: { name: "Gulf Region", fajr: 19.5, ishaInterval: 90 },
  Moonsighting: { base: "MoonsightingCommittee", name: "Moonsighting Committee", fajr: 18, isha: 18 },
  Singapore: { base: "Singapore", name: "MUIS (Singapore)", fajr: 20, isha: 18 },
  JAKIM: { base: "Singapore", name: "JAKIM (Malaysia)", fajr: 20, isha: 18 },
  Kemenag: { base: "Singapore", name: "Kemenag (Indonesia)", fajr: 20, isha: 18 },
  Tehran: { base: "Tehran", name: "Inst. of Geophysics, Tehran", fajr: 17.7, isha: 14 },
  France: { name: "UOIF (France)", fajr: 12, isha: 12 },
  Russia: { name: "Spiritual Admin. of Muslims, Russia", fajr: 16, isha: 15 },
  Morocco: { name: "Morocco", fajr: 19, isha: 17 },
  Algeria: { name: "Algeria", fajr: 18, isha: 17 },
  Tunisia: { name: "Tunisia", fajr: 18, isha: 18 },
  Jordan: { name: "Jordan", fajr: 18, isha: 18 },
  Custom: { name: "Custom angles", fajr: 18, isha: 17 },
};

const COUNTRY_METHOD = {
  TR: "Turkey", US: "ISNA", CA: "ISNA", SA: "UmmAlQura", YE: "UmmAlQura",
  EG: "Egypt", SD: "Egypt", LY: "Egypt", SY: "Egypt", LB: "Egypt", IQ: "MWL",
  PK: "Karachi", IN: "Karachi", BD: "Karachi", AF: "Karachi",
  AE: "Dubai", KW: "Kuwait", QA: "Qatar", BH: "Gulf", OM: "Gulf",
  SG: "Singapore", BN: "Singapore", MY: "JAKIM", ID: "Kemenag",
  IR: "Tehran", FR: "France", RU: "Russia", MA: "Morocco", DZ: "Algeria",
  TN: "Tunisia", JO: "Jordan", GB: "Moonsighting", IE: "Moonsighting",
};

// Hanafi Asr is the common practice in these countries (Diyanet officially uses the first shadow, so TR is not listed).
const HANAFI_COUNTRIES = new Set([
  "PK", "IN", "BD", "AF", "UZ", "KZ", "TJ", "KG", "TM", "BA", "AL", "XK", "MK",
]);

// Rough country fallback when only a time zone is known (e.g. offline GPS fix).
const TZ_COUNTRY = {
  "Europe/Istanbul": "TR", "Asia/Riyadh": "SA", "Asia/Dubai": "AE", "Asia/Karachi": "PK",
  "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Dhaka": "BD", "Africa/Cairo": "EG",
  "Asia/Kuala_Lumpur": "MY", "Asia/Jakarta": "ID", "Asia/Singapore": "SG", "Asia/Tehran": "IR",
  "Europe/Paris": "FR", "Europe/London": "GB", "Europe/Dublin": "IE", "Asia/Kuwait": "KW",
  "Asia/Qatar": "QA", "Europe/Moscow": "RU", "Africa/Casablanca": "MA", "Africa/Algiers": "DZ",
  "Africa/Tunis": "TN", "Asia/Amman": "JO", "Asia/Kabul": "AF", "Asia/Bahrain": "BH",
  "Asia/Muscat": "OM", "Asia/Tashkent": "UZ", "Asia/Almaty": "KZ", "Europe/Sarajevo": "BA",
};
const US_TZ = /^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Indiana|Kentucky|Boise|Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Regina|St_Johns)/;

export function guessCountry(place) {
  if (place?.cc) return String(place.cc).toUpperCase();
  const tz = place?.tz || "";
  if (TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
  if (US_TZ.test(tz)) return "US";
  return null;
}

export const DEFAULT_CALC = {
  method: "auto",
  madhab: "auto", // auto | shafi | hanafi
  highLat: "auto", // auto | middle | seventh | angle
  fajrAngle: 18,
  ishaAngle: 17,
  ishaInterval: 0,
  adj: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  imsak: 10, // minutes before Fajr
};

export function normalizeCalc(calc = {}) {
  const c = { ...DEFAULT_CALC, ...(calc || {}) };
  c.adj = { ...DEFAULT_CALC.adj, ...(calc?.adj || {}) };
  for (const k of TIMES) c.adj[k] = clampInt(c.adj[k], -60, 60);
  if (c.method !== "auto" && !METHODS[c.method]) c.method = "auto";
  if (!["auto", "shafi", "hanafi"].includes(c.madhab)) c.madhab = "auto";
  if (!["auto", "middle", "seventh", "angle"].includes(c.highLat)) c.highLat = "auto";
  c.fajrAngle = clampNum(c.fajrAngle, 6, 25, 18);
  c.ishaAngle = clampNum(c.ishaAngle, 6, 25, 17);
  c.ishaInterval = clampInt(c.ishaInterval, 0, 180);
  c.imsak = clampInt(c.imsak, 0, 60);
  return c;
}

// Resolve "auto" choices against the place, returning concrete values plus a human-readable reason.
export function resolveCalc(place, calcIn) {
  const calc = normalizeCalc(calcIn);
  const cc = guessCountry(place);
  const method = calc.method === "auto" ? COUNTRY_METHOD[cc] || "MWL" : calc.method;
  const madhab = calc.madhab === "auto" ? (HANAFI_COUNTRIES.has(cc) ? "hanafi" : "shafi") : calc.madhab;
  const lat = Math.abs(place?.lat || 0);
  const highLat = calc.highLat === "auto" ? (lat > 48 ? "seventh" : "middle") : calc.highLat;
  return { ...calc, method, madhab, highLat, country: cc, autoMethod: calc.method === "auto", autoMadhab: calc.madhab === "auto" };
}

function buildParams(r, ymd) {
  const def = METHODS[r.method] || METHODS.MWL;
  let params;
  if (r.method === "Custom") {
    params = new CalculationParameters("Other", r.fajrAngle, r.ishaInterval ? 0 : r.ishaAngle, r.ishaInterval);
  } else if (def.base) {
    params = CalculationMethod[def.base]();
  } else {
    params = new CalculationParameters("Other", def.fajr, def.ishaInterval ? 0 : def.isha, def.ishaInterval || 0);
  }
  if (r.method === "JAKIM" || r.method === "Kemenag") params.rounding = Rounding.Up;
  // Umm al-Qura adds 30 minutes to Isha during Ramadan.
  if (r.method === "UmmAlQura") {
    const h = hijriParts(ymd);
    if (h && h.m === 9) params.ishaInterval = 120;
  }
  params.madhab = r.madhab === "hanafi" ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule = {
    middle: HighLatitudeRule.MiddleOfTheNight,
    seventh: HighLatitudeRule.SeventhOfTheNight,
    angle: HighLatitudeRule.TwilightAngle,
  }[r.highLat];
  params.polarCircleResolution = PolarCircleResolution.AqrabYaum;
  params.adjustments = { ...r.adj };
  return params;
}

const dayCache = new Map();

// Compute adhan times for a place on a local calendar day (`ymd` in the place's time zone).
export function computeDay(place, calcIn, ymd) {
  const r = resolveCalc(place, calcIn);
  const key = JSON.stringify([place.lat, place.lng, r, ymd]);
  const hit = dayCache.get(key);
  if (hit) return hit;

  const coords = new Coordinates(place.lat, place.lng);
  const params = buildParams(r, ymd);
  // adhan reads the local Y/M/D components of the Date it is given.
  const pt = new PrayerTimes(coords, new Date(ymd.y, ymd.m - 1, ymd.d), params);
  const times = {};
  for (const k of TIMES) times[k] = valid(pt[k]);
  times.imsak = times.fajr && r.imsak ? new Date(times.fajr.getTime() - r.imsak * 60000) : null;
  let sunnah = null;
  try {
    sunnah = new SunnahTimes(pt);
  } catch {
    /* polar edge cases */
  }
  times.midnight = valid(sunnah?.middleOfTheNight);
  times.lastThird = valid(sunnah?.lastThirdOfTheNight);
  // Duha starts ~20 min after sunrise; Zawal (forbidden) ~5 min before Dhuhr adhan.
  times.duha = times.sunrise ? new Date(times.sunrise.getTime() + 20 * 60000) : null;

  const out = { ymd, times, resolved: r };
  if (dayCache.size > 400) dayCache.clear();
  dayCache.set(key, out);
  return out;
}

// --- Iqama ---------------------------------------------------------------
// Rule per prayer: { mode: "offset", offset: 10, round: 0|5|10|15 }
//              or { mode: "fixed", time: "20:15", min: 10 } — a fixed time, but never earlier than
//                 `min` minutes after the adhan (fixed times drift against the seasons otherwise).
// Masjids often change iqama during the year (e.g. Isha 19:30 in winter, 21:45 in summer).
// A rule may carry `changes: [{ from: "MM-DD", ...rule }]` that apply every year from that date;
// the base rule applies from 1 January until the first change.
export function activeRule(rule, ymd) {
  if (!rule?.changes?.length) return rule;
  const md = `${String(ymd.m).padStart(2, "0")}-${String(ymd.d).padStart(2, "0")}`;
  let active = rule;
  for (const c of [...rule.changes].sort((a, b) => a.from.localeCompare(b.from))) {
    if (c.from <= md) active = c;
  }
  return active;
}

export function iqamaFor(prayer, adhan, ruleIn, ymd, tz) {
  const rule = activeRule(ruleIn, ymd);
  if (!rule || !adhan) return null;
  if (rule.mode === "fixed") {
    const hm = parseHHMM(rule.time);
    if (!hm) return null;
    const at = zonedToInstant(ymd, hm.hh, hm.mm, tz);
    const earliest = adhan.getTime() + clampInt(rule.min, 0, 120) * 60000;
    // The fixed time has fallen before the adhan (+ minimum gap): use that instead and flag it.
    if (at.getTime() < earliest) return { at: new Date(earliest), clamped: true };
    return { at, clamped: false };
  }
  const off = clampInt(rule.offset, 0, 180);
  let ms = adhan.getTime() + off * 60000;
  const step = [5, 10, 15].includes(Number(rule.round)) ? Number(rule.round) : 0;
  if (step) {
    const stepMs = step * 60000;
    ms = Math.ceil(ms / stepMs) * stepMs;
  }
  return { at: new Date(ms), clamped: false };
}

// Full schedule for a day: adhan + iqama + Jumu'ah handling, as an ordered list of rows.
export function scheduleFor(place, calc, ymd) {
  const day = computeDay(place, calc, ymd);
  const isFriday = weekdayOf(ymd) === 5;
  const rows = [];
  for (const key of TIMES) {
    const adhan = day.times[key];
    const row = { key, adhan, iqama: null, isPrayer: key !== "sunrise" };
    if (key === "dhuhr" && isFriday && place.jumuah?.length) {
      row.key = "jumuah";
      row.jumuah = place.jumuah
        .map((t) => parseHHMM(t))
        .filter(Boolean)
        .map((hm) => zonedToInstant(ymd, hm.hh, hm.mm, place.tz));
      row.iqama = row.jumuah[0] ? { at: row.jumuah[0], clamped: false } : null;
    } else if (row.isPrayer && place.iqama) {
      row.iqama = iqamaFor(key, adhan, place.iqama[key], ymd, place.tz);
    }
    rows.push(row);
  }
  return { ...day, rows, isFriday };
}

// Status at `now`: current window, next event, and progress through the current window.
export function statusAt(place, calc, ymd, now = new Date()) {
  const today = scheduleFor(place, calc, ymd);
  const tomorrow = scheduleFor(place, calc, addDays(ymd, 1));
  const yesterday = scheduleFor(place, calc, addDays(ymd, -1));
  const seq = [];
  const push = (s, tag) => {
    for (const r of s.rows) if (r.adhan) seq.push({ ...r, day: tag });
  };
  push(yesterday, -1);
  push(today, 0);
  push(tomorrow, 1);
  const t = now.getTime();
  let idx = -1;
  for (let i = 0; i < seq.length; i++) if (seq[i].adhan.getTime() <= t) idx = i;
  const current = idx >= 0 ? seq[idx] : null;
  const next = seq[idx + 1] || null;
  let progress = 0;
  if (current && next) progress = (t - current.adhan.getTime()) / (next.adhan.getTime() - current.adhan.getTime());
  // Pending iqama for the current prayer (adhan called, congregation not yet started).
  const pendingIqama = current?.iqama && current.iqama.at.getTime() > t ? current.iqama.at : null;
  return { today, tomorrow, current, next, progress: Math.min(1, Math.max(0, progress)), pendingIqama };
}

export function qiblaBearing(lat, lng) {
  return Qibla(new Coordinates(lat, lng));
}

export function distanceToKaabaKm(lat, lng) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(21.4225241 - lat);
  const dLng = toRad(39.8261818 - lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(21.4225241)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function valid(d) {
  return d instanceof Date && !isNaN(d.getTime()) ? d : null;
}

export function clampInt(v, min, max) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return Math.min(max, Math.max(min, 0));
  return Math.min(max, Math.max(min, n));
}

function clampNum(v, min, max, dflt) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}
