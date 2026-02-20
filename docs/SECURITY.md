# Guía de Seguridad

La seguridad es una prioridad crítica para Piel en Armonía, especialmente considerando el manejo de datos de pacientes (PII) y pagos.

## Políticas de Seguridad

### 1. Gestión de Secretos
*   Nunca almacenar claves API, contraseñas o tokens en el código fuente.
*   Utilizar variables de entorno (`.env` local, Config Vars en producción).
*   El archivo `env.php` (si se usa) está estrictamente excluido en `.gitignore`.

### 2. Protección de Datos en Reposo
Los datos sensibles almacenados en disco (`store.json`) se cifran automáticamente.
*   **Algoritmo:** Cifrado simétrico robusto (implementado en `lib/storage.php`).
*   **Clave:** `PIELARMONIA_DATA_ENCRYPTION_KEY` (Variable de entorno obligatoria en producción).
*   **Permisos:** El directorio `data/` tiene permisos `775` y un `.htaccess` que deniega todo acceso web directo (`Deny from all`).

### 3. Cabeceras de Seguridad (HTTP Headers)
La aplicación envía cabeceras de seguridad estrictas en cada respuesta (configurado en `lib/http.php`):
*   `Strict-Transport-Security` (HSTS): Fuerza HTTPS.
*   `X-Content-Type-Options: nosniff`: Evita mime-sniffing.
*   `X-Frame-Options: SAMEORIGIN`: Previene clickjacking.
*   `Content-Security-Policy` (CSP): Restringe fuentes de scripts, estilos e imágenes para mitigar XSS.

### 4. Validación de Entrada
Toda entrada de usuario se valida y sanitiza antes de ser procesada (`lib/validation.php`).
*   **Emails:** `filter_var(..., FILTER_VALIDATE_EMAIL)`
*   **Teléfonos:** Regex estricto y limpieza de caracteres no numéricos.
*   **HTML:** Escapado en salida (`htmlspecialchars`) para prevenir XSS reflejado.

### 5. Rate Limiting
La API pública está protegida contra abusos mediante límites de velocidad por IP (Ver `docs/API.md` y `lib/ratelimit.php`).

## Respuesta a Incidentes de Seguridad

Si descubres una vulnerabilidad, por favor sigue estos pasos:

1.  **NO** abras un Issue público en GitHub.
2.  Envía un reporte detallado a `seguridad@pielarmonia.com` (o al contacto técnico designado).
3.  Incluye pasos para reproducir el fallo de manera segura.
4.  Espera confirmación antes de divulgar información.

### Checklist Pre-Despliegue de Seguridad
*   [ ] `PIELARMONIA_DATA_ENCRYPTION_KEY` configurada y rotada si es necesario.
*   [ ] `PIELARMONIA_ADMIN_PASSWORD` es fuerte y única.
*   [ ] Dependencias (`npm audit`) verificadas sin vulnerabilidades críticas.
*   [ ] Permisos de archivos en servidor (`chmod`) son restrictivos (especialmente `data/`).
