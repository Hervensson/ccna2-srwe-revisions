const CACHE_NAME = "ccna-srwe-v20";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./enhance.css",
  "./ux-polish.css",
  "./mobile-history.css",
  "./mobile-fix.css",
  "./revision-pro.css",
  "./training-mode.css",
  "./questions.js",
  "./app.js",
  "./enhance.js",
  "./launch-fix.js",
  "./home-button.js",
  "./ux-polish.js",
  "./revision-pro.js",
  "./training-mode.js",
  "./force-home.js",
  "./site.webmanifest",
  "./icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match("./index.html")))
  );
});
