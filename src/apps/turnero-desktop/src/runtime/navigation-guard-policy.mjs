import { buildDesktopBlockedStatus } from './boot-status-contract.mjs';
import { buildDesktopReadyTransition } from './boot-lifecycle-state.mjs';
import { shouldUseKioskMode } from './window-options.mjs';

function getDesktopSurfaceToken(config = {}) {
    return (
        String(config?.surface || 'operator')
            .trim()
            .toLowerCase() || 'operator'
    );
}

export function shouldOpenDesktopSettingsShortcut(input = {}) {
    if (String(input?.type || '').toLowerCase() !== 'keydown') {
        return false;
    }

    const key = String(input?.key || '').toLowerCase();
    return key === 'f10' || ((input?.control || input?.meta) && key === ',');
}

export function getDesktopBlockedNavigationDecision({
    targetUrl = '',
    isAllowedNavigation = false,
} = {}) {
    const normalizedTargetUrl = String(targetUrl || '').trim();
    if (!normalizedTargetUrl || isAllowedNavigation) {
        return null;
    }

    return {
        preventDefault: true,
        status: buildDesktopBlockedStatus(),
    };
}

export function getDesktopRenderProcessGoneRecovery(details = {}) {
    const reason = String(details?.reason || 'unknown').trim() || 'unknown';
    return {
        logMessage: `render-process-gone: ${reason}`,
        retryReason: 'La aplicacion remota se cerro de forma inesperada',
    };
}

export function getDesktopDidFailLoadRecovery({
    errorCode = 0,
    errorDescription = '',
    validatedUrl = '',
    isMainFrame = false,
    isAllowedNavigation = false,
    config = {},
} = {}) {
    const normalizedValidatedUrl = String(validatedUrl || '').trim();
    if (!isMainFrame || !normalizedValidatedUrl || !isAllowedNavigation) {
        return null;
    }

    const normalizedDescription =
        String(errorDescription || '').trim() || 'load_failed';
    return {
        logMessage: `did-fail-load ${errorCode}: ${normalizedDescription} (${normalizedValidatedUrl})`,
        retryReason: `La superficie ${getDesktopSurfaceToken(config)} no pudo cargar (${normalizedDescription})`,
    };
}

export function getDesktopDidFinishLoadDecision({
    currentUrl = '',
    isAllowedNavigation = false,
    config = {},
} = {}) {
    const normalizedUrl = String(currentUrl || '').trim();
    if (!normalizedUrl || !isAllowedNavigation) {
        return null;
    }

    return {
        transition: buildDesktopReadyTransition(config, {
            url: normalizedUrl,
        }),
        presentation: shouldUseKioskMode(config)
            ? 'kiosk'
            : config?.launchMode === 'fullscreen'
              ? 'fullscreen'
              : 'windowed',
    };
}
