# Aurora Derm - Security Governance

## Políticas Defensivas HTTP (Epic S28-09)

Las políticas de red de Aurora Derm están rigurosamente implementadas a nivel capa de proxy reverso (`ops/caddy/Caddyfile`) para garantizar un escudo estricto e infranqueable a la superficie de ataque del cliente. Las configuraciones aseguran las interacciones con el ecosistema web, incluyendo pasatiempos, telemedicina, y control administrativo.

### HTTP Headers Activos

1. **`Permissions-Policy`**
   - **Baseline**: `camera=(), microphone=(), geolocation=()`
   - **Propósito**: Deniega por completo el acceso a APIs de sensores en toda la plataforma por defecto, evitando escenarios de compromiso en los que XSS malicioso intente iniciar streamings en segundo plano. 
   - **Excepciones**: En la ruta `@telemedicina` (`/telemedicina`), la política es anulada por `camera=(self), microphone=(self)` asegurando que únicamente los iframes y el documento del mismo origen puedan invocar un `getUserMedia()` seguro.

2. **`Referrer-Policy`**
   - **Valor**: `strict-origin-when-cross-origin`
   - **Propósito**: Retiene los URLs completos (`query strings`, identificadores, tokens o caseIds de pacientes) durante navegaciones *mismo-origen* (apoyando analíticas integradas en base-uri 'self'), pero omite explícitamente el volcado de rutas sensible a terceros cuando se redirige tráfico originado desde Aurora Derm.

3. **`Cross-Origin-Opener-Policy (COOP)`**
   - **Valor**: `same-origin`
   - **Propósito**: Fuerzas las páginas servidas de Aurora Derm (particularmente los tableros de operadores con variables en memoria del V8 JS Engine) en contextos de navegación asilados, rompiendo conexiones lógicas `window.opener`. Esto precluye y desactiva amenazas side-channel (como Spectre, Meltdown) protegiendo el historial médico.

4. **`X-XSS-Protection`**
   - **Valor**: `1; mode=block`
   - **Propósito**: Bloqueo agresivo del navegador si detecta reflexión de parámetros en el DOM.

5. **`X-Frame-Options`**
   - **Valor**: `SAMEORIGIN`
   - **Propósito**: Protege toda vista generada de sufrir un Clickjacking embed.

6. **`Strict-Transport-Security (HSTS)`**
   - **Valor**: `max-age=31536000; includeSubDomains`
   - **Propósito**: Fuerza 1 año agresivo de conexiones HTTPS a todo cliente que nos haya visitado previamente previniendo degradaciones a HTTP llano, o exploits de envenenamiento de red local.
