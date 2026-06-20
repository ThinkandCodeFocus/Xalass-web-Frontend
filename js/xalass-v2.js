// ==========================================
// CONFIGURATION ET PARAMÈTRES PAR DÉFAUT
// ==========================================
const DEFAULT_SETTINGS = {
    // Liste locale pour le Wolof (que l'IA maîtrise moins bien)
    wolofVulgarWords: ['saga', 'kat', 'ndey', 'bay', 'thiapathiapa', 'saayi', 'khadj'],
    languages: ['wolof', 'francais', 'anglais'],
    updatedAt: new Date().toISOString()
};

// Configuration de l'API OpenAI (Remplace par ta vraie clé)
// NOTE: Il est fortement recommandé d'appeler l'API OpenAI depuis un backend
// pour ne pas exposer la clé dans le frontend. Tu peux fournir une URL
// de proxy backend via `window.MODERATION_URL`.
const OPENAI_API_KEY = ""; // place ta clé côté serveur, pas ici
const BACKEND_MODERATION_URL = (typeof window !== 'undefined' && window.MODERATION_URL) ? window.MODERATION_URL : null;

// ==========================================
// FONCTIONS DE MODÉRATION (MÉTHODE HYBRIDE)
// ==========================================

/**
 * Étape 1 : Appel à l'IA de modération gratuite d'OpenAI
 * Gère le Français et l'Anglais (Insultes, menaces, suicide, terrorisme...)
 */
async function checkWithAI(textToCheck) {
    try {
        // Si un backend est configuré, on l'utilise (recommandé)
        if (BACKEND_MODERATION_URL) {
            const resp = await fetch(BACKEND_MODERATION_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ input: textToCheck })
            });
            if (!resp.ok) {
                const body = await resp.text().catch(() => null);
                throw new Error(`Erreur proxy moderation: ${resp.status} ${body || ''}`);
            }
            const data = await resp.json();
            const results = data.results ? data.results[0] : (data[0] || data);
            if (results && results.flagged) {
                const brokenCategories = Object.keys(results.categories || {}).filter(cat => results.categories[cat]);
                return { safe: false, reason: "IA_MODERATION_BLOCKED", categories: brokenCategories };
            }
            return { safe: true };
        }

        // Sans backend, vérification basique de la clé côté client
        if (!OPENAI_API_KEY || typeof OPENAI_API_KEY !== 'string' || OPENAI_API_KEY.length < 10) {
            console.warn('OpenAI API key non configurée côté client. Ignoring AI moderation.');
            return { safe: true, warning: 'no_api_key_client' };
        }

        const response = await fetch("https://api.openai.com/v1/moderations", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({ input: textToCheck })
        });

        if (!response.ok) {
            const body = await response.text().catch(() => null);
            throw new Error(`Erreur API OpenAI: ${response.status} ${body || ''}`);
        }

        const data = await response.json();
        const results = data.results && data.results[0] ? data.results[0] : data[0] || data;

        if (results && results.flagged) {
            const brokenCategories = Object.keys(results.categories || {}).filter(cat => results.categories[cat]);
            return { safe: false, reason: "IA_MODERATION_BLOCKED", categories: brokenCategories };
        }

        return { safe: true };

    } catch (error) {
        console.error("Erreur lors de l'appel à l'IA de modération:", error);
        // En cas de panne de l'IA, on laisse passer ou on bloque selon ta politique de sécurité
        return { safe: true, warning: "AI_offline_fallback_to_local_only" };
    }
}

/**
 * Étape 2 : Fonction principale Hybride (Local Wolof + IA)
 * C'est cette fonction que tu vas appeler dans ton application
 */
