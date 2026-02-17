# 🖥️ Cómo ejecutar el sitio con servidor local

## ❌ El problema

Estás abriendo `index.html` haciendo doble clic, lo que usa el protocolo `file://`

Los navegadores bloquean `fetch()` en archivos locales por seguridad (CORS).

## ✅ Soluciones

### Opción 1: Live Server (VS Code) - RECOMENDADA

1. Instala la extensión **"Live Server"** en VS Code
2. Abre la carpeta del proyecto en VS Code
3. Haz clic derecho en `index.html` → **"Open with Live Server"**
4. Se abrirá en `http://localhost:5500`
5. ¡Listo! El chatbot funcionará

---

### Opción 2: Python (si tienes Python instalado)

Abre terminal en la carpeta del proyecto y ejecuta:

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

Luego abre: `http://localhost:8000`

---

### Opción 3: Node.js (si tienes Node instalado)

```bash
# Instalar http-server globalmente
npm install -g http-server

# En la carpeta del proyecto
http-server -p 8080
```

Luego abre: `http://localhost:8080`

---

### Opción 4: PHP (si tienes PHP instalado)

```bash
# En la carpeta del proyecto
php -S localhost:8000
```

Luego abre: `http://localhost:8000`

---

## 🌐 Opción definitiva: Subir a Hosting

Para que todo funcione en producción (chatbot con Kimi + panel admin), sube los archivos a un hosting con PHP:

### Hosting gratuito recomendado:
- **InfinityFree** (https://infinityfree.net) - PHP + MySQL gratis
- **000webhost** (https://www.000webhost.com) - PHP gratis
- **GitHub Pages** - Solo estático (NO sirve para el chatbot con Kimi)

### Pasos:
1. Crea cuenta en el hosting
2. Sube todos los archivos vía FTP o panel de control
3. Tu sitio estará en: `https://tudominio.com`
4. El chatbot funcionará perfectamente

---

## 🔍 Verificar que funciona

Cuando lo abras correctamente, la URL debe ser:
- ✅ `http://localhost:8000` (servidor local)
- ✅ `https://tusitio.com` (hosting)
- ❌ `file:///C:/Users/...` (NO sirve)

---

## ⚡ Rápido con VS Code

Si tienes VS Code instalado:

1. Abre la carpeta `kimiCode`
2. Presiona `Ctrl+Shift+P` (o `Cmd+Shift+P` en Mac)
3. Escribe: `Live Server: Open with Live Server`
4. ¡Listo!

O simplemente instala la extensión "Live Server" y haz clic en "Go Live" en la barra inferior.
