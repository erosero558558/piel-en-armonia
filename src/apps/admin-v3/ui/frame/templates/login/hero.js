export function renderLoginHero() {
    return `
        <section class="admin-v3-login__hero">
            <div class="admin-v3-login__brand">
                <p class="sony-kicker">Piel en Armonia</p>
                <h1>Centro operativo claro y protegido</h1>
                <p>
                    Acceso editorial para agenda, callbacks y disponibilidad con
                    jerarquia simple y lectura rapida.
                </p>
            </div>
            <div class="admin-v3-login__facts">
                <article class="admin-v3-login__fact">
                    <span>Sesion</span>
                    <strong>Acceso administrativo aislado</strong>
                    <small>Entrada dedicada para operacion diaria.</small>
                </article>
                <article class="admin-v3-login__fact">
                    <span>Proteccion</span>
                    <strong>Clave y 2FA en la misma tarjeta</strong>
                    <small>El segundo paso aparece solo cuando el backend lo exige.</small>
                </article>
                <article class="admin-v3-login__fact">
                    <span>Entorno</span>
                    <strong>Activos self-hosted y CSP activa</strong>
                    <small>Sin dependencias remotas para estilos ni fuentes.</small>
                </article>
            </div>
        </section>
    `;
}
