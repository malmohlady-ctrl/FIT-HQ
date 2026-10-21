/* The Forge service worker — cache-first offline shell.
   Cache name is namespaced (fithq-) and cleanup only deletes fithq-*
   caches, never other apps' caches on this origin.
   Cross-origin requests (Open Food Facts) are never intercepted. */
const CACHE = "forge-v3";
const ASSETS = ["./", "./index.html", "./app.js", "./nutrition.js", "./workouts.js",
  "./progress.js", "./extras.js", "./data.js", "./manifest.json",
  "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];
self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    for (const a of ASSETS) { try { await c.add(a); } catch (err) {} }
    self.skipWaiting();
  })());
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => (k.startsWith("fithq-") || k.startsWith("forge-")) && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(e.request, {ignoreSearch: true});
    if (hit) return hit;
    try {
      const net = await fetch(e.request);
      if (net.ok) c.put(e.request, net.clone());
      return net;
    } catch (err) {
      if (e.request.mode === "navigate") { const idx = await c.match("./index.html"); if (idx) return idx; }
      throw err;
    }
  })());
});
