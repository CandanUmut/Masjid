import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIcs, reminderEvents, normalizeRemind, normalizeCal, rangeDays, alertsFor, fold, DEFAULT_REMIND, DEFAULT_CAL, placeKey, exportSig, planExport, recordExport } from "../js/ics.js";
import { STRINGS, tn } from "../js/i18n.js";
import { hijriParts, formatHHMM, weekdayOf } from "../js/time.js";

const labelIn = (lang) => (k, vars) => {
  let s = STRINGS[lang][k] ?? STRINGS.en[k] ?? k;
  if (vars) for (const [key, v] of Object.entries(vars)) s = s.replaceAll(`{${key}}`, v);
  return s;
};
const label = labelIn("en");

const masjid = {
  id: "m1",
  kind: "masjid",
  name: "Al-Noor Masjid",
  sub: "Main St, Springfield",
  lat: 40.7128,
  lng: -74.006,
  tz: "America/New_York",
  cc: "US",
  calc: { method: "NorthAmerica", madhab: "shafi", highLat: "auto", adj: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 } },
  iqama: {
    fajr: { mode: "offset", offset: 20, round: 0 },
    dhuhr: { mode: "fixed", time: "13:30", min: 10 },
    asr: { mode: "offset", offset: 10, round: 5 },
    maghrib: { mode: "offset", offset: 5, round: 0 },
    isha: { mode: "offset", offset: 15, round: 0 },
  },
  jumuah: ["13:00", "14:15"],
};
const home = { id: "gps", kind: "gps", name: "Home", lat: 40.7128, lng: -74.006, tz: "America/New_York", cc: "US" };
const calc = masjid.calc;
const tue = { y: 2026, m: 11, d: 17 }; // a Tuesday
const fri = { y: 2026, m: 11, d: 20 };
const prefs = () => structuredClone(DEFAULT_REMIND);

const unfold = (text) => text.replace(/\r\n /g, "");
const events = (text) => unfold(text).split("BEGIN:VEVENT").slice(1);

test("days are what the tests think they are", () => {
  assert.equal(weekdayOf(tue), 2);
  assert.equal(weekdayOf(fri), 5);
});

test("default: adhan and iqama for the five prayers, as separate events", () => {
  const evs = reminderEvents(masjid, calc, prefs(), { from: tue, days: 1, label });
  assert.equal(evs.length, 10);
  assert.deepEqual(
    evs.map((e) => e.title),
    ["Fajr adhan", "Fajr iqama", "Dhuhr adhan", "Dhuhr iqama", "Asr adhan", "Asr iqama", "Maghrib adhan", "Maghrib iqama", "Isha adhan", "Isha iqama"]
  );
  const dhuhrIq = evs.find((e) => e.uid.endsWith("dhuhr-iqama"));
  assert.equal(formatHHMM(dhuhrIq.start, masjid.tz), "13:30");
  // The adhan event ends where the iqama begins (no overlapping blocks).
  const dhuhr = evs.find((e) => e.uid.endsWith("-dhuhr"));
  assert.ok(dhuhr.end <= dhuhrIq.start);
});

test("iqama only: just the congregation times", () => {
  const p = prefs();
  for (const k of ["fajr", "dhuhr", "asr", "maghrib", "isha"]) p.pick[k].adhan = false;
  const evs = reminderEvents(masjid, calc, p, { from: tue, days: 1, label });
  assert.equal(evs.length, 5);
  assert.ok(evs.every((e) => e.kind === "iqama" && e.title.endsWith("iqama")));
  const { text } = buildIcs(masjid, calc, p, { from: tue, days: 1, label, renew: false });
  for (const ev of events(text)) assert.match(ev, /TRIGGER:-PT10M/); // default: 10 min before iqama
});

test("pick single prayers: only Fajr adhan and Isha iqama", () => {
  const p = prefs();
  for (const k of ["fajr", "dhuhr", "asr", "maghrib", "isha"]) p.pick[k] = { adhan: false, iqama: false };
  p.pick.fajr.adhan = true;
  p.pick.isha.iqama = true;
  const evs = reminderEvents(masjid, calc, p, { from: tue, days: 3, label });
  assert.deepEqual([...new Set(evs.map((e) => e.title))], ["Fajr adhan", "Isha iqama"]);
  assert.equal(evs.length, 6);
});

