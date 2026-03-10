import { createSurfaceUrl } from '../config/contracts.mjs';

export function isAllowedNavigation(candidateUrl, surfaceUrl) {
    try {
        const candidate = new URL(candidateUrl);
        const allowed = new URL(surfaceUrl);
        return (
            candidate.origin === allowed.origin &&
            candidate.pathname === allowed.pathname
        );
    } catch (_error) {
        return false;
    }
}

export function createNavigationPolicy(config) {
    const surfaceUrl = createSurfaceUrl(config);
    return {
        surfaceUrl,
        isAllowedNavigation(candidateUrl) {
            return isAllowedNavigation(candidateUrl, surfaceUrl);
        },
    };
}
