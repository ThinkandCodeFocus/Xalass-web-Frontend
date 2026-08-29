/**
 * Xalass — bannière d'installation PWA ("ajouter à l'écran d'accueil").
 *
 * - Enregistre le service worker (nécessaire pour l'installabilité, et
 *   réutilise le même sw.js que les notifications push).
 * - N'affiche rien si l'app tourne déjà en mode standalone (déjà installée).
 * - Gérée à distance : si l'admin désactive `pwa_install_enabled` depuis
 *   xalass-admin.html (GET/PUT /settings), la bannière ne s'affiche plus,
 *   sur toutes les pages, sans nouveau déploiement.
 * - Android/Chrome/Edge : écoute `beforeinstallprompt` et déclenche le vrai
 *   dialogue natif d'installation au clic.
 * - iOS/Safari : `beforeinstallprompt` n'existe pas — on affiche à la place
 *   des instructions manuelles (Partager → Sur l'écran d'accueil).
 * - Un clic sur "Plus tard" masque la bannière pendant 14 jours (localStorage).
 */
(function () {
    'use strict';

    const DISMISS_KEY = 'xalass_pwa_install_dismissed_until';
    const DISMISS_DAYS = 14;
    const BANNER_ID = 'xalass-pwa-install-banner';

    let deferredPrompt = null;

    function isStandalone() {
        return (
            (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
            window.navigator.standalone === true
        );
    }

    function isIos() {
        return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    }

    function isDismissed() {
        try {
            const until = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
            return Date.now() < until;
        } catch (_) {
            return false;
        }
    }

    function dismiss() {
        try {
            const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
            localStorage.setItem(DISMISS_KEY, String(until));
        } catch (_) {}
        hideBanner();
    }

    function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('/sw.js').catch(function () {
                // Non bloquant : l'app reste utilisable sans service worker.
            });
        });
    }

    // Réglage à distance (dashboard admin). En cas d'échec réseau, on part
    // du principe que c'est activé — c'est la valeur par défaut côté backend
    // (voir Setting::getBool dans Xalass_Backend) et la bannière doit
    // fonctionner même si /settings est momentanément injoignable.
    function fetchInstallEnabled() {
        if (typeof api !== 'undefined' && typeof api.request === 'function') {
            return api.request('/settings', { method: 'GET' })
                .then(function (data) { return data && data.pwa_install_enabled !== false; })
                .catch(function () { return true; });
        }
        // api.js pas chargé sur cette page : on tente un fetch direct.
        const base = (typeof API_CONFIG !== 'undefined' && API_CONFIG.BASE_URL) || 'https://api.xalass.com/api';
        return fetch(base.replace(/\/+$/, '') + '/settings')
            .then(function (r) { return r.ok ? r.json() : { pwa_install_enabled: true }; })
            .then(function (data) { return data && data.pwa_install_enabled !== false; })
            .catch(function () { return true; });
    }

    function buildBanner(mode) {
        if (document.getElementById(BANNER_ID)) return;

        const style = document.createElement('style');
        style.id = BANNER_ID + '-style';
        style.textContent = `
            #${BANNER_ID} {
                position: fixed;
                left: 12px;
                right: 12px;
                bottom: 12px;
                z-index: 9999;
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 14px 16px;
                border-radius: 16px;
                background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                box-shadow: 0 8px 24px rgba(0,0,0,0.35);
                color: #fff;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                max-width: 420px;
                margin: 0 auto;
                animation: xalassPwaSlideUp .25s ease-out;
            }
            @keyframes xalassPwaSlideUp {
                from { transform: translateY(16px); opacity: 0; }
                to   { transform: translateY(0); opacity: 1; }
            }
            #${BANNER_ID} img {
                width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
            }
            #${BANNER_ID} .xalass-pwa-text { flex: 1; min-width: 0; }
            #${BANNER_ID} .xalass-pwa-title { font-size: 14px; font-weight: 700; margin-bottom: 2px; }
            #${BANNER_ID} .xalass-pwa-sub { font-size: 12.5px; opacity: .9; line-height: 1.35; }
            #${BANNER_ID} .xalass-pwa-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
            #${BANNER_ID} button {
                font-family: inherit;
                border: none;
                cursor: pointer;
            }
            #${BANNER_ID} .xalass-pwa-install-btn {
                background: #fff;
                color: #6366f1;
                font-weight: 700;
                font-size: 13px;
                padding: 8px 14px;
                border-radius: 10px;
                white-space: nowrap;
            }
            #${BANNER_ID} .xalass-pwa-close {
                background: transparent;
                color: rgba(255,255,255,0.85);
                font-size: 18px;
                line-height: 1;
                padding: 6px;
            }
        `;
        document.head.appendChild(style);

        const wrap = document.createElement('div');
        wrap.id = BANNER_ID;

        const subText = mode === 'ios'
            ? 'Appuyez sur Partager puis « Sur l’écran d’accueil ».'
            : 'Accès rapide, plein écran, depuis votre écran d’accueil.';
        const actionLabel = mode === 'ios' ? 'Compris' : 'Installer';

        wrap.innerHTML = `
            <img src="/images/pwa/icon-192.png" alt="Xalass">
            <div class="xalass-pwa-text">
                <div class="xalass-pwa-title">Installer Xalass</div>
                <div class="xalass-pwa-sub">${subText}</div>
            </div>
            <div class="xalass-pwa-actions">
                <button type="button" class="xalass-pwa-install-btn" id="${BANNER_ID}-install">${actionLabel}</button>
                <button type="button" class="xalass-pwa-close" id="${BANNER_ID}-close" aria-label="Fermer">&times;</button>
            </div>
        `;
        document.body.appendChild(wrap);

        document.getElementById(BANNER_ID + '-close').addEventListener('click', dismiss);
        document.getElementById(BANNER_ID + '-install').addEventListener('click', function () {
            if (mode === 'ios') {
                dismiss();
                return;
            }
            if (!deferredPrompt) {
                hideBanner();
                return;
            }
            deferredPrompt.prompt();
            deferredPrompt.userChoice.finally(function () {
                deferredPrompt = null;
                hideBanner();
            });
        });
    }

    function hideBanner() {
        const el = document.getElementById(BANNER_ID);
        if (el) el.remove();
        const style = document.getElementById(BANNER_ID + '-style');
        if (style) style.remove();
    }

    function init() {
        registerServiceWorker();

        if (isStandalone() || isDismissed()) return;

        fetchInstallEnabled().then(function (enabled) {
            if (!enabled || isStandalone() || isDismissed()) return;

            if (isIos()) {
                buildBanner('ios');
                return;
            }

            // Android/Chrome/Edge : la bannière n'apparaît qu'au moment où le
            // navigateur juge le site installable (événement natif).
            window.addEventListener('beforeinstallprompt', function (event) {
                event.preventDefault();
                deferredPrompt = event;
                if (!isDismissed()) buildBanner('android');
            });

            window.addEventListener('appinstalled', function () {
                deferredPrompt = null;
                hideBanner();
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
