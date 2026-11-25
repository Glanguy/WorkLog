/* WorkLog V3 : l'application s'ouvre sans réseau.
   - Fichiers de l'app : réseau d'abord (toujours la dernière version), cache si pas de réseau.
   - Liste des exercices : cache d'abord, mise à jour en arrière-plan.
   - Images et animations d'exercices déjà vues : gardées en cache (les plus anciennes sont retirées).
   Les séries, favoris et séances sont dans IndexedDB, pas ici. */
const CACHE = 'worklog-0.8.5';
const IMG_CACHE = 'worklog-img-v1';
const IMG_MAX = 1500;   // environ 130 Mo d'images au plus
let puts = 0;
const SHELL = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/i18n.js', 'js/gifreader.js', 'js/mannequin.js', 'js/exercices-3d.js', 'js/exercices-3d-muscu.js', 'models/mannequin.bin', 'models/mannequin-peau.jpg', 'manifest.webmanifest', 'data/data-v3.json', 'data/names-fr.json', 'data/bodymap.json', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/icon-maskable-512.png', 'icons/logo.svg', 'fonts/hubot-sans-latin.woff2', 'fonts/hubot-sans-latin-ext.woff2', 'fonts/wl-digits.woff2'];
const DATA = /\/(data-v3|names-fr|bodymap)\.json$|\/mannequin(\.bin|-peau\.jpg)$/;   // cache d'abord (le mannequin change seulement avec la version)
const IMG_HOSTS = ['cdn.jsdelivr.net', 'raw.githubusercontent.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== IMG_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

function timeout(ms) { return new Promise((res) => setTimeout(() => res(null), ms)); }
async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length > IMG_MAX) for (const k of keys.slice(0, keys.length - IMG_MAX + 100)) await cache.delete(k);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (IMG_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(IMG_CACHE).then(async (c) => {
      const hit = await c.match(req.url);
      if (hit) return hit;
      const r = await fetch(req);
      // L'image est rendue tout de suite ; la mise en cache se fait à côté, et le tri des plus
      // anciennes seulement de temps en temps (pas à chaque image).
      if (r && r.ok && r.type !== 'opaque') {
        e.waitUntil(c.put(req.url, r.clone()).then(() => { if (++puts % 60 === 0) return trim(c); }).catch(() => { /* quota : on continue sans cache */ }));
      }
      return r;
    }));
    return;
  }
  if (url.origin !== location.origin) return;

  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then((r) => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    if (DATA.test(url.pathname) && hit) { e.waitUntil(net); return hit; }
    const fresh = await Promise.race([net, hit ? timeout(2500) : net]);
    if (fresh && fresh.ok) return fresh;
    return hit || (await net) || new Response('Hors ligne', { status: 503 });
  }));
});
