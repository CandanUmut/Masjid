# Masjid — Prayer & Iqama Times

A simple, private prayer-times app that runs entirely in the browser. It has no account, no database and no build step: static files you can host on GitHub Pages.

- **Times for wherever you are.** It uses your location (if you allow it) and updates when you travel. You can also search any city or enter coordinates.
- **Calculated on your device.** It uses the [adhan-js](https://github.com/batoulapps/adhan-js) astronomical library, so times keep working offline.
- **Masjid pages, shared with a link.** You enter a masjid's iqama rules (minutes after adhan, rounding, or fixed times), Jumu'ah times and an announcement. The whole timetable is packed into a *seed*: a short code inside the link and the QR code. Anyone who opens it sees the same times. No server is involved.
- **Display mode** for masjid TVs and screens (`#/tv/<seed>`). It is full screen, keeps the screen awake, and counts down to iqama.
- Monthly timetable with print and **calendar export (.ics)**. The exported events carry alarms, so reminders work even when the app is closed.
- Qibla compass, Hijri date (Umm al-Qura, with a ±2 day adjustment), and optional extra times: Imsak, Duha, midnight and the last third of the night.
- Regional defaults are chosen automatically. For example, Diyanet for Türkiye, ISNA for North America and Umm al-Qura for Saudi Arabia. Hanafi Asr is used where it is the norm, and high-latitude rules apply above 48°. Every default can be overridden: 21 methods, custom angles, and ± minute adjustments per prayer.
- Light and dark mode, English, Türkçe and العربية (RTL), and a 12- or 24-hour clock.
- Installable as an app (PWA) and works fully offline.

## Privacy

Everything is stored in your browser (`localStorage`). There are only two optional network calls:

| What | Service | When |
| --- | --- | --- |
| City search | [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api) | When you type in the search box |
| Place name for your GPS position | [BigDataCloud reverse geocoding](https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api) | When your location changes by more than about 3 km (results are cached) |

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
- **To update times**, edit the masjid and share the new link. Each seed carries an id and a timestamp, so opening a newer link updates the saved copy and an older link never overwrites a newer one.
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
js/geo.js             geolocation, city search, reverse geocoding
js/i18n.js            EN / TR / AR strings
js/views/*            Today, Month, Qibla, Settings, masjid editor/share, display mode
js/vendor/            adhan-js (MIT), qrcode-generator (MIT)
sw.js                 offline cache (bump VERSION on every release)
tests/                node --test suites (engine accuracy, DST, iqama, seeds, offline cache)
```

## Develop

```bash
npm test          # Node 20+, no dependencies to install
```

When you change any file, bump `VERSION` in `sw.js` so installed copies offer a one-tap update. If you add a file, list it in `FILES` in `sw.js`; a test fails if you forget.

## Licenses

MIT for this app. It bundles [adhan-js](https://github.com/batoulapps/adhan-js) (MIT, © Batoul Apps) and [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT, © Kazuhiko Arase). "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.
