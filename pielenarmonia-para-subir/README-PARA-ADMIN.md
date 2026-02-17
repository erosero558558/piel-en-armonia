# Piel en Armonía - Instrucciones para el Servidor

## Archivos incluidos

| Archivo | Descripción |
|---------|-------------|
| `index.html` | Página principal del sitio |
| `styles.css` | Estilos CSS |
| `script.js` | JavaScript (chatbot, formularios, etc.) |
| `proxy.php` | Proxy para conectar con Kimi AI API |
| `admin.html` | Panel de administración |
| `admin.css` | Estilos del admin |
| `admin.js` | JavaScript del admin |

## Configuración de Nginx

Agrega esto a tu configuración de Nginx (ej: `/etc/nginx/sites-available/pielenarmonia`):

```nginx
server {
    listen 80;
    server_name pielenarmonia.xyz www.pielenarmonia.xyz;
    # O si no tienes dominio aún:
    # server_name 101.47.4.223;
    
    root /var/www/pielenarmonia;
    index index.html index.php;
    
    # Logs
    access_log /var/log/nginx/pielenarmonia.access.log;
    error_log /var/log/nginx/pielenarmonia.error.log;
    
    location / {
        try_files $uri $uri/ =404;
    }
    
    # PHP (necesario para proxy.php)
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php-fpm.sock; # Ajusta según tu versión PHP
        # O: fastcgi_pass 127.0.0.1:9000;
    }
    
    # Seguridad
    location ~ /\.ht {
        deny all;
    }
}
```

Luego:
```bash
sudo ln -s /etc/nginx/sites-available/pielenarmonia /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Requisitos del Servidor

- ✅ Nginx
- ✅ PHP 7.4+ con extensiones: `curl`, `json`
- ✅ cURL externo habilitado (para llamar a api.moonshot.cn)

## Verificar que funciona

1. **Web estática**: http://101.47.4.223/ o http://pielenarmonia.xyz/
2. **PHP funciona**: http://101.47.4.223/proxy.php (debe devolver error JSON, no 404)
3. **Chatbot**: Abrir la web y probar el chat

## Configuración del Chatbot (IMPORTANTE)

El chatbot usa la API de Kimi AI (Moonshot). La API key está en `proxy.php`:

```php
$apiKey = 'sk-kimi-lMIpVZxWGocfNOqaKO68Ws54Gi2lBuiFHkyBRA7VlCDWVeW0PWUAup1fUucHjHLZ';
```

**Si la key no funciona** (error 401), el chatbot automáticamente usa respuestas locales.

## Probar cURL desde el servidor

```bash
# Verificar que cURL puede salir a internet
curl -I https://api.moonshot.cn/v1/models

# Debe devolver HTTP 401 (normal, sin API key válida)
# Si devuelve timeout o error de conexión, revisar firewall
```

## Solución de Problemas

### Error 502 Bad Gateway (PHP)
Verificar que PHP-FPM está corriendo:
```bash
sudo systemctl status php8.1-fpm  # o tu versión
sudo systemctl start php8.1-fpm
```

### Error 401 en el chatbot
La API key de Kimi está vencida. El chatbot funcionará en "modo offline" con respuestas locales.

### No carga el CSS/JS
Verificar permisos:
```bash
sudo chown -R www-data:www-data /var/www/pielenarmonia
sudo chmod -R 755 /var/www/pielenarmonia
```

## SSL (Opcional pero recomendado)

Con Certbot:
```bash
sudo certbot --nginx -d pielenarmonia.xyz -d www.pielenarmonia.xyz
```

---

## Contacto

Si hay problemas, el chatbot funciona en modo offline incluso sin la API de Kimi.
