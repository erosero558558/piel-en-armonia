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

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $options
     * @return array<string,mixed>
     */
    public function backfill(array $store, array $options = []): array
    {
        $dryRun = $this->toBool($options['dryRun'] ?? false, false);
        $force = $this->toBool($options['force'] ?? false, false);
        $emitAudit = $this->toBool($options['emitAudit'] ?? true, true);
        $limit = max(0, (int) ($options['limit'] ?? 0));

        $appointments = isset($store['appointments']) && is_array($store['appointments']) ? $store['appointments'] : [];
        $updatedAppointments = [];
        $stats = [
            'scanned' => 0,
            'telemedicineCandidates' => 0,
            'processed' => 0,
            'created' => 0,
            'updated' => 0,
            'skippedAlreadyMigrated' => 0,
            'skippedByLimit' => 0,
        ];
        $changes = [];

        foreach ($appointments as $appointment) {
            $stats['scanned']++;
            $service = (string) ($appointment['service'] ?? '');
            if (!TelemedicineChannelMapper::isTelemedicineService($service)) {
                $updatedAppointments[] = $appointment;
                continue;
            }

            $stats['telemedicineCandidates']++;
            $existing = TelemedicineRepository::findIntakeByAppointmentId($store, (int) ($appointment['id'] ?? 0));
            $alreadyMigrated = $this->isAlreadyMigrated($appointment, $existing);
            if ($alreadyMigrated && !$force) {
                $stats['skippedAlreadyMigrated']++;
                $updatedAppointments[] = $appointment;
                continue;
            }
            if ($limit > 0 && $stats['processed'] >= $limit) {
                $stats['skippedByLimit']++;
                $updatedAppointments[] = $appointment;
                continue;
            }

            $stats['processed']++;
            $action = is_array($existing) ? 'update' : 'create';
            if ($dryRun) {
                if ($action === 'create') {
                    $stats['created']++;
                } else {
                    $stats['updated']++;
                }
                $changes[] = [
                    'appointmentId' => (int) ($appointment['id'] ?? 0),
                    'intakeId' => (int) ($existing['id'] ?? 0),
                    'action' => $action,
                    'reason' => $alreadyMigrated ? 'force' : 'needs_backfill',
                ];
                $updatedAppointments[] = $appointment;
                continue;
            }

            $result = $this->bridge->finalizeBookedAppointment($store, $appointment);
            $store = $result['store'];
            $appointment = $result['appointment'];
            if (is_array($result['intake'])) {
                $result['intake']['status'] = 'legacy_migrated';
                $saved = TelemedicineRepository::upsertIntake($store, $result['intake']);
                $store = $saved['store'];
                $appointment['telemedicineIntakeId'] = (int) ($saved['intake']['id'] ?? 0);
                if ($existing === null) {
                    $stats['created']++;
                } else {
                    $stats['updated']++;
                }
                if ($emitAudit) {
                    audit_log_event('telemedicine.legacy_backfilled', [
                        'appointmentId' => (int) ($appointment['id'] ?? 0),
                        'intakeId' => (int) ($saved['intake']['id'] ?? 0),
                    ]);
                }
                $changes[] = [
                    'appointmentId' => (int) ($appointment['id'] ?? 0),
                    'intakeId' => (int) ($saved['intake']['id'] ?? 0),
                    'action' => $action,
                    'reason' => $alreadyMigrated ? 'force' : 'migrated',
                ];
            }

            $updatedAppointments[] = $appointment;
        }

        if (!$dryRun) {
            $store['appointments'] = $updatedAppointments;
        }

        return [
            'store' => $store,
            'created' => (int) $stats['created'],
            'updated' => (int) $stats['updated'],
            'stats' => $stats,
            'changes' => $changes,
            'dryRun' => $dryRun,
            'changed' => ((int) $stats['created'] + (int) $stats['updated']) > 0,
        ];
    }

    /**
     * @param array<string,mixed>|null $existing
     * @param array<string,mixed> $appointment
     */
    private function isAlreadyMigrated(array $appointment, ?array $existing): bool
    {
        if (!is_array($existing)) {
            return false;
        }

        $intakeId = (int) ($existing['id'] ?? 0);
        $appointmentIntakeId = (int) ($appointment['telemedicineIntakeId'] ?? 0);
        if ($intakeId <= 0 || $appointmentIntakeId !== $intakeId) {
            return false;
        }

        if ((string) ($existing['status'] ?? '') !== 'legacy_migrated') {
            return false;
        }

        return $this->appointmentHasTelemedicineMetadata($appointment);
    }

    /**
     * @param array<string,mixed> $appointment
     */
    private function appointmentHasTelemedicineMetadata(array $appointment): bool
    {
        return trim((string) ($appointment['telemedicineChannel'] ?? '')) !== ''
            && trim((string) ($appointment['telemedicineSuitability'] ?? '')) !== ''
            && array_key_exists('telemedicineReviewRequired', $appointment)
            && trim((string) ($appointment['telemedicineEscalationRecommendation'] ?? '')) !== '';
    }

    /**
     * @param mixed $raw
     */
    private function toBool($raw, bool $default): bool
    {
        if (is_bool($raw)) {
            return $raw;
        }
        if (is_int($raw) || is_float($raw)) {
            return ((int) $raw) !== 0;
        }
        if (!is_string($raw)) {
            return $default;
        }

        $normalized = strtolower(trim($raw));
        if (in_array($normalized, ['1', 'true', 'yes', 'on'], true)) {
            return true;
        }
        if (in_array($normalized, ['0', 'false', 'no', 'off'], true)) {
            return false;
        }

        return $default;
    }
}
