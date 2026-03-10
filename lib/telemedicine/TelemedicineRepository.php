<?php

declare(strict_types=1);

require_once __DIR__ . '/../common.php';

final class TelemedicineRepository
{
    public static function nextId(array $records): int
    {
        $max = 0;
        foreach ($records as $record) {
            $id = (int) ($record['id'] ?? 0);
            if ($id > $max) {
                $max = $id;
            }
        }

        return $max + 1;
    }

    public static function upsertIntake(array $store, array $intake): array
    {
        $store['telemedicine_intakes'] = isset($store['telemedicine_intakes']) && is_array($store['telemedicine_intakes'])
            ? $store['telemedicine_intakes']
            : [];

        $records = $store['telemedicine_intakes'];
        $intake['updatedAt'] = local_date('c');
        if (!isset($intake['createdAt']) || trim((string) $intake['createdAt']) === '') {
            $intake['createdAt'] = $intake['updatedAt'];
        }

        $targetId = (int) ($intake['id'] ?? 0);
        foreach ($records as $index => $existing) {
            if ((int) ($existing['id'] ?? 0) !== $targetId) {
                continue;
            }
            $records[$index] = $intake;
            $store['telemedicine_intakes'] = array_values($records);
            return ['store' => $store, 'intake' => $intake];
        }

        if ($targetId <= 0) {
            $intake['id'] = self::nextId($records);
        }
        $records[] = $intake;
        $store['telemedicine_intakes'] = array_values($records);

        return ['store' => $store, 'intake' => $intake];
    }

    public static function findIntakeByAppointmentId(array $store, int $appointmentId): ?array
    {
        foreach (($store['telemedicine_intakes'] ?? []) as $intake) {
            if ((int) ($intake['linkedAppointmentId'] ?? 0) === $appointmentId) {
                return $intake;
            }
        }

        return null;
    }

    public static function findIntakeById(array $store, int $intakeId): ?array
    {
        foreach (($store['telemedicine_intakes'] ?? []) as $intake) {
            if ((int) ($intake['id'] ?? 0) === $intakeId) {
                return $intake;
            }
        }

        return null;
    }

    public static function findDraftByFingerprint(array $store, array $appointment): ?array
    {
        $fingerprint = self::draftFingerprint($appointment);
        foreach (($store['telemedicine_intakes'] ?? []) as $intake) {
            if ((string) ($intake['draftFingerprint'] ?? '') === $fingerprint) {
                return $intake;
            }
        }

        return null;
    }

    public static function replaceAppointment(array $store, array $appointment): array
    {
        $records = isset($store['appointments']) && is_array($store['appointments'])
            ? $store['appointments']
            : [];

        $targetId = (int) ($appointment['id'] ?? 0);
        if ($targetId <= 0) {
            return $store;
        }

        foreach ($records as $index => $existing) {
            if ((int) ($existing['id'] ?? 0) !== $targetId) {
                continue;
            }
            $records[$index] = $appointment;
            $store['appointments'] = array_values($records);
            return $store;
        }

        return $store;
    }

    public static function upsertClinicalUpload(array $store, array $upload): array
    {
        $store['clinical_uploads'] = isset($store['clinical_uploads']) && is_array($store['clinical_uploads'])
            ? $store['clinical_uploads']
            : [];

        $records = $store['clinical_uploads'];
        $upload['updatedAt'] = local_date('c');
        if (!isset($upload['createdAt']) || trim((string) $upload['createdAt']) === '') {
            $upload['createdAt'] = $upload['updatedAt'];
        }

        $targetId = (int) ($upload['id'] ?? 0);
        foreach ($records as $index => $existing) {
            if ((int) ($existing['id'] ?? 0) !== $targetId) {
                continue;
            }
            $records[$index] = $upload;
            $store['clinical_uploads'] = array_values($records);
            return ['store' => $store, 'upload' => $upload];
        }

        if ($targetId <= 0) {
            $upload['id'] = self::nextId($records);
        }
        $records[] = $upload;
        $store['clinical_uploads'] = array_values($records);

        return ['store' => $store, 'upload' => $upload];
    }

    public static function findClinicalUploadByLegacyPath(array $store, string $legacyPath): ?array
    {
        $needle = trim($legacyPath);
        if ($needle === '') {
            return null;
        }

        foreach (($store['clinical_uploads'] ?? []) as $upload) {
            if (trim((string) ($upload['legacyPublicPath'] ?? '')) === $needle) {
                return $upload;
            }
        }

        return null;
    }

    public static function draftFingerprint(array $appointment): string
    {
        return hash('sha256', implode('|', [
            strtolower(trim((string) ($appointment['email'] ?? ''))),
            strtolower(trim((string) ($appointment['phone'] ?? ''))),
            strtolower(trim((string) ($appointment['service'] ?? ''))),
            trim((string) ($appointment['date'] ?? '')),
            trim((string) ($appointment['time'] ?? '')),
            strtolower(trim((string) ($appointment['doctor'] ?? ''))),
        ]));
    }
}