test("your own location: plain prayer names, no iqama even if picked", () => {
  const evs = reminderEvents(home, calc, prefs(), { from: tue, days: 1, label });
  assert.deepEqual(evs.map((e) => e.title), ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]);
});

test("Friday: one event per khutbah, and no Dhuhr iqama", () => {
  const evs = reminderEvents(masjid, calc, prefs(), { from: fri, days: 1, label });
  const khutbah = evs.filter((e) => e.key === "jumuah");
  assert.equal(khutbah.length, 2);
  assert.deepEqual(khutbah.map((e) => formatHHMM(e.start, masjid.tz)), ["13:00", "14:15"]);
  assert.ok(!evs.some((e) => e.uid.endsWith("dhuhr-iqama")));
  assert.ok(evs.some((e) => e.title === "Jumu'ah adhan"));
  // Turning Jumu'ah off removes the khutbah events only.
  const p = prefs();
  p.pick.jumuah.adhan = false;
  assert.equal(reminderEvents(masjid, calc, p, { from: fri, days: 1, label }).filter((e) => e.key === "jumuah").length, 0);
});

test("alerts: two per event, earliest first; or none at all", () => {
  const p = prefs();
  p.adhanAlert = 15;
  p.adhanAlert2 = 0;
  p.iqamaAlert = -1;
  assert.deepEqual(alertsFor(p, "adhan"), [15, 0]);
  assert.deepEqual(alertsFor(p, "iqama"), []);
  const { text } = buildIcs(masjid, calc, p, { from: tue, days: 1, label, renew: false });
  const evs = events(text);
  const adhan = evs.find((e) => /SUMMARY:Asr adhan/.test(e));
  const iqama = evs.find((e) => /SUMMARY:Asr iqama/.test(e));
  assert.deepEqual([...adhan.matchAll(/TRIGGER:(\S+)/g)].map((m) => m[1]), ["-PT15M", "PT0M"]);
  assert.ok(!/VALARM/.test(iqama));
  // Same alert twice counts once.
  p.adhanAlert2 = 15;
  assert.deepEqual(alertsFor(p, "adhan"), [15]);
});

test("the file is valid iCalendar: CRLF, folded lines, balanced blocks, stable unique UIDs", () => {
  const opts = { from: tue, days: 30, label, url: "https://example.org/#/m/abc", stamp: new Date(Date.UTC(2026, 10, 17)) };
  const a = buildIcs(masjid, calc, prefs(), opts);
  const b = buildIcs(masjid, calc, prefs(), opts);
  assert.equal(a.text, b.text); // the same choices make the same file
  assert.ok(a.text.endsWith("\r\n"));
  assert.ok(!/[^\r]\n/.test(a.text), "bare LF");
  for (const line of a.text.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, `long line: ${line}`);
  const body = unfold(a.text);
  for (const k of ["VCALENDAR", "VEVENT", "VALARM"]) {
    assert.equal(body.split(`BEGIN:${k}`).length, body.split(`END:${k}`).length, k);
  }
  const uids = [...body.matchAll(/^UID:(.+)$/gm)].map((m) => m[1]);
  assert.equal(new Set(uids).size, uids.length);
  assert.equal(a.count + 1, uids.length); // + the renewal reminder
  assert.match(body, /X-WR-CALNAME:Prayer times · Al-Noor Masjid/);
  assert.match(body, /LOCATION:Al-Noor Masjid\\, Main St\\, Springfield/);
  assert.match(body, /GEO:40\.712800;-74\.006000/);
});

test("never puts your own position in the file", () => {
  const { text } = buildIcs(home, calc, prefs(), { from: tue, days: 2, label });
  assert.ok(!/GEO:/.test(text));
});

