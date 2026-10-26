import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDay, iqamaFor, resolveCalc, scheduleFor, statusAt, qiblaBearing } from "../js/engine.js";
import { formatHHMM, zonedToInstant, addDays, tzOffsetMinutes } from "../js/time.js";

const ymd = { y: 2026, m: 10, d: 26 };
const mins = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// Reference values from the independent Aladhan API (api.aladhan.com) for 26 Oct 2026.
const REFERENCE = [
  { name: "Istanbul", lat: 41.0082, lng: 28.9784, tz: "Europe/Istanbul", cc: "TR", ref: ["05:55", "07:21", "12:53", "15:48", "18:15", "19:35"] },
  { name: "New York", lat: 40.7128, lng: -74.006, tz: "America/New_York", cc: "US", ref: ["06:03", "07:19", "12:40", "15:36", "18:00", "19:16"] },
  { name: "Mecca", lat: 21.4225, lng: 39.8262, tz: "Asia/Riyadh", cc: "SA", ref: ["05:04", "06:21", "12:05", "15:23", "17:48", "19:18"] },
  { name: "Auckland", lat: -36.8485, lng: 174.7633, tz: "Pacific/Auckland", cc: "NZ", ref: ["04:49", "06:23", "13:05", "16:48", "19:47", "21:16"] },
  { name: "Honolulu", lat: 21.3069, lng: -157.8583, tz: "Pacific/Honolulu", cc: "US", ref: ["05:30", "06:32", "12:15", "15:33", "17:59", "19:01"] },
];

for (const c of REFERENCE) {
  test(`${c.name}: times within 2 minutes of an independent reference`, () => {
    const day = computeDay(c, {}, ymd);
    const keys = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
    keys.forEach((k, i) => {
      const got = formatHHMM(day.times[k], c.tz);
      assert.ok(Math.abs(mins(got) - mins(c.ref[i])) <= 2, `${k}: got ${got}, expected ~${c.ref[i]}`);
    });
  });
}

test("auto method & madhab follow the country", () => {
  assert.equal(resolveCalc({ cc: "TR", lat: 41 }, {}).method, "Turkey");
  assert.equal(resolveCalc({ cc: "TR", lat: 41 }, {}).madhab, "shafi");
  assert.equal(resolveCalc({ cc: "PK", lat: 31 }, {}).madhab, "hanafi");
  assert.equal(resolveCalc({ tz: "America/Chicago", lat: 41 }, {}).method, "ISNA");
  assert.equal(resolveCalc({ cc: "XX", lat: 10 }, {}).method, "MWL");
  assert.equal(resolveCalc({ cc: "NO", lat: 60 }, {}).highLat, "seventh");
  assert.equal(resolveCalc({ cc: "TR", lat: 41 }, { method: "ISNA", madhab: "hanafi" }).method, "ISNA");
});

test("polar summer still yields every time (Tromsø, June 21)", () => {
  const day = computeDay({ lat: 69.6492, lng: 18.9553, tz: "Europe/Oslo", cc: "NO" }, {}, { y: 2026, m: 6, d: 21 });
  for (const k of ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"]) assert.ok(day.times[k] instanceof Date, `${k} missing`);
});

test("minute adjustments are applied", () => {
  const p = REFERENCE[0];
  const a = computeDay(p, {}, ymd).times.maghrib;
  const b = computeDay(p, { adj: { maghrib: 3 } }, ymd).times.maghrib;
  assert.equal(b - a, 3 * 60000);
});

test("zonedToInstant handles DST transitions", () => {
  // New York leaves DST on 1 Nov 2026 at 02:00.
  const before = zonedToInstant({ y: 2026, m: 10, d: 31 }, 13, 30, "America/New_York");
  const after = zonedToInstant({ y: 2026, m: 11, d: 1 }, 13, 30, "America/New_York");
  assert.equal(before.toISOString(), "2026-10-31T17:30:00.000Z");
  assert.equal(after.toISOString(), "2026-11-01T18:30:00.000Z");
  assert.equal(tzOffsetMinutes(Date.UTC(2026, 6, 1), "Asia/Kolkata"), 330);
});

test("iqama: offset, rounding and fixed rules", () => {
  const tz = "Europe/Istanbul";
  const adhan = zonedToInstant(ymd, 12, 53, tz);
  assert.equal(formatHHMM(iqamaFor("dhuhr", adhan, { mode: "offset", offset: 10 }, ymd, tz).at, tz), "13:03");
  assert.equal(formatHHMM(iqamaFor("dhuhr", adhan, { mode: "offset", offset: 10, round: 15 }, ymd, tz).at, tz), "13:15");
  assert.equal(formatHHMM(iqamaFor("dhuhr", adhan, { mode: "fixed", time: "13:30" }, ymd, tz).at, tz), "13:30");
  const early = iqamaFor("dhuhr", adhan, { mode: "fixed", time: "12:30" }, ymd, tz);
  assert.equal(early.clamped, true);
  assert.equal(formatHHMM(early.at, tz), "12:53");
  assert.equal(iqamaFor("dhuhr", adhan, null, ymd, tz), null);
});

test("Jumu'ah replaces Dhuhr on Fridays", () => {
  const place = { ...REFERENCE[0], jumuah: ["13:15", "14:00"], iqama: { dhuhr: { mode: "offset", offset: 10 } } };
  const friday = { y: 2026, m: 10, d: 30 };
  const s = scheduleFor(place, {}, friday);
  const row = s.rows.find((r) => r.key === "jumuah");
  assert.ok(row);
  assert.equal(formatHHMM(row.iqama.at, place.tz), "13:15");
  assert.equal(row.jumuah.length, 2);
  const monday = scheduleFor(place, {}, ymd);
  assert.ok(monday.rows.some((r) => r.key === "dhuhr"));
});

test("status: after Isha the next prayer is tomorrow's Fajr", () => {
  const p = REFERENCE[0];
  const s = statusAt(p, {}, ymd, new Date("2026-10-26T20:00:00Z")); // 23:00 Istanbul
  assert.equal(s.current.key, "isha");
  assert.equal(s.next.key, "fajr");
  assert.equal(s.next.day, 1);
  const early = statusAt(p, {}, ymd, new Date("2026-10-26T01:00:00Z")); // 04:00 Istanbul
  assert.equal(early.current.key, "isha");
  assert.equal(early.current.day, -1);
  assert.equal(early.next.key, "fajr");
  assert.equal(early.next.day, 0);
});

test("status reports a pending iqama", () => {
  const p = { ...REFERENCE[0], iqama: { asr: { mode: "offset", offset: 15 } } };
  const asr = computeDay(p, {}, ymd).times.asr;
  const s = statusAt(p, {}, ymd, new Date(asr.getTime() + 5 * 60000));
  assert.equal(s.current.key, "asr");
  assert.equal(s.pendingIqama.getTime(), asr.getTime() + 15 * 60000);
});

test("qibla bearing from New York is ~58°", () => {
  const b = qiblaBearing(40.7128, -74.006);
  assert.ok(Math.abs(b - 58.5) < 1, String(b));
});

test("addDays crosses month and year boundaries", () => {
  assert.deepEqual(addDays({ y: 2026, m: 12, d: 31 }, 1), { y: 2027, m: 1, d: 1 });
  assert.deepEqual(addDays({ y: 2028, m: 3, d: 1 }, -1), { y: 2028, m: 2, d: 29 });
});
