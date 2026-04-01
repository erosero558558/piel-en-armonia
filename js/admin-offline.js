/**
 * js/admin-offline.js
 * S24-04: Offline Degradation Mode
 *
 * Implements a gold alert banner, disables critical actions,
 * and maintains a 5-case LRU cache via fetch monkey patching to keep the doctor operational.
 */

(function () {
    // 1. DOM Elements & State
    let bannerElement = null;
    const CACHE_PREFIX = 'ah_offline_case_';
    const CACHE_KEYS_LIST = 'ah_offline_cache_keys';
    const MAX_CACHE_SIZE = 5;

    // 2. LRU Cache for Clinical Responses
    function getCacheKeys() {
        try {
            return JSON.parse(localStorage.getItem(CACHE_KEYS_LIST) || '[]');
        } catch {
            return [];
        }
    }

    function saveCacheKeys(keys) {
        localStorage.setItem(CACHE_KEYS_LIST, JSON.stringify(keys));
    }

    function getCacheItem(key) {
        const data = localStorage.getItem(key);
        return data ? data : null; // returns raw text
    }

    function setCacheItem(key, rawJson) {
        let keys = getCacheKeys();
        
        // Remove if exists to update LRU position
        keys = keys.filter(k => k !== key);
        keys.push(key);

        // Evict oldest if exceeding capacity
        if (keys.length > MAX_CACHE_SIZE) {
            const oldest = keys.shift();
            localStorage.removeItem(oldest);
        }

        try {
            localStorage.setItem(key, rawJson);
            saveCacheKeys(keys);
        } catch(e) {
            console.warn('[Offline] LRU cache quota exceeded', e);
        }
    }

    // Identify if a URL is a clinical case fetch we want to cache
    function isClinicalCaseFetch(url) {
        if (!url || typeof url !== 'string') return false;
        // /api.php?resource=clinical-record&case_id=...
        return url.includes('resource=clinical-record') && url.includes('case_id=');
    }

    function getCaseIdFromUrl(url) {
        try {
            const parsed = new URL(url, window.location.origin);
            return parsed.searchParams.get('case_id');
        } catch {
            // fallback for relative regex matching
            const match = url.match(/[?&]case_id=([^&]+)/);
            return match ? match[1] : null;
        }
    }

    // 3. Monkey Patch fetch() for LRU offline caching
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
        const method = (args[1] && args[1].method) ? String(args[1].method).toUpperCase() : 'GET';

        // OFFLINE INTERCEPTION
        if (!navigator.onLine && method === 'GET' && isClinicalCaseFetch(url)) {
            const caseId = getCaseIdFromUrl(url);
            if (caseId) {
                const cacheKey = CACHE_PREFIX + caseId;
                const cachedData = getCacheItem(cacheKey);
                if (cachedData) {
                    console.warn(`[Offline] Serving clinical record ${caseId} from local LRU cache`);
                    return new Response(cachedData, {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            }
        }

        // ONLINE EXECUTION
        try {
            const response = await originalFetch.apply(this, args);
            
            // CACHE ON SUCCESSFUL FETCH
            if (response.ok && method === 'GET' && isClinicalCaseFetch(url)) {
                const clone = response.clone();
                clone.text().then(text => {
                    const caseId = getCaseIdFromUrl(url);
                    if (caseId) {
                        setCacheItem(CACHE_PREFIX + caseId, text);
                    }
                }).catch(e => console.error('[Offline] Error caching response', e));
            }
            
            return response;
        } catch (err) {
            // IF NETWORK FAILS UNEXPECTEDLY
            if (method === 'GET' && isClinicalCaseFetch(url)) {
                const caseId = getCaseIdFromUrl(url);
                if (caseId) {
                    const cacheKey = CACHE_PREFIX + caseId;
                    const cachedData = getCacheItem(cacheKey);
                    if (cachedData) {
                        console.warn(`[Fallback] Serving clinical record ${caseId} from local LRU cache due to fetch network error`);
                        if (!document.body.classList.contains('offline-degraded')) {
                            setOfflineUI();
                        }
                        return new Response(cachedData, {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                }
            }
            throw err;
        }
    };

    // 4. DOM MUTATORS
    function getCriticalButtons() {
        return document.querySelectorAll(`
            button[data-action="save-diagnosis"],
            button[data-action="issue-prescription"]
        `);
    }

    function setOfflineUI() {
        if (!document.body) return;
        document.body.classList.add('offline-degraded');
        
        // Ensure Banner (using the gold alert banner spec)
        if (!bannerElement) {
            bannerElement = document.createElement('div');
            bannerElement.className = 'offline-banner';
            // Styling it directly in JS to ensure it overrides everything (Gold Alert)
            Object.assign(bannerElement.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                right: '0',
                backgroundColor: 'var(--color-gold-500, #d97706)',
                color: '#fff',
                textAlign: 'center',
                padding: '12px 24px',
                fontWeight: '600',
                fontSize: '0.9rem',
                zIndex: '99999',
                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
            });
            bannerElement.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span>Modo offline degradado. Funciones de guardado están deshabilitadas temporalmente.</span>
            `;
            document.body.appendChild(bannerElement);
        } else {
            bannerElement.style.display = 'flex';
        }

        // Disable Critical Actions
        const buttons = getCriticalButtons();
        buttons.forEach(btn => {
            if (btn.hasAttribute('disabled')) return; // Already disabled (e.g. by other logic)
            btn.setAttribute('data-offline-disabled', 'true');
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            btn.dataset.originalTitle = btn.getAttribute('title') || '';
            btn.setAttribute('title', 'Sin conexión — los cambios no se guardarán');
        });
    }

    function setOnlineUI() {
        if (!document.body) return;
        document.body.classList.remove('offline-degraded');
        
        if (bannerElement) {
            bannerElement.style.display = 'none';
        }

        // Re-enable Actions
        const buttons = document.querySelectorAll('[data-offline-disabled="true"]');
        buttons.forEach(btn => {
            btn.removeAttribute('data-offline-disabled');
            btn.disabled = false;
            btn.style.opacity = '';
            btn.style.cursor = '';
            if (btn.dataset.originalTitle) {
                btn.setAttribute('title', btn.dataset.originalTitle);
            } else {
                btn.removeAttribute('title');
            }
        });
    }

    // 5. EVENT LISTENERS
    window.addEventListener('offline', setOfflineUI);
    window.addEventListener('online', setOnlineUI);

    // Initial boot check
    if (navigator.onLine === false) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setOfflineUI);
        } else {
            setOfflineUI();
        }
    }

    // Watchdog for dynamically injected buttons (Focus Mode)
    const observer = new MutationObserver((mutations) => {
        if (!navigator.onLine) {
            let shouldCheck = false;
            for (const mut of mutations) {
                if (mut.addedNodes.length > 0) {
                    shouldCheck = true;
                    break;
                }
            }
            if (shouldCheck) {
                setOfflineUI();
            }
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, { childList: true, subtree: true });
        });
    } else {
        if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    }

})();
