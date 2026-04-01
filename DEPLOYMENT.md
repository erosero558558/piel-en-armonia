# Aurora Derm Deployment Pipeline

Este documento detalla el pipeline estándar de despliegue para la fase de producción de Aurora Derm.

## 1. Prerrequisitos de Entorno
- La carpeta `data/` debe tener permisos completos para el usuario PHP.
- `php.ini` debe contener `memory_limit = 512M` o superior.
- Node.js version 22+ para ejecutar el stack de gobernanza y validación.

## 2. Preparación Post-Deploy
1. **Validar Integridad**. Ejecutar pruebas críticas:
   ```bash
   npm run nighty:stability
   npm run test:critical:payments
   ```
2. **Restaurar Crontab**. Correr el comando de instalación de tareas programadas desde root/servicio:
   ```bash
   npm run ops:install-crons
   ```
3. **Migrar Configuraciones**. Si hay cambios de DB/Almacenamiento (Epic S7), usar `php bin/sync-config.php`.

## 3. Seguridad Perimetral
- El directorio `data/uploads/.htaccess` debe negar la ejecución de scripts (`php_flag engine off`).
- Los logs como `hce-access-log.jsonl` solo pueden ser leídos internamente y deben rotar diariamente (incluido en `crontab.txt`).
- Ejecutar `npm run ops:install-crons` asegura que las rotaciones se activen inmediatamente y mantengan compliance.

## 4. Rollback
Si alguna validación falla en un entorno production-like (despliegue canary):
```bash
npm run gate:admin:rollout:rollback
```
Esto revierte inmediatamente al commit/tag anterior y bloquea el tráfico nuevo.

---

## 5. Variables de Entorno Requeridas (OPS-03)

Crear `/var/www/aurora-derm/.env` — nunca subir a Git:

```env
OPENAI_API_KEY=sk-...
WA_API_URL=https://api.whatsapp.com/...
WA_TOKEN=...
CLINIC_ID=aurora-derm-quito
TIMEZONE=America/Guayaquil
SESSION_SECRET=<64 chars random>
LOPD_CONSENT_VERSION=v1.0.0
CLARITY_ID=<microsoft_clarity_id>
GA4_ID=G-XXXXXXXXXX
```

## 6. Permisos de Carpetas (SEC-02)

```bash
chmod 750 data/ data/uploads/
chown -R www-data:www-data data/
cat > data/uploads/.htaccess << 'EOF'
php_flag engine off
Options -Indexes
deny from all
<FilesMatch "\.(jpg|jpeg|png|webp|gif)$">
  allow from all
</FilesMatch>
EOF
```

## 7. Instalar Crons (OPS-01) — OBLIGATORIO

Sin crons, las alertas clínicas, recordatorios y seguimiento de crónicos NO funcionan:

```bash
npm run ops:install-crons
crontab -l | grep aurora-derm   # → ≥3 entradas
```

| Cron | Horario | Función |
|---|---|---|
| `check-pending-labs.php` | Diario 8:00 AM | Labs sin resultado en 48h |
| `check-chronic-followup.php` | Lunes 9:00 AM | Crónicos sin visita |
| `check-pending-interconsults.php` | Martes 9:00 AM | Interconsultas sin respuesta |
| `send-appointment-reminders.php` | Diario 7:30 AM | Recordatorio de citas del día |

## 8. Nginx — Security Headers (S13-04)

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
location /data/ { deny all; return 404; }
location ~* \.(jsonl|log|env)$ { deny all; return 404; }
```

## 9. Verificación Post-Deploy

```bash
node bin/check-route-integrity.js           # → ✅ Route integrity OK
find controllers/ lib/ -name "*.php" | xargs -I{} php -l {} | grep -v "No syntax" | wc -l  # → 0
curl -s /api.php?resource=health | jq '.ok' # → true
crontab -l | grep -c aurora-derm            # → ≥3
```

## 10. Checklist Final de Lanzamiento

- [ ] Variables de entorno configuradas y verificadas
- [ ] Permisos `chmod 750 data/uploads/` aplicados
- [ ] `.htaccess` en `data/uploads/` con `php_flag engine off`
- [ ] Nginx con security headers (X-Frame-Options, etc.)
- [ ] Crons instalados: `crontab -l | grep aurora-derm` → match
- [ ] HTTPS activo con Let's Encrypt
- [ ] `GET /api.php?resource=health` → `{ ok: true }`
- [ ] `node bin/check-route-integrity.js` → ✅
- [ ] GA4 ID en todas las páginas públicas
- [ ] Backup automático configurado y probado