async function validateContent(text) {
    if (!text || typeof text !== 'string') {
        return { safe: true };
    }

    const lowerText = text.toLowerCase();

    // 1. VÉRIFICATION LOCALE (Rapidité absolue pour le Wolof)
    const hasWolofInsult = DEFAULT_SETTINGS.wolofVulgarWords.some(word => lowerText.includes(word));
    
    if (hasWolofInsult) {
        return { 
            safe: false, 
            reason: "LOCAL_WOLOF_FILTER", 
            detail: "Le texte contient des termes vulgaires en Wolof." 
        };
    }

    // 2. VÉRIFICATION PAR L'IA (Pour les milliers de mots en FR/EN et le contexte grave)
    const aiResult = await checkWithAI(text);
    
    if (!aiResult.safe) {
        return {
            safe: false,
            reason: aiResult.reason,
            detail: `Bloqué par l'IA pour : ${aiResult.categories.join(', ')}`
        };
    }

    // Si tout est propre
    return { safe: true };
}


// ==========================================
// EXEMPLES D'UTILISATION (TESTS) - DEV ONLY
// Ne pas exécuter automatiquement en production. Pour lancer les tests
// localement : définis `window.XALASS_DEBUG = true` dans la console
// ou utilise `location.hostname === 'localhost'`.

async function runLocalTests() {
    try {
        console.log('XalassV2: running local tests (dev only)');
        const testWolof = await validateContent("C'est un vrai saayi saayi celui-là");
        console.log('testWolof', testWolof);
        const testGrave = await validateContent("I am going to kill you tomorrow morning");
        console.log('testGrave', testGrave);
        const testPrope = await validateContent("Bonjour, j'espère que vous allez bien !");
        console.log('testPrope', testPrope);
    } catch (err) {
        console.error('Erreur lors des tests locaux:', err);
    }
}

if (typeof window !== 'undefined') {
    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (isLocalhost || window.XALASS_DEBUG) {
        runLocalTests();
    }
}


// /* =====================================
//    Xalass V2 - Moderation, validation et aides UI
//    ===================================== */

// (function () {
//     const STORAGE_KEY = 'xalass_v2_moderation_settings';
//     const TITLE_LIMIT = 80;

//     const DEFAULT_SETTINGS = {
//         vulgarWords: ['merde', 'putain', 'connard', 'salope', 'fuck', 'shit'],
//         graveWords: ['menace', 'suicide', 'terrorisme', 'viol', 'meurtre'],
//         languages: ['wolof', 'francais', 'anglais'],
//         updatedAt: new Date().toISOString()
//     };

//     function readSettings() {
//         try {
//             const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
//             if (!saved || typeof saved !== 'object') return { ...DEFAULT_SETTINGS };
//             return {
//                 ...DEFAULT_SETTINGS,
//                 ...saved,
//                 vulgarWords: Array.isArray(saved.vulgarWords) ? saved.vulgarWords : DEFAULT_SETTINGS.vulgarWords,
//                 graveWords: Array.isArray(saved.graveWords) ? saved.graveWords : DEFAULT_SETTINGS.graveWords
//             };
//         } catch (error) {
//             return { ...DEFAULT_SETTINGS };
//         }
//     }

//     function saveSettings(settings) {
//         const normalized = {
//             ...readSettings(),
//             ...settings,
//             vulgarWords: normalizeWordList(settings.vulgarWords),
//             graveWords: normalizeWordList(settings.graveWords),
//             updatedAt: new Date().toISOString()
//         };
//         localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
//         return normalized;
//     }

//     function normalizeWordList(words) {
//         if (typeof words === 'string') {
//             words = words.split(/[\n,;]/);
//         }
//         if (!Array.isArray(words)) return [];
//         return [...new Set(words.map(word => String(word).trim().toLowerCase()).filter(Boolean))];
//     }

//     function normalizeText(text) {
//         return String(text || '')
//             .normalize('NFD')
//             .replace(/[\u0300-\u036f]/g, '')
//             .replace(/[@4]/g, 'a')
//             .replace(/[3]/g, 'e')
//             .replace(/[1!|]/g, 'i')
//             .replace(/[0]/g, 'o')
//             .replace(/[$5]/g, 's')
//             .toLowerCase();
//     }

//     function escapeRegex(value) {
//         return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
//     }

