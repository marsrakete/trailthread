importScripts("./version.js");

const APP_VERSION = globalThis.APP_VERSION_INFO?.cacheVersion || "v0";
const CACHE_NAME = `trailthread-${APP_VERSION}`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./modules/komoot-import.js",
  "./modules/osm-analysis.js",
  "./modules/track-detail.js",
  "./modules/replay-workspace.js",
  "./modules/fit-io.js",
  "./modules/vendor/fit-file-parser/fit-parser.js",
  "./modules/vendor/fit-file-parser/binary.js",
  "./modules/vendor/fit-file-parser/helper.js",
  "./modules/vendor/fit-file-parser/fit.js",
  "./modules/vendor/fit-file-parser/messages.js",
  "./modules/vendor/fit-file-parser/fit-encoder.js",
  "./modules/vendor/fit-file-parser/garmin_profile.generated.js",
  "./modules/komoot-workspace.js",
  "./config.js",
  "./version.js",
  "./manifest.json",
  "./HELP.de.md",
  "./HELP.en.md",
  "./HELP.fr.md",
  "./icons/icon.svg",
  "./icons/maskable.svg",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css",
  "https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
    ])
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

  const requestUrl = new URL(request.url);
  const sameOrigin = requestUrl.origin === self.location.origin;
  const isExternalMapResource = requestUrl.origin === "https://tile.openstreetmap.org"
    || requestUrl.origin === "https://a.tile.openstreetmap.org"
    || requestUrl.origin === "https://tiles.mapterhorn.com";
  const isLocalProxyResource = requestUrl.origin === "http://localhost:8787";

  if (isExternalMapResource || isLocalProxyResource) {
    event.respondWith(fetch(request));
    return;
  }

  if (sameOrigin && requestUrl.pathname.endsWith("/version.js")) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return networkResponse;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./version.js")))
    );
    return;
  }

  if (sameOrigin && /\/HELP\.(de|en|fr)\.md$/u.test(requestUrl.pathname)) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return networkResponse;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./HELP.en.md")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          if (request.mode === "navigate") return caches.match("./index.html");
          return new Response("Offline", { status: 503, statusText: "Offline" });
        });
    })
  );
});
