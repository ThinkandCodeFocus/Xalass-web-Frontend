// ==========================================
// XALASS V2 — Modération & Validation
// ==========================================

// ---- 1. CONFIGURATION AI ----
const BACKEND_MODERATION_URL = (typeof window !== 'undefined' && window.MODERATION_URL)
    ? window.MODERATION_URL
    : null;

async function checkWithAI(textToCheck) {
    try {
        if (BACKEND_MODERATION_URL) {
            const resp = await fetch(BACKEND_MODERATION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: textToCheck })
            });
            if (!resp.ok) throw new Error(`Erreur proxy: ${resp.status}`);
            const data = await resp.json();
            const results = data.results ? data.results[0] : (data[0] || data);
            if (results && results.flagged) {
                const cats = Object.keys(results.categories || {}).filter(c => results.categories[c]);
                return { safe: false, reason: 'IA_MODERATION_BLOCKED', categories: cats };
            }
            return { safe: true };
        }
        return { safe: true, warning: 'no_moderation_url' };
    } catch (error) {
        console.error('Erreur IA modération:', error);
        return { safe: true, warning: 'AI_offline' };
    }
}

async function validateContent(text) {
    if (!text || typeof text !== 'string') return { safe: true };
    const words = readAllBannedWords();
    const lowerText = text.toLowerCase();
    const hasLocal = words.some(w => lowerText.includes(w));
    if (hasLocal) return { safe: false, reason: 'LOCAL_FILTER', detail: 'Contenu interdit détecté.' };
    return checkWithAI(text);
}

// ---- 2. MODULE XalassV2 (UI + validation locale) ----

