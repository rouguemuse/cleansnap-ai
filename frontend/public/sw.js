/**
 * CleanSnap Studio — Offline-First Store Service Worker (Microsoft Store & Android PWA)
 * Pre-caches core studio backdrops, showcase cutouts, ONNX segmentation model, and compiled bundles.
 */
const CACHE_NAME = 'cleansnap-studio-v2';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/models/u2netp.onnx',
  '/backdrops/green_screen_studio.jpg',
  '/backdrops/cork_bulletin_board.jpg',
  '/backdrops/slate_chalkboard.jpg',
  '/backdrops/sunny_park_lawn.jpg',
  '/samples/figure_greenscreen_before.jpg',
  '/samples/figure_greenscreen_after.jpg',
  '/samples/figure_greenscreen_cutout.webp',
  '/samples/tropical_slide_before.jpg',
  '/samples/tropical_slide_after.jpg',
  '/samples/tropical_slide_cutout.webp',
  '/samples/wax_letter_before.jpg',
  '/samples/wax_letter_after.jpg',
  '/samples/wax_letter_cutout.webp',
  '/samples/red_coat_before.jpg',
  '/samples/red_coat_after.jpg',
  '/samples/red_coat_cutout.webp',
  '/samples/graphic_umbrella_before.jpg',
  '/samples/graphic_umbrella_after.jpg',
  '/samples/graphic_umbrella_cutout.webp',
  '/samples/sports_coupe_before.jpg',
  '/samples/sports_coupe_after.jpg',
  '/samples/sports_coupe_cutout.webp'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first for immutable assets (/assets/*, /models/*, /backdrops/*, /samples/*, /icons/*)
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/models/') ||
    url.pathname.startsWith('/backdrops/') ||
    url.pathname.startsWith('/samples/') ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first with offline cache fallback for HTML navigation & manifest
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
  );
});
