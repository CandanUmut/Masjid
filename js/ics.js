// Reminder choices and calendar export. Pure (no DOM), so it runs in tests and is shared by the
// calendar file and the in-app notifications: one set of choices drives both.
import { scheduleFor, computeDay } from "./engine.js";
import { addDays, hijriParts, partsInTz, ymdKey } from "./time.js";

// Everything a person can be reminded of, in the order of the day.
// `iqama: true` rows offer an iqama event when the place has iqama times.
export const REMIND_ROWS = [
  { key: "fajr", iqama: true },
  { key: "sunrise", iqama: false, extra: true },
  { key: "dhuhr", iqama: true },
  { key: "jumuah", iqama: false, jumuah: true },
  { key: "asr", iqama: true },
  { key: "maghrib", iqama: true },
  { key: "isha", iqama: true },
  { key: "lastThird", iqama: false, extra: true },
];
export const PRAYER_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

// Minutes before an event; -1 = no alert.
export const ALERT_CHOICES = [-1, 0, 5, 10, 15, 20, 30, 45, 60];
export const LENGTH_CHOICES = [10, 15, 20, 30, 45, 60];
export const RANGE_CHOICES = ["month", "30", "90", "365"];

export const DEFAULT_REMIND = {
  pick: {
    fajr: { adhan: true, iqama: true },
    sunrise: { adhan: false },
    dhuhr: { adhan: true, iqama: true },
    jumuah: { adhan: true },
    asr: { adhan: true, iqama: true },
    maghrib: { adhan: true, iqama: true },
    isha: { adhan: true, iqama: true },
    lastThird: { adhan: false },
  },
  adhanAlert: 0,
  adhanAlert2: -1,
  iqamaAlert: 10,
  iqamaAlert2: -1,
};

export const DEFAULT_CAL = {
  range: "30",
  busy: false, // show prayer time as busy (so meetings aren't booked over it)
  length: 15, // minutes blocked for a prayer
  renew: true, // a last event that reminds you to add the next batch
  exports: {}, // placeId -> "YYYY-MM-DD": the last day already added to the calendar
};

const pickAlert = (v, dflt) => (ALERT_CHOICES.includes(Number(v)) ? Number(v) : dflt);

// Tolerant of missing/corrupt data. `legacy` is the old { before, iqama } reminder setting.
export function normalizeRemind(raw, legacy = null) {
  const out = structuredClone(DEFAULT_REMIND);
  if (raw && typeof raw === "object") {
    for (const { key, iqama } of REMIND_ROWS) {
      const p = raw.pick?.[key];
      if (!p || typeof p !== "object") continue;
      out.pick[key].adhan = Boolean(p.adhan);
      if (iqama) out.pick[key].iqama = Boolean(p.iqama);
    }
    out.adhanAlert = pickAlert(raw.adhanAlert, out.adhanAlert);
    out.adhanAlert2 = pickAlert(raw.adhanAlert2, out.adhanAlert2);
    out.iqamaAlert = pickAlert(raw.iqamaAlert, out.iqamaAlert);
    out.iqamaAlert2 = pickAlert(raw.iqamaAlert2, out.iqamaAlert2);
  } else if (legacy && typeof legacy === "object") {
    // Before: always "at adhan time", plus optionally N minutes before, plus "5 min before iqama".
    const before = Number(legacy.before) > 0 ? Number(legacy.before) : 0;
    out.adhanAlert = before ? pickAlert(before, 0) : 0;
    out.adhanAlert2 = before ? 0 : -1;
    for (const k of PRAYER_KEYS) out.pick[k].iqama = Boolean(legacy.iqama);
    out.iqamaAlert = 5;
  }
  return out;
}

export function normalizeCal(raw) {
  const out = structuredClone(DEFAULT_CAL);
  if (!raw || typeof raw !== "object") return out;
  if (RANGE_CHOICES.includes(String(raw.range))) out.range = String(raw.range);
  out.busy = Boolean(raw.busy);
  if (LENGTH_CHOICES.includes(Number(raw.length))) out.length = Number(raw.length);
  out.renew = raw.renew !== false;
  if (raw.exports && typeof raw.exports === "object") {
    for (const [id, until] of Object.entries(raw.exports)) {
      if (typeof id === "string" && /^\d{4}-\d{2}-\d{2}$/.test(until)) out.exports[id] = until;
    }
  }
  return out;
}

export const placeHasIqama = (place) => Boolean(place?.iqama && PRAYER_KEYS.some((k) => place.iqama[k]));
export const placeHasJumuah = (place) => Boolean(place?.jumuah?.length);

