const CACHE_NAME = 'trackmytrash-v1';
const urlsToCache = [
  '/',
  '/LandingPage.html',
  '/Login.html',
  '/Register.html',
  '/css/LandingPage.css',
  '/css/Login.css',
  '/js/script.js',
  '/img/logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});