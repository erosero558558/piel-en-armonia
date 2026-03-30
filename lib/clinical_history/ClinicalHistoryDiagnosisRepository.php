<?php

declare(strict_types=1);

require_once __DIR__ . '/../common.php';

final class ClinicalHistoryDiagnosisRepository
{

    public static function normalizeInterconsultationDiagnoses($items): array
        {
            if (!is_array($items)) {
                return [];
            }
    
            $normalized = [];
            foreach ($items as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $normalized[] = self::normalizeInterconsultationDiagnosis($item);
            }
    
            return array_values($normalized);
        }

    public static function normalizeInterconsultationDiagnosis(array $diagnosis): array
        {
            $type = self::trimString($diagnosis['type'] ?? 'pre');
            if (!in_array($type, ['pre', 'def'], true)) {
                $type = 'pre';
            }
    
            return [
                'type' => $type,
                'label' => self::trimString($diagnosis['label'] ?? ''),
                'cie10' => self::trimString($diagnosis['cie10'] ?? ''),
            ];
        }

    private static function trimString($value): string
        {
            return trim((string) $value);
        }
}
