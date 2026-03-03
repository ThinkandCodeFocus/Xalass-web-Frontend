// Configuration de l'API Backend (Render en production par defaut)
const API_CONFIG = (() => {
    const DEFAULT_BASE_URL = 'https://xalass-backend-hjqg.onrender.com/api';
    const STORAGE_KEY = 'xalass_api_base_url';
    const QUERY_KEY = 'api_base_url';

    let overrideBaseUrl = null;

    try {
        const params = new URLSearchParams(window.location.search);
        const queryOverride = params.get(QUERY_KEY);
        if (queryOverride) {
            localStorage.setItem(STORAGE_KEY, queryOverride);
            overrideBaseUrl = queryOverride;
        } else {
            overrideBaseUrl = localStorage.getItem(STORAGE_KEY);
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
        }
    };
})();
