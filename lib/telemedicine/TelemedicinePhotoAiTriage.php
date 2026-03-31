<?php

declare(strict_types=1);

final class TelemedicinePhotoAiTriage
{
    private const HIGH_RISK_KEYWORDS = [
        'sangrado',
        'sangra',
        'pus',
        'supura',
        'necrosis',
        'ampolla',
        'ampollas',
        'anafilaxia',
        'anaphylaxis',
        'dificultad para respirar',
        'difficulty breathing',
        'desmayo',
        'perdida de vision',
        'pérdida de visión',
        'parpado',
        'párpado',
    ];

    private const PROGRESSION_KEYWORDS = [
        'empeor',
        'más rojo',
        'mas rojo',
        'ardor',
        'dolor',
        'pica',
        'picor',
        'comezon',
        'comezón',
        'itch',
        'swelling',
        'extend',
        'crec',
    ];

    private const SENSITIVE_AREA_KEYWORDS = [
        'rostro',
        'cara',
        'parpado',
        'párpado',
        'labio',
        'genital',
    ];

    private const STABLE_KEYWORDS = [
        'control',
        'seguimiento',
        'revision',
        'revisión',
        'estable',
        'sin cambios',
    ];

    private const CONSULT_LABELS = [
        'gather_more_info' => 'Pedir mas informacion',
        'async_follow_up' => 'Seguimiento asincronico',
        'scheduled_video' => 'Teleconsulta en video',
        'priority_video' => 'Teleconsulta prioritaria',
        'priority_in_person' => 'Valoracion presencial prioritaria',
    ];

    public static function evaluate(array $intake): array
    {
        $concern = self::resolveConcern($intake);
        $affectedArea = trim((string) ($intake['affectedArea'] ?? ''));
        $haystack = mb_strtolower(trim($concern . ' ' . $affectedArea));
        $photoTriage = isset($intake['photoTriage']) && is_array($intake['photoTriage'])
            ? $intake['photoTriage']
            : [];
        $photoCount = max(
            (int) ($photoTriage['count'] ?? 0),
            count(is_array($intake['clinicalMediaIds'] ?? null) ? $intake['clinicalMediaIds'] : [])
        );
        $missingRoles = array_values(
            is_array($photoTriage['missingRoles'] ?? null) ? $photoTriage['missingRoles'] : []
        );
        $photoSetComplete = $photoCount >= 3 && $missingRoles === [];
        $suitability = trim((string) ($intake['suitability'] ?? 'review_required'));
        $channel = trim((string) ($intake['channel'] ?? ''));

        $signals = [];
        $status = 'ready';
        $urgencyLevel = 1;

        if ($concern === '') {
            $signals[] = 'missing_current_concern';
            $status = 'insufficient_data';
            $urgencyLevel = max($urgencyLevel, 2);
        }

        if ($photoCount <= 0) {
            $signals[] = 'no_case_photos';
            $status = 'insufficient_data';
            $urgencyLevel = max($urgencyLevel, 2);
        } elseif (!$photoSetComplete) {
            $signals[] = 'incomplete_photo_set';
            $status = 'insufficient_data';
            $urgencyLevel = max($urgencyLevel, 2);
        } else {
            $signals[] = 'complete_photo_set';
        }

        if (self::containsAny($haystack, self::PROGRESSION_KEYWORDS)) {
            $signals[] = 'progressive_visual_change';
            $urgencyLevel = max($urgencyLevel, 4);
        }

        if (self::containsAny($haystack, self::HIGH_RISK_KEYWORDS)) {
            $signals[] = 'high_risk_red_flag';
            $urgencyLevel = 5;
        }

        if ($urgencyLevel >= 3 && self::containsAny($haystack, self::SENSITIVE_AREA_KEYWORDS)) {
            $signals[] = 'sensitive_area';
            $urgencyLevel = max($urgencyLevel, 4);
        }

        if ($urgencyLevel <= 2 && self::containsAny($haystack, self::STABLE_KEYWORDS)) {
            $signals[] = 'stable_follow_up';
            $urgencyLevel = 2;
        }

        if ($suitability === 'unsuitable') {
            $signals[] = 'existing_unsuitable_flag';
            $urgencyLevel = max($urgencyLevel, 5);
        }

        $signals = array_values(array_unique($signals));
        $suggestedConsultType = self::resolveSuggestedConsultType(
            $status,
            $urgencyLevel,
            $channel,
            $signals
        );

        return [
            'engine' => 'aurora_telemed_photo_ai_triage_v1',
            'status' => $status,
            'urgencyLevel' => $urgencyLevel,
            'urgencyLabel' => self::urgencyLabel($urgencyLevel),
            'suggestedConsultType' => $suggestedConsultType,
            'suggestedConsultTypeLabel' => self::CONSULT_LABELS[$suggestedConsultType] ?? 'Revision medica',
            'signals' => $signals,
            'summary' => self::buildSummary(
                $urgencyLevel,
                $status,
                $suggestedConsultType,
                $photoCount,
                $missingRoles
            ),
            'requiresDoctorValidation' => true,
            'doctorValidationStatus' => 'pending',
            'doctorValidation' => [
                'status' => 'pending',
                'validatedAt' => '',
                'validatedBy' => '',
                'finalDecision' => '',
                'matchedSuggestion' => null,
                'notes' => '',
            ],
            'input' => [
                'photoCount' => $photoCount,
                'photoSetComplete' => $photoSetComplete,
                'missingRoles' => $missingRoles,
                'channel' => $channel,
            ],
            'generatedAt' => self::nowIso(),
        ];
    }

