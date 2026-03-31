# Motor de Promociones (S17-10)

El Motor de Promociones de Aurora Derm permite mostrar ofertas y campañas condicionales a los usuarios dependiendo de su estatus como pacientes.

## Arquitectura

El core está en `lib/promotions/PromotionEngine.php`, el cual evalúa una serie de reglas sobre un contexto de paciente.

### Endpoint

Para obtener las promociones aplicables:

```http
GET /api.php?resource=active-promotions&ci=12345678
```

Si no se envía `ci` (cédula o número identificador), el sistema asumirá que el visitante es un usuario anónimo (paciente potencial de `primera_vez`).

### Formato de Guardado en el Store (UI Admin)

Las promociones se guardan en el array global `promotions` de `store.json` (o SQLite), con el siguiente esquema:

```json
{
    "id": "promo-bienvenida",
    "title": "Primera consulta",
    "description": "15% de beneficio en tu primera visita dermatológica",
    "vigencia_start": "2024-05-01",
    "vigencia_end": "2024-05-31",
    "elegibilidad": "primera_vez",
    "exclusiones": ["miembro"],
    "descuento": "15%",
    "is_active": true
}
```

## Reglas y Condiciones

### Elegibilidad
La propiedad `elegibilidad` puede tomar los siguientes valores:
- `todos`: Cualquier paciente que consulte el endpoint.
- `primera_vez`: Solo usuarios que no tengan citas agendadas confirmadas previamente (si envían CI y existe récord de cita, son excluidos).
- `miembro`: Solo usuarios con membresía activa (`has_active_membership`).
- `referido`: Usuarios cuyo `acquisition_source` sea 'referral'.

### Exclusiones
Ciertas promociones tienen exclusiones explícitas para prevenir abusos.
Ejemplo: `["miembro", "paciente_existente"]`. Si un paciente tiene el atributo correspondiente (es miembro), la promoción se excluye de la respuesta enviada al front-end, aunque la eligibilidad teórica haya sido pasada.

### Vigencia Temporal
- `vigencia_start`: Formato ISO `YYYY-MM-DD`. Si la fecha actual es anterior, la promo no se envía.
- `vigencia_end`: Formato ISO `YYYY-MM-DD`. Si la fecha actual es posterior, la promo se desactiva automáticamente.

### Estado
- `is_active`: booleano (`true`/`false`). Forma explícita del Administrador para deshabilitar temporal o permanentemente una promoción.
