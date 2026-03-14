import { renderThemeSwitcher } from './theme-switcher.js';

export function renderLoginPanel() {
    return `
        <section class="admin-v3-login__panel">
            <div class="admin-v3-login__panel-head">
                <p class="sony-kicker" id="adminLoginStepEyebrow">Admin interno</p>
                <h2 id="adminLoginStepTitle">Entre al panel operativo</h2>
                <p id="adminLoginStepSummary">
                    Aqui solo se resuelve el acceso. El estado operativo se revisa adentro, despues de iniciar sesion.
                </p>
            </div>

            <div class="admin-login-route-card">
                <p class="sony-kicker" id="adminLoginRouteEyebrow">Via activa</p>
                <strong id="adminLoginRouteTitle">OpenClaw en este equipo</strong>
                <p id="adminLoginRouteMessage">
                    El operador entra desde este laptop. Al continuar, OpenClaw abre el helper local y confirma la identidad con un codigo temporal.
                </p>
            </div>

            <div
                id="adminLoginStatusCard"
                class="admin-login-status-card admin-login-alert"
                data-state="neutral"
            >
                <strong id="adminLoginStatusTitle">Estado del acceso</strong>
                <p id="adminLoginStatusMessage">
                    Todavia no hay un intento en curso. Usa la via recomendada para abrir el admin.
                </p>
            </div>

            <form id="loginForm" class="sony-login-form" novalidate>
                <div id="legacyLoginStage">
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
                </div>
                <div id="openclawLoginStage" class="admin-openclaw-stage is-hidden" aria-live="polite">
                    <div class="admin-openclaw-stage__intro">
                        <strong id="adminOpenClawIntroTitle">Entrada en este equipo</strong>
                        <p id="adminOpenClawIntroMessage">
                            Esta ruta abre OpenClaw en este mismo equipo para confirmar la identidad del operador.
                        </p>
                    </div>
                    <div id="adminOpenClawChallengeCard" class="admin-openclaw-challenge is-hidden">
                        <div class="admin-openclaw-challenge__head">
                            <span class="admin-openclaw-challenge__eyebrow">Codigo temporal</span>
                            <strong id="adminOpenClawManualCode">-</strong>
                        </div>
                        <p id="adminOpenClawChallengeMeta">
                            Si este equipo usa helper local, el codigo activo aparecera aqui.
                        </p>
                        <div class="admin-openclaw-challenge__actions">
                            <a
                                id="adminOpenClawHelperLink"
                                class="admin-login-inline-link is-hidden"
                                href="#"
                                target="_blank"
                                rel="noopener"
                            >
                                Abrir helper otra vez
                            </a>
                        </div>
                    </div>
                </div>
                <div class="admin-login-actions">
                    <button id="loginBtn" type="submit">Continuar con OpenClaw</button>
                    <button
                        id="loginReset2FABtn"
                        type="button"
                        class="sony-login-reset is-hidden"
                        data-action="reset-login-2fa"
                    >
                        Volver
                    </button>
                </div>
                <div class="admin-login-alt-actions">
                    <button
                        id="loginFallbackToggleBtn"
                        type="button"
                        class="admin-login-inline-link is-hidden"
                        data-action="show-login-fallback"
                    >
                        Abrir contingencia
                    </button>
                    <button
                        id="loginPrimaryToggleBtn"
                        type="button"
                        class="admin-login-inline-link is-hidden"
                        data-action="show-login-primary"
                    >
                        Volver a OpenClaw
                    </button>
                </div>
            </form>

            <div class="admin-login-next-step">
                <strong>Siguiente paso</strong>
                <p id="adminLoginSupportCopy" class="admin-login-support-copy">
                    Presiona el boton principal para abrir OpenClaw en este equipo. Cuando salga el codigo temporal, confirmalo en el helper local y vuelve a esta pantalla.
                </p>
            </div>

            <p
                id="adminLoginContingencyCopy"
                class="admin-login-support-copy admin-login-support-copy-secondary is-hidden"
            >
                Si este equipo falla y el backend habilita contingencia, podras entrar con clave + 2FA.
            </p>

            ${renderThemeSwitcher('login-theme-bar')}
        </section>
    `;
}
