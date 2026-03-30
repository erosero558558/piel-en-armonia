<?php

declare(strict_types=1);

require_once __DIR__ . '/../common.php';

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
                    'physicalExam' => self::trimString($draft['physicalExam'] ?? ''),
                    'diagnosticImpression' => implode(', ', self::normalizeStringList($draft['cie10Sugeridos'] ?? [])),
                    'diagnosisType' => self::normalizeDiagnosisType($draft['diagnosisType'] ?? ''),
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
                'physicalExam' => self::trimString($source['physicalExam'] ?? ''),
                'diagnosticImpression' => self::trimString($source['diagnosticImpression'] ?? ''),
                'diagnosisType' => self::normalizeDiagnosisType($source['diagnosisType'] ?? $source['diagnosticType'] ?? ''),
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
                self::trimString($normalized['physicalExam']) !== ''
                    ? 'Examen fisico: ' . $normalized['physicalExam']
                    : '',
                self::trimString($normalized['diagnosticImpression']) !== ''
                    ? 'Impresion diagnostica: ' . $normalized['diagnosticImpression']
                    : '',
                self::trimString($normalized['diagnosisType']) !== ''
                    ? 'Tipo de diagnostico: ' . $normalized['diagnosisType']
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

    private static function normalizeDiagnosisType($value): string
        {
            $normalized = strtoupper(self::trimString($value));

            return match ($normalized) {
                'PRE', 'PRESUNTIVO' => 'PRE',
                'DEF', 'DEFINITIVO' => 'DEF',
                default => '',
            };
        }
}
