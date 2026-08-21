// Configuration de l'API Backend
const API_CONFIG = (() => {
    const DEFAULT_BASE_URL = 'https://api.xalass.com/api';
    const STORAGE_KEY = 'xalass_api_base_url';
    const QUERY_KEY = 'api_base_url';

    // Nettoyer toute URL locale stockée par erreur dans les sessions précédentes
    // (localhost, 127.x, IPs privées) — évite le bug iPhone "toujours localhost"
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const isLocal = /127\.|localhost|192\.168\.|10\.\d+\.\d+\.|172\.(1[6-9]|2\d|3[01])\./.test(saved);
            if (isLocal) localStorage.removeItem(STORAGE_KEY);
        }
    } catch (_) {}

    let overrideBaseUrl = null;

    try {
        const params = new URLSearchParams(window.location.search);
        const queryOverride = params.get(QUERY_KEY);
        if (queryOverride) {
            overrideBaseUrl = queryOverride;
            // Ne persister que les URLs de production (pas localhost)
            const isLocalOverride = /127\.|localhost|192\.168\./.test(queryOverride);
            if (!isLocalOverride) {
                localStorage.setItem(STORAGE_KEY, queryOverride);
            }
        }
    } catch (error) {
        // Fallback silencieux sur l'URL par defaut.
    }

    const selectedBaseUrl = (window.XALASS_API_BASE_URL || overrideBaseUrl || DEFAULT_BASE_URL).trim();
    const normalizedBaseUrl = selectedBaseUrl.replace(/\/+$/, '');

    return {
        BASE_URL: normalizedBaseUrl,
        SESSION_STORAGE_KEY: 'xalass_session',
        REQUEST_TIMEOUT_MS: 45000,
        DEFAULT_HEADERS: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        // ⚠️ PLACEHOLDER — ceci est la clé publique VAPID d'exemple documentée par la
        // librairie web-push (https://github.com/web-push-libs/web-push), PAS une vraie
        // clé Xalass. Elle DOIT être remplacée avant que les notifications push ne soient
        // utilisées en production : générer une vraie paire de clés VAPID côté serveur
        // (ex. `npx web-push generate-vapid-keys`), déployer la clé privée correspondante
        // sur le backend, puis remplacer uniquement la valeur ci-dessous par la clé publique
        // générée. Tant que ce placeholder reste en place, les abonnements push créés par
        // js/push-notifications.js ne pourront pas être authentifiés par un vrai serveur
        // push et cette fonctionnalité doit être considérée comme non fonctionnelle.
        VAPID_PUBLIC_KEY: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
    };
})();
