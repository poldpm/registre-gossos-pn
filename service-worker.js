// Service Worker: permet que l'app funcioni sense connexió a internet.
// Quan canviïs els fitxers de l'app, incrementa CACHE_NAME perquè
// els mòbils descarreguin la nova versió.
const CACHE_NAME = 'registre-gossos-v7';

const ARXIUS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './images/logo-parc.png'
];

// Instal·lació: desa tots els arxius de l'app a la memòria cau
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARXIUS))
  );
  self.skipWaiting();
});

// Activació: elimina caches antigues
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Peticions: serveix primer des de la memòria cau (funciona sense internet).
// Les peticions cap a l'Apps Script (Google) sempre van a la xarxa.
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  if (url.includes('script.google.com')) {
    return; // deixa-ho passar tal qual (la gestiona app.js)
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((resp) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, resp.clone());
          return resp;
        });
      }).catch(() => cached);
    })
  );
});
