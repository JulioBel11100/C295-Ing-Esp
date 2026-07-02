/*
  SERVICE-WORKER.JS
  ==================
  Este archivo permite que la app funcione sin conexión y avise cuando hay
  una versión nueva disponible.

  PARA PUBLICAR UNA ACTUALIZACIÓN:
   1. Cambia el contenido de data.js, app.js o lo que corresponda.
   2. Sube en 1 el número de CACHE_VERSION aquí abajo (por ejemplo 'v2', 'v3'...).
   3. Vuelve a subir TODOS los archivos a tu hosting.
  Los usuarios que ya tengan la app instalada verán automáticamente el aviso
  "🔄 Nueva versión disponible" la próxima vez que abran la app.
*/
const CACHE_VERSION = 'v1';
const CACHE_NAME = `c295-ingles-${CACHE_VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if(event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request).then((response) => {
        if(response && response.status === 200){
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
