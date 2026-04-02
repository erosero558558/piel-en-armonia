# Auditoría de `LegacyTelemedicineBridge.php` (S7-15)

De acuerdo a la revisión del código en el sprint 7, el componente `LegacyTelemedicineBridge` no puede ser eliminado ni movido a `_archive/` en este momento, debido a que mantiene dependencias activas (callers en uso) en controladores del core.

## Callers Activos Identificados

1. **`controllers/PaymentController.php`** (Línea 722)
   El controlador asíncrono para pagos online todavía instancia el bridge para notificar al sistema de telemedicina sobre pagos compensados.
2. **`lib/BookingService.php`** (Línea 220)
   El flujo principal de agendamiento delega aquí la conexión legacy.
3. **`lib/telemedicine/TelemedicineBackfillService.php`** (Línea 15)
   El servicio de retro-compatiblidad lo requiere estructuralmente.

## Decisión
Debido a la existencia de 3 callers críticos en el flujo de pagos, agendamiento y backfills, el archivo **no será deprecado ni purgado** durante este batch de tickets. Se recomienda agendar refactorizaciones individuales para bifurcar `PaymentController` y `BookingService` hacia `TelemedicineIntakeService` directamente.
