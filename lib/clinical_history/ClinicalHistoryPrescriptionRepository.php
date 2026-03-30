<?php

declare(strict_types=1);

require_once __DIR__ . '/../common.php';

final class ClinicalHistoryPrescriptionRepository
{

    public static function normalizePrescriptionItems($items): array
        {
            if (!is_array($items)) {
                return [];
            }
    
            $normalized = [];
            foreach ($items as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $normalized[] = self::normalizePrescriptionItem($item);
            }
    
            return array_values($normalized);
        }

    public static function normalizePrescriptionItem(array $item): array
        {
            return [
                'medication' => self::trimString($item['medication'] ?? ''),
                'presentation' => self::trimString($item['presentation'] ?? ''),
                'dose' => self::trimString($item['dose'] ?? ''),
                'route' => self::trimString($item['route'] ?? ''),
                'frequency' => self::trimString($item['frequency'] ?? ''),
                'duration' => self::trimString($item['duration'] ?? ''),
                'quantity' => self::trimString($item['quantity'] ?? ''),
                'instructions' => self::trimString($item['instructions'] ?? ''),
            ];
        }

    public static function prescriptionItemIsStarted(array $item): bool
        {
            foreach (self::normalizePrescriptionItem($item) as $value) {
                if (self::trimString($value) !== '') {
                    return true;
                }
            }
    
            return false;
        }

    public static function prescriptionItemIsComplete(array $item): bool
        {
            foreach (self::normalizePrescriptionItem($item) as $value) {
                if (self::trimString($value) === '') {
                    return false;
                }
            }
    
            return true;
        }

    public static function renderPrescriptionMedicationMirror(array $items): string
        {
            $labels = [];
            foreach (self::normalizePrescriptionItems($items) as $item) {
                if (!self::prescriptionItemIsStarted($item)) {
                    continue;
                }
                $labels[] = trim(implode(' ', array_filter([
                    $item['medication'],
                    $item['presentation'],
                ])));
            }
    
            return trim(implode("\n", array_filter($labels, static fn ($value): bool => self::trimString($value) !== '')));
        }

    public static function renderPrescriptionDirectionsMirror(array $items): string
        {
            $lines = [];
            foreach (self::normalizePrescriptionItems($items) as $item) {
                if (!self::prescriptionItemIsStarted($item)) {
                    continue;
                }
    
                $segments = array_filter([
                    self::trimString($item['dose'] ?? ''),
                    self::trimString($item['route'] ?? ''),
                    self::trimString($item['frequency'] ?? ''),
                    self::trimString($item['duration'] ?? ''),
                    self::trimString($item['quantity'] ?? '') !== ''
                        ? 'Cantidad ' . self::trimString($item['quantity'] ?? '')
                        : '',
                ], static fn ($value): bool => self::trimString((string) $value) !== '');
    
                $instructions = self::trimString($item['instructions'] ?? '');
                $medication = self::trimString($item['medication'] ?? '');
                $line = $medication !== '' ? $medication . ': ' : '';
                $line .= implode(' • ', $segments);
                if ($instructions !== '') {
                    $line = trim($line) !== ''
                        ? trim($line) . '. ' . $instructions
                        : $instructions;
                }
                $lines[] = trim($line);
            }
    
            return trim(implode("\n", array_filter($lines, static fn ($value): bool => self::trimString($value) !== '')));
        }
}
