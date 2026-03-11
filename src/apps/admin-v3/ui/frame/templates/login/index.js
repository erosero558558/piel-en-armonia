import { renderLoginHero } from './hero.js';
import { renderLoginPanel } from './panel.js';
import { renderThemeSwitcher } from './theme-switcher.js';

export function renderLoginTemplate() {
    return `
        <div class="admin-v3-login">
            ${renderLoginHero()}
            ${renderLoginPanel()}
        </div>
    `;
}

export function renderHeaderThemeSwitcher() {
    return renderThemeSwitcher('admin-theme-switcher-header');
}
