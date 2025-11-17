self.addEventListener('install', e => {
  e.waitUntil(
    caches.open('music-era').then(cache => {
      return cache.addAll([
        '/',
        '/login.html',
        '/playlist.html',
        '/style.css',
        '/manifest.json'
      ]);
    })
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});