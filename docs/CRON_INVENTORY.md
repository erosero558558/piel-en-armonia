# Aurora Derm — Inventario de Tareas Programadas (Cron/Workers)

Este documento detalla todas las tareas en segundo plano que garantizan la operatividad de Aurora Derm (Pipeline de correos, IA, limpieza y backups).
Estas tareas están expuestas en `cron.php` y se protegen mediante el token `AURORADERM_CRON_SECRET`.

## 1. Tareas de Mantenimiento de Estado (State Reconciliation)

### `action=clinical-history-reconcile`
- **Frecuencia Sugerida:** Cada 1 a 5 minutos (`*/5 * * * *`)
- **Propósito:** Escanea las notas evolutivas y la historia clínica para solidificar sesiones médicas estancadas, compilar firmas de los especialistas o cerrar tickets de telemedicina abandonados.
- **Health Signal:** Reporta el diferencial de expedientes "scaned" contra "mutated".

### `action=ai-queue-worker`
- **Frecuencia Sugerida:** Cada 1 minuto (`* * * * *`)
- **Propósito:** Orquesta el `JobProcessor` (`lib/figo_queue/`) despachando los prompts de IA encolados (OpenClaw) que excedieron el *time-budget* de procesamiento en vivo. Permite que tareas asíncronas masivas (ej: resúmenes de historias de años) operen sin bloquear UX.
- **Health Signal:** Monitoreable desde status check, expone latencia de cola y tasa de fallos de gateway remoto.

### `action=process-retries`
- **Frecuencia Sugerida:** Cada 15 minutos (`*/15 * * * *`)
- **Propósito:** Motor de reintentos genérico. Lee de la base interna fallas que no pasaron del 3er strike (ej: caídas de webhook, correos rebotados limitados por API), y ejecuta exponential backoff para inyectarlos al sistema nuevamente.

## 2. Operaciones Comerciales y de Retención

### `action=reminders`
- **Frecuencia Sugerida:** Diaria a las 18:00 (`0 18 * * *`)
- **Propósito:** Pipeline masivo de mensajería (WhatsApp y Email):
  - **Citas de Mañana:** Envío preventivo para disminuir el Inasistencia / No-Show.
  - **Seguimientos (FollowUps):** Re-llamado de pacientes que se trataron el mes pasado.
  - **Medicación:** Alertas de renovación de tratamiento.
  - **Suscripción de Software:** Avisos in-app/Whatsapp de trials de Flow OS a caducar (para Tenants).
  - **Cumpleaños:** Fidelización.

### `action=gift-cards-reminders`
- **Frecuencia Sugerida:** Diaria
- **Propósito:** Avisa a clientes o pacientes que tienen saldos (Gift Cards o Membresías prepagadas) con caducidad menor a 14 días.

## 3. Seguridad de Datos (Backup)

### `action=backup-health`
- **Frecuencia Sugerida:** Diaria en madrugada (`10 3 * * *`)
- **Propósito:** Valida que el tamaño y suma de los archivos generados en `data/backups/` tengan integridad coherente comparado con los del último snapshot y alerta si la compresión JSON falla. Integrado al `system-status`.

### `action=backup-offsite`
- **Frecuencia Sugerida:** Semanal o Diaria (`20 3 * * *`)
- **Propósito:** Transfiere la compresión encriptada a un blob storage seguro offsite para garantías de Disaster Recovery (Zero Trust).
