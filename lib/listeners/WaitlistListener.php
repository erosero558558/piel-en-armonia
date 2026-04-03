<?php

declare(strict_types=1);

require_once __DIR__ . '/../events/BookingCancelled.php';
require_once __DIR__ . '/../common.php';
require_once __DIR__ . '/../models.php';
require_once __DIR__ . '/../LeadOpsService.php';

class WaitlistListener
{
    public function onBookingCancelled(BookingCancelled $event): void
    {
        $appointment = $event->appointment;
        $date = trim((string) ($appointment['date'] ?? ''));
        $doctor = trim((string) ($appointment['doctor'] ?? ''));
        $service = trim((string) ($appointment['service'] ?? ''));

        if ($date === '' || $doctor === '' || $service === '') {
            return;
        }

        with_store_lock(function () use ($date, $doctor, $service) {
            $store = read_store();
            $callbacks = isset($store['callbacks']) && is_array($store['callbacks']) ? $store['callbacks'] : [];
            $modified = false;

            $nowTs = time();
            $cutoff = date('Y-m-d', $nowTs);
            if ($date < $cutoff) {
                return ['ok' => true];
            }

            foreach ($callbacks as &$callback) {
                if (!is_array($callback) || map_callback_status((string) ($callback['status'] ?? 'pendiente')) !== 'pendiente') {
                    continue;
                }

                $preferencia = trim((string) ($callback['preferencia'] ?? ''));
                if (!str_contains($preferencia, '[WAITLIST]')) {
                    continue;
                }

                if (
                    str_contains($preferencia, 'date:' . $date) &&
                    str_contains($preferencia, 'doctor:' . $doctor) &&
                    str_contains($preferencia, 'service:' . $service)
                ) {
                    $phone = trim((string) ($callback['telefono'] ?? ''));
                    if ($phone === '') {
                        continue;
                    }

                    $this->enqueueWaitlistNotification($phone, $date, $doctor, $service);

                    // Mark as contacted so they aren't spammed
                    $callback['status'] = 'contactado';
                    if (!isset($callback['leadOps']) || !is_array($callback['leadOps'])) {
                        $callback['leadOps'] = LeadOpsService::normalizeLeadOps([]);
                    }
                    $callback['leadOps']['contactedAt'] = local_date('c');
                    $callback['leadOps']['outcome'] = 'contactado';
                    $callback['leadOps']['nextAction'] = 'Notificado por cupo liberado en Lista de Espera';
                    $modified = true;
                }
            }
            unset($callback);

            if ($modified) {
                $store['callbacks'] = $callbacks;
                write_store($store);
            }

            return ['ok' => true];
        });
    }

    private function enqueueWaitlistNotification(string $phone, string $date, string $doctor, string $service): void
    {
        if (!function_exists('whatsapp_openclaw_repository')) {
            $bootstrapPath = __DIR__ . '/../whatsapp_openclaw/bootstrap.php';
            if (is_file($bootstrapPath)) {
                require_once $bootstrapPath;
            } else {
                return;
            }
        }

        $doctorLabel = function_exists('get_doctor_label') ? get_doctor_label($doctor) : $doctor;
        $serviceLabel = function_exists('get_service_label') ? get_service_label($service) : $service;
        $dateLabel = function_exists('format_date_label') ? format_date_label($date) : $date;
        $url = app_api_absolute_url('appointments');

        $body = "Hola 👋,\n";
        $body .= "Te informamos que se acaba de liberar un espacio en nuestra agenda:\n\n";
        $body .= "🗓 *Fecha:* " . $dateLabel . "\n";
        $body .= "👩‍⚕️ *Doctor:* " . $doctorLabel . "\n";
        $body .= "📋 *Servicio:* " . $serviceLabel . "\n\n";
        $body .= "Ingresa ahora al siguiente link para asegurar tu turno antes de que se ocupe:\n" . $url . "\n\n";
        $body .= "¡Te esperamos!\n" . AppConfig::BRAND_NAME;

        try {
            whatsapp_openclaw_repository()->enqueueOutbox([
                'phone' => $phone,
                'status' => 'pending',
                'type' => 'text',
                'payload' => [
                    'text' => $body
                ]
            ]);
        } catch (\Throwable $e) {
            error_log('Aurora Derm Waitlist WhatsApp error: ' . $e->getMessage());
        }
    }
}
