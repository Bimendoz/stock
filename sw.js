// sw.js — STOCK STORE: instalación como app, arranque offline y avisos de ofertas.
// Los avisos NUNCA revelan contenido: siempre parecen promociones de la tienda.
const CACHE = 'stockstore-v1';
const SHELL = ['./', './index.html', './app.css', './app.js', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/badge-96.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Red primero para los archivos propios (siempre la versión nueva), caché si no hay internet.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

self.addEventListener('push', (event) => {
  let d = { title: '🛒 STOCK STORE', body: 'Tienes una oferta nueva esperándote', tag: 'stockstore-msg' };
  try { if (event.data) d = { ...d, ...event.data.json() }; } catch (e) {}
  event.waitUntil(self.registration.showNotification(d.title, {
    body: d.body, tag: d.tag, renotify: true,
    icon: 'icons/icon-192.png', badge: 'icons/badge-96.png',
    vibrate: [200, 100, 200], data: { url: './' }
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(Promise.all([
    self.registration.getNotifications().then(l => l.forEach(n => n.close())),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow ? self.clients.openWindow('./') : null;
    })
  ]));
});
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_NOTIFICATIONS') {
    event.waitUntil(self.registration.getNotifications().then(l => l.forEach(n => n.close())));
  }
});
