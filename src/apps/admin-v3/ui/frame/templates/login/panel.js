import { renderThemeSwitcher } from './theme-switcher.js';

export function renderLoginPanel() {
    return `
        <section class="admin-v3-login__panel">
            <div class="admin-v3-login__panel-head">
                <p class="sony-kicker" id="adminLoginStepEyebrow">Ingreso protegido</p>
                <h2 id="adminLoginStepTitle">Acceso de administrador</h2>
                <p id="adminLoginStepSummary">
                    Usa tu clave para abrir el workbench operativo.
                </p>
            </div>

            <div id="adminLoginStatusCard" class="admin-login-status-card" data-state="neutral">
                <strong id="adminLoginStatusTitle">Proteccion activa</strong>
                <p id="adminLoginStatusMessage">
                    El panel usa autenticacion endurecida y activos self-hosted.
                </p>
            </div>

            <form id="loginForm" class="sony-login-form" novalidate>
                <label id="adminPasswordField" class="admin-login-field" for="adminPassword">
                    <span>Contrasena</span>
                    <input id="adminPassword" type="password" required placeholder="Ingresa tu clave" autocomplete="current-password" />
                </label>
                <div id="group2FA" class="is-hidden">
                    <label id="admin2FAField" class="admin-login-field" for="admin2FACode">
                        <span>Codigo 2FA</span>
                        <input id="admin2FACode" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456" />
                    </label>
                </div>
                <div class="admin-login-actions">
                    <button id="loginBtn" type="submit">Ingresar</button>
                    <button
                        id="loginReset2FABtn"
                        type="button"
                        class="sony-login-reset is-hidden"
                        data-action="reset-login-2fa"
                    >
                        Volver
                    </button>
                </div>
                <p id="adminLoginSupportCopy" class="admin-login-support-copy">
                    Si el backend solicita un segundo paso, el flujo sigue en esta misma tarjeta.
                </p>
            </form>

            ${renderThemeSwitcher('login-theme-bar')}
        </section>
    `;
}
