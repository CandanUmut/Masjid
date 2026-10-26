// Seeds: a whole masjid (location, method, iqama rules, Jumu'ah, note) packed into a short,
// URL-safe string. No server — the link *is* the data. Format:
//   <kind><payload>   kind: "m" = place/masjid v1 (deflate-raw), "M" = same, uncompressed
//                            "b" = full backup v1 (deflate-raw), "B" = same, uncompressed
//   payload = base64url(JSON array)
import { PRAYERS, TIMES, METHODS, normalizeCalc } from "./engine.js";
import { isValidTimeZone, parseHHMM } from "./time.js";

const HL = { auto: "a", middle: "m", seventh: "7", angle: "t" };
const HL_R = Object.fromEntries(Object.entries(HL).map(([k, v]) => [v, k]));
const MADHAB = { auto: "a", shafi: "s", hanafi: "h" };
const MADHAB_R = Object.fromEntries(Object.entries(MADHAB).map(([k, v]) => [v, k]));

// --- iqama rules <-> "+10|+10r5|@13:30|" ---------------------------------------------
// One rule: "+10", "+10r5" (after adhan, rounded up to 5), "-40", "-40r5" (before the next prayer, rounded
// down) or "@20:15", "@20:15>10" (fixed, ≥10 min after adhan).
// Seasonal changes follow as "~MMDD<rule>", e.g. "@19:30~0329@21:00~1025@19:30".
function ruleStr(r) {
  if (!r) return "";
  if (r.mode === "fixed") return parseHHMM(r.time) ? `@${r.time}${r.min ? `>${Math.min(120, Math.max(0, Math.round(r.min)))}` : ""}` : "";
  const off = Math.max(0, Math.min(300, Math.round(Number(r.offset) || 0)));
  return `${r.mode === "before" ? "-" : "+"}${off}${r.round ? `r${r.round}` : ""}`;
}

function parseRule(v) {
  let m;
  if ((m = /^@(\d{1,2}:\d{2})(?:>(\d{1,3}))?$/.exec(v)) && parseHHMM(m[1])) return { mode: "fixed", time: m[1], min: m[2] ? Math.min(120, Number(m[2])) : 0 };
  if ((m = /^([+-])(\d{1,3})(?:r(5|10|15))?$/.exec(v))) return { mode: m[1] === "-" ? "before" : "offset", offset: Math.min(300, Number(m[2])), round: m[3] ? Number(m[3]) : 0 };
  return null;
}

const validMd = (md) => /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(md);

export function packIqama(iqama) {
  if (!iqama) return "";
  const parts = PRAYERS.map((p) => {
    const r = iqama[p];
    const base = ruleStr(r);
    if (!base) return "";
    const changes = (r.changes || [])
      .filter((c) => validMd(c.from) && ruleStr(c))
      .sort((a, b) => a.from.localeCompare(b.from))
      .slice(0, 12)
      .map((c) => `~${c.from.replace("-", "")}${ruleStr(c)}`);
    return base + changes.join("");
  });
  return parts.some(Boolean) ? parts.join("|") : "";
}

export function unpackIqama(s) {
  if (!s || typeof s !== "string") return null;
  const parts = s.split("|");
  const out = {};
  let any = false;
  PRAYERS.forEach((p, i) => {
    const [baseStr, ...rest] = (parts[i] || "").split("~");
    const rule = parseRule(baseStr);
    if (rule && rest.length) {
      const changes = [];
      for (const c of rest.slice(0, 12)) {
        const md = `${c.slice(0, 2)}-${c.slice(2, 4)}`;
        const r = parseRule(c.slice(4));
        if (validMd(md) && r) changes.push({ from: md, ...r });
      }
      if (changes.length) rule.changes = changes;
    }
    out[p] = rule;
    if (rule) any = true;
  });
  return any ? out : null;
}

// --- place <-> compact array ---------------------------------------------------------
function packCalc(calcIn) {
  if (!calcIn) return null; // inherits the viewer's own settings
  const c = normalizeCalc(calcIn);
  const adj = TIMES.map((k) => c.adj[k] || 0);
  const out = [c.method === "auto" ? "a" : c.method, MADHAB[c.madhab], HL[c.highLat]];
  if (c.method === "Custom") out.push(c.fajrAngle, c.ishaAngle, c.ishaInterval);
  else out.push(0, 0, 0);
  if (adj.some(Boolean)) out.push(adj);
  return out;
}

