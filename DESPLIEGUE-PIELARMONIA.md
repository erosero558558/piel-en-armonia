# 🚀 Despliegue en pielarmonia.com

## Estructura de archivos

Subir estos 8 archivos a la raíz del hosting:

```
/public_html/  (o la carpeta raíz de tu hosting)
├── index.html          ← Página principal
├── styles.css          ← Estilos
├── script.js           ← Chatbot con Kimi AI
├── proxy.php           ← Proxy para API de Kimi
├── hero-woman.jpg      ← Imagen del hero
├── admin.html          ← Panel de administración
├── admin.css           ← Estilos del admin
└── admin.js            ← JavaScript del admin
```

---

## Requisitos del servidor

- ✅ PHP 7.4 o superior
- ✅ Extensión cURL habilitada
- ✅ Soporte para HTTPS (SSL)

---

## Configuración del hosting

### 1. Subir archivos

Usar FTP, FileZilla, o el panel de control del hosting para subir los 8 archivos.

### 2. Verificar PHP

Crear archivo `test.php` temporal:
```php
<?php
phpinfo();
?>
```

Acceder a: `https://pielarmonia.com/test.php`

Verificar que muestre:
- PHP Version: 7.4+ 
- curl: enabled

Luego **eliminar** test.php

### 3. Verificar proxy.php

Acceder a: `https://pielarmonia.com/proxy.php`

Debe mostrar:
```json
{
  "status": "ok",
  "message": "Proxy funcionando correctamente",
  "curl_enabled": true
}
```

### 4. Probar chatbot

1. Ir a: `https://pielarmonia.com`
2. Abrir el chatbot (botón 💬)
3. Escribir: "hola"
4. Debe responder con **Kimi AI** (no modo offline)

---

## Solución de problemas

### Error 500 en proxy.php

Ver logs de error o crear archivo `.htaccess`:
```apache
php_value display_errors 0
```

### cURL no instalado

Contactar al proveedor de hosting o agregar en `php.ini`:
```ini
extension=curl
```

### API Key inválida (401)

Si la API key de Kimi no funciona, el chatbot automáticamente usa **modo offline** con respuestas locales. Todo seguirá funcionando.

Para obtener nueva API key:
1. Ir a: https://platform.moonshot.cn/
2. Crear cuenta y generar nueva key
3. Editar `script.js` línea 1022:
```javascript
apiKey: 'TU_NUEVA_API_KEY_AQUI',
```

### CORS errors

Si ves errores de CORS en consola, verificar que:
1. El dominio sea exactamente `pielarmonia.com`
2. Se use HTTPS (no HTTP)
3. El archivo `proxy.php` tenga los permisos correctos (644)

---

## SSL/HTTPS (Importante)

El sitio **debe** usar HTTPS para que el chatbot funcione correctamente.

Si el hosting no tiene SSL gratuito, usar Cloudflare:
1. Crear cuenta en cloudflare.com
2. Agregar dominio pielarmonia.com
3. Cambiar DNS en el registrador de dominio
4. Activar "Always Use HTTPS"

---

## Configuración DNS recomendada (Cloudflare)

```
Type: A
Name: @
Content: IP_DEL_SERVIDOR
Proxy status: Proxied (naranja)

Type: A
Name: www
Content: IP_DEL_SERVIDOR
Proxy status: Proxied (naranja)
```

---

## Contacto soporte

Si hay problemas técnicos:
1. Verificar proxy.php funcione
2. Verificar consola del navegador (F12)
3. Verificar que cURL esté instalado
4. Contactar soporte del hosting si es necesario
