# Deploy por GitHub Actions (sin subir manual)

## 1) Configura secretos del repo

En GitHub:
- `Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`

Crea:
- `FTP_SERVER` (ejemplo: `ftp.tudominio.com` o IP del hosting)
- `FTP_USERNAME`
- `FTP_PASSWORD`

## 2) Configura variables opcionales

En:
- `Settings` -> `Secrets and variables` -> `Actions` -> `Variables`

Crea:
- `FTP_PROTOCOL`: `ftps` (recomendado) o `ftp`
- `FTP_SERVER_DIR`: `/public_html/`
- `PROD_URL`: `https://pielarmonia.com`

## 3) Ejecuta deploy

Opciones:
- Push a `main` para deploy automatico.
- Manual: `Actions` -> `Deploy Hosting (FTP/FTPS)` -> `Run workflow`.

Parametros manuales recomendados:
- `protocol`: `ftps`
- `server_dir`: `/public_html/`
- `dry_run`: `false`
- `clean_slate`: `false`

## 4) Verifica

Despues del deploy:
- `https://pielarmonia.com/api.php?resource=health`
- `https://pielarmonia.com/figo-chat.php`
- `https://pielarmonia.com/`

Si falla conexion FTP:
- Revisa host, usuario, clave y puerto en tu proveedor.
- Usa el host FTP del proveedor, no una URL proxied por Cloudflare.
