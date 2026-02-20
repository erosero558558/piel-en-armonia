# Runbooks Operacionales - Piel en Armonía

Este documento detalla los procedimientos estándar para la operación, despliegue y respuesta a incidentes del sistema Piel en Armonía.

## 1. Despliegue (Deployment)

Para detalles técnicos profundos, ver `DESPLIEGUE-PIELARMONIA.md`.

### 1.1 Despliegue Automático (Recomendado)
El repositorio cuenta con un flujo de GitHub Actions (`.github/workflows/deploy-hosting.yml`) que se dispara al hacer push a la rama `main`.

**Pasos:**
1.  Realizar cambios en una rama de `feature`.
2.  Crear Pull Request y fusionar a `main`.
3.  Verificar la ejecución del Action en la pestaña "Actions" de GitHub.
4.  Una vez completado (verde), ejecutar la validación post-despliegue.

### 1.2 Despliegue Manual (FTP)
Si el despliegue automático falla, se puede subir manualmente.

**Pasos:**
1.  Ejecutar `npm run bundle:deploy` para generar el paquete ZIP en `_deploy_bundle/`.
2.  Conectarse al servidor FTP (credenciales en gestor de contraseñas del equipo).
3.  Subir el contenido del ZIP a `public_html/`.
4.  **Importante:** No sobrescribir la carpeta `data/` si ya contiene datos de producción.

### 1.3 Validación Post-Despliegue
Después de cualquier despliegue, ejecutar el script de verificación:

```powershell
.\GATE-POSTDEPLOY.ps1 -Domain "https://pielarmonia.com"
```

Esto verificará:
*   Estado HTTP 200 en páginas clave.
*   Respuesta de la API (`/health`).
*   Configuración de seguridad (Headers).

---

## 2. Respuesta a Incidentes (Emergency Response)

### 2.1 Sitio Caído (HTTP 500 / Timeout)
**Síntoma:** El sitio no carga o muestra error de servidor.

**Acciones:**
1.  **Verificar Logs:** Acceder por FTP y revisar `php.log` o `error_log` en la raíz.
2.  **Health Check:** Consultar `https://pielarmonia.com/api.php?resource=health` para ver si la API responde JSON.
3.  **Revertir:** Si fue tras un despliegue, volver a desplegar la versión anterior (revert commit en Git y push).
4.  **Infraestructura:** Verificar estado del proveedor de hosting.

### 2.2 Corrupción de Datos
**Síntoma:** Datos faltantes, citas erróneas, JSON inválido en `store.json`.

**Acciones:**
1.  **Detener Escrituras:** Renombrar `api.php` temporalmente o poner el sitio en mantenimiento para evitar nuevas escrituras.
2.  **Evaluar Daño:** Descargar `data/store.json` y validar su sintaxis JSON.
3.  **Restaurar:** Seguir el procedimiento de **Disaster Recovery** (ver `docs/DISASTER_RECOVERY.md`).

### 2.3 Fallo en Pagos (Stripe)
**Síntoma:** Usuarios reportan que no pueden pagar o citas no se confirman.

**Acciones:**
1.  **Verificar Config:** `GET /payment-config` debe devolver `enabled: true`.
2.  **Stripe Dashboard:** Verificar si hay errores en los logs de Stripe (API keys expiradas, webhooks fallidos).
3.  **Logs de Auditoría:** Revisar `data/audit.log` buscando eventos `stripe.webhook_failed`.

### 2.4 Chatbot No Responde
**Síntoma:** El chat se queda cargando o da error.

**Acciones:**
1.  **Verificar Figo:** Consultar `https://pielarmonia.com/figo-chat.php`. Debe devolver diagnóstico.
2.  **Reiniciar:** No aplica (PHP stateless), pero revisar si la variable de entorno `FIGO_CHAT_ENDPOINT` es correcta.

---

## 3. Tareas Rutinarias (Routine Tasks)

### 3.1 Monitoreo Diario
*   Visitar el sitio y verificar carga rápida.
*   Verificar que `https://pielarmonia.com/api.php?resource=health` esté OK.

### 3.2 Backups y Verificacion
El sistema mantiene backups rotativos en `data/backups/` al escribir `store.json`. Adicionalmente, se recomienda ejecutar verificaciones y replicacion offsite por cron.

**Cron recomendado (America/Guayaquil):**
```bash
10 3 * * * curl -s "https://pielarmonia.com/cron.php?action=backup-health&token=YOUR_CRON_SECRET"
20 3 * * * curl -s "https://pielarmonia.com/cron.php?action=backup-offsite&token=YOUR_CRON_SECRET"

# Alternativa recomendada (sin token en URL):
curl -s "https://pielarmonia.com/cron.php?action=backup-health" -H "Authorization: Bearer YOUR_CRON_SECRET"
curl -s "https://pielarmonia.com/cron.php?action=backup-offsite" -H "X-Cron-Token: YOUR_CRON_SECRET"
```

