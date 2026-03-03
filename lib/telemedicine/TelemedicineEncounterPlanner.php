<?php

declare(strict_types=1);

require_once __DIR__ . '/TelemedicineChannelMapper.php';

final class TelemedicineEncounterPlanner
{
    public static function build(array $intake): array
    {
        $channel = (string) ($intake['channel'] ?? TelemedicineChannelMapper::CHANNEL_PHONE);
        $suitability = (string) ($intake['suitability'] ?? 'review_required');
        $mediaCount = is_array($intake['clinicalMediaIds'] ?? null) ? count($intake['clinicalMediaIds']) : 0;
        $requiresReview = (bool) ($intake['reviewRequired'] ?? false);

        $notes = [
            'Visit mode: ' . TelemedicineChannelMapper::visitMode($channel),
            'Telemedicine intake id: ' . (string) ($intake['id'] ?? ''),
            'Suitability: ' . $suitability,
            'Clinical media count: ' . $mediaCount,
            'Escalation recommendation: ' . (string) ($intake['escalationRecommendation'] ?? 'manual_review'),
        ];

        return [
            'intakeId' => $intake['id'] ?? null,
            'channel' => $channel,
            'visitMode' => TelemedicineChannelMapper::visitMode($channel),
            'calendarNotes' => implode("\n", $notes),
            'providerInstructions' => $requiresReview
                ? 'Revisar suitability y media clinica antes de confirmar resolucion remota.'
                : 'Realizar evaluacion remota segun protocolo de teledermatologia.',
            'patientInstructions' => $channel === TelemedicineChannelMapper::CHANNEL_SECURE_VIDEO
                ? 'Ten listas tus fotos clinicas y una conexion estable antes de la videollamada.'
                : 'Mantente disponible por telefono en la franja agendada.',
            'escalationRecommendation' => (string) ($intake['escalationRecommendation'] ?? 'manual_review'),
            'followUpWindow' => $suitability === 'fit' ? '72h' : '24h',
            'requiresHumanReview' => $requiresReview,
        ];
    }
}