// The alert offsets for one kind of event, earliest first, no duplicates.
export function alertsFor(prefs, kind) {
  const a = kind === "iqama" ? [prefs.iqamaAlert, prefs.iqamaAlert2] : [prefs.adhanAlert, prefs.adhanAlert2];
  return [...new Set(a.filter((m) => m >= 0))].sort((x, y) => y - x);
}

// Every event the choices produce for `days` days from `from` (a ymd in the place's time zone).
// `label(key, vars)` translates; `now` drops anything already past.
export function reminderEvents(place, calc, prefs, { from, days, label = (k) => k, hijriOffset = 0, now = null, busy = false, length = 15 } = {}) {
  const hasIqama = placeHasIqama(place);
  const hasJumuah = placeHasJumuah(place);
  const pick = prefs.pick;
  const out = [];
  const min = (n) => n * 60000;
  const nowMs = now ? now.getTime() : -Infinity;
  for (let i = 0; i < days; i++) {
    const ymd = addDays(from, i);
    const s = scheduleFor(place, calc, ymd);
    const day = ymdKey(ymd);
    const ramadan = hijriParts(ymd, hijriOffset)?.m === 9;
    const push = (ev) => {
      if (ev.start.getTime() >= nowMs) out.push({ ...ev, ymd });
    };
    for (const r of s.rows) {
      if (!r.adhan) continue;
      const base = r.key === "jumuah" ? "dhuhr" : r.key;
      const prayerName = label(r.key === "jumuah" ? "jumuah" : base);
      // In titles like "Fajr iqama" some languages name the prayer, not the time (Turkish: Sabah, not İmsak).
      const named = r.key === "jumuah" ? prayerName : base === "fajr" ? label("fajrPrayer") : prayerName;

      if (r.key === "sunrise") {
        if (pick.sunrise?.adhan) {
          push({ uid: `${day}-sunrise`, kind: "adhan", key: "sunrise", start: r.adhan, end: new Date(r.adhan.getTime() + min(10)), title: label("evSunrise"), busy: false });
        }
        continue;
      }

      // Jumu'ah: one event per khutbah time (with the masjid's two Jumu'ahs, both).
      if (r.key === "jumuah" && hasJumuah) {
        if (pick.jumuah?.adhan) {
          r.jumuah.forEach((at, j) => {
            push({
              uid: `${day}-jumuah${j ? j + 1 : ""}`,
              kind: "iqama",
              key: "jumuah",
              start: at,
              end: new Date(at.getTime() + min(Math.max(45, length))),
              title: label("evKhutbah"),
              busy,
            });
          });
        }
        // The Dhuhr adhan on a Friday is still the Dhuhr adhan (titled Jumu'ah).
      }

      const wantIqama = hasIqama && r.key !== "jumuah" && pick[base]?.iqama && r.iqama?.at;
      if (pick[base]?.adhan) {
        let title = hasIqama || (r.key === "jumuah" && hasJumuah) ? label("evAdhan", { p: named }) : prayerName;
        if (ramadan && base === "fajr") title = `${title} · ${label("evSuhoorEnds")}`;
        if (ramadan && base === "maghrib") title = `${title} · ${label("iftar")}`;
        // An adhan event runs until the iqama (when that's added too), else it blocks the prayer.
        const endMs = wantIqama && r.iqama.at > r.adhan ? Math.min(r.iqama.at.getTime(), r.adhan.getTime() + min(length)) : r.adhan.getTime() + min(wantIqama ? 5 : length);
        push({
          uid: `${day}-${base}`,
          kind: "adhan",
          key: base,
          start: r.adhan,
          end: new Date(Math.max(endMs, r.adhan.getTime() + min(5))),
          title,
          iqamaAt: r.iqama?.at || null,
          // Blocking time is about praying: with an iqama event the congregation is the busy part.
          busy: busy && !wantIqama && !(r.key === "jumuah" && hasJumuah && pick.jumuah?.adhan),
        });
      }
      if (wantIqama) {
        push({
          uid: `${day}-${base}-iqama`,
          kind: "iqama",
          key: base,
          start: r.iqama.at,
          end: new Date(r.iqama.at.getTime() + min(length)),
          title: label("evIqama", { p: named }),
          adhanAt: r.adhan,
          busy,
        });
      }
    }
    // The last third of the night that *follows* this day's Maghrib (so it falls early tomorrow).
    if (pick.lastThird?.adhan) {
      const lt = computeDay(place, calc, ymd).times.lastThird;
      if (lt) push({ uid: `${day}-lastthird`, kind: "adhan", key: "lastThird", start: lt, end: new Date(lt.getTime() + min(10)), title: label("evLastThird"), busy: false });
    }
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

// --- iCalendar (RFC 5545) ------------------------------------------------------------------
export function icsDate(d) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
export function icsText(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
const ymdCompact = (ymd) => `${ymd.y}${String(ymd.m).padStart(2, "0")}${String(ymd.d).padStart(2, "0")}`;

function hhmm(d, tz) {
  const p = partsInTz(d, tz);
  return `${String(p.hh).padStart(2, "0")}:${String(p.mm).padStart(2, "0")}`;
}

function alarm(trigger, text) {
  return ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(text)}`, `TRIGGER:${trigger}`, "END:VALARM"];
}
const before = (m) => (m ? `-PT${m}M` : "PT0M");

// Build the calendar file.
// opts: { from, days, label, hijriOffset, now, busy, length, renew, url, fmt, fmtDate, calName, stamp }
export function buildIcs(place, calc, prefs, opts) {
  const { label = (k) => k, url = "", fmt = (d) => hhmm(d, place.tz), fmtDate = ymdKey, renew = true, stamp = new Date() } = opts;
  const events = reminderEvents(place, calc, prefs, opts);
  const id = place.id || "here";
  const dtstamp = icsDate(stamp);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ufuq//Prayer Times//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(opts.calName || `${label("calName")} · ${place.name}`)}`,
    `X-WR-TIMEZONE:${place.tz}`,
  ];
  const where = [place.name, place.sub].filter(Boolean).join(", ");
  // A masjid is a real place: give calendars its coordinates (maps, travel time). Never your own spot.
  const geo = place.kind === "masjid" && Number.isFinite(place.lat) ? place : null;
  for (const ev of events) {
    const details = [];
    if (ev.kind === "adhan" && ev.iqamaAt) details.push(`${label("adhan")} ${fmt(ev.start)} · ${label("iqama")} ${fmt(ev.iqamaAt)}`);
    else if (ev.kind === "iqama" && ev.adhanAt) details.push(`${label("adhan")} ${fmt(ev.adhanAt)} · ${label("iqama")} ${fmt(ev.start)}`);
    details.push(place.name);
    if (url) details.push(url);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${id}-${ev.uid}@ufuq`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${icsDate(ev.start)}`,
      `DTEND:${icsDate(ev.end)}`,
      `SUMMARY:${icsText(ev.title)}`,
      `DESCRIPTION:${icsText(details.join("\n"))}`,
      where ? `LOCATION:${icsText(where)}` : null,
      geo ? `GEO:${geo.lat.toFixed(6)};${geo.lng.toFixed(6)}` : null,
      url ? `URL:${url}` : null,
      `TRANSP:${ev.busy ? "OPAQUE" : "TRANSPARENT"}`,
      "CATEGORIES:" + icsText(label("calName"))
    );
    for (const m of alertsFor(prefs, ev.kind)) lines.push(...alarm(before(m), ev.title));
    lines.push("END:VEVENT");
  }
  // The calendar reminds you to add the next batch, two days before it runs out.
  if (renew && events.length && opts.days > 3) {
    const last = addDays(opts.from, opts.days - 1);
    const day = addDays(last, -2);
    const until = fmtDate(last);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${id}-renew-${ymdKey(last)}@ufuq`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${ymdCompact(day)}`,
      `DTEND;VALUE=DATE:${ymdCompact(addDays(day, 1))}`,
      `SUMMARY:${icsText(label("renewTitle", { d: until }))}`,
      `DESCRIPTION:${icsText([label("renewBody", { p: place.name }), url].filter(Boolean).join("\n"))}`,
      url ? `URL:${url}` : null,
      "TRANSP:TRANSPARENT",
      ...alarm("PT9H", label("renewTitle", { d: until })),
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  // RFC 5545 wants CRLF and lines of at most 75 octets; fold long lines.
  return { text: lines.filter(Boolean).map(fold).join("\r\n") + "\r\n", count: events.length };
}

// UTF-8 length of one code point, without allocating (a year's file has ~10k lines to fold).
const u8len = (cp) => (cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4);
export function fold(line) {
  if (line.length <= 75 && /^[\x00-\x7f]*$/.test(line)) return line;
  const out = [];
  let cur = "";
  let len = 0;
  for (const ch of line) {
    const l = u8len(ch.codePointAt(0));
    if (len + l > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      len = 0;
    }
    cur += ch;
    len += l;
  }
  out.push(cur);
  return out.join("\r\n ");
}

// The days a range choice covers. `ym` is a month being viewed (Month tab); else this month.
export function rangeDays(range, today, ym = null) {
  if (range === "month") {
    const m = ym || { y: today.y, m: today.m };
    const n = new Date(Date.UTC(m.y, m.m, 0)).getUTCDate();
    const isThis = m.y === today.y && m.m === today.m;
    const from = isThis ? today : { y: m.y, m: m.m, d: 1 };
    return { from, days: isThis ? n - today.d + 1 : n };
  }
  return { from: today, days: Number(range) || 30 };
}