function unpackCalc(a) {
  if (!Array.isArray(a)) return null;
  const [m, md, hl, fa, ia, ii, adj] = a;
  const calc = {
    method: m === "a" ? "auto" : METHODS[m] ? m : "auto",
    madhab: MADHAB_R[md] || "auto",
    highLat: HL_R[hl] || "auto",
  };
  if (calc.method === "Custom") Object.assign(calc, { fajrAngle: fa, ishaAngle: ia, ishaInterval: ii });
  if (Array.isArray(adj)) calc.adj = Object.fromEntries(TIMES.map((k, i) => [k, Number(adj[i]) || 0]));
  return normalizeCalc(calc);
}

export function placeToArray(p) {
  return [
    1, // format version
    p.kind === "masjid" ? "m" : "c",
    String(p.id || ""),
    String(p.name || "").slice(0, 80),
    String(p.sub || "").slice(0, 120),
    Math.round(p.lat * 1e5) / 1e5,
    Math.round(p.lng * 1e5) / 1e5,
    p.tz,
    p.cc || "",
    packCalc(p.calc),
    packIqama(p.iqama),
    (p.jumuah || []).filter((t) => parseHHMM(t)).join(","),
    String(p.note || "").slice(0, 280),
    p.u || 0,
  ];
}

export function arrayToPlace(a) {
  if (!Array.isArray(a) || a[0] !== 1) throw new Error("unsupported seed version");
  const [, kind, id, name, sub, lat, lng, tz, cc, calc, iqama, jumuah, note, u] = a;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error("bad coordinates");
  if (!isValidTimeZone(tz)) throw new Error("bad time zone");
  return {
    id: /^[a-z0-9]{4,16}$/i.test(id) ? id : null,
    kind: kind === "m" ? "masjid" : "city",
    name: String(name || "").slice(0, 80) || `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
    sub: String(sub || "").slice(0, 120),
    lat,
    lng,
    tz,
    cc: /^[A-Z]{2}$/.test(cc) ? cc : null,
    calc: unpackCalc(calc),
    iqama: unpackIqama(iqama),
    jumuah: String(jumuah || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => parseHHMM(s))
      .slice(0, 6),
    note: String(note || "").slice(0, 280),
    u: Number.isFinite(u) ? u : 0,
  };
}

// --- bytes <-> base64url, with optional deflate ------------------------------------------
function b64url(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(str) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "===".slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

const canCompress = typeof CompressionStream === "function" && typeof DecompressionStream === "function";

async function encode(kind, value) {
  const json = new TextEncoder().encode(JSON.stringify(value));
  if (canCompress) {
    try {
      const z = await pipe(json, new CompressionStream("deflate-raw"));
      if (z.length < json.length) return kind + b64url(z);
    } catch {
      /* fall through to uncompressed */
    }
  }
  return kind.toUpperCase() + b64url(json);
}

async function decode(seed) {
  const kind = seed[0];
  const body = unb64url(seed.slice(1));
  let bytes = body;
  if (kind === kind.toLowerCase()) {
    if (!canCompress) throw new Error("This browser can't open compressed codes");
    bytes = await pipe(body, new DecompressionStream("deflate-raw"));
  }
  if (bytes.length > 200000) throw new Error("too large");
  return { kind: kind.toLowerCase(), value: JSON.parse(new TextDecoder().decode(bytes)) };
}

// --- public API ----------------------------------------------------------------------
export async function placeToSeed(place) {
  return encode("m", placeToArray(place));
}

export async function backupToSeed(state) {
  return encode("b", {
    v: 1,
    settings: state.settings,
    places: state.places.map(placeToArray),
    activeId: state.activeId,
  });
}

// Accepts a bare seed, "#/m/<seed>", or any full URL containing one.
export function extractSeed(text) {
  const s = String(text || "").trim();
  const m = /(?:#\/?m\/|[?&]seed=)([A-Za-z0-9_-]+)/.exec(s);
  if (m) return m[1];
  if (/^[mMbB][A-Za-z0-9_-]{8,}$/.test(s)) return s;
  return null;
}

export async function parseSeed(text) {
  const seed = extractSeed(text);
  if (!seed) throw new Error("not a seed");
  const { kind, value } = await decode(seed);
  if (kind === "m") return { kind: "place", place: arrayToPlace(value) };
  if (kind === "b") {
    if (!value || value.v !== 1) throw new Error("unsupported backup");
    const places = [];
    for (const a of value.places || []) {
      try {
        places.push(arrayToPlace(a));
      } catch {
        /* skip broken entries */
      }
    }
    return { kind: "backup", settings: value.settings || {}, places, activeId: value.activeId };
  }
  throw new Error("unknown seed kind");
}

export function seedUrl(seed, route = "m") {
  const base = location.href.split("#")[0].split("?")[0];
  return `${base}#/${route}/${seed}`;
}