test("busy: the congregation blocks time; adhan stays free when its iqama is added", () => {
  const { text } = buildIcs(masjid, calc, prefs(), { from: tue, days: 1, label, busy: true, length: 20, renew: false });
  const evs = events(text);
  const iq = evs.find((e) => /SUMMARY:Asr iqama/.test(e));
  const ad = evs.find((e) => /SUMMARY:Asr adhan/.test(e));
  assert.match(iq, /TRANSP:OPAQUE/);
  assert.match(ad, /TRANSP:TRANSPARENT/);
  // Adhan only: then the adhan blocks the time.
  const p = prefs();
  for (const k of ["fajr", "dhuhr", "asr", "maghrib", "isha"]) p.pick[k].iqama = false;
  const only = events(buildIcs(masjid, calc, p, { from: tue, days: 1, label, busy: true, length: 20, renew: false }).text);
  assert.ok(only.every((e) => /TRANSP:OPAQUE/.test(e)));
});

test("past times today are left out", () => {
  const all = reminderEvents(masjid, calc, prefs(), { from: tue, days: 1, label });
  const now = new Date(all[5].start.getTime() + 1000);
  const later = reminderEvents(masjid, calc, prefs(), { from: tue, days: 1, label, now });
  assert.equal(later.length, all.length - 6);
});

test("a last event reminds you to add more", () => {
  const { text } = buildIcs(masjid, calc, prefs(), { from: tue, days: 30, label, fmtDate: (d) => `${d.d}/${d.m}` });
  const renew = events(text).find((e) => /UID:m1-renew/.test(e));
  assert.ok(renew);
  assert.match(renew, /DTSTART;VALUE=DATE:20261214/); // two days before the last day (16 Dec)
  assert.match(renew, /SUMMARY:Prayer times in your calendar end 16\/12/);
  assert.match(renew, /TRIGGER:PT9H/);
  assert.ok(!/renew/.test(buildIcs(masjid, calc, prefs(), { from: tue, days: 30, label, renew: false }).text));
});

test("extras: sunrise and the last third of the night", () => {
  const p = prefs();
  p.pick.sunrise.adhan = true;
  p.pick.lastThird.adhan = true;
  const evs = reminderEvents(home, calc, p, { from: tue, days: 1, label });
  const sunrise = evs.find((e) => e.key === "sunrise");
  const third = evs.find((e) => e.key === "lastThird");
  const isha = evs.find((e) => e.key === "isha");
  assert.equal(sunrise.title, "Sunrise · Fajr time ends");
  assert.ok(third.start > isha.start, "the last third follows that evening's Isha");
  assert.equal(evs.at(-1), third);
});

test("Ramadan: Suhoor and Iftar in the titles", () => {
  const day = { y: 2027, m: 2, d: 20 };
  assert.equal(hijriParts(day)?.m, 9);
  const titles = reminderEvents(masjid, calc, prefs(), { from: day, days: 1, label }).map((e) => e.title);
  assert.ok(titles.includes("Fajr adhan · Suhoor ends"));
  assert.ok(titles.includes("Maghrib adhan · Iftar"));
});

test("Turkish titles name the prayer, not the time", () => {
  const tr = labelIn("tr");
  const titles = reminderEvents(masjid, calc, prefs(), { from: tue, days: 1, label: tr }).map((e) => e.title);
  assert.equal(titles[0], "Sabah ezanı");
  assert.equal(titles[1], "Sabah kameti");
  assert.ok(titles.includes("İkindi kameti"));
});

test("every new string exists in every language", () => {
  const keys = Object.keys(STRINGS.en).filter((k) => /^(cal|alert|range|how|plat|ev|renew|remind|notifyIn|nPrayers|fajrPrayer)/.test(k) && !/_(one|two|few|many)$/.test(k));
  assert.ok(keys.length > 50);
  for (const lang of ["tr", "ar"]) for (const k of keys) assert.ok(STRINGS[lang][k], `${lang}.${k} missing`);
});

