# 🚀 Guía: Subir a Hosting con PHP (IA Real)

Esta guía te lleva paso a paso para subir tu sitio a un hosting gratuito con PHP y activar el chatbot con IA real de Kimi.

---

## 📋 Opciones de Hosting Gratuito con PHP

| Hosting | Espacio | PHP | URL |
|---------|---------|-----|-----|
| **InfinityFree** | 5 GB | ✅ 7.4+ | infinityfree.net |
| **000webhost** | 1 GB | ✅ 7.4+ | 000webhost.com |
| **AwardSpace** | 1 GB | ✅ 7.4+ | awardspace.com |

**Recomendado: InfinityFree** (más espacio, sin anuncios forzados)

---

## 🛠️ Opción 1: InfinityFree (Recomendado)

### Paso 1: Crear cuenta
1. Ve a https://infinityfree.net
2. Haz clic en **"Sign Up"** o **"Register"**
3. Completa el formulario con tu email
4. Verifica tu email

### Paso 2: Crear un nuevo sitio
1. Inicia sesión en el panel de control
2. Haz clic en **"New Account"** o **"Create Account"**
3. Elige un nombre de dominio gratuito (ej: `tusitiomedical.42web.io`)
4. Espera 5-10 minutos a que se active

### Paso 3: Acceder al FTP
1. En el panel, ve a **"FTP Accounts"** o **"FTP Details"**
2. Anota estos datos:
   - **FTP Host:** (ej: `ftpupload.net`)
   - **FTP Username:** (tu usuario)
   - **FTP Password:** (tu contraseña)
   - **FTP Port:** `21`

### Paso 4: Subir archivos vía FTP

#### Opción A: FileZilla (Recomendado)

1. **Descarga FileZilla:** https://filezilla-project.org/download.php
2. **Instala y abre FileZilla**
3. **Completa los datos de conexión:**
   - Host: `ftpupload.net` (o el que te dio InfinityFree)
   - Username: tu usuario de FTP
   - Password: tu contraseña de FTP
   - Port: `21`
4. **Haz clic en "Quickconnect"**
5. **En la ventana derecha** (servidor remoto), navega a: `/htdocs`
6. **En la ventana izquierda** (tu PC), navega a: `C:\Users\ernes\OneDrive\Documentos\kimiCode`
7. **Selecciona todos los archivos** de la carpeta y arrástralos a la derecha
8. **Espera a que termine la subida** (barra de progreso en la parte inferior)

#### Opción B: WebFTP (Sin instalar nada)

1. En el panel de InfinityFree, busca **"Online File Manager"** o **"File Manager"`
2. Haz clic para abrirlo
3. Navega a la carpeta `/htdocs`
4. Haz clic en **"Upload"** o **"Subir"**
5. Selecciona todos los archivos de tu carpeta `kimiCode`
6. Espera a que terminen de subir

### Paso 5: Verificar que funciona

1. Abre tu navegador
2. Escribe tu dominio: `https://tusitiomedical.42web.io` (reemplaza con tu dominio)
3. Deberías ver tu sitio web funcionando
4. **Prueba el chatbot:**
   - Haz clic en el botón de chat 💬
   - Escribe: "Hola"
   - Debería responder con IA real (sin decir "modo offline")

---

## 🛠️ Opción 2: 000webhost

### Paso 1: Crear cuenta
1. Ve a https://www.000webhost.com
2. Regístrate con email o Google/Facebook

### Paso 2: Crear sitio
1. Haz clic en **"Create New Site"**
2. Elige nombre para tu sitio
3. Selecciona **"Upload your own site"**

### Paso 3: Subir archivos
1. Ve a **"Tools" → "File Manager"**
2. Entra a la carpeta `public_html`
3. Borra el archivo `index.html` por defecto
4. Haz clic en **"Upload"** y sube todos tus archivos

### Paso 4: Probar
1. Visita: `https://tusitio.000webhostapp.com`
2. Prueba el chatbot

---

## ✅ Verificar que el Chatbot con IA funciona

Después de subir al hosting, abre tu sitio y prueba:

### Test 1: Conexión básica
```
Tú: "Hola"
Bot: Debe responder con un saludo personalizado (no genérico)
```

### Test 2: Pregunta específica
```
Tú: "¿Cuánto cuesta una consulta?"
Bot: Debe decir "$40" específicamente
```

### Test 3: Contexto
```
Tú: "Tengo acné"
Bot: Debe dar información específica sobre tratamiento de acné
```

Si las respuestas son específicas de tu clínica (no genéricas), **¡la IA está funcionando!**

---

## 🔧 Solución de problemas

### Error 500 (Internal Server Error)
- Verifica que `proxy.php` tenga permisos 644
- En el File Manager, haz clic derecho en `proxy.php` → Permissions → 644

### El chatbot sigue diciendo "modo offline"
- Abre la consola del navegador (F12)
- Busca errores rojos
- Verifica que `proxy.php` se haya subido correctamente

### La página no carga
- Espera 10-15 minutos después de subir (propagación DNS)
- Verifica que hayas subido los archivos a `/htdocs` (InfinityFree) o `/public_html` (000webhost)

---

## 📁 Archivos que debes subir

Asegúrate de subir **TODOS** estos archivos:

```
📁 htdocs/ (o public_html/)
├── index.html          ✅
├── styles.css          ✅
├── script.js           ✅
├── proxy.php           ✅ IMPORTANTE
├── admin.html          ✅
├── admin.css           ✅
├── admin.js            ✅
└── (README.md opcional)
```

---

## 🎉 Una vez funcionando

Tu sitio estará disponible 24/7 en:
- `https://tusitiomedical.42web.io` (ejemplo InfinityFree)
- `https://tusitio.000webhostapp.com` (ejemplo 000webhost)

El chatbot usará **IA real de Kimi** y podrás:
- Atender pacientes automáticamente
- Dar información precisa sobre tus servicios
- Agendar citas
- Todo funcionando con inteligencia artificial

---

## 💡 Tip: Dominio personalizado (opcional)

Si quieres un dominio profesional como `www.pielenarmonia.com`:

1. Compra un dominio en Namecheap, GoDaddy, o Nic.ec (Ecuador)
2. En el panel de InfinityFree, ve a "Domains" → "Parked Domains"
3. Agrega tu dominio comprado
4. Configura los DNS según las instrucciones

---

## 📞 ¿Necesitas ayuda?

Si tienes problemas para subir al hosting:

1. **Revisa que proxy.php esté subido** - Es el archivo más importante
2. **Verifica que el hosting tenga PHP** - Debe ser PHP 7.4 o superior
3. **Limpia caché del navegador** - Ctrl+Shift+R para recargar sin caché

¡Estoy aquí para ayudarte!
