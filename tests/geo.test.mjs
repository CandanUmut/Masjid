import { test } from "node:test";
import assert from "node:assert/strict";
import { guessTimeZone } from "../js/geo.js";

test("offline time zone: exact for single-zone countries", async () => {
  assert.deepEqual(await guessTimeZone(41.0, 29.0, "TR"), { tz: "Europe/Istanbul", approximate: false });
  assert.deepEqual(await guessTimeZone(51.5, -0.12, "GB"), { tz: "Europe/London", approximate: false });
});

test("offline time zone: nearest zone city in multi-zone countries, flagged", async () => {
  assert.deepEqual(await guessTimeZone(40.75, -73.99, "US"), { tz: "America/New_York", approximate: true });
  assert.deepEqual(await guessTimeZone(41.88, -87.63, "US"), { tz: "America/Chicago", approximate: true });
  assert.deepEqual(await guessTimeZone(34.05, -118.24, "US"), { tz: "America/Los_Angeles", approximate: true });
});

test("offline time zone: never a clock far from the sun", async () => {
  // Open Pacific: Kiritimati (UTC+14) is nearby, but this spot is ten hours behind UTC.
  assert.deepEqual(await guessTimeZone(0, -150, null), { tz: "Etc/GMT+10", approximate: true });
});
