# Checklist de Pruebas en Produccion

Fecha de ejecucion sugerida: completar al desplegar.

## 1. Pre-check de servidor

1. Verifica que existan estos archivos en produccion:
- `index.html`
- `script.js`
- `admin.html`
- `admin.js`
- `api.php`
- `api-lib.php`
- `admin-auth.php`
- carpeta `data/` con permisos de escritura
- `figo-chat.php` disponible en el servidor

2. Verifica variables de entorno:
- `PIELARMONIA_ADMIN_PASSWORD`
- opcional: `PIELARMONIA_ADMIN_PASSWORD_HASH`
- opcional: `PIELARMONIA_EMAIL_FROM`
- opcional: `PIELARMONIA_DATA_DIR`
- `FIGO_CHAT_ENDPOINT`
- opcional: `FIGO_CHAT_TOKEN`
- opcional: `FIGO_CHAT_APIKEY_HEADER`
- opcional: `FIGO_CHAT_APIKEY`
- opcional: `FIGO_CHAT_DEGRADED_MODE`
- alternativa: `data/figo-config.json` con `endpoint`

3. Verifica endpoint de salud:
- URL: `https://TU_DOMINIO/api.php?resource=health`
- Esperado: JSON con `"ok": true`

## 2. Pruebas del panel admin

1. Abre `https://TU_DOMINIO/admin.html`.
2. Intenta login con contraseña incorrecta:
- Esperado: mensaje de error.
3. Login con contraseña correcta (`PIELARMONIA_ADMIN_PASSWORD`):
- Esperado: carga dashboard.
4. Navega por secciones:
- `Citas`, `Callbacks`, `Reseñas`, `Disponibilidad`
- Esperado: sin errores visuales ni pantallas en blanco.
5. Exportar datos:
- Boton `Exportar Datos`
- Esperado: descarga de JSON correcta.

## 3. Flujo de cita publica

1. Abre `https://TU_DOMINIO/index.html`.
2. En `Reserva tu Cita`, completa formulario:
- servicio, doctor, fecha, hora, nombre, email, telefono.
3. Clic en `Confirmar Reserva`.
4. En modal de confirmacion, termina flujo.
- Esperado: mensaje `Cita registrada correctamente` y modal con detalle.
5. Vuelve al admin > `Citas`:
- Esperado: la nueva cita aparece en tabla.

## 4. Validacion de disponibilidad

1. Admin > `Disponibilidad`.
2. Selecciona fecha y agrega un horario nuevo.
- Esperado: horario visible en lista.
3. En web publica, selecciona misma fecha.
- Esperado: el horario aparece disponible.
4. Reserva ese horario en web publica.
5. Recarga y revisa misma fecha.
- Esperado: el horario ya no aparece libre.

## 5. Flujo de callback

1. En web publica, envia formulario `¿Prefieres que te llamemos?`.
2. En admin > `Callbacks`:
- Esperado: aparece registro con estado `Pendiente`.
3. Usa `Marcar contactado`.
- Esperado: estado cambia a `Contactado`.
4. Prueba filtro:
- `Pendientes` y `Contactados` deben mostrar resultados correctos.

## 6. Flujo de reseñas

1. En web publica, envia nueva reseña con estrellas.
2. Esperado en web publica:
- aparece nueva reseña en el grid.
3. Esperado en admin > `Reseñas`:
- aparece reseña, conteo y promedio actualizados.

## 7. Chatbot Figo

1. Verifica `figo-chat.php`:
- URL: `https://TU_DOMINIO/figo-chat.php`
- Esperado: responde JSON (GET o POST válido).

2. Chatbot en sitio:
- Pregunta: `hola`
- Esperado: respuesta valida del bot, sin errores de endpoint.

3. Si `figo-chat.php` falla temporalmente:
- Esperado: chatbot sigue funcionando con fallback local (sin romper UI).

## 8. Seguridad basica

1. Busca en codigo desplegado:
- no debe existir `sk-...` hardcodeado.
- no debe existir `admin123` como fallback.
- `proxy.php` debe responder `410` (deshabilitado).

2. Verifica admin sin sesion:
- abre `admin.html` en incognito.
- esperado: solicita login.

3. Verifica backups automaticos:
- tras crear o editar una cita/callback/reseña, debe existir al menos un archivo en `data/backups/`.

## 9. Prueba de regresion rapida (5 min)

1. Home carga sin errores.
2. Menu y scroll funcionan.
3. Modales abren/cierran.
4. Agendamiento completo.
5. Admin login + vista de citas.
6. Chatbot responde.

## 10. Si algo falla

1. Revisa consola del navegador (F12).
2. Revisa respuesta de:
- `api.php?resource=health`
- `admin-auth.php?action=status`
- `figo-chat.php`
3. Revisa permisos de `data/`.
4. Verifica variables de entorno.
