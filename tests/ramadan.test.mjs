import { test } from "node:test";
import assert from "node:assert/strict";
import { taraweehFor, specialEvents, ramadanSpan, isRamadan } from "../js/engine.js";
import { reminderEvents, ramadanEvents, buildIcs, exportSig, DEFAULT_REMIND, DEFAULT_CAL } from "../js/ics.js";
import { placeToArray, arrayToPlace, placeToSeed, parseSeed, extractSeed, cleanEvents } from "../js/seed.js";
import { STRINGS } from "../js/i18n.js";
import { addDays, formatHHMM, ymdKey } from "../js/time.js";

const label = (k, vars) => {
  let s = STRINGS.en[k] ?? k;
  if (vars) for (const [key, v] of Object.entries(vars)) s = s.replaceAll(`{${key}}`, v);
  return s;
};
const masjid = {
  id: "m1",
  kind: "masjid",
  name: "Al-Noor Masjid",
  sub: "",
  lat: 40.7128,
  lng: -74.006,
  tz: "America/New_York",
  cc: "US",
  calc: { method: "NorthAmerica", madhab: "shafi", highLat: "auto", adj: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 } },
  iqama: { fajr: { mode: "offset", offset: 20, round: 0 }, dhuhr: null, asr: null, maghrib: { mode: "offset", offset: 5, round: 0 }, isha: { mode: "offset", offset: 15, round: 0 } },
  jumuah: ["13:00"],
  taraweeh: { mode: "offset", offset: 15 },
  events: [
    { date: "2027-03-10", time: "08:00", title: "Eid al-Fitr prayer" },
    { date: "2026-12-05", time: "19:00", title: "Family night" },
  ],
  note: "",
  u: 1790000000,
};
const calc = masjid.calc;
const prefs = () => structuredClone(DEFAULT_REMIND);
const span = ramadanSpan({ y: 2026, m: 11, d: 17 });

test("Ramadan 1448 is found, with its first and last day", () => {
  assert.equal(span.year, 1448);
  assert.ok(span.days === 29 || span.days === 30);
  assert.ok(isRamadan(span.from));
  assert.ok(!isRamadan(addDays(span.from, -1)));
  assert.ok(!isRamadan(addDays(span.from, span.days)));
  // From inside Ramadan, the same month (not next year's).
  assert.deepEqual(ramadanSpan(addDays(span.from, 10)).from, span.from);
});

test("Taraweeh: after the Isha iqama, or a fixed time never before it", () => {
  const day = addDays(span.from, 3);
  const after = taraweehFor(masjid, calc, day);
  const fixed = taraweehFor({ ...masjid, taraweeh: { mode: "fixed", time: "21:30" } }, calc, day);
  assert.equal(formatHHMM(fixed, masjid.tz), "21:30");
  const tooEarly = taraweehFor({ ...masjid, taraweeh: { mode: "fixed", time: "17:00" } }, calc, day);
  assert.ok(tooEarly >= after.getTime() - 15 * 60000, "clamped to the Isha iqama");
  assert.equal(taraweehFor({ ...masjid, taraweeh: null }, calc, day), null);
});

test("Taraweeh in the calendar: from the evening before the first fast, never on the eve of Eid", () => {
  const evs = reminderEvents(masjid, calc, prefs(), { from: addDays(span.from, -3), days: span.days + 6, label });
  const nights = evs.filter((e) => e.key === "taraweeh").map((e) => ymdKey(e.ymd));
  assert.equal(nights.length, span.days);
  assert.equal(nights[0], ymdKey(addDays(span.from, -1)));
  assert.equal(nights.at(-1), ymdKey(addDays(span.from, span.days - 2)));
  // Not outside Ramadan.
  assert.equal(reminderEvents(masjid, calc, prefs(), { from: { y: 2026, m: 11, d: 17 }, days: 30, label }).filter((e) => e.key === "taraweeh").length, 0);
});

