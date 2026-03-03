<?php

declare(strict_types=1);

require_once __DIR__ . '/../validation.php';
require_once __DIR__ . '/TelemedicineChannelMapper.php';

final class TelemedicineSuitabilityEvaluator
{
    /**
     * @return array{suitability:string,reasons:array<int,string>,requiresHumanReview:bool,escalationRecommendation:string}
     */
    public static function evaluate(array $appointment, string $channel): array
    {
        $reasons = [];
        $reason = trim((string) ($appointment['reason'] ?? ''));
        $affectedArea = trim((string) ($appointment['affectedArea'] ?? ''));
        $evolutionTime = trim((string) ($appointment['evolutionTime'] ?? ''));
        $casePhotoCount = (int) ($appointment['casePhotoCount'] ?? 0);
        $consent = isset($appointment['privacyConsent']) && parse_bool($appointment['privacyConsent']) === true;

        if ($reason === '' || text_length($reason) < 12) {
            $reasons[] = 'missing_clinical_reason';
        }
        if ($affectedArea === '') {
            $reasons[] = 'missing_affected_area';
        }
        if ($evolutionTime === '') {
            $reasons[] = 'missing_evolution_time';
        }
        if (!$consent) {
            $reasons[] = 'missing_telemedicine_consent';
        }
        if (TelemedicineChannelMapper::requiresCasePhotos($channel) && $casePhotoCount < 1) {
            $reasons[] = 'missing_case_photos';
        }

        $riskHaystack = strtolower($reason . ' ' . $affectedArea . ' ' . $evolutionTime);
        $urgentKeywords = [
            'sangrado',
            'difficulty breathing',
            'dificultad para respirar',
            'emergencia',
            'dolor severo',
            'necrosis',
            'desmayo',
            'anaphylaxis',
            'anafilaxia',
            'pérdida de visión',
            'perdida de vision'
        ];

        foreach ($urgentKeywords as $keyword) {
            if ($keyword !== '' && strpos($riskHaystack, $keyword) !== false) {
                $reasons[] = 'urgent_in_person_assessment';
                break;
            }
        }

        $reasons = array_values(array_unique($reasons));
        if (in_array('urgent_in_person_assessment', $reasons, true)) {
            return [
                'suitability' => 'unsuitable',
                'reasons' => $reasons,
                'requiresHumanReview' => true,
                'escalationRecommendation' => 'in_person_urgent',
            ];
        }

        if ($reasons !== []) {
            return [
                'suitability' => 'review_required',
                'reasons' => $reasons,
                'requiresHumanReview' => true,
                'escalationRecommendation' => 'manual_review',
            ];
        }

        return [
            'suitability' => 'fit',
            'reasons' => [],
            'requiresHumanReview' => false,
            'escalationRecommendation' => 'remote_visit',
        ];
    }
}
