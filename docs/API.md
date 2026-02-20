# Documentación de la API

La API de Piel en Armonía es el núcleo backend que gestiona citas, pagos, reseñas y disponibilidad. Esta documentación complementa la especificación técnica OpenAPI.

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
- **429 Too Many Requests**: Excedido el límite de velocidad.
- **500 Internal Server Error**: Error inesperado del servidor.
- **502 Bad Gateway**: Error en servicio externo (ej. Stripe falló).
- **503 Service Unavailable**: Servicio en mantenimiento o sobrecarga temporal.

## Ejemplos de Uso

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
