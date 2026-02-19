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

### 3.2 Backup Semanal
Aunque el sistema guarda backups rotativos en `data/backups/`, se recomienda descargar una copia local semanalmente.

**Comando:**
Conectarse por SFTP y descargar `data/store.json`.

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
