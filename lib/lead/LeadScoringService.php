<?php

declare(strict_types=1);

require_once __DIR__ . '/../business.php';

final class LeadScoringService
{
    public static function scoreCallback(array $callback, array $store = [], array $context = []): array
    {
        $leadOps = isset($callback['leadOps']) && is_array($callback['leadOps']) ? $callback['leadOps'] : [];
        $preference = self::normalizeText((string) ($context['preference'] ?? ($callback['preferencia'] ?? '')));
        $status = self::normalizeStatus((string) ($callback['status'] ?? 'pendiente'));
        $ageMinutes = max(0, (int) ($context['ageMinutes'] ?? 0));
        $serviceHints = is_array($context['serviceHints'] ?? null) ? array_values($context['serviceHints']) : [];

        $serviceId = self::resolveServiceId($callback, $leadOps, $serviceHints, $preference);
        $serviceConfig = $serviceId !== '' && function_exists('get_service_config')
            ? get_service_config($serviceId)
            : null;
        $serviceValue = $serviceId !== '' && function_exists('get_service_price_amount')
            ? (float) get_service_price_amount($serviceId)
            : 0.0;
        $premiumService = self::isPremiumService($serviceId, $serviceConfig, $serviceValue);
        $source = self::firstNonEmptyString(
            (string) ($callback['source'] ?? ''),
            (string) ($leadOps['source'] ?? '')
        );
        $surface = self::firstNonEmptyString(
            (string) ($callback['surface'] ?? ''),
            (string) ($leadOps['surface'] ?? '')
        );
        $noShowCount = self::countPriorNoShows($callback, $store);

        $factors = [];
        $factors[] = self::makeFactor(
            'queue_age',
            'Tiempo en cola',
            self::scoreQueueAge($ageMinutes),
            $ageMinutes >= 180 ? 'Lead pendiente por mas de 3 horas.' : ($ageMinutes >= 60 ? 'Lead pendiente por mas de 1 hora.' : 'Lead recien ingresado.')
        );
        $factors[] = self::makeFactor(
            'clinical_urgency',
            'Urgencia clinica',
            self::scoreClinicalUrgency($preference, $serviceId),
            self::clinicalUrgencyExplanation($preference, $serviceId)
        );
        $factors[] = self::makeFactor(
            'estimated_value',
            'Valor estimado',
            self::scoreEstimatedValue($serviceValue),
            $serviceValue > 0
                ? 'Servicio estimado en $' . number_format($serviceValue, 2, '.', '') . '.'
                : 'Sin servicio claro; se usa valor conservador.'
        );
        $factors[] = self::makeFactor(
            'channel',
            'Canal',
            self::scoreChannel($source, $surface),
            self::channelExplanation($source, $surface)
        );
        $factors[] = self::makeFactor(
            'premium_service',
            'Servicio premium',
            $premiumService ? 12 : 0,
            $premiumService
                ? 'Servicio premium o ticket alto; conviene priorizar cierre.'
                : 'Servicio estandar.'
        );
        $factors[] = self::makeFactor(
            'no_show_history',
            'Historial no-show',
            self::scoreNoShowPenalty($noShowCount),
            $noShowCount > 0
                ? 'Tiene ' . $noShowCount . ' cita(s) previa(s) marcada(s) como no_show.'
                : 'Sin no-shows previos detectados.'
        );

        $base = $status === 'contactado' ? 8 : 20;
        $score = $base;
        foreach ($factors as $factor) {
            $score += (int) ($factor['delta'] ?? 0);
        }

        $score = self::clampInt($score, 0, 100);
        $priorityBand = $score >= 72 ? 'hot' : ($score >= 45 ? 'warm' : 'cold');
        $positiveFactors = array_values(array_filter($factors, static function (array $factor): bool {
            return (int) ($factor['delta'] ?? 0) > 0;
        }));
        usort($positiveFactors, static function (array $left, array $right): int {
            return ((int) ($right['delta'] ?? 0)) <=> ((int) ($left['delta'] ?? 0));
        });
        $factorLabels = array_values(array_map(
            static fn (array $factor): string => (string) ($factor['label'] ?? ''),
            $positiveFactors
        ));

        return [
            'score' => $score,
            'priorityBand' => $priorityBand,
            'reasonCodes' => self::reasonCodesFromFactors($factors),
            'factorLabels' => array_slice($factorLabels, 0, 4),
            'summary' => self::buildSummary($factors),
            'factors' => $factors,
            'serviceId' => $serviceId,
            'serviceValue' => $serviceValue,
            'premiumService' => $premiumService,
            'noShowCount' => $noShowCount,
            'channelSource' => self::normalizeToken($source),
        ];
    }

