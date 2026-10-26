// Offline support: every app file is precached, so the app (and prayer times) work with no network.
// Bump VERSION whenever any file changes; the app then offers a one-tap reload.
const VERSION = "2.2.0-1";
const CACHE = `masjid-${VERSION}`;
const FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./js/app.js",
  "./js/main.js",
  "./js/engine.js",
  "./js/astro.js",
  "./js/time.js",
  "./js/geo.js",
  "./js/store.js",
  "./js/seed.js",
  "./js/i18n.js",
  "./js/ui.js",
  "./js/views/today.js",
  "./js/views/skychart.js",
  "./js/views/places.js",
  "./js/views/settings.js",
  "./js/views/calc-editor.js",
  "./js/views/masjid.js",
  "./js/views/month.js",
  "./js/views/qibla.js",
  "./js/views/tv.js",
  "./js/views/extras.js",
  "./js/vendor/adhan.js",
  "./js/vendor/qrcode.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-192-maskable.png",
  "./assets/icons/icon-512-maskable.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/favicon-32.png",
  "./assets/icons/favicon-16.png",
  "./assets/icons/icon.svg",
  "./assets/fonts/newsreader-latin-600-normal.woff2",
  "./assets/fonts/newsreader-latin-ext-600-normal.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("masjid-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // geocoding APIs: always live, never cached here
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (req.mode === "navigate") {
        const hit = await cache.match("./index.html");
        if (hit) return hit;
      }
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        return await fetch(req);
      } catch {
        return (await cache.match("./index.html")) || Response.error();
      }
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) return c.focus();
      return self.clients.openWindow("./");
    })
  );
});
