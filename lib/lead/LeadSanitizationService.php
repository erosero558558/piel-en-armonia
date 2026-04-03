<?php

declare(strict_types=1);

final class LeadSanitizationService
{
public static function normalizeLeadOrigin($value, array $context = []): array
    {
        $lead = is_array($value) ? $value : [];
        $contextLead = isset($context['leadOps']) && is_array($context['leadOps']) ? $context['leadOps'] : [];
        $explicitSource = self::resolveLeadOriginValue(['source'], $lead, $contextLead, $context);
        $explicitCampaign = self::resolveLeadOriginValue(['campaign', 'utm_campaign', 'utmCampaign'], $lead, $contextLead, $context);
        $explicitSurface = self::resolveLeadOriginValue(
            ['surface', 'entrySurface', 'checkoutEntry', 'channel', 'lastChannel', 'public_surface'],
            $lead,
            $contextLead,
            $context
        );
        $explicitServiceIntent = self::resolveLeadOriginValue(
            ['service_intent', 'serviceIntent', 'service', 'legacyService', 'serviceLine'],
            $lead,
            $contextLead,
            $context
        );

        $source = self::normalizeLeadOriginToken($explicitSource, '');
        $campaign = self::normalizeLeadOriginToken($explicitCampaign, '');
        $surface = self::normalizeLeadOriginToken($explicitSurface, '');
        $serviceIntent = self::normalizeLeadOriginToken($explicitServiceIntent, '');

        if ($source === '') {
            $source = self::inferLeadOriginSource($surface, $serviceIntent);
        }
        if ($surface === '') {
            $surface = self::inferLeadOriginSurface($source);
        }
        if ($serviceIntent === '' && $source === 'public_preconsultation') {
            $serviceIntent = 'preconsulta_digital';
        }

        return [
            'source' => $source !== '' ? $source : 'unknown',
            'campaign' => $campaign !== '' ? $campaign : 'unknown',
            'surface' => $surface !== '' ? $surface : 'unknown',
            'service_intent' => $serviceIntent !== '' ? $serviceIntent : 'unknown',
        ];
    }

public static function normalizeLeadOps($value, array $context = []): array
    {
        $leadOps = is_array($value) ? $value : [];
        $origin = self::normalizeLeadOrigin($leadOps, $context);
        $aiObjective = self::normalizeObjective((string) ($leadOps['aiObjective'] ?? ''));
        $aiStatus = self::normalizeAiStatus((string) ($leadOps['aiStatus'] ?? 'idle'));
        $outcome = self::normalizeOutcome((string) ($leadOps['outcome'] ?? ''));
        $whatsappTemplateKey = self::normalizeWhatsappTemplateKey((string) ($leadOps['whatsappTemplateKey'] ?? ''));

        return array_merge($origin, [
            'heuristicScore' => LeadOpsService::clampInt((int) ($leadOps['heuristicScore'] ?? 0), 0, 100),
            'priorityBand' => self::normalizePriorityBand((string) ($leadOps['priorityBand'] ?? 'cold')),
            'reasonCodes' => self::sanitizeList($leadOps['reasonCodes'] ?? [], 8, 60),
            'serviceHints' => self::sanitizeList($leadOps['serviceHints'] ?? [], 3, 80),
            'nextAction' => truncate_field(sanitize_xss((string) ($leadOps['nextAction'] ?? '')), 180),
            'scoreSummary' => truncate_field(sanitize_xss((string) ($leadOps['scoreSummary'] ?? '')), 220),
            'scoreFactors' => self::sanitizeList($leadOps['scoreFactors'] ?? [], 4, 80),
            'aiStatus' => $aiStatus,
            'aiObjective' => $aiObjective,
            'aiSummary' => truncate_field(sanitize_xss((string) ($leadOps['aiSummary'] ?? '')), 1600),
            'aiDraft' => truncate_field(sanitize_xss((string) ($leadOps['aiDraft'] ?? '')), 2400),
            'aiProvider' => truncate_field(sanitize_xss((string) ($leadOps['aiProvider'] ?? '')), 80),
            'requestedAt' => self::normalizeTimestamp((string) ($leadOps['requestedAt'] ?? '')),
            'completedAt' => self::normalizeTimestamp((string) ($leadOps['completedAt'] ?? '')),
            'contactedAt' => self::normalizeTimestamp((string) ($leadOps['contactedAt'] ?? '')),
            'outcome' => $outcome,
            'whatsappTemplateKey' => $whatsappTemplateKey,
            'whatsappMessageDraft' => truncate_field(sanitize_xss((string) ($leadOps['whatsappMessageDraft'] ?? '')), 2400),
            'whatsappLastPreparedAt' => self::normalizeTimestamp((string) ($leadOps['whatsappLastPreparedAt'] ?? '')),
            'whatsappLastOpenedAt' => self::normalizeTimestamp((string) ($leadOps['whatsappLastOpenedAt'] ?? '')),
        ]);
    }

public static function requestLeadAi(array $callback, string $objective, array $store = [], ?array $funnelMetrics = null): array
    {
        $objective = self::normalizeObjective($objective);
        if ($objective === '') {
            throw new InvalidArgumentException('Objetivo IA inválido');
        }

        if (class_exists('Metrics')) {
            Metrics::increment('lead_ops_ai_requests_total', ['objective' => $objective]);
        }

        return LeadOpsService::mergeLeadOps($callback, [
            'aiStatus' => 'requested',
            'aiObjective' => $objective,
            'requestedAt' => local_date('c'),
            'completedAt' => '',
            'aiSummary' => '',
            'aiDraft' => '',
            'aiProvider' => '',
        ], $store, $funnelMetrics);
    }

public static function applyAiResult(array $callback, array $payload, array $store = [], ?array $funnelMetrics = null): array
    {
        $objective = self::normalizeObjective((string) ($payload['objective'] ?? ($callback['leadOps']['aiObjective'] ?? '')));
        $status = self::normalizeAiStatus((string) ($payload['status'] ?? 'completed'));
        if (!in_array($status, ['completed', 'failed'], true)) {
            $status = 'completed';
        }

        if (class_exists('Metrics')) {
            Metrics::increment('lead_ops_ai_results_total', [
                'status' => $status,
                'objective' => $objective !== '' ? $objective : 'unknown',
            ]);
        }

        return LeadOpsService::mergeLeadOps($callback, [
            'aiStatus' => $status,
            'aiObjective' => $objective,
            'aiSummary' => $payload['summary'] ?? '',
            'aiDraft' => $payload['draft'] ?? '',
            'aiProvider' => $payload['provider'] ?? 'openclaw',
            'completedAt' => local_date('c'),
        ], $store, $funnelMetrics);
    }

private static function extractBirthdayFirstName(string $value): string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return 'Paciente';
        }

        $parts = preg_split('/\s+/', $trimmed);
        if (!is_array($parts) || $parts === []) {
            return 'Paciente';
        }

        return trim((string) ($parts[0] ?? 'Paciente'));
    }

