# Documentación de la API

La API de Aurora Derm es el núcleo backend que gestiona citas, pagos, reseñas y disponibilidad. Esta documentación complementa la especificación técnica OpenAPI.

## Referencia Técnica

Para una definición completa de los endpoints, esquemas de datos y ejemplos de respuesta, consulta el archivo OpenAPI:

📄 **[openapi.yaml](./openapi.yaml)**

Puedes visualizar este archivo importándolo en herramientas como [Swagger Editor](https://editor.swagger.io/).

## Autenticación

La API utiliza dos mecanismos principales de seguridad dependiendo del contexto:

### 1. Sesión de Administrador (Cookie)

Para los endpoints protegidos (marcados como `Admin` en OpenAPI), se requiere una sesión activa.

- **Mecanismo:** Cookie estándar de PHP (`PHPSESSID`).
- **Inicio de Sesión:** Se realiza a través de `login.php` (no parte de la API REST pura).
- **Verificación:** La API verifica `$_SESSION['admin_logged_in'] === true`.

### 2. Protección CSRF (Header)

Para las mutaciones (`POST`, `PUT`, `PATCH`) realizadas por administradores, se requiere un token CSRF para prevenir ataques Cross-Site Request Forgery.

- **Header:** `X-CSRF-Token`
- **Obtención:** El token se inyecta en el frontend administrativo (`admin.html`) al cargar.

## Rate Limiting (Límites de Velocidad)

Para proteger la disponibilidad del sistema y prevenir abusos, la API implementa límites de velocidad estrictos por dirección IP. Si excedes el límite, recibirás un error `429 Too Many Requests`.

| Endpoint (Resource) | Método   | Límite (Requests) | Ventana (Segundos) |
| :------------------ | :------- | :---------------- | :----------------- |
| `figo-config`       | POST/PUT | 6                 | 60                 |
| `payment-intent`    | POST     | 8                 | 60                 |
| `payment-verify`    | POST     | 12                | 60                 |
| `transfer-proof`    | POST     | 6                 | 60                 |
| `appointments`      | POST     | 5                 | 60                 |
| `callbacks`         | POST     | 5                 | 60                 |
| `reviews`           | POST     | 3                 | 60                 |
| `reschedule`        | PATCH    | 5                 | 60                 |

_Nota: Los límites se aplican por IP mediante un sistema de sharding basado en archivos._

## Códigos de Error

La API sigue los estándares HTTP para códigos de estado. Las respuestas de error siempre incluyen un cuerpo JSON con el formato:

```json
{
    "ok": false,
    "error": "Descripción legible del error"
}
```

### Códigos Comunes

- **200 OK**: Solicitud exitosa.
- **201 Created**: Recurso creado exitosamente (ej. Cita agendada).
- **400 Bad Request**: Datos de entrada inválidos o faltantes.
- **401 Unauthorized**: Requiere sesión de administrador.
- **403 Forbidden**: Token CSRF inválido o permisos insuficientes.
- **404 Not Found**: El recurso o endpoint no existe.
- **409 Conflict**: Conflicto de estado (ej. Horario ya reservado).
- **422 Unprocessable Entity**: La solicitud es válida pero no apta clínicamente para telemedicina con enforcement activo.
- **429 Too Many Requests**: Excedido el límite de velocidad.
- **500 Internal Server Error**: Error inesperado del servidor.
- **502 Bad Gateway**: Error en servicio externo (ej. Stripe falló).
- **503 Service Unavailable**: Servicio en mantenimiento o sobrecarga temporal.

## Ejemplos de Uso

## Telemedicina Backend v2

Sin cambiar el frontend actual, los flujos legacy con `service=telefono` y
`service=video` ahora se procesan internamente como telemedicina:

- `payment-intent` crea o actualiza un intake borrador en shadow mode.
- `transfer-proof` actua como upload legacy staged; el backend decide despues si
  el archivo termina siendo `payment_proof` o `case_photo`.
- `appointments` vincula el intake con la cita real y persiste metadata
  telemedicina aditiva (`telemedicineIntakeId`, `telemedicineChannel`,
  `telemedicineSuitability`, `telemedicineReviewRequired`,
  `telemedicineEscalationRecommendation`).
- enforcement progresivo backend-only disponible por flags:
    - `AURORADERM_TELEMED_V2_ENFORCE_UNSUITABLE=1` bloquea reservas con
      suitability `unsuitable` (error `telemedicine_unsuitable`, HTTP `422`).
    - `AURORADERM_TELEMED_V2_ENFORCE_REVIEW_REQUIRED=1` bloquea reservas
      `review_required` (error `telemedicine_review_required`, HTTP `409`).
    - `AURORADERM_TELEMED_V2_ALLOW_DECISION_OVERRIDE=1` permite override
      cuando staff marco `approve_remote`.

La compatibilidad publica se mantiene: no hay endpoints breaking ni cambios
obligatorios de frontend en esta fase.

## Observabilidad Operativa de Telemedicina

La fase backend-only agrega observabilidad aditiva sin abrir endpoints nuevos:

- `GET /api.php?resource=health` incluye `checks.telemedicine` con resumen
  operativo sin PHI:
    - conteos de intakes
    - conteos por `status`, `suitability` y `channel`
    - integridad (`linkedAppointmentsCount`, `unlinkedIntakesCount`,
      `stagedLegacyUploadsCount`, etc.)
    - `reviewQueueCount`
    - `latestActivityAt`
    - `policy` (`shadowModeEnabled`, `enforceUnsuitable`,
      `enforceReviewRequired`, `allowDecisionOverride`)
- `GET /api.php?resource=data` incluye `data.telemedicineMeta` para staff/admin:
    - `summary` con el mismo snapshot resumido
    - `reviewQueue` con items accionables para triage manual
- `GET /api.php?resource=telemedicine-intakes` (admin) devuelve:
    - `summary` operativo
    - `reviewQueue` admin
    - `intakes` filtrables por `status`, `channel`, `suitability`,
      `decision`, `reviewOnly`, `includeResolved`
- `PATCH /api.php?resource=telemedicine-intakes` (admin) permite registrar
  decision de triage persistente sobre un intake:
    - `approve_remote`
    - `request_more_info`
    - `escalate_presential`
- `POST /api.php?resource=telemedicine-policy-simulate` (admin) permite
  simular resultado de enforcement (`allowed/blocked`) sin persistir cambios.
  Soporta `policyOverride` para pruebas what-if en staging.
- `GET /api.php?resource=telemedicine-rollout-readiness` (admin) devuelve
  proyección de escenarios de rollout (`shadow_only`,
  `enforce_unsuitable`, `enforce_unsuitable_and_review`) sobre el estado
  actual de intakes.
- `GET /api.php?resource=telemedicine-ops-diagnostics` (admin) devuelve
  diagnóstico operativo post-backfill con severidades (`healthy|degraded|critical`),
  checks por código y acciones sugeridas de remediación.
- `GET /api.php?resource=metrics` exporta gauges Prometheus operativos,
  incluyendo:
    - `AURORADERM_queue_size`
    - `AURORADERM_queue_waiting_total`
    - `AURORADERM_queue_called_total`
    - `AURORADERM_queue_tickets_total{status=...}`
    - `AURORADERM_queue_help_requests_pending_total`
    - `AURORADERM_telemedicine_intakes_total`
    - `AURORADERM_telemedicine_review_queue_total`
    - `AURORADERM_telemedicine_review_decisions_total`
    - `AURORADERM_telemedicine_review_state_total`
    - `AURORADERM_telemedicine_unlinked_intakes_total`
    - `AURORADERM_telemedicine_staged_legacy_uploads_total`
    - `AURORADERM_telemedicine_shadow_mode_enabled`
    - `AURORADERM_telemedicine_enforce_unsuitable_enabled`
    - `AURORADERM_telemedicine_enforce_review_required_enabled`
    - `AURORADERM_telemedicine_allow_decision_override_enabled`
    - `AURORADERM_telemedicine_diagnostics_status{status=...}`
    - `AURORADERM_telemedicine_diagnostics_issues_total{severity=...}`
    - `AURORADERM_telemedicine_diagnostics_healthy`

Herramienta operativa de rollout:

- `php bin/telemedicine-rollout-readiness.php` genera un resumen JSON con
  proyección de bloqueos en escenarios:
    - `shadow_only`
    - `enforce_unsuitable`
    - `enforce_unsuitable_and_review`
- `php bin/telemedicine-ops-diagnostics.php` genera diagnóstico operativo de
  integridad y backlog de telemedicina.
    - `--data-dir <path>` fuerza el data dir de lectura para auditorías puntuales.
    - `--strict` retorna exit code `2` si hay issues `critical`.
    - `--fail-on-warning` retorna exit code `3` si hay issues `critical|warning`.

Regla de seguridad:

- `health` no expone cola detallada ni datos de paciente.
- la cola detallada solo aparece en `/data`, que sigue siendo endpoint admin.

### Consultar Disponibilidad

```http
GET /api.php?resource=availability
```

### Reservar una Cita (Público)

```http
POST /api.php?resource=appointments
Content-Type: application/json

{
  "service": "consulta",
  "doctor": "rosero",
  "date": "2023-11-15",
  "time": "10:00",
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "phone": "0991234567",
  "privacyConsent": true
}
```
