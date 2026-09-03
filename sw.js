// Xalass Service Worker — Web Push Notifications + Cache hors-ligne
const CACHE_VERSION = 'xalass-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// App shell : pages et fichiers essentiels, pré-mis en cache à l'installation.
// Les polices/images ont des noms hashés et changeants — elles ne sont pas
// précachées ici, mais couvertes par la stratégie runtime cache-first ci-dessous.
const APP_SHELL = [
    '/xalass-feed.html',
    '/xalass-login.html',
    '/css/main.min.css',
    '/css/style.css',
    '/css/color.css',
    '/css/responsive.css',
    '/css/xalass.css',
    '/js/config.js',
    '/js/api.js',
    '/js/main.min.js',
    '/js/xalass.js',
    '/js/pwa-install.js',
    '/manifest.json',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => cache.addAll(APP_SHELL))
            .catch(() => {}) // Ne bloque pas l'installation si une ressource échoue
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key.startsWith('xalass-') && key !== STATIC_CACHE && key !== RUNTIME_CACHE)
                    .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Types de requêtes qu'on ne met jamais en cache (données sensibles / toujours fraîches)
function isApiRequest(url) {
    return url.pathname.startsWith('/api/') || url.hostname.startsWith('api.');
}

function isStaticAsset(url) {
    return /\.(css|js|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico)$/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return; // Ne cache jamais POST/PUT/DELETE

    const url = new URL(request.url);

    // API : network-first, repli sur le cache si hors-ligne (pour ne pas servir
    // de données périmées quand la connexion fonctionne).
    if (isApiRequest(url)) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // Assets statiques (CSS/JS/fonts/images) : cache-first, rapide et fonctionne hors-ligne.
    if (isStaticAsset(url)) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((response) => {
                    const clone = response.clone();
                    caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
                    return response;
                });
            })
        );
        return;
    }

    // Pages HTML : network-first avec repli sur le cache (contenu à jour en
    // priorité, consultation minimale hors-ligne en secours).
    if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
                    return response;
                })
                .catch(() => caches.match(request).then((cached) => cached || caches.match('/xalass-feed.html')))
        );
    }
});

// Réception d'une notification push
self.addEventListener('push', function (event) {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch (_) {}
    const title   = data.title   || 'Xalass';
    const options = {
        body:    data.body    || data.message || 'Nouvelle notification',
        icon:    data.icon    || '/favicon.ico',
        badge:   '/favicon.ico',
        tag:     data.tag     || 'xalass-notif',
        data:    { url: data.url || '/xalass-notifications.html' },
        vibrate: [200, 100, 200],
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

// Clic sur la notification → ouvre l'onglet notifications
self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    const url = event.notification.data?.url || '/xalass-notifications.html';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
            for (const client of clients) {
                if (client.url.includes('xalass') && 'focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            if (self.clients.openWindow) return self.clients.openWindow(url);
        })
    );
});