test("ranges", () => {
  const today = { y: 2026, m: 11, d: 17 };
  assert.deepEqual(rangeDays("month", today), { from: today, days: 14 });
  assert.deepEqual(rangeDays("month", today, { y: 2027, m: 2 }), { from: { y: 2027, m: 2, d: 1 }, days: 28 });
  assert.deepEqual(rangeDays("365", today), { from: today, days: 365 });
});

test("a whole year stays a reasonable file", () => {
  const { text, count } = buildIcs(masjid, calc, prefs(), { from: tue, days: 365, label, url: "https://example.org/#/m/" + "x".repeat(200) });
  assert.equal(count, 365 * 10 + 52); // 52 Fridays: two khutbahs instead of one Dhuhr iqama
  assert.ok(text.length < 6_000_000, `${(text.length / 1e6).toFixed(1)} MB`);
});

test("settings: old reminder choices carry over, junk is ignored", () => {
  const fromOld = normalizeRemind(null, { enabled: true, before: 10, iqama: true });
  assert.deepEqual(alertsFor(fromOld, "adhan"), [10, 0]);
  assert.equal(fromOld.pick.asr.iqama, true);
  assert.equal(fromOld.iqamaAlert, 5);
  const junk = normalizeRemind({ pick: { asr: "yes", fajr: { adhan: 0, iqama: 1 } }, adhanAlert: 7, iqamaAlert: "15" });
  assert.equal(junk.adhanAlert, 0); // 7 isn't a choice
  assert.equal(junk.iqamaAlert, 15);
  assert.deepEqual(junk.pick.fajr, { adhan: false, iqama: true });
  assert.deepEqual(junk.pick.asr, DEFAULT_REMIND.pick.asr);
  const cal = normalizeCal({ range: "999", length: 3, renew: false, exports: { m1: { from: "2026-11-17", to: "2026-12-16", sig: "x" }, old: "2026-12-16", bad: { from: "2026-12-16", to: "2026-11-01" } } });
  assert.equal(cal.range, "30");
  assert.equal(cal.length, 15);
  assert.equal(cal.renew, false);
  assert.deepEqual(cal.exports, { m1: { from: "2026-11-17", to: "2026-12-16", sig: "x", last: { from: "2026-11-17", to: "2026-12-16" } } });
});

test("folding never splits a character", () => {
  const line = "SUMMARY:" + "إقامة العصر · ".repeat(12);
  const folded = fold(line);
  for (const part of folded.split("\r\n")) assert.ok(new TextEncoder().encode(part).length <= 75);
  assert.equal(folded.replace(/\r\n /g, ""), line);
});

// --- What's already in the calendar ---------------------------------------------------------
const d = (k) => {
  const [y, m, dd] = k.split("-").map(Number);
  return { y, m, d: dd };
};
const span = (p) => p.days > 0 ? [`${p.from.y}-${String(p.from.m).padStart(2, "0")}-${String(p.from.d).padStart(2, "0")}`, p.days] : [null, 0];

test("next file continues where the calendar ends; no duplicates", () => {
  const rec = recordExport(null, "2026-11-17", "2026-12-16", "s");
  // Next 30 days, asked again a week later: only the new days.
  assert.deepEqual(span(planExport({ from: d("2026-11-24"), days: 30 }, rec, "s")), ["2026-12-17", 7]);
  // All of it is there already.
  const p = planExport({ from: d("2026-11-20"), days: 10 }, rec, "s");
  assert.equal(p.covered, true);
  // Asked to add them again anyway.
  assert.deepEqual(span(planExport({ from: d("2026-11-24"), days: 30 }, rec, "s", false)), ["2026-11-24", 30]);
});