test("special events land on their day, in range only, and can be switched off", () => {
  const evs = reminderEvents(masjid, calc, prefs(), { from: { y: 2026, m: 11, d: 17 }, days: 30, label });
  const special = evs.filter((e) => e.key === "events");
  assert.deepEqual(special.map((e) => e.title), ["Family night"]);
  assert.equal(formatHHMM(special[0].start, masjid.tz), "19:00");
  const p = prefs();
  p.pick.events.adhan = false;
  assert.equal(reminderEvents(masjid, calc, p, { from: { y: 2026, m: 11, d: 17 }, days: 30, label }).filter((e) => e.key === "events").length, 0);
  assert.equal(specialEvents(masjid, { y: 2027, m: 3, d: 1 }, { y: 2027, m: 3, d: 31 })[0].title, "Eid al-Fitr prayer");
});

test("Ramadan pack: Suhoor before Fajr, Iftar at Maghrib, Taraweeh including the first night", () => {
  const evs = ramadanEvents(masjid, calc, { from: span.from, days: span.days, suhoorLead: 45, label });
  const suhoor = evs.filter((e) => e.key === "suhoor");
  const iftar = evs.filter((e) => e.key === "iftar");
  const tw = evs.filter((e) => e.key === "taraweeh");
  assert.equal(suhoor.length, span.days);
  assert.equal(iftar.length, span.days);
  assert.equal(tw.length, span.days);
  assert.equal((suhoor[0].end - suhoor[0].start) / 60000, 45);
  assert.equal(ymdKey(tw[0].ymd), ymdKey(addDays(span.from, -1)));
  const { text } = buildIcs(masjid, calc, null, { events: evs, from: span.from, days: span.days, label, renew: false });
  assert.equal(text.split("BEGIN:VEVENT").length - 1, evs.length);
  assert.match(text, /SUMMARY:Suhoor\r\n/);
  // No Suhoor reminder when turned off.
  assert.equal(ramadanEvents(masjid, calc, { from: span.from, days: span.days, suhoorLead: -1, label }).filter((e) => e.key === "suhoor").length, 0);
});

test("seed: Taraweeh and events travel in the link; older links are unchanged", async () => {
  const plain = { ...masjid, taraweeh: null, events: [] };
  assert.equal(placeToArray(plain).length, 14); // byte-for-byte what older versions produced
  const a = placeToArray(masjid);
  assert.equal(a.length, 15);
  // An older app reads the first 14 fields and ignores the rest.
  const back = arrayToPlace(a);
  assert.deepEqual(back.taraweeh, { mode: "offset", offset: 15 });
  assert.deepEqual(back.events.map((e) => e.title), ["Family night", "Eid al-Fitr prayer"]); // sorted by date
  const { place } = await parseSeed(await placeToSeed(masjid));
  assert.deepEqual(place.events, back.events);
  assert.deepEqual(arrayToPlace(placeToArray({ ...masjid, taraweeh: { mode: "fixed", time: "21:30" } })).taraweeh, { mode: "fixed", time: "21:30" });
  // Junk is dropped, titles are capped, at most 8 events.
  const many = Array.from({ length: 12 }, (_, i) => ({ date: `2027-01-${String(i + 1).padStart(2, "0")}`, time: "10:00", title: "x".repeat(100) }));
  const cleaned = cleanEvents([...many, { date: "soon", time: "10:00", title: "bad" }, { date: "2027-01-01", time: "25:00", title: "bad" }, { date: "2027-01-01", time: "10:00", title: "  " }]);
  assert.equal(cleaned.length, 8);
  assert.equal(cleaned[0].title.length, 60);
});

test("reminders links (#/cal/…) and display links are recognised when pasted", () => {
  assert.equal(extractSeed("https://x.org/Masjid/#/cal/mABCDEFGHIJKL"), "mABCDEFGHIJKL");
  assert.equal(extractSeed("https://x.org/Masjid/#/tv/mABCDEFGHIJKL"), "mABCDEFGHIJKL");
});

test("new masjid times (Taraweeh, events) count as a change for the calendar", () => {
  const sig = (p) => exportSig(p, calc, prefs(), DEFAULT_CAL);
  assert.notEqual(sig(masjid), sig({ ...masjid, taraweeh: { mode: "offset", offset: 20 } }));
  assert.notEqual(sig(masjid), sig({ ...masjid, events: [] }));
});