**Prueba manual (dry run offsite):**
```bash
curl -s "https://pielarmonia.com/cron.php?action=backup-offsite&dryRun=1&token=YOUR_CRON_SECRET"
curl -s "https://pielarmonia.com/cron.php?action=backup-offsite&dryRun=1" -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Variables requeridas para offsite real:**
* `PIELARMONIA_BACKUP_OFFSITE_URL`
* `PIELARMONIA_BACKUP_OFFSITE_TOKEN` (opcional)
* `PIELARMONIA_BACKUP_OFFSITE_TOKEN_HEADER` (opcional)
* `PIELARMONIA_BACKUP_MAX_AGE_HOURS` (opcional)
* `PIELARMONIA_BACKUP_LOCAL_REPLICA` (opcional, default `true`)

Si no configuras endpoint remoto, `backup-offsite` replica localmente en `data/backups/offsite-local/`.

Para réplica remota real:
* Publica `backup-receiver.php` en el servidor destino.
* Configura `PIELARMONIA_BACKUP_RECEIVER_TOKEN` en destino.
* Configura en origen:
  `PIELARMONIA_BACKUP_OFFSITE_URL=https://DESTINO/backup-receiver.php`
  `PIELARMONIA_BACKUP_OFFSITE_TOKEN=<mismo_token>`
* Usa `CONFIGURAR-BACKUP-OFFSITE.ps1` para generar token y comandos.

### 3.3 Revisión de Auditoría
Revisar `data/audit.log` semanalmente en busca de:
*   Accesos no autorizados (`api.unauthorized`).
*   Intentos de fuerza bruta.
*   Errores recurrentes de la API.

---

## 4. Monitoreo y Rendimiento

Utilizar los scripts de PowerShell incluidos en el repositorio para métricas.

*   **Latencia:** `.\BENCH-API-PRODUCCION.ps1` mide el tiempo de respuesta de la API.
*   **Disponibilidad:** `.\SMOKE-PRODUCCION.ps1` realiza un recorrido rápido por las URLs principales.

---

## 5. Procedimiento de Rollback

### 5.1 Revertir Código (Deploy Fallido)
Si un despliegue introduce errores críticos (pantalla blanca, errores 500 generalizados), se debe revertir el código a la versión estable anterior.

**Método A: Revertir vía GitHub (Recomendado)**
1.  Identificar el commit problemático en la historia de `main`.
2.  Crear un revert commit:
    ```bash
    git revert <commit-hash>
    git push origin main
    ```
3.  Esto disparará automáticamente el workflow de despliegue (`deploy-hosting.yml`).
4.  Monitorear la pestaña "Actions" en GitHub hasta que el deploy finalice (verde).

**Método B: Revertir Manual (Emergencia)**
Si GitHub Actions no funciona:
1.  Localizar el backup local o checkout del commit anterior.
2.  Subir manualmente los archivos PHP/JS/HTML vía FTP/SFTP (ver sección 1.2).
    *   **NO** sobrescribir la carpeta `data/`.
    *   **NO** subir `env.php` si no ha cambiado.

### 5.2 Restauración de Base de Datos (Rollback de Datos)
Si el despliegue corrompió `store.json` o borró datos:

**Punto de Restauración:**
El sistema genera backups automáticos en `data/backups/` antes de cada escritura.

**Pasos:**
1.  Acceder por SFTP a `data/backups/`.
2.  Localizar el archivo `store-YYYYMMDD-HHMMSS-XXXXXX.json` con fecha/hora justo antes del incidente.
3.  Descargar y verificar que el JSON es válido.
4.  Renombrar `data/store.json` a `data/store.json.corrupt` (como evidencia).
5.  Subir el backup seleccionado como `data/store.json`.
6.  Verificar permisos (664 o 644).

### 5.3 Contactos de Emergencia
En caso de incidentes críticos que no se pueden resolver con rollback:

*   **Líder Técnico:** [Nombre/Teléfono - Ver Gestor de Contraseñas]
*   **Hosting Support:** [Link/Ticket]
*   **Stripe Support:** [Link]

### 5.4 Checklist de Validación Post-Rollback
Una vez revertido el cambio, ejecutar las siguientes validaciones:

1.  **Smoke Test:**
    *   [ ] La página de inicio carga sin errores visuales.
    *   [ ] `/api.php?resource=health` devuelve `{"status":"ok", ...}`.
    *   [ ] `/api.php?resource=features` devuelve la configuración correcta.

2.  **Flujos Críticos:**
    *   [ ] El widget de reserva muestra horarios disponibles.
    *   [ ] El formulario de "Telemedicina" carga correctamente.
    *   [ ] Iniciar sesión en `/admin.html` (si aplica).

3.  **Logs:**
    *   [ ] Verificar que no hay nuevos errores fatales en `php.log` o `error_log`.