test("a future month added first: the gap before it is filled, nothing claimed that wasn't added", () => {
  const feb = recordExport(null, "2027-02-01", "2027-02-28", "s");
  const p = planExport({ from: d("2026-11-18"), days: 30 }, feb, "s");
  assert.equal(p.covered, false);
  assert.deepEqual(span(p), ["2026-11-18", 30]); // no overlap with February: all of it
  const p2 = planExport({ from: d("2026-11-18"), days: 90 }, feb, "s");
  assert.deepEqual(span(p2), ["2026-11-18", 75]); // up to 31 January only
  // Recording the gap joins the two spans.
  assert.deepEqual(recordExport(feb, "2026-11-18", "2027-01-31", "s"), { from: "2026-11-18", to: "2027-02-28", sig: "s", last: { from: "2026-11-18", to: "2027-01-31" } });
  // A separate span (with a gap between) replaces the record rather than pretending to cover the gap.
  assert.deepEqual(recordExport(feb, "2026-11-18", "2026-12-17", "s"), { from: "2026-11-18", to: "2026-12-17", sig: "s", last: { from: "2026-11-18", to: "2026-12-17" } });
});

test("the record never moves backwards", () => {
  const rec = recordExport(null, "2026-11-17", "2027-02-28", "s");
  assert.deepEqual(recordExport(rec, "2026-11-17", "2026-11-30", "s"), { from: "2026-11-17", to: "2027-02-28", sig: "s", last: { from: "2026-11-17", to: "2026-11-30" } });
});

test("changed choices or masjid times are not called 'already added'", () => {
  const p = prefs();
  const sig1 = exportSig(masjid, calc, p, DEFAULT_CAL);
  const rec = recordExport(null, "2026-11-17", "2026-12-16", sig1);
  p.pick.sunrise.adhan = true;
  const sig2 = exportSig(masjid, calc, p, DEFAULT_CAL);
  assert.notEqual(sig1, sig2);
  const plan = planExport({ from: d("2026-11-18"), days: 30 }, rec, sig2);
  assert.equal(plan.changed, true);
  assert.equal(plan.covered, false);
  assert.deepEqual(span(plan), ["2026-11-18", 30]);
  // The masjid publishes new iqama times: also a change.
  const updated = { ...masjid, iqama: { ...masjid.iqama, isha: { mode: "fixed", time: "20:00", min: 10 } } };
  assert.notEqual(exportSig(updated, calc, prefs(), DEFAULT_CAL), exportSig(masjid, calc, prefs(), DEFAULT_CAL));
});

test("'My location' is keyed by where it was, so travelling never reuses old times or UIDs", () => {
  const ny = home;
  const ist = { ...home, lat: 41.0082, lng: 28.9784, tz: "Europe/Istanbul" };
  assert.notEqual(placeKey(ny), placeKey(ist));
  assert.equal(placeKey(ny), placeKey({ ...ny, lat: ny.lat + 0.001 })); // same neighbourhood: same calendar
  assert.equal(placeKey(masjid), "m1");
  const uid = unfold(buildIcs(ist, calc, prefs(), { from: tue, days: 1, label, renew: false }).text).match(/^UID:(.+)$/m)[1];
  assert.ok(uid.startsWith(placeKey(ist)), uid);
  assert.ok(!/gps/.test(uid));
});

test("the masjid link is in the description once, not repeated in every event's URL", () => {
  const url = "https://example.org/#/m/" + "x".repeat(200);
  const { text } = buildIcs(masjid, calc, prefs(), { from: tue, days: 30, label, url });
  const evs = events(text);
  assert.ok(evs.filter((e) => /^URL:/m.test(e)).length === 1); // only the renewal reminder
  assert.ok(evs.every((e) => e.includes(url)));
});

test("plurals: Arabic minutes and prayers", () => {
  const ar = (key, n) => {
    const cat = new Intl.PluralRules("ar").select(n);
    return (STRINGS.ar[`${key}_${cat}`] ?? STRINGS.ar[key]).replaceAll("{m}", n).replaceAll("{n}", n);
  };
  assert.equal(ar("alertBefore", 5), "قبل 5 دقائق");
  assert.equal(ar("alertBefore", 15), "قبل 15 دقيقة");
  assert.equal(ar("nPrayers", 1), "صلاة واحدة");
  assert.equal(ar("nPrayers", 2), "صلاتان");
  assert.equal(ar("nPrayers", 5), "5 صلوات");
  assert.equal(tn("nPrayers", 1), "1 prayer"); // English (the default language in tests)
  assert.equal(tn("nPrayers", 4), "4 prayers");
});
