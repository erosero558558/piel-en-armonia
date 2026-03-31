# Aurora Derm — Cron Jobs Operativos

Este documento rastrea los procesos en segundo plano delegados al sistema operativo, diseñados para disparar automatizaciones esenciales del embudo de agendamiento y retención.

## 1. Recordatorios de Citas (24h)

Envía la notificación automática (correo y link de confirmación de WhatsApp) previendo el show-rate y disminuyendo posibles inasistencias.

- **Comando exacto:** `0 18 * * * /usr/bin/php /var/www/html/bin/send-appointment-reminders.php --json >> /var/log/aurora-reminders.log 2>&1`
- **Usuario recomendado:** `www-data` (o el equivalente al runtime del servidor web)
- **Explicación:** Ejecuta la resolución diaria para citas programadas específicamente el "día de mañana" que no tengan confirmación previa.
- **Output esperado:** Estructura en JSON que detalla el target date y la cantidad de sent, skipped y errors.
- **Gobernanza:** Registra una bitácora perpetua en `governance/appointment-reminders-log.json`.

## 2. Seguimiento Post-Consulta (30 días)

Fomenta controles progresivos invitando al paciente a reagendar luego de un mes exacto de su última visita.

- **Comando exacto:** `0 19 * * * /usr/bin/php /var/www/html/bin/send-followup-reminders.php --json >> /var/log/aurora-followup.log 2>&1`
- **Usuario recomendado:** `www-data`
- **Explicación:** Detecta citas terminadas (`status NOT IN (cancelled, no_show)`) de hace exactamente 30 días, que contengan la bandera expresa de seguimiento `followup_reminder` activada en set `json_data`.
- **Output esperado:** Estructura JSON con keys `total`, `sent` y `targetDate`.
