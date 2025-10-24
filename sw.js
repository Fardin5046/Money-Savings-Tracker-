// sw.js — updated to ensure new HTML updates show up immediately on Vercel

const VERSION = 'v2'; // <— bump this each time you redeploy to force cache refresh
const STATIC_CACHE = `static-${VERSION}`;
const HTML_CACHE = `html-${VERSION}`;

const STATIC_ASSETS = [
  // do NOT include './' or './index.html' here
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== STATIC_CACHE && k !== HTML_CACHE) return caches.delete(k);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Network-first for navigations/HTML
  const isHTML =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req, { cache: 'no-store' });
          const cache = await caches.open(HTML_CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (err) {
          const cache = await caches.open(HTML_CACHE);
          const cached = await cache.match(req);
          return cached || caches.match('/index.html');
        }
      })()
    );
    return;
  }

  // Cache-first for static assets
  if (STATIC_ASSETS.some((p) => req.url.includes(p.replace('./', '/')))) {
    event.respondWith(caches.match(req).then((c) => c || fetch(req)));
    return;
  }

  // Default: try cache, then network
  event.respondWith(caches.match(req).then((c) => c || fetch(req)));
});
