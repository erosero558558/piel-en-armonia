# Aurora Derm: Remote Auth Recovery Runbook

Este documento provee pasos de diagnóstico y acción rápida (Tier 2/3) cuando los endpoints `operator-auth-status` o `admin-auth` devuelven el temido **502 Bad Gateway** o **504 Gateway Timeout**.

---

## 🛑 Diagnóstico de Primeros Auxilios

Cuando el Front-end (React/Desktop) detecta que no puede autenticar porque recibe códigos 5xx, el problema casi siempre radica en el **backend bridge (Nginx → PHP-FPM)** o en colapsos del servidor interno.

### 1. Ubicar el Error Real
Nginx intercepta las caídas de PHP. Debes revisar los logs de error del servidor remoto:
```bash
# Entrar al servidor de producción vía SSH
ssh ubuntu@pielarmonia.com

# Revisar los errores fatales de nginx (los 502 se loguean aquí)
sudo tail -n 50 /var/log/nginx/error.log
```
**Qué buscar:**
- `connect() failed (111: Connection refused) while connecting to upstream`: Significa que el servicio `php-fpm` está muerto, no se está ejecutando o el socket `.sock` carece de permisos.
- `upstream prematurely closed connection while reading response header from upstream`: Esto indica que PHP intentó arrancar el script `admin-auth.php` pero tuvo un **Fatal Error** inmanejable antes de poder imprimir o enviar los headers (ej: le falta una variable de entorno como `DB_PASSWORD` en su `.env` y usa `exit(1)` crudo o arroja una Excepción irrecuperable).
- `upstream timed out (110: Connection timed out)`: El proceso PHP está atascado esperando una query larga a la base de datos externa o un servicio de terceros congelado (>30 segundos a >60 segundos).

---

## 🛠 Resoluciones Comunes

### Escenario A: PHP-FPM está muerto o exhausto
A veces el servidor supera su `max_children` o se queda sin RAM (OOM Killer elimina el proceso).
**Acción:**
```bash
# Validar el estado
systemctl status php8.2-fpm  # (ajustar la version según OS)

# Reiniciar el socket
sudo systemctl restart php8.2-fpm

# Si se queda sin memoria crónicamente, revisar consumo de RAM
free -m
```

### Escenario B: Faltan variables de Entorno o Configs rotos (El culpable más probable tras un despliegue)
Si en Nginx ves "prematurely closed", PHP crasheó leyendo la receta. 
Aurora requiere variables obligatorias, especialmente para tokens y DB.
**Acción:**
```bash
# Inspeccionar que el archivo env en producción exista y no esté vacío
cat /var/www/pielarmonia/.env

# Revisar explícitamente logs de PHP-FPM
sudo tail -n 50 /var/log/php8.2-fpm.log
```
Si hubo un update reciente que agregó un env requirement (ej: `OPERATOR_SECRET`), añádelo a la DB en producción.

### Escenario C: Timeout remoto
Si el endpoint trata de reconectar a Google Calendar o la BDD y la conexión de la BD es rechazada, `admin-auth.php` esperará hasta timeout. Nginx, a los 60s arrojará 504 Gateway Timeout (o 502).
**Acción:**
- Haz PING a la base de datos desde la máquina. `mysql -h host -u user -p`.
- Asegura que los firewalls no hayan bloqueado de repente el IP del proxy.

---

## 🔬 Monitoreo: Smoke Test

Se ha configurado un test de latencia en la pipeline para prevenir sorpresas:
```bash
npm run smoke:auth
```
- Realiza peticiones anónimas a los endpoints vitales auth.
- Verifica que NO expongan familia 5xx (un HTTP 401 está PERFECTO, significa que el servicio de validación está VIVO e impermeabilizado).
- Mide la latencia estricta exigiendo que la fachada reaccione en `< 3000ms`.