private static function buildBirthdayLegalName(array $identity): string
    {
        return trim(implode(' ', array_filter([
            trim((string) ($identity['primerNombre'] ?? '')),
            trim((string) ($identity['segundoNombre'] ?? '')),
            trim((string) ($identity['apellidoPaterno'] ?? '')),
            trim((string) ($identity['apellidoMaterno'] ?? '')),
        ])));
    }

private static function buildBirthdayPatientKey(
        string $documentNumber,
        string $phone,
        string $birthDate,
        string $name,
        string $caseId,
        string $sessionId
    ): string {
        $document = preg_replace('/\W+/', '', strtolower($documentNumber));
        if (is_string($document) && $document !== '') {
            return 'doc:' . $document;
        }

        $normalizedPhone = self::normalizeBirthdayPhone($phone);
        if ($normalizedPhone !== '') {
            return 'phone:' . $normalizedPhone . '|' . self::normalizeBirthdayDate($birthDate);
        }

        $nameKey = preg_replace('/[^a-z0-9]+/', '_', strtolower(trim($name)));
        if (is_string($nameKey) && $nameKey !== '' && self::normalizeBirthdayDate($birthDate) !== '') {
            return 'name:' . trim($nameKey, '_') . '|' . self::normalizeBirthdayDate($birthDate);
        }

        return 'case:' . LeadOpsService::firstNonEmptyString($caseId, $sessionId, sha1($name . '|' . $birthDate));
    }

private static function normalizeBirthdayPhone(string $value): string
    {
        $digits = preg_replace('/\D+/', '', $value);
        if (!is_string($digits)) {
            return '';
        }

        return ltrim($digits, '0');
    }

private static function normalizeBirthdayDate(string $value): string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return '';
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', substr($trimmed, 0, 10)) === 1) {
            return substr($trimmed, 0, 10);
        }

        try {
            return (new DateTimeImmutable($trimmed))->format('Y-m-d');
        } catch (Throwable $e) {
            return '';
        }
    }