    public static function recordDoctorValidation(
        array $triage,
        string $decision,
        string $reviewedBy,
        string $reviewedAt,
        string $notes = ''
    ): array {
        $normalizedDecision = trim($decision);
        if ($normalizedDecision === '') {
            return $triage;
        }

        $suggestedConsultType = trim((string) ($triage['suggestedConsultType'] ?? ''));
        $matchedSuggestion = in_array(
            $suggestedConsultType,
            self::decisionMatches($normalizedDecision),
            true
        );

        $triage['doctorValidationStatus'] = 'validated';
        $triage['doctorValidation'] = [
            'status' => 'validated',
            'validatedAt' => $reviewedAt !== '' ? $reviewedAt : self::nowIso(),
            'validatedBy' => $reviewedBy,
            'finalDecision' => $normalizedDecision,
            'matchedSuggestion' => $matchedSuggestion,
            'notes' => $notes,
        ];

        return $triage;
    }

    /**
     * @param array<int,string> $signals
     */
    private static function resolveSuggestedConsultType(
        string $status,
        int $urgencyLevel,
        string $channel,
        array $signals
    ): string {
        if (in_array('high_risk_red_flag', $signals, true) || in_array('existing_unsuitable_flag', $signals, true)) {
            return 'priority_in_person';
        }

        if ($status === 'insufficient_data') {
            return 'gather_more_info';
        }

        if ($urgencyLevel >= 4) {
            return $channel === 'phone' ? 'priority_video' : 'priority_video';
        }

        if ($urgencyLevel === 3) {
            return 'scheduled_video';
        }

        return 'async_follow_up';
    }

    /**
     * @return array<int,string>
     */
    private static function decisionMatches(string $decision): array
    {
        return match ($decision) {
            'approve_remote' => ['async_follow_up', 'scheduled_video', 'priority_video'],
            'request_more_info' => ['gather_more_info'],
            'escalate_presential' => ['priority_in_person'],
            default => [],
        };
    }

    private static function resolveConcern(array $intake): string
    {
        $latest = trim((string) ($intake['latestPatientConcern'] ?? ''));
        if ($latest !== '') {
            return $latest;
        }

        return trim((string) ($intake['clinicalReason'] ?? ''));
    }

    /**
     * @param array<int,string> $needles
     */
    private static function containsAny(string $haystack, array $needles): bool
    {
        foreach ($needles as $needle) {
            if ($needle !== '' && mb_strpos($haystack, $needle) !== false) {
                return true;
            }
        }

        return false;
    }

    private static function urgencyLabel(int $level): string
    {
        return match (max(1, min(5, $level))) {
            1 => 'Monitoreo',
            2 => 'Baja',
            3 => 'Moderada',
            4 => 'Alta',
            5 => 'Muy alta',
        };
    }

    /**
     * @param array<int,string> $missingRoles
     */
    private static function buildSummary(
        int $urgencyLevel,
        string $status,
        string $consultType,
        int $photoCount,
        array $missingRoles
    ): string {
        if ($status === 'insufficient_data') {
            $missingCount = count($missingRoles);
            $missingCopy = $missingCount > 0
                ? sprintf('Faltan %d de 3 tomas orientadoras.', $missingCount)
                : 'Todavia falta contexto clinico suficiente.';

            return sprintf(
                'Urgencia %d/5. %s Conviene pedir mas informacion antes de cerrar la ruta.',
                $urgencyLevel,
                $missingCopy
            );
        }

        return sprintf(
            'Urgencia %d/5. La preclasificacion sugiere %s con %d foto(s) clinica(s) listas.',
            $urgencyLevel,
            self::CONSULT_LABELS[$consultType] ?? 'revision medica',
            $photoCount
        );
    }

    private static function nowIso(): string
    {
        return function_exists('local_date') ? (string) local_date('c') : gmdate('c');
    }
}
