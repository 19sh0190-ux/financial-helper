const CACHE_NAME = "smart-buyer-v1";
const APP_SHELL = ["./", "./index.html", "./styles.css", "./app.js", "./manifest.json", "./icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  const sameOrigin = requestUrl.origin === self.location.origin;
  if (!sameOrigin && requestUrl.protocol !== "https:") return;

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
      return response;
    }).catch(async () => (await caches.match(event.request)) || (await caches.match("./index.html"))));
    return;
  }

  if (sameOrigin) {
    event.respondWith(fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
      return response;
    }).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      throw new Error("This app asset is not available offline.");
    }));
    return;
  }

  event.respondWith(caches.match(event.request).then(async (cached) => {
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok || response.type === "opaque") {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      if (sameOrigin) return caches.match(event.request);
      throw error;
    }
  }));
});