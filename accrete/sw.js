// Accrete service worker: everything the game needs is cached on first visit, so it plays offline.
const CACHE = "accrete-785ac2800a";
const CORE = ["./", "index.html", "three.min.js", "manifest.webmanifest", "fonts/orbitron-latin-600-normal.woff2", "fonts/orbitron-latin-700-normal.woff2", "fonts/exo-2-latin-400-normal.woff2", "fonts/exo-2-latin-500-normal.woff2", "fonts/exo-2-latin-600-normal.woff2", "fonts/exo-2-latin-700-normal.woff2", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon.svg", "icons/maskable-512.png", "sounds/rock-0.mp3", "sounds/rock-1.mp3", "sounds/rock-2.mp3", "sounds/rock-3.mp3", "sounds/rock-4.mp3", "sounds/ignite-0.mp3", "sounds/ignite-1.mp3", "sounds/ignite-2.mp3", "sounds/rumble-0.mp3", "sounds/rumble-1.mp3", "sounds/hum-0.mp3", "sounds/hum-1.mp3", "sounds/supernova.mp3", "sounds/crunch-0.mp3", "sounds/crunch-1.mp3", "sounds/crunch-2.mp3", "sounds/implode.mp3", "sounds/deny.mp3", "sounds/perseus.mp3", "sounds/gameloop.webm", "sounds/gameloop.mp3"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("accrete-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  // the page: network first so updates arrive, cache when offline. Everything else: cache first.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put("./", copy)); return r; }).catch(() => caches.match("./")));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return r;
  })));
});
