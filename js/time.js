// Time-zone aware helpers built on Intl. All instants are plain Date objects (UTC under the hood);
// "local" always means local to a place's IANA time zone, never the device.

const dtfCache = new Map();
function dtf(locale, opts) {
  const key = locale + JSON.stringify(opts);
  let f = dtfCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, opts);
    dtfCache.set(key, f);
  }
  return f;
}

export function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function isValidTimeZone(tz) {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function allTimeZones() {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [deviceTimeZone(), "UTC"];
  }
}

// Calendar parts of an instant as seen in `tz`.
export function partsInTz(date, tz) {
  const parts = dtf("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    weekday: "short",
  }).formatToParts(date);
  const out = {};
  for (const p of parts) out[p.type] = p.value;
  return {
    y: Number(out.year),
    m: Number(out.month),
    d: Number(out.day),
    hh: Number(out.hour) % 24,
    mm: Number(out.minute),
    ss: Number(out.second),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(out.weekday),
  };
}

// Offset of `tz` from UTC at instant `ms`, in minutes.
export function tzOffsetMinutes(ms, tz) {
  const p = partsInTz(new Date(ms), tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

// Instant for a wall-clock time in `tz`. Handles DST by re-checking the offset.
export function zonedToInstant(ymd, hh, mm, tz) {
  const guess = Date.UTC(ymd.y, ymd.m - 1, ymd.d, hh, mm);
  let off = tzOffsetMinutes(guess, tz);
  let ms = guess - off * 60000;
  const off2 = tzOffsetMinutes(ms, tz);
  if (off2 !== off) ms = guess - off2 * 60000;
  return new Date(ms);
}

export function todayYmd(tz, now = new Date()) {
  const p = partsInTz(now, tz);
  return { y: p.y, m: p.m, d: p.d };
}

export function addDays(ymd, n) {
  const t = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

export function ymdKey(ymd) {
  return `${ymd.y}-${String(ymd.m).padStart(2, "0")}-${String(ymd.d).padStart(2, "0")}`;
}

export function sameYmd(a, b) {
  return a.y === b.y && a.m === b.m && a.d === b.d;
}

export function weekdayOf(ymd) {
  return new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d)).getUTCDay();
}

export function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function parseHHMM(s) {
  const m = /^\s*(\d{1,2})[:.](\d{2})\s*$/.exec(String(s || ""));
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return { hh, mm };
}

export function formatTime(date, tz, { hour12 = false, locale = "en" } = {}) {
  if (!(date instanceof Date) || isNaN(date)) return "—";
  return dtf(locale, {
    timeZone: tz,
    hour: hour12 ? "numeric" : "2-digit",
    minute: "2-digit",
    hour12,
    ...(hour12 ? {} : { hourCycle: "h23" }),
  }).format(date);
}

export function formatHHMM(date, tz) {
  const p = partsInTz(date, tz);
  return `${String(p.hh).padStart(2, "0")}:${String(p.mm).padStart(2, "0")}`;
}

export function formatDate(ymd, locale, opts = { weekday: "long", day: "numeric", month: "long" }) {
  return dtf(locale, { timeZone: "UTC", ...opts }).format(new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d, 12)));
}

// Hijri date via the built-in Umm al-Qura calendar. `offsetDays` lets users align with local moon sighting.
export function hijriParts(ymd, offsetDays = 0) {
  const base = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + offsetDays, 12));
  try {
    const parts = dtf("en-US-u-ca-islamic-umalqura", {
      timeZone: "UTC",
      day: "numeric",
      month: "numeric",
      year: "numeric",
    }).formatToParts(base);
    const o = {};
    for (const p of parts) o[p.type] = p.value;
    return { d: Number(o.day), m: Number(o.month), y: parseInt(o.year, 10) };
  } catch {
    return null;
  }
}

export function formatHijri(ymd, locale, offsetDays = 0) {
  const base = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + offsetDays, 12));
  try {
    return dtf(`${locale}-u-ca-islamic-umalqura`, {
      timeZone: "UTC",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(base);
  } catch {
    return "";
  }
}

// "1:05:09" / "45:09" style countdown.
export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mmss = `${String(m).padStart(h ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
  return h ? `${h}:${mmss}` : mmss;
}

// Time split into the clock part and the AM/PM marker (locale aware), e.g. { main: "5:55", period: "AM" }.
export function timeParts(date, tz, { hour12 = false, locale = "en" } = {}) {
  if (!(date instanceof Date) || isNaN(date)) return { main: "—", period: "" };
  const parts = dtf(locale, {
    timeZone: tz,
    hour: hour12 ? "numeric" : "2-digit",
    minute: "2-digit",
    hour12,
    ...(hour12 ? {} : { hourCycle: "h23" }),
  }).formatToParts(date);
  const period = parts.find((p) => p.type === "dayPeriod")?.value || "";
  const main = parts
    .filter((p) => p.type !== "dayPeriod")
    .map((p) => p.value)
    .join("")
    .trim();
  return { main, period };
}

// "Jumada I 1448" — Hijri month and year only.
export function formatHijriMonth(ymd, locale, offsetDays = 0) {
  const base = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + offsetDays, 12));
  try {
    return dtf(`${locale}-u-ca-islamic-umalqura`, { timeZone: "UTC", month: "long", year: "numeric" }).format(base);
  } catch {
    return "";
  }
}
