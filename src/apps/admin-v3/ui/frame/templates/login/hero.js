export function renderLoginHero() {
    return `
        <section class="admin-v3-login__hero">
            <div class="admin-v3-login__brand">
                <p class="sony-kicker">Piel en Armonia</p>
                <h1>Entre aqui al admin operativo</h1>
                <p>
                    Esta portada solo ordena el acceso. Despues se abren cola,
                    agenda, historial clinico y herramientas internas segun el
                    perfil del operador.
                </p>
            </div>
            <div class="admin-v3-login__facts">
                <article class="admin-v3-login__fact">
                    <span>Despues de entrar</span>
                    <strong>Cola, agenda e historial quedan en una sola consola</strong>
                    <small>El acceso abre el panel interno que usa recepcion y consultorio durante la operacion.</small>
                </article>
                <article class="admin-v3-login__fact">
                    <span>Via correcta hoy</span>
                    <strong>OpenClaw manda; helper o navegador dependen del entorno</strong>
                    <small>La tarjeta derecha le dice si este equipo entra con helper local o con redireccion web.</small>
                </article>
                <article class="admin-v3-login__fact">
                    <span>Si algo falla</span>
                    <strong>Clave + 2FA aparece solo como contingencia</strong>
                    <small>No compite con la ruta principal. Solo se muestra cuando el backend la habilita.</small>
                </article>
            </div>
        </section>
    `;
}