    private static function resolveServiceId(array $callback, array $leadOps, array $serviceHints, string $preference): string
    {
        $services = function_exists('get_services_config') ? get_services_config() : [];
        foreach ([
            (string) ($callback['service_intent'] ?? ''),
            (string) ($leadOps['service_intent'] ?? ''),
        ] as $candidate) {
            $normalized = self::normalizeToken($candidate);
            if ($normalized !== '' && isset($services[$normalized])) {
                return $normalized;
            }
        }

        foreach ($serviceHints as $hint) {
            $matched = self::matchServiceByText((string) $hint, $services);
            if ($matched !== '') {
                return $matched;
            }
        }

        return self::matchServiceByText($preference, $services);
    }

    private static function matchServiceByText(string $value, array $services): string
    {
        $normalized = self::normalizeText($value);
        if ($normalized === '') {
            return '';
        }

        foreach (array_keys($services) as $serviceId) {
            if (str_contains($normalized, self::normalizeText((string) $serviceId))) {
                return (string) $serviceId;
            }
        }

        foreach ($services as $serviceId => $service) {
            $label = self::normalizeText((string) ($service['name'] ?? ''));
            if ($label !== '' && str_contains($normalized, $label)) {
                return (string) $serviceId;
            }
        }

        if (str_contains($normalized, 'botox') || str_contains($normalized, 'rejuvenec')) {
            return 'rejuvenecimiento';
        }
        if (str_contains($normalized, 'laser')) {
            return 'laser';
        }
        if (str_contains($normalized, 'acne') || str_contains($normalized, 'rosacea')) {
            return 'acne';
        }
        if (str_contains($normalized, 'cancer') || str_contains($normalized, 'lunar') || str_contains($normalized, 'lesion')) {
            return 'cancer';
        }
        if (str_contains($normalized, 'video') || str_contains($normalized, 'virtual')) {
            return 'video';
        }
        if (str_contains($normalized, 'telefono') || str_contains($normalized, 'llamada')) {
            return 'telefono';
        }
        if (str_contains($normalized, 'consulta')) {
            return 'consulta';
        }

        return '';
    }

    private static function scoreClinicalUrgency(string $preference, string $serviceId): int
    {
        $score = 0;
        if (preg_match('/\b(urgente|urgencia|hoy|ahora|ya|asap)\b/', $preference) === 1) {
            $score += 12;
        }
        if (
            preg_match('/\b(sangra|dolor|ardor|lesion|lunar|cancer|inflamatorio|mancha)\b/', $preference) === 1
            || $serviceId === 'cancer'
        ) {
            $score += 18;
        } elseif (preg_match('/\b(acne|rosacea|brote|dermatitis|alergia)\b/', $preference) === 1) {
            $score += 10;
        }

        return min(30, $score);
    }

    private static function clinicalUrgencyExplanation(string $preference, string $serviceId): string
    {
        if (
            preg_match('/\b(sangra|dolor|ardor|lesion|lunar|cancer|inflamatorio|mancha)\b/', $preference) === 1
            || $serviceId === 'cancer'
        ) {
            return 'Texto del lead con sintomas clinicos sensibles.';
        }
        if (preg_match('/\b(urgente|urgencia|hoy|ahora|ya|asap)\b/', $preference) === 1) {
            return 'El lead expresa urgencia temporal.';
        }
        if (preg_match('/\b(acne|rosacea|brote|dermatitis|alergia)\b/', $preference) === 1) {
            return 'Consulta clinica activa, sin alerta critica.';
        }

        return 'Sin signos claros de urgencia clinica.';
    }

