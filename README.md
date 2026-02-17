# 🩺 Piel en Armonía - Dermatología Especializada

Sitio web profesional para clínica dermatológica con diseño Apple-inspired, telemedicina simplificada y panel de administración completo.

![Version](https://img.shields.io/badge/version-2.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Características Principales

### 🎨 Diseño Apple-Inspired
- **Glassmorphism navbar** - Con blur y transparencia
- **Tipografía grande y limpia** - Fuente Inter
- **Animaciones suaves** - Transiciones elegantes
- **Totalmente responsive** - Móvil, tablet y desktop

### 🌍 Multi-idioma
- **Español / English** - Cambio instantáneo
- **Persistencia** - Guarda preferencia en localStorage

### 🤖 Chatbot Inteligente
- **Diseño glassmorphism** flotante en esquina inferior derecha
- **Respuestas automáticas** sobre servicios, precios, ubicación
- **Sugerencias rápidas** (botones predefinidos)
- **Historial persistente** en localStorage
- **Detección de intenciones** (acné, láser, citas, etc.)
- **Transferencia a humano** vía WhatsApp o teléfono
- **Proactivo** - Muestra notificación después de 30 segundos

### 📞 Telemedicina Ultra Simple
| Método | Cómo funciona | Requiere |
|--------|--------------|----------|
| **Llamada Telefónica** | `tel:` link → abre app teléfono | Solo celular |
| **WhatsApp Video** | `wa.me` link → abre WhatsApp | WhatsApp instalado |
| **Video Web** | Jitsi Meet → sin registro | Navegador web |
| **Callback** | Formulario → doctor te llama | Nada |

**NO requiere:** Node.js, Twilio, apps, registros, instalaciones

---

## 🔧 Panel de Administración

Accede a `/admin.html` para gestionar todo el sistema:

### Dashboard
- Estadísticas en tiempo real
- Citas de hoy
- Callbacks recientes
- Rating promedio

### Gestión de Citas
- Ver todas las citas
- Filtrar por fecha/estado
- Buscar pacientes
- Cancelar citas
- Contactar directo (tel/WhatsApp)

### Callbacks
- Ver solicitudes de llamada
- Marcar como contactado
- Llamar directamente

### Reseñas
- Ver todas las reseñas
- Rating promedio
- Estadísticas de satisfacción

### Configurar Disponibilidad
- Calendario mensual
- Agregar/eliminar horarios
- Bloquear días no disponibles

### Acceso
- **URL:** `admin.html`
- **Contraseña:** `admin123` (cambiar en producción)

---

## 📋 Sistema de Citas Completo

### Para el Paciente:
1. Selecciona servicio
2. Elige doctor
3. Selecciona fecha (con validación de disponibilidad)
4. Elige horario (solo muestra disponibles)
5. Ingresa datos personales
6. Paga online o selecciona método
7. **¡Exporta a Google Calendar o Outlook!**

### Funcionalidades:
- ✅ Cálculo automático de precios + IVA (12%)
- ✅ Validación de horarios ocupados (en tiempo real)
- ✅ 3 métodos de pago: Tarjeta, Transferencia, Efectivo
- ✅ Exportar a Google Calendar
- ✅ Descargar archivo .ics (Outlook/Apple)
- ✅ Confirmación con detalles completos

---

## 📁 Estructura de Archivos

```
📁 Piel en Armonía/
│
├── 📄 index.html          (47KB) - Sitio principal + Chatbot
├── 📄 styles.css          (42KB) - Estilos Apple + Chatbot
├── 📄 script.js           (62KB) - Funcionalidades + Chatbot con Kimi AI
├── 📄 README.md           (8KB)  - Documentación
│
├── 📄 admin.html          (13KB) - Panel de admin
├── 📄 admin.css           (19KB) - Estilos admin
└── 📄 admin.js            (26KB) - JavaScript admin
```

**Total: ~150KB** - Sin dependencias externas (solo CDN de íconos)

---

## 🚀 Cómo Usar

### Opción 1: Hosting con PHP (IA Real) ⭐ RECOMENDADA

Para usar el chatbot con **inteligencia artificial real** de Kimi:

1. **Regístrate en InfinityFree:** https://infinityfree.net
2. **Sube todos los archivos** vía FTP (ver `SUBIR-A-HOSTING.md`)
3. **Listo** - El chatbot usará IA real automáticamente

📖 **Guía completa:** `SUBIR-A-HOSTING.md`

**Ventajas:**
- ✅ Chatbot con IA real de Kimi
- ✅ Sitio disponible 24/7 en internet
- ✅ Panel de admin accesible desde cualquier lugar
- ✅ Gratuito

---

### Opción 2: Servidor Local (Respuestas predefinidas)

Para desarrollo sin PHP:

#### VS Code + Live Server
1. Instala extensión **"Live Server"**
2. Haz clic derecho en `index.html` → "Open with Live Server"
3. Se abre en `http://localhost:5500`

📖 **Ver `SERVIDOR-LOCAL.md` para más opciones**

**Nota:** En local el chatbot usa respuestas predefinidas (sin IA).

---

### Para el Paciente:
1. Abre el sitio web
2. Usa el chatbot (IA real si está en hosting)
3. Navega servicios
4. Reserva cita

### Para el Doctor (Admin):
1. Ve a `admin.html`
2. Contraseña: `admin123`
3. Gestiona todo

---

## 📞 Contacto Configurado

- **Teléfono/WhatsApp:** +593 98 245 3672
- **Dirección:** Valparaíso 13-183 y Sodiro, Quito, Ecuador
- **Horario:** Lun-Vie 9:00-18:00, Sáb 9:00-13:00

---

## 💾 Datos Almacenados (localStorage)

Todo se guarda localmente en el navegador:

| Clave | Contenido |
|-------|-----------|
| `language` | Idioma preferido (es/en) |
| `appointments` | Historial de citas |
| `currentAppointment` | Cita en proceso |
| `callbacks` | Solicitudes de llamada |
| `reviews` | Reseñas de pacientes |
| `availability` | Horarios configurados por el admin |

---

## 🤖 Chatbot - Dr. Virtual (INTEGRADO CON KIMI AI)

El chatbot usa la **API real de Kimi (Moonshot AI)** para responder con inteligencia artificial.

### 🚀 Configuración Rápida

1. **Obtén tu API Key** en: https://platform.moonshot.cn/
2. **Al abrir el chat**, te pedirá ingresar la API key
3. **Listo** - El bot responderá usando IA real

### 💡 Características
- ✅ **IA Real** - Respuestas generadas por Kimi (Moonshot AI)
- ✅ **Contexto mantenido** - Recuerda la conversación
- ✅ **Conocimiento de la clínica** - Información sobre servicios, precios, doctores
- ✅ **Respuestas naturales** - Como hablar con un humano
- ✅ **Fallback inteligente** - Si hay error, redirige a WhatsApp
- ✅ **Historial persistente** - Guarda conversación en el navegador
- ✅ **Diseño glassmorphism** tipo Apple

### 📝 Prompt del Sistema
Kimi está configurado como "Dr. Virtual" de Piel en Armonía con:
- Información completa de la clínica
- Precios de todos los servicios
- Datos de contacto y ubicación
- Horarios de atención
- Instrucciones para agendar citas
- Límites éticos (no diagnósticos definitivos)

### 🔒 Seguridad
- La API key se guarda en `localStorage` (solo en el navegador del usuario)
- No se envía a ningún servidor propio
- Comunicación directa con API de Moonshot

---

## 🎯 Nuevas Funcionalidades v2.0

### Toast Notifications
- Reemplaza alerts feos
- 4 tipos: success, error, warning, info
- Auto-cierre en 5 segundos
- Animaciones suaves

### Loading States
- Indicadores en botones
- Spinners animados
- Previene doble-click
- Mejor UX

### Exportar a Calendario
- Google Calendar (link directo)
- Outlook/Apple Calendar (archivo .ics)
- Detalles completos del evento
- Recordatorios automáticos

### Sistema de Disponibilidad
- Admin configura horarios por fecha
- Paciente solo ve horarios disponibles
- Validación en tiempo real
- Prevención de doble reserva

---

## 🔒 Seguridad

- Contraseña de admin en frontend (cambiar en producción)
- Datos en localStorage (navegador del usuario)
- Sin servidor backend (100% frontend)
- Ideal para clínicas pequeñas/medias

---

## 🛠️ Tecnologías

- **HTML5** semántico
- **CSS3** (Grid, Flexbox, Variables, Backdrop-filter)
- **JavaScript** vanilla (ES6+)
- **Font Awesome** (CDN)
- **Google Fonts** - Inter

---

## 🌐 Proxy PHP (Solución CORS)

Para evitar problemas de CORS, incluimos un proxy PHP:

### Archivos del proxy:
- `proxy.php` - Backend que comunica con Kimi API

### Requisitos:
- Servidor web con PHP 7.4+
- Extensión cURL habilitada

### Configuración:
1. Sube `proxy.php` a tu servidor web (misma carpeta que index.html)
2. El frontend automáticamente usa el proxy
3. El proxy añade los headers CORS necesarios
4. La API key viaja de forma segura

### Seguridad del proxy:
- Valida que solo se acepten peticiones POST
- Sanitiza datos de entrada
- No expone errores internos al cliente
- Puedes hardcodear la API key en el proxy para mayor seguridad

## 🌐 API de Kimi (Moonshot AI)

### Precios de la API (2024):
- **moonshot-v1-8k**: ~$0.006 / 1K tokens
- **moonshot-v1-32k**: ~$0.012 / 1K tokens  
- **moonshot-v1-128k**: ~$0.024 / 1K tokens

### Modelos disponibles:
- `moonshot-v1-8k` - Usado por defecto (recomendado)
- `moonshot-v1-32k` - Para conversaciones largas
- `moonshot-v1-128k` - Para mucho contexto

### Límites:
- 3 requests/segundo (rate limit)
- Máximo 1000 tokens por respuesta
- Contexto de 8K tokens (modelo default)

## 📱 Compatibilidad

| Navegador | Soporte |
|-----------|---------|
| Chrome | ✅ Completo |
| Firefox | ✅ Completo |
| Safari | ✅ Completo |
| Edge | ✅ Completo |
| Móvil | ✅ Completo |

---

## 🤝 Soporte

¿Necesitas ayuda?
- Abre un issue en GitHub
- Contacta al desarrollador
- Revisa el código fuente

---

## 📄 Licencia

MIT License - Libre para usar y modificar.

---

Hecho con ❤️ en Quito, Ecuador 🇪🇨

**Piel en Armonía** - Cuidando tu piel, cuidando de ti.