private static function normalizeAppointmentReminderTimestamp(string $value): ?DateTimeImmutable
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        try {
            return new DateTimeImmutable($trimmed);
        } catch (Throwable $e) {
            return null;
        }
    }

private static function normalizeObjective(string $objective): string
    {
        $objective = self::normalizeToken($objective);
        return in_array($objective, self::OBJECTIVES, true) ? $objective : '';
    }

private static function normalizeAiStatus(string $status): string
    {
        $status = self::normalizeToken($status);
        return in_array($status, self::AI_STATUSES, true) ? $status : 'idle';
    }

private static function normalizeOutcome(string $outcome): string
    {
        $outcome = self::normalizeToken($outcome);
        return in_array($outcome, self::OUTCOMES, true) ? $outcome : '';
    }

private static function normalizeWhatsappTemplateKey(string $value): string
    {
        $value = self::normalizeToken($value);
        return in_array($value, self::WHATSAPP_TEMPLATE_KEYS, true)
            ? $value
            : '';
    }

private static function normalizePriorityBand(string $band): string
    {
        $band = self::normalizeToken($band);
        return in_array($band, self::PRIORITY_BANDS, true) ? $band : 'cold';
    }

private static function normalizeTimestamp(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        return strtotime($value) === false ? '' : $value;
    }

private static function sanitizeList($values, int $limit, int $maxLength): array
    {
        $list = [];
        foreach ((array) $values as $value) {
            $sanitized = truncate_field(sanitize_xss((string) $value), $maxLength);
            if ($sanitized === '') {
                continue;
            }
            $list[] = $sanitized;
            if (count($list) >= $limit) {
                break;
            }
        }
        return array_values(array_unique($list));
    }

private static function resolveLeadOriginValue(array $keys, array ...$sources): string
    {
        foreach ($sources as $source) {
            foreach ($keys as $key) {
                if (!array_key_exists($key, $source)) {
                    continue;
                }

                $value = trim((string) ($source[$key] ?? ''));
                if ($value !== '' && self::normalizeLeadOriginToken($value, '') !== 'unknown') {
                    return $value;
                }
            }
        }

        return '';
    }

private static function inferLeadOriginSource(string $surface, string $serviceIntent): string
    {
        if ($surface === 'unknown') {
            $surface = '';
        }
        if ($serviceIntent === 'unknown') {
            $serviceIntent = '';
        }
        if (str_contains($surface, 'whatsapp')) {
            return 'whatsapp_openclaw';
        }
        if (str_contains($surface, 'preconsulta') || $serviceIntent === 'preconsulta_digital') {
            return 'public_preconsultation';
        }
        if ($surface !== '' || $serviceIntent !== '') {
            return 'booking';
        }

        return 'unknown';
    }

private static function inferLeadOriginSurface(string $source): string
    {
        if ($source === 'unknown') {
            $source = '';
        }
        if ($source === 'whatsapp_openclaw') {
            return 'whatsapp_openclaw';
        }
        if ($source === 'public_preconsultation') {
            return 'preconsulta_publica';
        }
        if ($source === 'booking') {
            return 'booking';
        }

        return 'unknown';
    }

private static function extractTokens(string $value): array
    {
        $normalized = self::normalizeText($value);
        $parts = preg_split('/[^a-z0-9]+/', $normalized) ?: [];
        return array_values(array_filter($parts, static fn (string $token): bool => strlen($token) >= 4));
    }

private static function normalizeText(string $value): string
    {
        $value = trim($value);
        $value = function_exists('mb_strtolower')
            ? mb_strtolower($value, 'UTF-8')
            : strtolower($value);
        $value = strtr($value, [
            'á' => 'a',
            'é' => 'e',
            'í' => 'i',
            'ó' => 'o',
            'ú' => 'u',
            'ñ' => 'n',
        ]);
        return $value;
    }

private static function normalizeToken(string $value): string
    {
        return trim(preg_replace('/[^a-z0-9_\\-]+/', '-', self::normalizeText($value)) ?? '', '-');
    }

private static function normalizeLeadOriginToken(string $value, string $fallback = 'unknown'): string
    {
        $normalized = trim(preg_replace('/[^a-z0-9]+/', '_', self::normalizeText($value)) ?? '', '_');
        return $normalized !== '' ? $normalized : $fallback;
    }

private static function normalizeComparablePhone(string $value): string
    {
        $digits = preg_replace('/\D+/', '', $value);
        if (!is_string($digits)) {
            return '';
        }

        return ltrim($digits, '0');
    }

}
