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
  // Fixed, but at least 15 min after adhan: 13:00 is too early → 13:08 (flagged).
  const guarded = iqamaFor("dhuhr", adhan, { mode: "fixed", time: "13:00", min: 15 }, ymd, tz);
  assert.equal(formatHHMM(guarded.at, tz), "13:08");
  assert.equal(guarded.clamped, true);
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

test("seasonal iqama: the latest change on or before the date applies, every year", async () => {
  const { activeRule } = await import("../js/engine.js");
  const rule = { mode: "fixed", time: "19:30", changes: [{ from: "03-29", mode: "fixed", time: "21:00" }, { from: "10-25", mode: "fixed", time: "19:30" }] };
  assert.equal(activeRule(rule, { y: 2027, m: 1, d: 10 }).time, "19:30");
  assert.equal(activeRule(rule, { y: 2027, m: 3, d: 29 }).time, "21:00");
  assert.equal(activeRule(rule, { y: 2027, m: 7, d: 1 }).time, "21:00");
  assert.equal(activeRule(rule, { y: 2027, m: 10, d: 25 }).time, "19:30");
  const tz = "Europe/Istanbul";
  const ymdSummer = { y: 2027, m: 6, d: 15 };
  const adhan = zonedToInstant(ymdSummer, 20, 30, tz);
  assert.equal(formatHHMM(iqamaFor("isha", adhan, rule, ymdSummer, tz).at, tz), "21:00");
});

test("iqama 'before the next prayer': Dhuhr 40 min before Asr, Fajr 45 min before sunrise", () => {
  const p = { ...REFERENCE[0], iqama: { fajr: { mode: "before", offset: 45 }, dhuhr: { mode: "before", offset: 40, round: 5 }, asr: { mode: "offset", offset: 120 } } };
  const s = scheduleFor(p, {}, ymd);
  const row = (k) => s.rows.find((r) => r.key === k);
  assert.equal(row("fajr").iqama.at.getTime(), s.times.sunrise.getTime() - 45 * 60000);
  // Asr 15:46 − 40 = 15:06 → rounded down to 15:05
  assert.equal(formatHHMM(row("dhuhr").iqama.at, p.tz), "15:05");
  // two hours after Asr adhan is allowed (no 90-minute cap)
  assert.equal(row("asr").iqama.at.getTime(), row("asr").adhan.getTime() + 120 * 60000);
  // asking for more than the whole window clamps to the adhan, flagged
  const tight = scheduleFor({ ...p, iqama: { maghrib: { mode: "before", offset: 200 } } }, {}, ymd).rows.find((r) => r.key === "maghrib");
  assert.equal(tight.iqama.clamped, true);
  assert.equal(tight.iqama.at.getTime(), tight.adhan.getTime());
});

test("seasonal iqama: a 'base' change goes back to the first rule", async () => {
  const { activeRule } = await import("../js/engine.js");
  const rule = { mode: "fixed", time: "19:45", min: 5, changes: [{ from: "04-01", mode: "fixed", time: "21:30", min: 5 }, { from: "11-01", mode: "base" }] };
  assert.equal(activeRule(rule, { y: 2027, m: 2, d: 1 }).time, "19:45");
  assert.equal(activeRule(rule, { y: 2027, m: 7, d: 1 }).time, "21:30");
  assert.equal(activeRule(rule, { y: 2027, m: 11, d: 15 }).time, "19:45");
  // Editing the winter rule changes both winter periods at once.
  rule.time = "19:15";
  assert.equal(activeRule(rule, { y: 2027, m: 12, d: 1 }).time, "19:15");
});

test("two Jumu'ahs: after the first khutbah, the second one is what's pending", async () => {
  const { statusAt } = await import("../js/engine.js");
  const place = { lat: 41.0082, lng: 28.9784, tz: "Europe/Istanbul", cc: "TR", jumuah: ["13:00", "14:15"] };
  const ymd = { y: 2026, m: 10, d: 30 }; // a Friday
  const before = statusAt(place, null, ymd, new Date("2026-10-30T09:56:00Z")); // 12:56 local
  assert.equal(before.current.key, "jumuah");
  assert.equal(before.pendingIqama.toISOString(), "2026-10-30T10:00:00.000Z");
  const between = statusAt(place, null, ymd, new Date("2026-10-30T10:30:00Z")); // 13:30 local
  assert.equal(between.pendingIqama.toISOString(), "2026-10-30T11:15:00.000Z");
  const after = statusAt(place, null, ymd, new Date("2026-10-30T11:30:00Z"));
  assert.equal(after.pendingIqama, null);
});
