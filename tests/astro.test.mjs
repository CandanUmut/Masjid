import { test } from "node:test";
import assert from "node:assert/strict";
import { sunAltitude, moonPhase, skyColors } from "../js/astro.js";
import { computeDay } from "../js/engine.js";

const ist = { lat: 41.0082, lng: 28.9784, tz: "Europe/Istanbul", cc: "TR" };
const ymd = { y: 2026, m: 10, d: 26 };

test("sun altitude agrees with the prayer engine", () => {
  // Pure (unadjusted) MWL times: sunrise/maghrib ≈ -0.83°, fajr ≈ -18°, isha ≈ -17°.
  const day = computeDay(ist, { method: "MWL", adj: { dhuhr: -1 } }, ymd);
  assert.ok(Math.abs(sunAltitude(day.times.sunrise, ist.lat, ist.lng) + 0.83) < 0.6);
  assert.ok(Math.abs(sunAltitude(day.times.maghrib, ist.lat, ist.lng) + 0.83) < 0.6);
  assert.ok(Math.abs(sunAltitude(day.times.fajr, ist.lat, ist.lng) + 18) < 0.6);
  assert.ok(Math.abs(sunAltitude(day.times.isha, ist.lat, ist.lng) + 17) < 0.6);
  const noon = sunAltitude(day.times.dhuhr, ist.lat, ist.lng);
  assert.ok(noon > 35 && noon < 38, String(noon));
});

test("moon phase is near full on a known full moon", () => {
  // Full moon: 2026-10-26 04:12 UTC (per published tables). Mean phase is within ~1 day.
  const p = moonPhase(new Date("2026-10-26T04:12:00Z"));
  assert.ok(Math.abs(p - 0.5) < 0.04, String(p));
});

test("sky is dark at night and bright at noon", () => {
  assert.equal(skyColors(-30).night, true);
  assert.equal(skyColors(40).night, false);
});
