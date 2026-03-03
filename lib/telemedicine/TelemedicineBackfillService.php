<?php

declare(strict_types=1);

require_once __DIR__ . '/../audit.php';
require_once __DIR__ . '/LegacyTelemedicineBridge.php';
require_once __DIR__ . '/TelemedicineRepository.php';

final class TelemedicineBackfillService
{
    private LegacyTelemedicineBridge $bridge;

    public function __construct()
    {
        $this->bridge = new LegacyTelemedicineBridge();
    }

    public function backfill(array $store): array
    {
        $appointments = isset($store['appointments']) && is_array($store['appointments']) ? $store['appointments'] : [];
        $updatedAppointments = [];
        $created = 0;
        $updated = 0;

        foreach ($appointments as $appointment) {
            $service = (string) ($appointment['service'] ?? '');
            if (!TelemedicineChannelMapper::isTelemedicineService($service)) {
                $updatedAppointments[] = $appointment;
                continue;
            }

            $existing = TelemedicineRepository::findIntakeByAppointmentId($store, (int) ($appointment['id'] ?? 0));
            $result = $this->bridge->finalizeBookedAppointment($store, $appointment);
            $store = $result['store'];
            $appointment = $result['appointment'];
            if (is_array($result['intake'])) {
                $result['intake']['status'] = 'legacy_migrated';
                $saved = TelemedicineRepository::upsertIntake($store, $result['intake']);
                $store = $saved['store'];
                $appointment['telemedicineIntakeId'] = (int) ($saved['intake']['id'] ?? 0);
                if ($existing === null) {
                    $created++;
                } else {
                    $updated++;
                }
                audit_log_event('telemedicine.legacy_backfilled', [
                    'appointmentId' => (int) ($appointment['id'] ?? 0),
                    'intakeId' => (int) ($saved['intake']['id'] ?? 0),
                ]);
            }

            $updatedAppointments[] = $appointment;
        }

        $store['appointments'] = $updatedAppointments;

        return [
            'store' => $store,
            'created' => $created,
            'updated' => $updated,
        ];
    }
}
