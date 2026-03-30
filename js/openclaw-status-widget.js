/**
 * openclaw-status-widget.js
 * Widget de estado del Copiloto Clínico OpenClaw para el panel admin de Aurora Derm.
 *
 * Uso: incluir este script en admin.html. Expone window.OpenclawStatusWidget.
 * El widget se monta automáticamente si existe un elemento con id="openclaw-status-widget".
 */

'use strict';

(function () {
    // ── Configuración ─────────────────────────────────────────────────────────
    const CONFIG = {
        statusEndpoint: '/api.php?resource=openclaw-router-status',
        chatEndpoint: '/api.php?resource=openclaw-chat',
        pollIntervalMs: 30_000,
        containerId: 'openclaw-status-widget',
        setupUrl: '/admin-openclaw-setup.html',
    };

    // ── Estilos inyectados ─────────────────────────────────────────────────────
    const CSS = `
        #openclaw-status-widget {
            font-family: 'Inter', system-ui, sans-serif;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.10);
            border-radius: 16px;
            padding: 18px 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            min-width: 260px;
        }
        #openclaw-status-widget .ocw-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
        }
        #openclaw-status-widget .ocw-title {
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: rgba(255,255,255,0.45);
            margin: 0;
        }
        #openclaw-status-widget .ocw-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            font-weight: 600;
            padding: 4px 10px;
            border-radius: 999px;
            background: rgba(255,255,255,0.07);
            color: rgba(255,255,255,0.6);
            transition: background 0.25s, color 0.25s;
        }
        #openclaw-status-widget .ocw-badge.ok {
            background: rgba(34,197,94,0.15);
            color: #4ade80;
        }
        #openclaw-status-widget .ocw-badge.warn {
            background: rgba(234,179,8,0.15);
            color: #facc15;
        }
        #openclaw-status-widget .ocw-badge.err {
            background: rgba(239,68,68,0.13);
            color: #f87171;
        }
        #openclaw-status-widget .ocw-pill {
            display: inline-block;
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: currentColor;
            flex-shrink: 0;
        }
        #openclaw-status-widget .ocw-rows {
            display: flex;
            flex-direction: column;
            gap: 7px;
        }
        #openclaw-status-widget .ocw-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
        }
        #openclaw-status-widget .ocw-label {
            color: rgba(255,255,255,0.4);
        }
        #openclaw-status-widget .ocw-value {
            color: rgba(255,255,255,0.75);
            font-weight: 500;
        }
        #openclaw-status-widget .ocw-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        #openclaw-status-widget .ocw-btn {
            flex: 1;
            min-width: 0;
            padding: 8px 12px;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.12);
            background: rgba(255,255,255,0.06);
            color: rgba(255,255,255,0.75);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            text-align: center;
            transition: background 0.18s, color 0.18s;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            white-space: nowrap;
        }
        #openclaw-status-widget .ocw-btn:hover {
            background: rgba(255,255,255,0.12);
            color: #fff;
        }
        #openclaw-status-widget .ocw-btn.primary {
            background: rgba(99,102,241,0.25);
            border-color: rgba(99,102,241,0.4);
            color: #a5b4fc;
        }
        #openclaw-status-widget .ocw-btn.primary:hover {
            background: rgba(99,102,241,0.4);
            color: #e0e7ff;
        }
        #openclaw-status-widget .ocw-icon {
            font-size: 13px;
        }
        @keyframes ocw-spin {
            to { transform: rotate(360deg); }
        }
        #openclaw-status-widget .ocw-loading .ocw-pill {
            animation: ocw-spin 1s linear infinite;
            border-radius: 0;
            background: none;
            border: 2px solid currentColor;
            border-top-color: transparent;
            width: 8px;
            height: 8px;
        }
    `;

    // ── Helpers de render ──────────────────────────────────────────────────────
    function injectStyles() {
        if (document.getElementById('openclaw-status-widget-css')) return;
        const style = document.createElement('style');
        style.id = 'openclaw-status-widget-css';
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    function tierLabel(tier) {
        const map = { tier1: 'Tier 1 — Codex', tier2: 'Tier 2 — OpenRouter', tier3: 'Tier 3 — Local', degraded: 'Modo degradado' };
        return map[tier] || tier || '—';
    }

    function providerLabel(provider) {
        const map = { openclaw_chatgpt: 'ChatGPT Custom GPT', openrouter: 'OpenRouter', local: 'Local (fallback)', openclaw_queue: 'Cola OpenClaw' };
        return map[provider] || provider || '—';
    }

    function timeSince(isoDate) {
        if (!isoDate) return '—';
        const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
        if (diff < 60) return `hace ${diff}s`;
        if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
        return `hace ${Math.floor(diff / 3600)}h`;
    }

    // ── Estado ──────────────────────────────────────────────────────────────
    let _state = {
        status: 'loading', // loading | ok | warn | err
        tier: null,
        provider: null,
        lastCheck: null,
        detail: '',
    };

    function setState(patch) {
        _state = { ..._state, ...patch };
        render();
    }

    // ── Fetch de estado ─────────────────────────────────────────────────────
    async function fetchStatus() {
        try {
            const resp = await fetch(CONFIG.statusEndpoint, {
                headers: { Accept: 'application/json' },
                cache: 'no-store',
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            const router = data.router || data;
            const activeTier = router.activeTier || router.tier || null;
            const ok = router.ok !== false;

            setState({
                status: ok ? 'ok' : 'warn',
                tier: activeTier,
                provider: router.provider || router.activeProvider || null,
                lastCheck: new Date().toISOString(),
                detail: ok ? '' : (router.reason || 'Sin tiers disponibles'),
            });
        } catch (err) {
            setState({
                status: 'err',
                tier: null,
                provider: null,
                lastCheck: new Date().toISOString(),
                detail: err.message || 'Sin conexión',
            });
        }
    }

    // ── Render ──────────────────────────────────────────────────────────────
    function render() {
        const container = document.getElementById(CONFIG.containerId);
        if (!container) return;

        const { status, tier, provider, lastCheck, detail } = _state;

        const badgeClass = status === 'loading' ? 'ocw-loading' : status;
        const badgeText = {
            loading: 'Verificando…',
            ok: 'Conectado',
            warn: 'Degradado',
            err: 'Sin conexión',
        }[status] || status;

        const rows = [];
        if (tier) rows.push(['Tier activo', tierLabel(tier)]);
        if (provider) rows.push(['Proveedor', providerLabel(provider)]);
        if (detail) rows.push(['Estado', detail]);
        rows.push(['Última verificación', timeSince(lastCheck)]);

        container.innerHTML = `
            <div class="ocw-header">
                <p class="ocw-title">🤖 OpenClaw Copiloto</p>
                <span class="ocw-badge ${badgeClass}">
                    <span class="ocw-pill"></span>
                    ${badgeText}
                </span>
            </div>
            <div class="ocw-rows">
                ${rows.map(([l, v]) => `
                    <div class="ocw-row">
                        <span class="ocw-label">${l}</span>
                        <span class="ocw-value">${v}</span>
                    </div>`).join('')}
            </div>
            <div class="ocw-actions">
                <button class="ocw-btn" id="ocw-btn-refresh" title="Verificar conexión ahora">
                    <span class="ocw-icon">🔄</span> Verificar
                </button>
                <a class="ocw-btn primary" href="${CONFIG.setupUrl}" id="ocw-btn-setup" title="Cómo usar OpenClaw">
                    <span class="ocw-icon">⚙️</span> Configurar
                </a>
            </div>
        `;

        document.getElementById('ocw-btn-refresh')?.addEventListener('click', () => {
            setState({ status: 'loading', detail: '' });
            fetchStatus();
        });
    }

    // ── Inicio ───────────────────────────────────────────────────────────────
    function init() {
        injectStyles();
        setState({ status: 'loading' });
        fetchStatus();
        setInterval(fetchStatus, CONFIG.pollIntervalMs);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Exponer API pública
    window.OpenclawStatusWidget = {
        refresh: () => { setState({ status: 'loading' }); return fetchStatus(); },
        getState: () => ({ ..._state }),
    };
})();
