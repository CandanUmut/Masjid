// Persistent app state in localStorage. Small, versioned, and tolerant of corrupt data.
import { DEFAULT_CALC, normalizeCalc } from "./engine.js";

const KEY = "masjid.state.v1";

export const DEFAULT_SETTINGS = {
  lang: "auto", // auto | en | tr | ar
  theme: "auto", // auto | light | dark
  clock: "auto", // auto | 12 | 24
  extras: { imsak: false, sunrise: true, duha: false, midnight: false, lastThird: false },
  hijriOffset: 0,
  calc: { ...DEFAULT_CALC },
  notify: { enabled: false, before: 0, iqama: false },
};

function fresh() {
  return {
    settings: structuredClone(DEFAULT_SETTINGS),
    places: [],
    activeId: "gps",
    gps: null, // { lat, lng, tz, cc, name, sub, at }
    onboarded: false,
  };
}

export function load() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(KEY));
  } catch {
    raw = null;
  }
  const s = fresh();
  if (!raw || typeof raw !== "object") return s;
  s.settings = {
    ...s.settings,
    ...(raw.settings || {}),
    extras: { ...s.settings.extras, ...(raw.settings?.extras || {}) },
    notify: { ...s.settings.notify, ...(raw.settings?.notify || {}) },
    calc: normalizeCalc(raw.settings?.calc),
  };
  s.places = Array.isArray(raw.places) ? raw.places.filter(isPlace) : [];
  s.activeId = typeof raw.activeId === "string" ? raw.activeId : "gps";
  s.gps = raw.gps && Number.isFinite(raw.gps.lat) ? raw.gps : null;
  s.onboarded = Boolean(raw.onboarded);
  if (s.activeId !== "gps" && !s.places.some((p) => p.id === s.activeId)) s.activeId = "gps";
  return s;
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function isPlace(p) {
  return (
    p &&
    typeof p === "object" &&
    typeof p.id === "string" &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180 &&
    typeof p.tz === "string"
  );
}

export function newId() {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 10);
}
