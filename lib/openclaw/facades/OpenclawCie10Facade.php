<?php

declare(strict_types=1);

final class OpenclawCie10Facade
{
    public static function suggestCie10(string $q): array
    {
        $q = strtolower(trim($q));
        if (strlen($q) < 2) {
            return ['ok' => true, 'suggestions' => []];
        }

        $cie10Path = __DIR__ . '/../../../data/cie10.json';
        if (!file_exists($cie10Path)) {
            return ['ok' => false, 'error' => 'Catálogo CIE-10 no disponible', 'statusCode' => 503];
        }

        $data  = json_decode((string) file_get_contents($cie10Path), true) ?? [];
        $codes = $data['codes'] ?? [];

        $suggestions = [];
        $qWords      = explode(' ', $q);

        foreach ($codes as $code => $info) {
            $description = strtolower((string) ($info['d'] ?? ''));
            $category    = strtolower((string) ($info['c'] ?? ''));
            $codeL       = strtolower((string) $code);

            $score = 0;

            // Exact code match
            if ($codeL === $q || str_starts_with($codeL, $q)) {
                $score += 100;
            }

            // All words present in description
            $allFound = true;
            foreach ($qWords as $word) {
                if (!str_contains($description, $word) && !str_contains($category, $word)) {
                    $allFound = false;
                    break;
                }
            }
            if ($allFound && count($qWords) > 1) {
                $score += 80;
            }

            // Partial word match
            foreach ($qWords as $word) {
                if (str_contains($description, $word)) {
                    $score += 20;
                }
                if (str_contains($category, $word)) {
                    $score += 10;
                }
            }

            if ($score > 0) {
                $suggestions[] = [
                    'code'        => $code,
                    'description' => $info['d'],
                    'category'    => $info['c'],
                    'confidence'  => min(1.0, round($score / 100, 2)),
                ];
            }
        }

        // Sort by confidence DESC
        usort($suggestions, static fn($a, $b) => $b['confidence'] <=> $a['confidence']);

        return [
            'ok'          => true,
            'suggestions' => array_slice($suggestions, 0, 8),
        ];
    }

    public static function getTreatmentProtocol(string $code): array
    {
        // Buscar protocolo específico
        $protocolPath = __DIR__ . '/../../../data/protocols/' . preg_replace('/[^A-Z0-9.]/', '', $code) . '.json';
        if (file_exists($protocolPath)) {
            $protocol = json_decode((string) file_get_contents($protocolPath), true) ?? [];
            return ['ok' => true] + $protocol;
        }

        // Protocolo genérico por categoría CIE-10
        $generic = self::genericProtocol($code);
        return ['ok' => true] + $generic;
    }

    public static function genericProtocol(string $code): array
    {
        $prefix = substr($code, 0, 1);

        $protocols = [
            'L' => [
                'cie10_code'          => $code,
                'first_line'          => [
                    ['medication' => 'Emoliente', 'dose' => 'aplicar 2-3 veces/día', 'duration' => 'continuo'],
                    ['medication' => 'Hidrocortisona 1%', 'dose' => 'aplicar bid', 'duration' => '14 días'],
                ],
                'alternatives'        => ['Betametasona 0.05% si respuesta pobre', 'Tacrolimus 0.1% para mantenimiento'],
                'follow_up'           => '4 semanas. Si no mejora: biopsia o interconsulta dermatología.',
                'referral_criteria'   => 'Afección >30% superficie corporal, signos sistémicos, sin respuesta a 8 semanas',
                'patient_instructions'=> 'Evitar rascado. Baños cortos con agua tibia. Ropa de algodón.',
            ],
            'B' => [
                'cie10_code'        => $code,
                'first_line'        => [
                    ['medication' => 'Según infección específica', 'dose' => 'ver protocolo', 'duration' => 'variable'],
                ],
                'alternatives'      => ['Consultar protocolo específico'],
                'follow_up'         => '2 semanas post-tratamiento.',
                'referral_criteria' => 'Infección diseminada, inmunocompromiso.',
                'patient_instructions'=> 'Completar tratamiento. Higiene estricta. Evitar contacto.',
            ],
            'C' => [
                'cie10_code'        => $code,
                'first_line'        => [
                    ['medication' => 'Derivación oncología urgente', 'dose' => '-', 'duration' => '<2 semanas'],
                ],
                'alternatives'      => [],
                'follow_up'         => 'Oncología dermatológica.',
                'referral_criteria' => 'SIEMPRE derivar',
                'patient_instructions'=> 'Evitar exposición solar. Acudir urgente a especialista.',
            ],
        ];

        return $protocols[$prefix] ?? [
            'cie10_code'         => $code,
            'first_line'         => [],
            'alternatives'       => [],
            'follow_up'          => 'Evaluación clínica.',
            'referral_criteria'  => 'Según criterio médico.',
            'patient_instructions'=> '',
        ];
    }
}
