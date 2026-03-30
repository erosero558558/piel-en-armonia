<?php

declare(strict_types=1);

require_once __DIR__ . '/../common.php';
require_once __DIR__ . '/ClinicalHistoryPrescriptionRepository.php';

final class ClinicalHistoryEvolutionRepository
{

    public static function normalizeHcu005Draft(array $draft): array
        {
            $sectionSeed = isset($draft['hcu005']) && is_array($draft['hcu005'])
                ? $draft['hcu005']
                : $draft;
    
            return array_merge(
                self::normalizeHcu005Section($sectionSeed, [
                    'evolutionNote' => self::trimString($draft['resumen'] ?? $draft['resumenClinico'] ?? ''),
                    'diagnosticImpression' => implode(', ', self::normalizeStringList($draft['cie10Sugeridos'] ?? [])),
                    'therapeuticPlan' => self::trimString($draft['tratamientoBorrador'] ?? ''),
                    'careIndications' => self::trimString(
                        is_array($draft['posologiaBorrador'] ?? null)
                            ? ($draft['posologiaBorrador']['texto'] ?? '')
                            : ''
                    ),
                ]),
                [
                    'prescriptionItems' => self::normalizePrescriptionItems(
                        $sectionSeed['prescriptionItems'] ?? $draft['prescriptionItems'] ?? []
                    ),
                ]
            );
        }

    public static function normalizeHcu005Section(array $section, array $fallback = []): array
        {
            $source = array_merge($fallback, $section);
    
            return [
                'evolutionNote' => self::trimString($source['evolutionNote'] ?? ''),
                'diagnosticImpression' => self::trimString($source['diagnosticImpression'] ?? ''),
                'therapeuticPlan' => self::trimString($source['therapeuticPlan'] ?? ''),
                'careIndications' => self::trimString($source['careIndications'] ?? ''),
            ];
        }

    public static function evaluateHcu005(array $hcu005): array
        {
            $normalized = self::normalizeHcu005Draft($hcu005);
            $items = self::normalizePrescriptionItems($normalized['prescriptionItems'] ?? []);
            $startedItems = array_values(array_filter($items, static fn (array $item): bool => self::prescriptionItemIsStarted($item)));
            $incompleteItems = array_values(array_filter($startedItems, static fn (array $item): bool => !self::prescriptionItemIsComplete($item)));
    
            $hasEvolution = self::trimString($normalized['evolutionNote'] ?? '') !== '';
            $hasDiagnostic = self::trimString($normalized['diagnosticImpression'] ?? '') !== '';
            $hasPlanOrCare =
                self::trimString($normalized['therapeuticPlan'] ?? '') !== ''
                || self::trimString($normalized['careIndications'] ?? '') !== '';
            $hasAnyContent = $hasEvolution || $hasDiagnostic || $hasPlanOrCare || $startedItems !== [];
    
            $status = 'missing';
            if ($hasAnyContent) {
                $status = ($hasEvolution && $hasDiagnostic && $hasPlanOrCare && $incompleteItems === [])
                    ? 'complete'
                    : 'partial';
            }
    
            return [
                'status' => $status,
                'hasAnyContent' => $hasAnyContent,
                'hasEvolutionNote' => $hasEvolution,
                'hasDiagnosticImpression' => $hasDiagnostic,
                'hasPlanOrCare' => $hasPlanOrCare,
                'startedPrescriptionItems' => count($startedItems),
                'incompletePrescriptionItems' => count($incompleteItems),
                'incompletePrescriptionDetails' => array_values($incompleteItems),
            ];
        }

    public static function renderHcu005Summary(array $section): string
        {
            $normalized = self::normalizeHcu005Section($section);
            if ($normalized['diagnosticImpression'] !== '') {
                return $normalized['diagnosticImpression'];
            }
            if ($normalized['evolutionNote'] !== '') {
                return $normalized['evolutionNote'];
            }
    
            return implode(' | ', array_filter([
                $normalized['therapeuticPlan'],
                $normalized['careIndications'],
            ]));
        }

    public static function renderHcu005Content(array $section): string
        {
            $normalized = self::normalizeHcu005Section($section);
            $lines = [
                self::trimString($normalized['evolutionNote']) !== ''
                    ? 'Evolucion clinica: ' . $normalized['evolutionNote']
                    : '',
                self::trimString($normalized['diagnosticImpression']) !== ''
                    ? 'Impresion diagnostica: ' . $normalized['diagnosticImpression']
                    : '',
                self::trimString($normalized['therapeuticPlan']) !== ''
                    ? 'Plan terapeutico: ' . $normalized['therapeuticPlan']
                    : '',
                self::trimString($normalized['careIndications']) !== ''
                    ? 'Indicaciones / cuidados: ' . $normalized['careIndications']
                    : '',
            ];
    
            return trim(implode("\n", array_filter($lines, static fn ($line): bool => is_string($line) && trim($line) !== '')));
        }

    private static function normalizePrescriptionItems($items): array
        {
            return ClinicalHistoryPrescriptionRepository::normalizePrescriptionItems($items);
        }

    private static function prescriptionItemIsStarted(array $item): bool
        {
            return ClinicalHistoryPrescriptionRepository::prescriptionItemIsStarted($item);
        }

    private static function prescriptionItemIsComplete(array $item): bool
        {
            return ClinicalHistoryPrescriptionRepository::prescriptionItemIsComplete($item);
        }

    /**
     * @return array<int,string>
     */
    private static function normalizeStringList($items): array
        {
            if (!is_array($items)) {
                return [];
            }

            $normalized = [];
            foreach ($items as $item) {
                $value = self::trimString($item);
                if ($value !== '') {
                    $normalized[] = $value;
                }
            }

            return array_values($normalized);
        }

    private static function trimString($value): string
        {
            return trim((string) $value);
        }
}
