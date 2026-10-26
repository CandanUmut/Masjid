# Ufuq — Prayer & Iqama Times

<img src="assets/icons/icon.svg" width="96" alt="Ufuq icon: the sun on the horizon at dawn, with its path across the sky" align="right">

**Ufuq** (أُفُق) means *horizon*. Fajr, sunrise, Maghrib and Isha are all defined by where the sun stands against the horizon, and the app is built around that idea. The icon shows the moment of sunrise, with the sun's daily path dotted across the sky.

A simple, private prayer-times app that runs entirely in the browser. It has no account, no database and no build step: static files you can host on GitHub Pages.

- **The sky is the interface.** Prayer times come from the sun, so the Today screen draws it. The card is coloured by the sun's *real* altitude at your location: navy at night, blue hour, rose dawn, gold sunset. It plots today's actual sun path with each prayer on it and a dot for the sun right now, plus stars and the real moon phase at night. In Oslo in June you can see why Isha is hard.
- **A timeline, not a table.** Each prayer is a node coloured by the sky at that moment, with the current one gently highlighted. The sky card counts down to the next prayer, or to the iqama on a masjid page. During Ramadan it switches to **Suhoor ends in** and **Iftar in** automatically.
- **Times for wherever you are.** It uses your location (if you allow it) and updates when you travel. You can also search any city or enter coordinates (the time zone is taken from the coordinates, never assumed).
- **Calculated on your device.** It uses [adhan-js](https://github.com/batoulapps/adhan-js), so times keep working offline.
- **Masjid pages, shared with a link.** You write each iqama rule as a sentence: "**40** min *before Asr adhan*", "**45** min *before sunrise*", "**120** min *after Isha adhan*" (type the minutes or nudge them with − / +, with optional rounding), or a fixed time that is never earlier than *N* minutes after adhan. Add **changes during the year** (for example Isha 19:45 from 25 October and 21:15 from 29 March); these repeat every year. Jumu'ah times and an announcement go in too. The whole timetable is packed into a *seed*, a short code in the link and QR code. Anyone who opens it sees the same adhan and iqama times **for every day of the year**, with no server involved. The share sheet previews the next 7 days, and on your own location Today shows **your masjids' next iqama** at a glance.
- **Built for real masjids:**
  - A **display mode** for TVs (`#/tv/<seed>`): it scales to any screen, keeps the screen awake, counts down to iqama, shows a "prayer in progress, silence your phones" screen, and puts a QR code on the screen so the congregation can subscribe.
  - A **printable QR poster** for the entrance.
  - A **one-page A4 monthly timetable**.
- **Calendar export (.ics)** with an alarm at each prayer, so reminders work even when the app is closed.
- Qibla compass, Hijri date (Umm al-Qura, with a ±2 day adjustment), and optional extra times: Imsak, Duha, midnight and the last third of the night.
- Regional defaults are chosen automatically: Diyanet for Türkiye (with Turkish names, where İmsak *is* Fajr), ISNA for North America, Umm al-Qura for Saudi Arabia (plus 30 minutes on Isha in Ramadan), Hanafi Asr where it is the norm, and high-latitude rules above 48°. All of it can be overridden: 21 methods, custom angles, and per-prayer minute adjustments.
- Apple's New York serif (with a bundled open-source fallback), SF system fonts and iOS colours. Light and dark mode, English, Türkçe and العربية (RTL), 12/24-hour clock. Installable (PWA) and works fully offline.

## Privacy

Everything is stored in your browser (`localStorage`). There are only a few optional network calls:

| What | Service | When |
| --- | --- | --- |
| City search | [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api) | When you type in the search box |
| Place name for your GPS position | [BigDataCloud reverse geocoding](https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api) | When your location changes by more than about 3 km. Only a position rounded to about 1 km is sent, and results are cached |
| Address and masjid search | [Photon](https://photon.komoot.io/) (OpenStreetMap data) | When you type in the search box. To show nearby results first, your area is sent rounded to about 10 km |
| Time zone for a picked address or typed coordinates | [Open-Meteo](https://open-meteo.com/) | Position rounded to about 1 km. Offline (or if the service is busy) a built-in zone table is used: exact in single-zone countries; elsewhere the app picks the nearest zone and, for typed coordinates, asks you to confirm |

Prayer times never need the network.

## Run it

```bash
python3 -m http.server 8080   # or any static file server
# open http://localhost:8080
```

Opening `index.html` directly from disk (`file://`) won't work, because browsers block ES modules there.

## Deploy to GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages → Build and deployment → Deploy from a branch**, and pick `main` and `/ (root)`.
3. Your app will be at `https://<user>.github.io/<repo>/`.

There is nothing to configure: no keys and no environment variables.

## Sharing a masjid (seeds)

A seed is the masjid's settings as compact JSON, compressed with `deflate-raw` and base64url-encoded. It is usually about 150–250 characters:

```
https://<user>.github.io/Masjid/#/m/mHc2xDoIwFIXhVzFn5Yj3tigtkw4ODjo…
```

- The data sits after the `#`, so it is never sent to any server, not even GitHub's.
- It contains the location, time zone, calculation method (pinned, so everyone gets identical times), iqama rules, Jumu'ah times and a note.
- **To update times**, edit the masjid and share the new link. Each seed carries an id and a timestamp. Opening a newer link updates the saved copy, with an Undo. Opening an older one keeps yours and tells you so.
- **Links are treated as untrusted.** Timestamps from the future are capped, so a wrong clock or a prank can't freeze a masjid. Backup codes are never accepted from a link; they can only be pasted into *Settings → Restore*, and only after a confirmation.
- Iqama rules like "+10 min after adhan, rounded up to 5" follow the adhan through the seasons. Most masjids therefore rarely need to re-share.
- For a masjid screen, open `#/tv/<seed>` (the **Display mode** button in the share sheet) and bookmark it as the browser's start page.

*Settings → Back up* produces a similar code for all your places and settings, which you can paste into *Restore* on another device.

## Accuracy

The engine is checked against the independent [Aladhan API](https://aladhan.com/prayer-times-api) for cities on four continents. Results are within 1–2 minutes (see `tests/engine.test.mjs`). Differences of a minute or two between calculators are normal, and come from rounding and from method-specific minute offsets such as Diyanet's. If your masjid or official calendar differs, use the per-prayer minute adjustments.

At high latitudes, Fajr and Isha can be undefined in summer. The app then applies a high-latitude rule (one-seventh of the night above 48° by default). Inside the polar circle it falls back to the nearest day with a normal sunrise and sunset.

## Project layout

```
index.html            app shell
css/app.css           design system (iOS colours, system fonts, light/dark, RTL, print)
js/app.js             entry: registers feature plugins and starts the app
js/main.js            state, routing, location handling, rendering
js/engine.js          prayer-time engine (adhan-js presets, auto method, iqama, Jumu'ah)
js/seed.js            seed encode/decode (place + backup)
js/time.js            time-zone-aware formatting via Intl (no libraries)
js/geo.js             geolocation, city/address search, reverse geocoding, time zones
js/tzdata.js          IANA zone table for offline time-zone lookup (generated)
js/i18n.js            EN / TR / AR strings
js/views/*            Today, Month, Qibla, Settings, masjid editor/share, display mode
js/vendor/            adhan-js (MIT), qrcode-generator (MIT)
sw.js                 offline cache (bump VERSION on every release)
tools/make-icons.cjs  regenerates the PNG icons from the SVG design (dev only, needs Playwright)
tools/make-tzdata.cjs regenerates js/tzdata.js from tzdata's zone.tab
tests/                node --test suites (engine accuracy, DST, iqama, seeds, offline cache)
```

## Develop

```bash
npm test          # Node 20+, no dependencies to install
```

When you change any file, bump `VERSION` in `sw.js` so installed copies offer a one-tap update. If you add a file, list it in `FILES` in `sw.js`; a test fails if you forget.

## Licenses

MIT for this app. It bundles [Newsreader](https://github.com/productiontype/Newsreader) (SIL OFL 1.1) as a serif fallback, [adhan-js](https://github.com/batoulapps/adhan-js) (MIT, © Batoul Apps) and [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT, © Kazuhiko Arase). "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.