    private static function scoreEstimatedValue(float $value): int
    {
        if ($value >= 150.0) {
            return 22;
        }
        if ($value >= 120.0) {
            return 18;
        }
        if ($value >= 80.0) {
            return 14;
        }
        if ($value >= 60.0) {
            return 10;
        }
        if ($value > 0.0) {
            return 6;
        }

        return 0;
    }

    private static function scoreChannel(string $source, string $surface): int
    {
        $sourceToken = self::normalizeToken($source);
        $surfaceToken = self::normalizeToken($surface);

        if ($sourceToken === 'whatsapp_openclaw' || str_contains($surfaceToken, 'whatsapp')) {
            return 12;
        }
        if ($sourceToken === 'public_preconsultation' || str_contains($surfaceToken, 'preconsulta')) {
            return 10;
        }
        if ($sourceToken === 'booking' || $surfaceToken === 'booking_form' || $surfaceToken === 'chatbot') {
            return 8;
        }
        if ($sourceToken === 'legacy_booking_bridge') {
            return 6;
        }

        return 4;
    }

    private static function channelExplanation(string $source, string $surface): string
    {
        $sourceToken = self::normalizeToken($source);
        $surfaceToken = self::normalizeToken($surface);

        if ($sourceToken === 'whatsapp_openclaw' || str_contains($surfaceToken, 'whatsapp')) {
            return 'Canal conversacional con alta probabilidad de cierre rapido.';
        }
        if ($sourceToken === 'public_preconsultation' || str_contains($surfaceToken, 'preconsulta')) {
            return 'Lead ya dejo contexto clinico y material previo.';
        }
        if ($sourceToken === 'booking' || $surfaceToken === 'booking_form' || $surfaceToken === 'chatbot') {
            return 'Lead ya avanzo en el flujo de reserva.';
        }
        if ($sourceToken === 'legacy_booking_bridge') {
            return 'Lead proveniente de bridge telemedico.';
        }

        return 'Canal no clasificado; se usa peso base.';
    }

    private static function isPremiumService(string $serviceId, ?array $serviceConfig, float $value): bool
    {
        if ($serviceId === 'laser' || $serviceId === 'rejuvenecimiento') {
            return true;
        }
        $category = self::normalizeToken((string) ($serviceConfig['category'] ?? ''));
        if ($category === 'procedimiento' || $category === 'estetico') {
            return true;
        }

        return $value >= 120.0;
    }

    private static function countPriorNoShows(array $callback, array $store): int
    {
        $appointments = isset($store['appointments']) && is_array($store['appointments'])
            ? array_values($store['appointments'])
            : [];
        $callbackTs = self::timestampValue((string) ($callback['fecha'] ?? ''));
        $callbackPhone = self::normalizePhone((string) ($callback['telefono'] ?? ''));
        $callbackCaseId = trim((string) ($callback['patientCaseId'] ?? ''));
        $callbackPatientId = trim((string) ($callback['patientId'] ?? ''));
        $count = 0;

        foreach ($appointments as $appointment) {
            if (!is_array($appointment)) {
                continue;
            }
            if (self::normalizeToken((string) ($appointment['status'] ?? '')) !== 'no_show') {
                continue;
            }

            $matches = false;
            if ($callbackCaseId !== '' && trim((string) ($appointment['patientCaseId'] ?? '')) === $callbackCaseId) {
                $matches = true;
            }
            if (!$matches && $callbackPatientId !== '' && trim((string) ($appointment['patientId'] ?? '')) === $callbackPatientId) {
                $matches = true;
            }
            if (
                !$matches
                && $callbackPhone !== ''
                && self::normalizePhone((string) ($appointment['phone'] ?? '')) === $callbackPhone
            ) {
                $matches = true;
            }
            if (!$matches) {
                continue;
            }

            $appointmentTs = max(
                self::timestampValue((string) ($appointment['dateBooked'] ?? '')),
                self::timestampValue((string) ($appointment['date'] ?? ''))
            );
            if ($callbackTs > 0 && $appointmentTs > $callbackTs) {
                continue;
            }

            $count++;
        }

        return $count;
    }

