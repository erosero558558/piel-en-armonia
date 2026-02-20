# Reporte de Pruebas de Seguridad P0 - Crítico

**Fecha:** 2026-02-21
**Autor:** Jules (AI Agent)

## 1. Verificación de Backups Automatizados

**Estado:** ✅ Verificado

- **Prueba:** Se creó una cita de prueba mediante la API `POST /appointments`.
- **Resultado:** Se confirmó la creación de un nuevo archivo de backup en `data/backups/store-*.json`.
- **Mecanismo:** La función `write_store` en `lib/storage.php` llama a `create_store_backup_locked` antes de sobrescribir `data/store.json`, garantizando que siempre exista un respaldo del estado anterior.

## 2. Penetration Testing Básico

### Checklist

| Vulnerabilidad | Estado | Observaciones |
| :--- | :--- | :--- |
| **SQL Injection** | ✅ N/A | La aplicación no utiliza base de datos SQL. `lib/db.php` existe pero no es invocado. Los datos se almacenan en archivos JSON (`data/store.json`). |
| **XSS (Cross-Site Scripting)** | ✅ Mitigado | Se inyectaron payloads `<script>` en el formulario de citas. El backend almacena el payload tal cual (comportamiento esperado para integridad de datos), pero el frontend de administración (`admin.js`) utiliza `escapeHtml` (vía `textContent`) para renderizar todos los campos, previniendo la ejecución de scripts. |
| **Authentication Bypass** | ✅ Seguro | Intentos de acceso directo a endpoints protegidos (`GET /appointments`) sin sesión válida retornaron `401 Unauthorized`. |
| **CSRF (Cross-Site Request Forgery)** | ✅ Seguro | Las acciones administrativas (`PATCH`, `POST` en contexto admin) requieren un header `X-CSRF-Token`. Las pruebas enviando peticiones autenticadas sin este header fueron rechazadas con `403 Forbidden`. Los formularios públicos no requieren token por diseño. |
| **Rate Limiting** | ✅ Activo | Se confirmó que el endpoint de reservas (`POST /appointments`) bloquea peticiones tras exceder el límite de 5 intentos por minuto, retornando `429 Too Many Requests`. |

### Conclusiones

El sistema cumple con los requisitos de seguridad básicos solicitados.
- Los backups son funcionales y automáticos.
- La superficie de ataque SQL es inexistente.
- El riesgo de XSS almacenado está mitigado en la capa de presentación administrativa.
- Los controles de acceso y tasa (Rate Limiting) funcionan correctamente.