//     function escapeHtml(value) {
//         const node = document.createElement('div');
//         node.textContent = value == null ? '' : String(value);
//         return node.innerHTML;
//     }

//     function detectBlockedContacts(text) {
//         const value = String(text || '');
//         const urlPattern = /(https?:\/\/|www\.|[a-z0-9-]+(\[\.]|\(\.\)|\s+dot\s+|\.)[a-z]{2,})(\S*)/i;
//         const phonePattern = /(\+?\d[\d\s().-]{7,}\d)/;
//         const hits = [];
//         if (urlPattern.test(value)) hits.push('lien');
//         if (phonePattern.test(value)) hits.push('numero de telephone');
//         return hits;
//     }

//     function censorText(text) {
//         let output = String(text || '');
//         const settings = readSettings();
//         const words = [...settings.vulgarWords, ...settings.graveWords];

//         words.forEach(word => {
//             if (!word) return;
//             const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
//             output = output.replace(regex, match => '*'.repeat(Math.max(3, match.length)));
//         });

//         return output;
//     }

//     function findModerationWords(text) {
//         const normalized = normalizeText(text);
//         const settings = readSettings();
//         const vulgar = settings.vulgarWords.filter(word => normalized.includes(normalizeText(word)));
//         const grave = settings.graveWords.filter(word => normalized.includes(normalizeText(word)));
//         return { vulgar, grave };
//     }

//     function validateTextContent(text, options = {}) {
//         const errors = [];
//         const blocked = detectBlockedContacts(text);
//         if (blocked.length) {
//             errors.push(`Les ${blocked.join(' et ')} ne sont pas autorises pour proteger l'anonymat.`);
//         }

//         if (options.requireText && !String(text || '').trim()) {
//             errors.push('Le contenu ne peut pas etre vide.');
//         }

//         return {
//             ok: errors.length === 0,
//             errors,
//             sanitized: censorText(text),
//             matches: findModerationWords(text)
//         };
//     }

//     function validateTitle(title) {
//         const value = String(title || '').trim();
//         const errors = [];
//         if (!value) errors.push('Remplis le titre de ton histoire.');
//         if (value.length > TITLE_LIMIT) errors.push(`Le titre est limite a ${TITLE_LIMIT} caracteres.`);
//         return { ok: errors.length === 0, errors, remaining: TITLE_LIMIT - value.length };
//     }

//     function attachTitleCounter(input, counter) {
//         if (!input || !counter) return;
//         input.setAttribute('maxlength', String(TITLE_LIMIT));

//         const update = () => {
//             const remaining = TITLE_LIMIT - input.value.length;
//             counter.textContent = `${remaining} caracteres restants`;
//             counter.classList.toggle('is-warning', remaining <= 20 && remaining > 8);
//             counter.classList.toggle('is-danger', remaining <= 8);
//         };

//         input.addEventListener('input', update);
//         update();
//     }

//     function attachLivePreview(input, preview, alertBox) {
//         if (!input || !preview) return;

//         const update = () => {
//             const validation = validateTextContent(input.value);
//             preview.innerHTML = escapeHtml(validation.sanitized || '').replace(/\n/g, '<br>');
//             if (alertBox) {
//                 alertBox.textContent = validation.errors.join(' ');
//                 alertBox.style.display = validation.errors.length ? 'block' : 'none';
//             }
//         };

//         input.addEventListener('input', update);
//         update();
//     }

//     function buildModerationScore(text, reportCount = 0, viewCount = 0) {
//         const matches = findModerationWords(text);
//         const reportRatio = viewCount > 0 ? reportCount / viewCount : 0;
//         const score = Math.min(1, (matches.vulgar.length * 0.12) + (matches.grave.length * 0.24) + (reportCount * 0.06) + (reportRatio * 0.35));
//         let action = 'Aucune action';
//         if (score >= 0.8) action = 'Suppression automatique';
//         else if (score >= 0.6) action = 'Masquage temporaire';
//         else if (score >= 0.3) action = 'Revue manuelle';
//         return { score, action, matches };
//     }