    private static function scoreNoShowPenalty(int $noShowCount): int
    {
        if ($noShowCount >= 2) {
            return -18;
        }
        if ($noShowCount === 1) {
            return -10;
        }

        return 0;
    }

    private static function scoreQueueAge(int $ageMinutes): int
    {
        if ($ageMinutes >= 180) {
            return 10;
        }
        if ($ageMinutes >= 60) {
            return 6;
        }
        if ($ageMinutes >= 20) {
            return 3;
        }

        return 0;
    }

    private static function makeFactor(string $key, string $label, int $delta, string $explanation): array
    {
        return [
            'key' => $key,
            'label' => $label,
            'delta' => $delta,
            'explanation' => $explanation,
        ];
    }

    private static function buildSummary(array $factors): string
    {
        $positive = array_values(array_map(
            static fn (array $factor): string => (string) ($factor['label'] ?? ''),
            array_values(array_filter($factors, static function (array $factor): bool {
                return (int) ($factor['delta'] ?? 0) > 0;
            }))
        ));
        $negative = array_values(array_map(
            static fn (array $factor): string => (string) ($factor['label'] ?? ''),
            array_values(array_filter($factors, static function (array $factor): bool {
                return (int) ($factor['delta'] ?? 0) < 0;
            }))
        ));

        $parts = [];
        if ($positive !== []) {
            $parts[] = implode(' + ', array_slice($positive, 0, 2));
        }
        if ($negative !== []) {
            $parts[] = 'Ajuste: ' . implode(', ', array_slice($negative, 0, 1));
        }

        return implode(' · ', $parts);
    }

    private static function reasonCodesFromFactors(array $factors): array
    {
        $codes = [];
        foreach ($factors as $factor) {
            if (!is_array($factor)) {
                continue;
            }
            $delta = (int) ($factor['delta'] ?? 0);
            if ($delta === 0) {
                continue;
            }
            $key = self::normalizeToken((string) ($factor['key'] ?? ''));
            if ($key === '') {
                continue;
            }
            $codes[] = $delta > 0 ? 'score_' . $key : 'risk_' . $key;
        }

        return array_values(array_unique($codes));
    }

    private static function normalizeText(string $value): string
    {
        $value = trim($value);
        $value = function_exists('mb_strtolower')
            ? mb_strtolower($value, 'UTF-8')
            : strtolower($value);
        return strtr($value, [
            'á' => 'a',
            'é' => 'e',
            'í' => 'i',
            'ó' => 'o',
            'ú' => 'u',
            'ñ' => 'n',
        ]);
    }

    private static function normalizeToken(string $value): string
    {
        return trim(preg_replace('/[^a-z0-9_\\-]+/', '_', self::normalizeText($value)) ?? '', '_');
    }

    private static function normalizeStatus(string $value): string
    {
        $normalized = self::normalizeToken($value);
        if ($normalized === 'pending' || $normalized === 'pendiente') {
            return 'pendiente';
        }
        if ($normalized === 'contacted' || $normalized === 'contactado') {
            return 'contactado';
        }

        return $normalized !== '' ? $normalized : 'pendiente';
    }

    private static function normalizePhone(string $value): string
    {
        $digits = preg_replace('/\D+/', '', $value);
        if (!is_string($digits)) {
            return '';
        }

        return ltrim($digits, '0');
    }

    private static function firstNonEmptyString(string ...$values): string
    {
        foreach ($values as $value) {
            $trimmed = trim($value);
            if ($trimmed !== '') {
                return $trimmed;
            }
        }

        return '';
    }

    private static function timestampValue(string $value): int
    {
        $timestamp = strtotime($value);
        return $timestamp === false ? 0 : $timestamp;
    }

    private static function clampInt(int $value, int $min, int $max): int
    {
        return max($min, min($max, $value));
    }
}
