const STYLE_ID = 'turneroSurfaceOpsInlineStyles';

function resolveHost(target) {
    if (typeof document === 'undefined') {
        return null;
    }

    if (typeof target === 'string') {
        return (
            document.querySelector(target) || document.getElementById(target)
        );
    }

    return typeof HTMLElement !== 'undefined' && target instanceof HTMLElement
        ? target
        : null;
}

function normalizeText(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function normalizeState(value) {
    const normalized = normalizeText(value, 'info').toLowerCase();
    if (['ready', 'healthy', 'success'].includes(normalized)) {
        return 'ready';
    }
    if (['warning', 'watch', 'review'].includes(normalized)) {
        return 'warning';
    }
    if (
        ['alert', 'danger', 'fallback', 'blocked', 'hold'].includes(normalized)
    ) {
        return 'alert';
    }
    return 'info';
}

export function ensureTurneroSurfaceOpsStyles() {
    if (typeof document === 'undefined') {
        return false;
    }
    if (document.getElementById(STYLE_ID)) {
        return true;
    }

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-surface-ops__stack {
            display: grid;
            gap: 0.55rem;
            margin-top: 0.6rem;
        }
        .turnero-surface-ops__chips {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
        }
        .turnero-surface-ops__chip,
        .turnero-surface-ops-console__chip {
            display: inline-flex;
            align-items: center;
            gap: 0.38rem;
            min-height: 36px;
            padding: 0.42rem 0.68rem;
            border-radius: 999px;
            border: 1px solid rgb(15 23 32 / 12%);
            background: rgb(255 255 255 / 88%);
            color: inherit;
            font-size: 0.8rem;
            line-height: 1.2;
            box-shadow: inset 0 1px 0 rgb(255 255 255 / 50%);
        }
        .turnero-surface-ops__chip span,
        .turnero-surface-ops-console__chip span {
            opacity: 0.76;
            font-weight: 700;
            letter-spacing: 0.01em;
        }
        .turnero-surface-ops__chip strong,
        .turnero-surface-ops-console__chip strong {
            font-weight: 800;
            letter-spacing: 0.01em;
        }
        .turnero-surface-ops__chip[data-state='ready'],
        .turnero-surface-ops-console__chip[data-state='ready'] {
            border-color: rgb(22 163 74 / 24%);
            background: rgb(220 252 231 / 82%);
            color: rgb(22 101 52);
        }
        .turnero-surface-ops__chip[data-state='warning'],
        .turnero-surface-ops-console__chip[data-state='warning'] {
            border-color: rgb(180 83 9 / 24%);
            background: rgb(254 243 199 / 80%);
            color: rgb(120 53 15);
        }
        .turnero-surface-ops__chip[data-state='alert'],
        .turnero-surface-ops-console__chip[data-state='alert'] {
            border-color: rgb(190 24 93 / 22%);
            background: rgb(255 228 230 / 80%);
            color: rgb(159 18 57);
        }
        .turnero-surface-ops__banner {
            display: grid;
            gap: 0.18rem;
            padding: 0.72rem 0.82rem;
            border-radius: 16px;
            border: 1px solid rgb(180 83 9 / 18%);
            background: rgb(255 251 235 / 78%);
            color: inherit;
        }
        .turnero-surface-ops__banner[data-state='alert'] {
            border-color: rgb(190 24 93 / 18%);
            background: rgb(255 241 242 / 80%);
        }
        .turnero-surface-ops__banner strong {
            font-size: 0.92rem;
            line-height: 1.2;
        }
        .turnero-surface-ops__banner p {
            margin: 0;
            font-size: 0.82rem;
            line-height: 1.45;
            opacity: 0.88;
        }
        .turnero-surface-ops-console {
            display: grid;
            gap: 0.85rem;
        }
        .turnero-surface-ops-console__header {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            gap: 0.85rem;
            align-items: flex-start;
        }
        .turnero-surface-ops-console__header p,
        .turnero-surface-ops-console__header h3,
        .turnero-surface-ops-console__meta,
        .turnero-surface-ops-console__section h4,
        .turnero-surface-ops-console__section p {
            margin: 0;
        }
        .turnero-surface-ops-console__header h3,
        .turnero-surface-ops-console__surface-title {
            font-family: 'FrauncesSoft', serif;
            font-weight: 500;
            letter-spacing: 0.01em;
        }
        .turnero-surface-ops-console__actions,
        .turnero-surface-ops-console__surface-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
        }
        .turnero-surface-ops-console__button {
            min-height: 38px;
            padding: 0.56rem 0.84rem;
            border-radius: 999px;
            border: 1px solid rgb(15 23 32 / 12%);
            background: rgb(255 255 255 / 88%);
            color: inherit;
            font: inherit;
            cursor: pointer;
        }
        .turnero-surface-ops-console__button[data-tone='primary'] {
            border-color: rgb(15 107 220 / 22%);
            background: rgb(15 107 220 / 10%);
            color: rgb(10 67 137);
        }
        .turnero-surface-ops-console__grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 0.8rem;
        }
        .turnero-surface-ops-console__surface {
            display: grid;
            gap: 0.7rem;
            padding: 0.95rem 1rem;
            border-radius: 22px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 82%);
        }
        .turnero-surface-ops-console__surface[data-state='healthy'] {
            border-color: rgb(22 163 74 / 20%);
        }
        .turnero-surface-ops-console__surface[data-state='watch'] {
            border-color: rgb(180 83 9 / 18%);
        }
        .turnero-surface-ops-console__surface[data-state='fallback'] {
            border-color: rgb(190 24 93 / 18%);
        }
        .turnero-surface-ops-console__surface-header {
            display: flex;
            justify-content: space-between;
            gap: 0.8rem;
            align-items: flex-start;
        }
        .turnero-surface-ops-console__meta {
            font-size: 0.8rem;
            line-height: 1.45;
            opacity: 0.82;
        }
        .turnero-surface-ops-console__section {
            display: grid;
            gap: 0.35rem;
        }
        .turnero-surface-ops-console__section h4 {
            font-size: 0.78rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            opacity: 0.72;
        }
        .turnero-surface-ops-console__list {
            margin: 0;
            padding-left: 1rem;
            display: grid;
            gap: 0.26rem;
            font-size: 0.84rem;
            line-height: 1.45;
        }
        .turnero-surface-ops-console__empty {
            font-size: 0.84rem;
            line-height: 1.45;
            opacity: 0.78;
        }
        @media (max-width: 760px) {
            .turnero-surface-ops-console__header,
            .turnero-surface-ops-console__surface-header {
                flex-direction: column;
            }
        }
    `;
    document.head.appendChild(styleEl);
    return true;
}

export function mountTurneroSurfaceCheckpointChip(
    target,
    { label, value, state } = {}
) {
    const host = resolveHost(target);
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    const normalizedState = normalizeState(state);
    host.className = 'queue-ops-pilot__chip turnero-surface-ops__chip';
    host.dataset.state = normalizedState;
    host.innerHTML = `
        <span>${normalizeText(label, 'Chip')}</span>
        <strong>${normalizeText(value, '--')}</strong>
    `;
    return host;
}