//     function injectStyles() {
//         if (document.getElementById('xalass-v2-styles')) return;
//         const style = document.createElement('style');
//         style.id = 'xalass-v2-styles';
//         style.textContent = `
//             .v2-counter {
//                 margin-top: 8px;
//                 color: #34d399;
//                 font-size: 12px;
//                 font-weight: 600;
//             }
//             .v2-counter.is-warning { color: #f59e0b; }
//             .v2-counter.is-danger { color: #ef4444; }
//             .v2-alert {
//                 margin-top: 10px;
//                 padding: 10px 12px;
//                 border: 1px solid rgba(239, 68, 68, 0.35);
//                 border-radius: 8px;
//                 background: rgba(239, 68, 68, 0.12);
//                 color: #fecaca;
//                 font-size: 13px;
//             }
//             .v2-preview {
//                 min-height: 34px;
//                 margin-top: 10px;
//                 padding: 10px 12px;
//                 border: 1px dashed rgba(99, 102, 241, 0.35);
//                 border-radius: 8px;
//                 color: #a5b4fc;
//                 font-size: 13px;
//                 line-height: 1.5;
//             }
//             .v2-reply-target {
//                 display: flex;
//                 align-items: center;
//                 justify-content: space-between;
//                 gap: 12px;
//                 margin-bottom: 10px;
//                 padding: 10px 12px;
//                 border-radius: 8px;
//                 background: rgba(99, 102, 241, 0.10);
//                 border: 1px solid rgba(99, 102, 241, 0.25);
//                 color: #c7d2fe;
//                 font-size: 13px;
//             }
//             .v2-reply-target button {
//                 border: 0;
//                 background: transparent;
//                 color: inherit;
//                 cursor: pointer;
//                 font-weight: 700;
//             }
//             .v2-admin-grid {
//                 display: grid;
//                 grid-template-columns: minmax(260px, 1fr) minmax(260px, 1fr);
//                 gap: 18px;
//             }
//             .v2-admin-panel {
//                 background: rgba(22, 27, 34, 0.94);
//                 border: 1px solid rgba(99, 102, 241, 0.20);
//                 border-radius: 8px;
//                 padding: 18px;
//             }
//             .v2-admin-panel textarea,
//             .v2-admin-panel input,
//             .v2-admin-panel select {
//                 width: 100%;
//                 border-radius: 8px;
//                 border: 1px solid rgba(99, 102, 241, 0.25);
//                 background: #0d1117;
//                 color: #e6edf3;
//                 padding: 11px 12px;
//             }
//             .v2-admin-panel textarea { min-height: 170px; resize: vertical; }
//             .v2-admin-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
//             .v2-admin-btn {
//                 border: 0;
//                 border-radius: 8px;
//                 padding: 10px 14px;
//                 background: #6366f1;
//                 color: #fff;
//                 font-weight: 700;
//                 cursor: pointer;
//             }
//             .v2-admin-btn.secondary { background: #30363d; }
//             .v2-score {
//                 display: inline-flex;
//                 align-items: center;
//                 justify-content: center;
//                 min-width: 68px;
//                 padding: 6px 10px;
//                 border-radius: 999px;
//                 background: rgba(16, 185, 129, 0.14);
//                 color: #34d399;
//                 font-weight: 800;
//             }
//             @media (max-width: 760px) {
//                 .v2-admin-grid { grid-template-columns: 1fr; }
//             }
//         `;
//         document.head.appendChild(style);
//     }

//     if (document.readyState === 'loading') {
//         document.addEventListener('DOMContentLoaded', injectStyles);
//     } else {
//         injectStyles();
//     }

//     window.XalassV2 = {
//         STORAGE_KEY,
//         TITLE_LIMIT,
//         readSettings,
//         saveSettings,
//         normalizeWordList,
//         censorText,
//         validateTextContent,
//         validateTitle,
//         attachTitleCounter,
//         attachLivePreview,
//         buildModerationScore,
//         escapeHtml
//     };
// })();


