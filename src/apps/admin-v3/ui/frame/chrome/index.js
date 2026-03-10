import { renderChromeBadges } from './badges.js';
import { renderChromeContext } from './context.js';
import { getChromeMetrics } from './metrics.js';
import { renderChromeSession } from './session.js';

export function renderAdminChrome(state) {
    const metrics = getChromeMetrics(state);
    renderChromeContext(state, metrics.config);
    renderChromeBadges(metrics);
    renderChromeSession(metrics.auth);
}
