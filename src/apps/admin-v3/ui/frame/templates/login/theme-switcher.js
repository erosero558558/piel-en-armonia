import { icon } from '../../../../shared/ui/icons.js';

export function renderThemeSwitcher(className) {
    return `
        <div class="sony-theme-switcher ${className}" role="group" aria-label="Tema">
            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="light">${icon('sun')}</button>
            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="dark">${icon('moon')}</button>
            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="system">${icon('system')}</button>
        </div>
    `;
}
