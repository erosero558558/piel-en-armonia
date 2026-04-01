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
