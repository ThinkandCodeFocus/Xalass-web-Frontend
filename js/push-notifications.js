/**
 * Xalass Web Push — enregistrement de la subscription navigateur
 * Utilisé sur toutes les pages qui chargent api.js
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'xalass_push_subscribed';

    async function registerPush() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        // Une seule demande par session
        if (sessionStorage.getItem(STORAGE_KEY)) return;

        try {
            const reg = await navigator.serviceWorker.register('/sw.js');

            // Vérifier si déjà abonné
            let sub = await reg.pushManager.getSubscription();

            if (!sub) {
                // Demander la permission
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') return;

                // S'abonner (VAPID public key — à remplacer par une vraie clé générée)
                const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
                const vapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
                sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: vapidKey,
                });
            }

            // Envoyer la subscription au backend
            if (typeof api !== 'undefined') {
                await api.request('/push/subscribe', {
                    method: 'POST',
                    body: JSON.stringify({
                        endpoint: sub.endpoint,
                        p256dh:   sub.getKey ? btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))) : null,
                        auth:     sub.getKey ? btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))) : null,
                    }),
                });
            }

            sessionStorage.setItem(STORAGE_KEY, '1');
        } catch (err) {
            console.warn('Push subscription failed:', err);
        }
    }

    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = atob(base64);
        return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
    }

    // Déclencher après chargement pour ne pas bloquer le rendu
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', registerPush);
    } else {
        setTimeout(registerPush, 1000);
    }
})();