(function () {
    'use strict';

    const STORAGE_KEY  = 'xalass_v2_moderation_settings';
    const TITLE_LIMIT  = 80;
    // Durée de vie du cache local des mots (10 minutes)
    const WORDS_CACHE_TTL = 10 * 60 * 1000;

    // Mots par défaut — utilisés si l'API est inaccessible
    const DEFAULT_WORDS = {
        vulgar: {
            wolof:    ['saga', 'kat', 'ndey', 'bay', 'thiapathiapa', 'saayi', 'khadj'],
            francais: ['merde', 'putain', 'connard', 'salope', 'con', 'conne', 'couille'],
            anglais:  ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'damn']
        },
        grave: {
            wolof:    [],
            francais: ['suicide', 'terrorisme', 'viol', 'meurtre', 'pedophilie', 'jihad'],
            anglais:  ['suicide', 'terrorism', 'rape', 'murder', 'pedophilia', 'jihad']
        }
    };

    // Charge les listes depuis l'API backend et les met en cache localStorage
    async function syncWordsFromApi() {
        try {
            const base = (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : null)
                      || (typeof window !== 'undefined' && window.API_BASE_URL ? window.API_BASE_URL : null)
                      || 'https://api.xalass.com/api';

            const resp = await fetch(`${base}/moderation/words`);
            if (!resp.ok) return;
            const data = await resp.json();
            if (!data.success || !data.words) return;

            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                ...data.words,
                updatedAt: new Date().toISOString(),
                _source: 'api',
            }));
        } catch (_) {
            // API inaccessible — les listes locales servent de fallback
        }
    }

    // Déclencher la sync au chargement si le cache est expiré
    (function initSync() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            const age   = saved?.updatedAt ? Date.now() - new Date(saved.updatedAt).getTime() : Infinity;
            if (age > WORDS_CACHE_TTL || saved?._source !== 'api') {
                syncWordsFromApi();
            }
        } catch (_) { syncWordsFromApi(); }
    })();

    function readSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (!saved || typeof saved !== 'object') return null;
            return saved;
        } catch (_) { return null; }
    }

    function saveSettings(settings) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                ...settings,
                updatedAt: new Date().toISOString()
            }));
        } catch (_) {}
    }

    function getAllWords() {
        const saved = readSettings();
        const merge = (key, lang) => {
            const def = DEFAULT_WORDS[key][lang] || [];
            const adm = saved?.[key]?.[lang] || [];
            return [...new Set([...def, ...adm])];
        };
        return [
            ...merge('vulgar', 'wolof'),
            ...merge('vulgar', 'francais'),
            ...merge('vulgar', 'anglais'),
            ...merge('grave', 'wolof'),
            ...merge('grave', 'francais'),
            ...merge('grave', 'anglais'),
        ].filter(Boolean);
    }

    // Exposée globalement pour checkWithAI / validateContent
    window.readAllBannedWords = getAllWords;

    function normalizeText(text) {
        return String(text || '')
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[@4]/g, 'a')
            .replace(/[3]/g, 'e')
            .replace(/[1!|]/g, 'i')
            .replace(/[0]/g, 'o')
            .replace(/[$5]/g, 's')
            .toLowerCase();
    }

    function normalizeWordList(words) {
        if (typeof words === 'string') words = words.split(/[\n,;]/);
        if (!Array.isArray(words)) return [];
        return [...new Set(words.map(w => String(w).trim().toLowerCase()).filter(Boolean))];
    }

    function escapeRegex(v) {
        return String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function escapeHtml(v) {
        const n = document.createElement('div');
        n.textContent = v == null ? '' : String(v);
        return n.innerHTML;
    }

    function detectBlockedContacts(text) {
        const val = String(text || '');
        const urlRe   = /(https?:\/\/|www\.|[a-z0-9-]+(\[\.]|\(\.\)|\s+dot\s+|\.)[a-z]{2,})/i;
        const phoneRe = /(\+?\d[\d\s().\-]{7,}\d)/;
        const hits = [];
        if (urlRe.test(val))   hits.push('lien');
        if (phoneRe.test(val)) hits.push('numéro de téléphone');
        return hits;
    }

    function censorText(text) {
        let out = String(text || '');
        const normalized = normalizeText(out);
        getAllWords().forEach(word => {
            if (!word) return;
            const nw = normalizeText(word);
            const re = new RegExp(escapeRegex(nw), 'gi');
            if (re.test(normalized)) {
                const wRe = new RegExp(escapeRegex(word), 'gi');
                out = out.replace(wRe, m => '*'.repeat(Math.max(3, m.length)));
            }
        });
        return out;
    }

    function findModerationWords(text) {
        const norm = normalizeText(text);
        const saved = readSettings();
        const merge = (key, lang) => {
            const def = DEFAULT_WORDS[key][lang] || [];
            const adm = saved?.[key]?.[lang] || [];
            return [...new Set([...def, ...adm])];
        };
        const vulgar = ['wolof','francais','anglais']
            .flatMap(l => merge('vulgar', l))
            .filter(w => norm.includes(normalizeText(w)));
        const grave = ['wolof','francais','anglais']
            .flatMap(l => merge('grave', l))
            .filter(w => norm.includes(normalizeText(w)));
        return { vulgar, grave };
    }

    function validateTextContent(text, options = {}) {
        const errors = [];
        const blocked = detectBlockedContacts(text);
        if (blocked.length) {
            errors.push(`Les ${blocked.join(' et les ')} ne sont pas autorisés pour protéger l'anonymat.`);
        }
        if (options.requireText && !String(text || '').trim()) {
            errors.push('Le contenu ne peut pas être vide.');
        }
        return {
            ok: errors.length === 0,
            errors,
            sanitized: censorText(text),
            matches: findModerationWords(text)
        };
    }

    function validateTitle(title) {
        const value = String(title || '').trim();
        const errors = [];
        if (!value) errors.push('Remplis le titre de ton histoire.');
        if (value.length > TITLE_LIMIT) errors.push(`Le titre est limité à ${TITLE_LIMIT} caractères.`);
        return { ok: errors.length === 0, errors, remaining: TITLE_LIMIT - value.length };
    }

    function attachTitleCounter(input, counter) {
        if (!input || !counter) return;
        input.setAttribute('maxlength', String(TITLE_LIMIT));

        const update = () => {
            const remaining = TITLE_LIMIT - input.value.length;
            const pct = input.value.length / TITLE_LIMIT;
            counter.textContent = `${remaining} / ${TITLE_LIMIT}`;
            counter.classList.toggle('is-warning', pct >= 0.75 && pct < 0.9);
            counter.classList.toggle('is-danger',  pct >= 0.9);
        };

        input.addEventListener('input', update);
        update();
    }

    function attachLivePreview(input, preview, alertBox) {
        if (!input || !preview) return;

        const update = () => {
            const validation = validateTextContent(input.value);
            const censored = escapeHtml(validation.sanitized || '').replace(/\n/g, '<br>');
            preview.innerHTML = censored
                ? `<span style="opacity:.6;font-size:11px;display:block;margin-bottom:4px;">Aperçu filtré :</span>${censored}`
                : '';
            if (alertBox) {
                alertBox.textContent = validation.errors.join(' ');
                alertBox.style.display = validation.errors.length ? 'block' : 'none';
            }
        };

        input.addEventListener('input', update);
        update();
    }

    // ---- Reply targeting helper ----
    // Affiche un bandeau "En réponse à…" au-dessus du champ de saisie
    // et stocke l'ID du commentaire cible.
    let _replyTargetId = null;

    function setReplyTarget(commentId, commentPreview, targetEl) {
        _replyTargetId = commentId;
        if (!targetEl) return;

        targetEl.innerHTML = `
            <div class="v2-reply-target">
                <span>💬 En réponse à : <em>${escapeHtml(String(commentPreview || '').slice(0, 80))}${(commentPreview || '').length > 80 ? '…' : ''}</em></span>
                <button type="button" onclick="XalassV2.clearReplyTarget(document.getElementById('v2-reply-banner'))">✕ Annuler</button>
            </div>
        `;
    }

    function clearReplyTarget(targetEl) {
        _replyTargetId = null;
        if (targetEl) targetEl.innerHTML = '';
    }

    function getReplyTargetId() {
        return _replyTargetId;
    }

    // ---- Moderation score (pour l'admin) ----
    function buildModerationScore(text, reportCount = 0, viewCount = 0) {
        const matches = findModerationWords(text);
        const reportRatio = viewCount > 0 ? reportCount / viewCount : 0;
        const score = Math.min(1,
            (matches.vulgar.length * 0.12) +
            (matches.grave.length  * 0.24) +
            (reportCount           * 0.06) +
            (reportRatio           * 0.35)
        );
        let action = 'Aucune action';
        if (score >= 0.8) action = 'Suppression automatique';
        else if (score >= 0.6) action = 'Masquage temporaire';
        else if (score >= 0.3) action = 'Revue manuelle';
        return { score: Math.round(score * 100) / 100, action, matches };
    }

    // ---- Styles injectés ----
    function injectStyles() {
        if (document.getElementById('xalass-v2-styles')) return;
        const style = document.createElement('style');
        style.id = 'xalass-v2-styles';
        style.textContent = `
            .v2-counter {
                margin-top: 5px;
                color: #34d399;
                font-size: 11px;
                font-weight: 600;
                text-align: right;
                transition: color 0.2s;
            }
            .v2-counter.is-warning { color: #f59e0b; }
            .v2-counter.is-danger  { color: #ef4444; }
            .v2-alert {
                margin-top: 8px;
                padding: 9px 12px;
                border: 1px solid rgba(239,68,68,0.35);
                border-radius: 8px;
                background: rgba(239,68,68,0.12);
                color: #fecaca;
                font-size: 13px;
            }
            .v2-preview {
                margin-top: 8px;
                padding: 9px 12px;
                border: 1px dashed rgba(99,102,241,0.3);
                border-radius: 8px;
                color: #a5b4fc;
                font-size: 13px;
                line-height: 1.5;
                min-height: 32px;
            }
            .v2-reply-target {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 10px;
                padding: 9px 14px;
                border-radius: 8px;
                background: rgba(99,102,241,0.10);
                border-left: 3px solid #6366f1;
                color: #c7d2fe;
                font-size: 13px;
                animation: v2-slide-in 0.2s ease;
            }
            .v2-reply-target em { font-style: normal; color: #e6edf3; }
            .v2-reply-target button {
                border: 0;
                background: transparent;
                color: #8b949e;
                cursor: pointer;
                font-size: 15px;
                line-height: 1;
                padding: 2px 4px;
                border-radius: 4px;
                transition: color 0.15s;
            }
            .v2-reply-target button:hover { color: #f85149; }
            @keyframes v2-slide-in {
                from { opacity: 0; transform: translateY(-6px); }
                to   { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectStyles);
    } else {
        injectStyles();
    }

    window.XalassV2 = {
        STORAGE_KEY,
        TITLE_LIMIT,
        readSettings,
        saveSettings,
        normalizeWordList,
        getAllWords,
        censorText,
        validateTextContent,
        validateTitle,
        attachTitleCounter,
        attachLivePreview,
        setReplyTarget,
        clearReplyTarget,
        getReplyTargetId,
        buildModerationScore,
        escapeHtml,
        detectBlockedContacts
    };

})();
