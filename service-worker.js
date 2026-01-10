const CACHE_VERSION = "v1";
const PRECACHE_NAME = `prayerhub-precache-${CACHE_VERSION}`;
const RUNTIME_NAME = `prayerhub-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
];

const TTL = {
  aladhan: 1000 * 60 * 60 * 6,
  nominatim: 1000 * 60 * 60 * 24,
  supabase: 1000 * 60 * 10,
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PRECACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![PRECACHE_NAME, RUNTIME_NAME].includes(key))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isSameOrigin) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (url.hostname.includes("api.aladhan.com")) {
    event.respondWith(cacheWithTtl(request, TTL.aladhan));
    return;
  }

  if (url.hostname.includes("nominatim.openstreetmap.org")) {
    event.respondWith(cacheWithTtl(request, TTL.nominatim));
    return;
  }

  if (url.hostname.includes("supabase.co") && url.pathname.includes("/rest/v1/masjids")) {
    if (url.pathname.includes("/auth")) return;
    event.respondWith(cacheWithTtl(request, TTL.supabase));
    return;
  }
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(RUNTIME_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cache = await caches.open(PRECACHE_NAME);
    const cached = await cache.match("./index.html");
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

async function cacheWithTtl(request, ttl) {
  const cache = await caches.open(RUNTIME_NAME);
  const cached = await cache.match(request);
  if (cached) {
    const cachedTime = cached.headers.get("sw-fetched-at");
    if (cachedTime && Date.now() - Number(cachedTime) < ttl) {
      return cached;
    }
  }

  try {
    const response = await fetch(request);
    const stamped = await stampResponse(response);
    cache.put(request, stamped.clone());
    return stamped;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

async function stampResponse(response) {
  const headers = new Headers(response.headers);
  headers.set("sw-fetched-at", String(Date.now()));
  const body = await response.clone().blob();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
