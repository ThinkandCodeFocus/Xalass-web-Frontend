// Xalass Service Worker — Web Push Notifications
const CACHE_NAME = 'xalass-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

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
