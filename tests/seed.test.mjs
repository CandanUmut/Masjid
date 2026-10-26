import { test } from "node:test";
import assert from "node:assert/strict";
import { placeToSeed, parseSeed, extractSeed, packIqama, unpackIqama } from "../js/seed.js";

const masjid = {
  id: "abc123xyz0",
  kind: "masjid",
  name: "Süleymaniye Camii — مسجد",
  sub: "Fatih, İstanbul",
  lat: 41.016111,
  lng: 28.963889,
  tz: "Europe/Istanbul",
  cc: "TR",
  calc: { method: "Turkey", madhab: "shafi", highLat: "auto", adj: { fajr: 0, sunrise: 0, dhuhr: 2, asr: 0, maghrib: 1, isha: 0 } },
  iqama: {
    fajr: { mode: "offset", offset: 30, round: 0 },
    dhuhr: { mode: "fixed", time: "13:15", min: 10 },
    asr: { mode: "offset", offset: 10, round: 5 },
    maghrib: null,
    isha: { mode: "offset", offset: 10, round: 0 },
  },
  jumuah: ["13:00", "14:15"],
  note: "Teravih 21:30 🌙",
  u: 1793000000,
};

test("masjid survives a seed round trip", async () => {
  const seed = await placeToSeed(masjid);
  assert.match(seed, /^[mM][A-Za-z0-9_-]+$/);
  assert.ok(seed.length < 400, `seed too long: ${seed.length}`);
  const { kind, place } = await parseSeed(seed);
  assert.equal(kind, "place");
  assert.equal(place.name, masjid.name);
  assert.equal(place.note, masjid.note);
  assert.equal(place.calc.method, "Turkey");
  assert.equal(place.calc.adj.dhuhr, 2);
  assert.deepEqual(place.jumuah, masjid.jumuah);
  assert.deepEqual(place.iqama.dhuhr, { mode: "fixed", time: "13:15", min: 10 });
  assert.deepEqual(place.iqama.asr, { mode: "offset", offset: 10, round: 5 });
  assert.equal(place.iqama.maghrib, null);
  assert.equal(place.u, masjid.u);
});

test("seeds are found inside links", async () => {
  const seed = await placeToSeed(masjid);
  assert.equal(extractSeed(`https://example.github.io/Masjid/#/m/${seed}`), seed);
  assert.equal(extractSeed(seed), seed);
  assert.equal(extractSeed("hello world"), null);
});

test("garbage and tampered seeds are rejected", async () => {
  await assert.rejects(parseSeed("not a seed"));
  await assert.rejects(parseSeed("mAAAAAAAAAAAAAAAAAAAA"));
  const bad = "M" + Buffer.from(JSON.stringify([1, "m", "x", "n", "", 999, 0, "Europe/Istanbul"])).toString("base64url");
  await assert.rejects(parseSeed(bad));
  const badTz = "M" + Buffer.from(JSON.stringify([1, "m", "x", "n", "", 1, 1, "Mars/Base"])).toString("base64url");
  await assert.rejects(parseSeed(badTz));
});

test("iqama packing ignores invalid rules", () => {
  assert.equal(packIqama(null), "");
  const u = unpackIqama("+10|@25:00|+5r7|junk|@19:30");
  assert.deepEqual(u.fajr, { mode: "offset", offset: 10, round: 0 });
  assert.equal(u.dhuhr, null);
  assert.equal(u.asr, null);
  assert.deepEqual(u.isha, { mode: "fixed", time: "19:30", min: 0 });
});

test("seasonal iqama changes survive a seed round trip", async () => {
  const m = {
    ...masjid,
    iqama: {
      ...masjid.iqama,
      isha: { mode: "fixed", time: "19:30", min: 5, changes: [{ from: "10-25", mode: "fixed", time: "19:30", min: 5 }, { from: "03-29", mode: "fixed", time: "21:00", min: 5 }] },
    },
  };
  const { place } = await parseSeed(await placeToSeed(m));
  assert.deepEqual(place.iqama.isha.changes, [
    { from: "03-29", mode: "fixed", time: "21:00", min: 5 },
    { from: "10-25", mode: "fixed", time: "19:30", min: 5 },
  ]);
  // Old seeds (no changes) still parse exactly as before.
  assert.equal(unpackIqama("+10|+5").fajr.changes, undefined);
  // Junk dates are dropped, not trusted.
  assert.equal(unpackIqama("@19:30~1399@20:00").fajr.changes, undefined);
});

test("'before next prayer' rules and long offsets round-trip", () => {
  const u = unpackIqama(packIqama({ fajr: { mode: "before", offset: 45, round: 0 }, dhuhr: { mode: "before", offset: 40, round: 5 }, asr: { mode: "offset", offset: 120, round: 0 } }));
  assert.deepEqual(u.fajr, { mode: "before", offset: 45, round: 0 });
  assert.deepEqual(u.dhuhr, { mode: "before", offset: 40, round: 5 });
  assert.deepEqual(u.asr, { mode: "offset", offset: 120, round: 0 });
});
