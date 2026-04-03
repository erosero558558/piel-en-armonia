<?php

declare(strict_types=1);

final class LeadQueueService
{
    private const LEAD_ORIGIN_FIELDS = ['source', 'campaign', 'surface', 'service_intent'];

    /** @var array{path:string,mtime:int,services:array<int,array<string,mixed>>}|null */
    private static ?array $catalogCache = null;

public static function enrichCallbacks(array $callbacks, array $store, ?array $funnelMetrics = null): array
    {
        $enriched = [];
        foreach ($callbacks as $callback) {
            if (!is_array($callback)) {
                continue;
            }
            $enriched[] = self::enrichCallback($callback, $store, $funnelMetrics);
        }

        usort($enriched, static function (array $left, array $right): int {
            $leftScore = (int) (($left['leadOps']['heuristicScore'] ?? 0));
            $rightScore = (int) (($right['leadOps']['heuristicScore'] ?? 0));
            if ($leftScore !== $rightScore) {
                return $rightScore <=> $leftScore;
            }

            $leftAt = LeadOpsService::timestampValue((string) ($left['fecha'] ?? ''));
            $rightAt = LeadOpsService::timestampValue((string) ($right['fecha'] ?? ''));
            if ($leftAt !== $rightAt) {
                return $leftAt <=> $rightAt;
            }

            return (int) ($right['id'] ?? 0) <=> (int) ($left['id'] ?? 0);
        });

        return $enriched;
    }

public static function enrichCallback(array $callback, array $store, ?array $funnelMetrics = null): array
    {
        $originContext = self::buildCallbackOriginContext($callback, $store);
        $callback = self::applyLeadOrigin($callback, $originContext);
        $leadOps = LeadOpsService::normalizeLeadOps($callback['leadOps'] ?? [], array_merge($originContext, $callback));
        $heuristic = self::buildHeuristic($callback, $store, $funnelMetrics);

        $callback['leadOps'] = array_merge($leadOps, [
            'heuristicScore' => $heuristic['score'],
            'priorityBand' => $heuristic['priorityBand'],
            'reasonCodes' => $heuristic['reasonCodes'],
            'serviceHints' => $heuristic['serviceHints'],
            'nextAction' => $heuristic['nextAction'],
            'scoreSummary' => $heuristic['scoreSummary'],
            'scoreFactors' => $heuristic['scoreFactors'],
        ]);

        return $callback;
    }

public static function applyLeadOrigin(array $record, array $context = []): array
    {
        $origin = LeadOpsService::normalizeLeadOrigin($record, $context);
        foreach (self::LEAD_ORIGIN_FIELDS as $field) {
            $record[$field] = $origin[$field];
        }

        if (array_key_exists('leadOps', $record)) {
            $record['leadOps'] = LeadOpsService::normalizeLeadOps(
                is_array($record['leadOps']) ? $record['leadOps'] : [],
                array_merge($context, $record)
            );
        }

        return $record;
    }

public static function mergeLeadOps(array $callback, array $incomingLeadOps, array $store = [], ?array $funnelMetrics = null): array
    {
        $current = LeadOpsService::normalizeLeadOps($callback['leadOps'] ?? [], $callback);
        $merged = $current;

        foreach ([
            'aiStatus',
            'aiObjective',
            'aiSummary',
            'aiDraft',
            'aiProvider',
            'requestedAt',
            'completedAt',
            'contactedAt',
            'outcome',
            'nextAction',
            'source',
            'campaign',
            'surface',
            'service_intent',
            'whatsappTemplateKey',
            'whatsappMessageDraft',
            'whatsappLastPreparedAt',
            'whatsappLastOpenedAt',
        ] as $field) {
            if (!array_key_exists($field, $incomingLeadOps)) {
                continue;
            }
            $merged[$field] = $incomingLeadOps[$field];
        }

        if (array_key_exists('reasonCodes', $incomingLeadOps)) {
            $merged['reasonCodes'] = $incomingLeadOps['reasonCodes'];
        }

        if (array_key_exists('serviceHints', $incomingLeadOps)) {
            $merged['serviceHints'] = $incomingLeadOps['serviceHints'];
        }

        $normalized = LeadOpsService::normalizeLeadOps($merged, $callback);
        $status = map_callback_status((string) ($callback['status'] ?? 'pendiente'));
        if ($status === 'contactado' && $normalized['contactedAt'] === '') {
            $normalized['contactedAt'] = local_date('c');
        }

        if ($normalized['outcome'] !== '' && $normalized['contactedAt'] === '') {
            $normalized['contactedAt'] = local_date('c');
        }

        if ($normalized['aiStatus'] === 'accepted' && $current['aiStatus'] !== 'accepted' && class_exists('Metrics')) {
            Metrics::increment('lead_ops_ai_acceptances_total', [
                'objective' => $normalized['aiObjective'] !== '' ? $normalized['aiObjective'] : 'unknown',
            ]);
        }

        if ($normalized['outcome'] !== '' && $normalized['outcome'] !== $current['outcome'] && class_exists('Metrics')) {
            Metrics::increment('lead_ops_callback_outcomes_total', [
                'outcome' => $normalized['outcome'],
            ]);
        }

        if ($normalized['contactedAt'] !== '' && $current['contactedAt'] === '') {
            LeadOpsService::recordFirstContactMetric($callback, $normalized['contactedAt']);
        }

        return self::enrichCallback(
            array_merge($callback, ['leadOps' => $normalized]),
            $store,
            $funnelMetrics
        )['leadOps'];
    }

public static function buildQueuePayload(array $callbacks, array $store, ?array $funnelMetrics = null): array
    {
        $items = [];
        foreach (self::enrichCallbacks($callbacks, $store, $funnelMetrics) as $callback) {
            $leadOps = LeadOpsService::normalizeLeadOps($callback['leadOps'] ?? []);
            if ($leadOps['aiStatus'] !== 'requested' || $leadOps['aiObjective'] === '') {
                continue;
            }

            $items[] = [
                'callbackId' => (int) ($callback['id'] ?? 0),
                'objective' => $leadOps['aiObjective'],
                'priorityBand' => $leadOps['priorityBand'],
                'heuristicScore' => (int) $leadOps['heuristicScore'],
                'reasonCodes' => $leadOps['reasonCodes'],
                'serviceHints' => $leadOps['serviceHints'],
                'nextAction' => $leadOps['nextAction'],
                'requestedAt' => $leadOps['requestedAt'],
                'telefonoMasked' => LeadOpsService::maskPhone((string) ($callback['telefono'] ?? '')),
                'preferencia' => truncate_field(sanitize_xss((string) ($callback['preferencia'] ?? '')), 240),
                'fecha' => (string) ($callback['fecha'] ?? ''),
            ];
        }

        return [
            'items' => $items,
            'meta' => [
                'generatedAt' => local_date('c'),
                'count' => count($items),
                'worker' => self::workerStatus(),
            ],
        ];
    }

public static function workerStatus(): array
    {
        $configured = trim((string) getenv('PIELARMONIA_LEADOPS_MACHINE_TOKEN')) !== '';
        $path = self::workerStatusPath();
        $snapshot = [];

        if (is_file($path)) {
            $decoded = json_decode((string) file_get_contents($path), true);
            if (is_array($decoded)) {
                $snapshot = $decoded;
            }
        }

        $lastSeenAt = LeadOpsService::normalizeTimestamp((string) ($snapshot['lastSeenAt'] ?? ''));
        $lastSuccessAt = LeadOpsService::normalizeTimestamp((string) ($snapshot['lastSuccessAt'] ?? ''));
        $lastErrorAt = LeadOpsService::normalizeTimestamp((string) ($snapshot['lastErrorAt'] ?? ''));
        $mode = 'pending';

        if (!$configured) {
            $mode = 'disabled';
        } elseif ($lastSeenAt === '') {
            $mode = 'pending';
        } elseif ((time() - LeadOpsService::timestampValue($lastSeenAt)) > self::workerStaleAfterSeconds()) {
            $mode = 'offline';
        } elseif ($lastErrorAt !== '' && LeadOpsService::timestampValue($lastErrorAt) > LeadOpsService::timestampValue($lastSuccessAt)) {
            $mode = 'degraded';
        } else {
            $mode = 'online';
        }

        return [
            'configured' => $configured,
            'mode' => $mode,
            'lastSeenAt' => $lastSeenAt,
            'lastSuccessAt' => $lastSuccessAt,
            'lastErrorAt' => $lastErrorAt,
            'lastErrorMessage' => truncate_field(sanitize_xss((string) ($snapshot['lastErrorMessage'] ?? '')), 240),
            'lastQueuePollAt' => LeadOpsService::normalizeTimestamp((string) ($snapshot['lastQueuePollAt'] ?? '')),
            'lastResultAt' => LeadOpsService::normalizeTimestamp((string) ($snapshot['lastResultAt'] ?? '')),
            'statusPath' => $path,
        ];
    }

public static function touchWorkerHeartbeat(string $event, array $meta = []): array
    {
        $path = self::workerStatusPath();
        $current = self::workerStatus();
        $now = local_date('c');
        $snapshot = array_merge($current, [
            'lastSeenAt' => $now,
        ]);

        if ($event === 'queue_poll') {
            $snapshot['lastQueuePollAt'] = $now;
        }

        if ($event === 'result_ok') {
            $snapshot['lastResultAt'] = $now;
            $snapshot['lastSuccessAt'] = $now;
            $snapshot['lastErrorAt'] = '';
            $snapshot['lastErrorMessage'] = '';
        }

        if ($event === 'result_error') {
            $snapshot['lastResultAt'] = $now;
            $snapshot['lastErrorAt'] = $now;
            $snapshot['lastErrorMessage'] = truncate_field(sanitize_xss((string) ($meta['message'] ?? '')), 240);
        }

        @file_put_contents($path, json_encode($snapshot, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        return self::workerStatus();
    }

public static function buildHealthSnapshot(array $store): array
    {
        $callbacks = isset($store['callbacks']) && is_array($store['callbacks']) ? $store['callbacks'] : [];
        $meta = LeadOpsService::buildMeta($callbacks, $store);

        return [
            'configured' => (bool) ($meta['worker']['configured'] ?? false),
            'mode' => (string) ($meta['worker']['mode'] ?? 'disabled'),
            'degraded' => (bool) ($meta['degraded'] ?? true),
            'callbacksTotal' => (int) ($meta['totalCount'] ?? 0),
            'pendingCallbacks' => (int) ($meta['pendingCount'] ?? 0),
            'contactedCount' => (int) ($meta['contactedCount'] ?? 0),
            'priorityHot' => (int) (($meta['priorityCounts']['hot'] ?? 0)),
            'priorityWarm' => (int) (($meta['priorityCounts']['warm'] ?? 0)),
            'priorityHotPending' => (int) (($meta['priorityPendingCounts']['hot'] ?? 0)),
            'priorityWarmPending' => (int) (($meta['priorityPendingCounts']['warm'] ?? 0)),
            'aiRequested' => (int) (($meta['aiStatusCounts']['requested'] ?? 0)),
            'aiCompleted' => (int) (($meta['aiStatusCounts']['completed'] ?? 0) + ($meta['aiStatusCounts']['accepted'] ?? 0)),
            'aiAccepted' => (int) ($meta['aiAcceptedCount'] ?? 0),
            'outcomeClosedWon' => (int) ($meta['closedWonCount'] ?? 0),
            'outcomeNoResponse' => (int) ($meta['noResponseCount'] ?? 0),
            'outcomeDiscarded' => (int) ($meta['discardedCount'] ?? 0),
            'firstContactSamples' => (int) (($meta['firstContact']['samples'] ?? 0)),
            'firstContactAvgMinutes' => (float) (($meta['firstContact']['avgMinutes'] ?? 0.0)),
            'firstContactP95Minutes' => (float) (($meta['firstContact']['p95Minutes'] ?? 0.0)),
            'aiAcceptanceRatePct' => (float) (($meta['rates']['aiAcceptancePct'] ?? 0.0)),
            'closeRatePct' => (float) (($meta['rates']['closedPct'] ?? 0.0)),
            'closeFromContactedRatePct' => (float) (($meta['rates']['closedFromContactedPct'] ?? 0.0)),
            'workerLastSeenAt' => (string) ($meta['worker']['lastSeenAt'] ?? ''),
            'workerLastErrorAt' => (string) ($meta['worker']['lastErrorAt'] ?? ''),
        ];
    }

public static function renderPrometheusMetrics(array $store): string
    {
        $callbacks = isset($store['callbacks']) && is_array($store['callbacks']) ? $store['callbacks'] : [];
        $meta = LeadOpsService::buildMeta($callbacks, $store);
        $health = self::buildHealthSnapshot($store);
        $output = '';

        $output .= "\n# TYPE auroraderm_leadops_callbacks_pending_total gauge";
        $output .= "\nauroraderm_leadops_callbacks_pending_total " . (int) ($meta['pendingCount'] ?? 0);

        $output .= "\n# TYPE auroraderm_leadops_callbacks_total gauge";
        $output .= "\nauroraderm_leadops_callbacks_total " . (int) ($meta['totalCount'] ?? 0);

        $output .= "\n# TYPE auroraderm_leadops_callbacks_contacted_total gauge";
        $output .= "\nauroraderm_leadops_callbacks_contacted_total " . (int) ($meta['contactedCount'] ?? 0);

        foreach ((array) ($meta['priorityCounts'] ?? []) as $band => $count) {
            $output .= "\n# TYPE auroraderm_leadops_priority_band_total gauge";
            $output .= "\nauroraderm_leadops_priority_band_total{band=\"" . $band . "\"} " . (int) $count;
        }

        foreach ((array) ($meta['priorityPendingCounts'] ?? []) as $band => $count) {
            $output .= "\n# TYPE auroraderm_leadops_priority_band_pending_total gauge";
            $output .= "\nauroraderm_leadops_priority_band_pending_total{band=\"" . $band . "\"} " . (int) $count;
        }

        foreach ((array) ($meta['aiStatusCounts'] ?? []) as $status => $count) {
            $output .= "\n# TYPE auroraderm_leadops_ai_status_total gauge";
            $output .= "\nauroraderm_leadops_ai_status_total{status=\"" . $status . "\"} " . (int) $count;
        }

        $output .= "\n# TYPE auroraderm_leadops_ai_accepted_total gauge";
        $output .= "\nauroraderm_leadops_ai_accepted_total " . (int) ($meta['aiAcceptedCount'] ?? 0);

        foreach ((array) ($meta['outcomeCounts'] ?? []) as $outcome => $count) {
            $output .= "\n# TYPE auroraderm_leadops_outcome_total gauge";
            $output .= "\nauroraderm_leadops_outcome_total{outcome=\"" . $outcome . "\"} " . (int) $count;
        }

        $output .= "\n# TYPE auroraderm_leadops_closed_won_total gauge";
        $output .= "\nauroraderm_leadops_closed_won_total " . (int) ($meta['closedWonCount'] ?? 0);

        $output .= "\n# TYPE auroraderm_leadops_first_contact_samples_total gauge";
        $output .= "\nauroraderm_leadops_first_contact_samples_total " . (int) (($meta['firstContact']['samples'] ?? 0));

        $output .= "\n# TYPE auroraderm_leadops_first_contact_avg_minutes gauge";
        $output .= "\nauroraderm_leadops_first_contact_avg_minutes " . (float) (($meta['firstContact']['avgMinutes'] ?? 0.0));

        $output .= "\n# TYPE auroraderm_leadops_first_contact_p95_minutes gauge";
        $output .= "\nauroraderm_leadops_first_contact_p95_minutes " . (float) (($meta['firstContact']['p95Minutes'] ?? 0.0));

        $output .= "\n# TYPE auroraderm_leadops_ai_acceptance_rate_pct gauge";
        $output .= "\nauroraderm_leadops_ai_acceptance_rate_pct " . (float) (($meta['rates']['aiAcceptancePct'] ?? 0.0));

        $output .= "\n# TYPE auroraderm_leadops_close_rate_pct gauge";
        $output .= "\nauroraderm_leadops_close_rate_pct " . (float) (($meta['rates']['closedPct'] ?? 0.0));

        $output .= "\n# TYPE auroraderm_leadops_close_from_contacted_rate_pct gauge";
        $output .= "\nauroraderm_leadops_close_from_contacted_rate_pct " . (float) (($meta['rates']['closedFromContactedPct'] ?? 0.0));

        foreach (['online', 'degraded', 'offline', 'pending', 'disabled'] as $mode) {
            $output .= "\n# TYPE auroraderm_leadops_worker_mode gauge";
            $output .= "\nauroraderm_leadops_worker_mode{mode=\"" . $mode . "\"} " . (($health['mode'] ?? '') === $mode ? 1 : 0);
        }

        $output .= "\n# TYPE auroraderm_leadops_worker_degraded gauge";
        $output .= "\nauroraderm_leadops_worker_degraded " . (($health['degraded'] ?? false) ? 1 : 0) . "\n";

        return app_prometheus_alias_output($output);
    }

public static function buildHeuristic(array $callback, array $store, ?array $funnelMetrics): array
    {
        $preference = LeadOpsService::normalizeText((string) ($callback['preferencia'] ?? ''));
        $status = map_callback_status((string) ($callback['status'] ?? 'pendiente'));
        $createdAt = LeadOpsService::timestampValue((string) ($callback['fecha'] ?? ''));
        $ageMinutes = $createdAt > 0
            ? max(0, (int) round((time() - $createdAt) / 60))
            : 0;
        [$serviceHints, , $serviceReasons] = self::resolveServiceHints($preference, $funnelMetrics);
        $scoring = LeadScoringService::scoreCallback($callback, $store, [
            'preference' => $preference,
            'ageMinutes' => $ageMinutes,
            'serviceHints' => $serviceHints,
        ]);
        $score = (int) ($scoring['score'] ?? 0);
        $reasonCodes = array_merge(
            is_array($scoring['reasonCodes'] ?? null) ? $scoring['reasonCodes'] : [],
            $serviceReasons
        );

        foreach ([
            'precio' => ['precio', 'costo', 'cuanto', 'valor', 'tarifa'],
            'agenda' => ['agenda', 'cita', 'turno', 'hora', 'disponible', 'manana', 'tarde'],
        ] as $code => $tokens) {
            foreach ($tokens as $token) {
                if (!str_contains($preference, $token)) {
                    continue;
                }
                $reasonCodes[] = 'keyword_' . $code;
                break;
            }
        }

        if (($funnelMetrics['summary']['checkoutAbandon'] ?? 0) > 0) {
            $score += 4;
            $reasonCodes[] = 'funnel_dropoff_active';
        }

        $score = LeadOpsService::clampInt($score, 0, 100);
        $priorityBand = (string) ($scoring['priorityBand'] ?? '');
        if ($priorityBand === '') {
            $priorityBand = $score >= 72 ? 'hot' : ($score >= 45 ? 'warm' : 'cold');
        } elseif (($priorityBand === 'hot' && $score < 72) || ($priorityBand === 'warm' && $score < 45)) {
            $priorityBand = $score >= 72 ? 'hot' : ($score >= 45 ? 'warm' : 'cold');
        }

        $nextAction = $priorityBand === 'hot'
            ? 'Llamar en menos de 10 min'
            : ($priorityBand === 'warm'
                ? 'Responder en esta franja y proponer horario'
                : 'Mantener visible y reagrupar en bloque');

        if (in_array('keyword_precio', $reasonCodes, true)) {
            $nextAction = 'Responder precio y cerrar cita en el mismo contacto';
        }

        if ($status === 'contactado') {
            $nextAction = 'Seguimiento registrado';
        }

        return [
            'score' => $score,
            'priorityBand' => $priorityBand,
            'reasonCodes' => array_slice(array_values(array_unique($reasonCodes)), 0, 8),
            'serviceHints' => array_slice($serviceHints, 0, 3),
            'nextAction' => $nextAction,
            'scoreSummary' => truncate_field(sanitize_xss((string) ($scoring['summary'] ?? '')), 220),
            'scoreFactors' => LeadOpsService::sanitizeList($scoring['factorLabels'] ?? [], 4, 80),
        ];
    }

public static function resolveServiceHints(string $preference, ?array $funnelMetrics): array
    {
        $catalog = self::serviceCatalog();
        $funnelMap = self::funnelSignals($funnelMetrics);
        $matches = [];

        foreach ($catalog['services'] as $service) {
            $hits = 0;
            foreach ($service['tokens'] as $token) {
                if ($token !== '' && str_contains($preference, $token)) {
                    $hits++;
                }
            }

            if ($hits === 0) {
                continue;
            }

            $signal = $funnelMap[$service['metricSlug']] ?? ['bookingIntent' => 0, 'checkoutStarts' => 0];
            $score = ($hits * 6)
                + (int) min(
                    12,
                    (($signal['bookingIntent'] ?? 0) * 2)
                    + (($signal['checkoutStarts'] ?? 0) * 3)
                    + (($signal['bookingConfirmed'] ?? 0) * 4)
                )
                + self::servicePriorityBoost($service, $signal);
            $matches[] = [
                'label' => $service['label'],
                'reason' => 'service_' . $service['metricSlug'],
                'score' => $score,
            ];
        }

        usort($matches, static fn (array $left, array $right): int => ($right['score'] ?? 0) <=> ($left['score'] ?? 0));

        $labels = [];
        $reasons = [];
        $score = 0;
        foreach ($matches as $match) {
            $labels[] = $match['label'];
            $reasons[] = $match['reason'];
            $score += (int) ($match['score'] ?? 0);
            if (count($labels) >= 3) {
                break;
            }
        }

        return [
            array_values(array_unique($labels)),
            min(24, $score),
            array_values(array_unique($reasons)),
        ];
    }

public static function serviceCatalog(): array
    {
        $catalog = load_service_catalog_payload();
        $path = (string) ($catalog['path'] ?? '');
        $mtime = (int) ($catalog['mtime'] ?? 0);

        if (
            self::$catalogCache !== null
            && self::$catalogCache['path'] === $path
            && self::$catalogCache['mtime'] === $mtime
        ) {
            return [
                'services' => self::$catalogCache['services'],
            ];
        }

        $services = [];

        foreach (service_catalog_services('public_route') as $service) {
            if (!is_array($service)) {
                continue;
            }

            $slug = LeadOpsService::normalizeToken((string) ($service['slug'] ?? ''));
            if ($slug === '') {
                continue;
            }

            $hint = LeadOpsService::normalizeToken((string) (($service['cta']['service_hint'] ?? '')));
            $label = $hint !== '' && function_exists('get_service_label')
                ? get_service_label($hint)
                : trim((string) ($service['hero'] ?? $slug));

            $tokens = array_merge(
                LeadOpsService::extractTokens($slug),
                LeadOpsService::extractTokens((string) ($service['hero'] ?? '')),
                LeadOpsService::extractTokens((string) ($service['summary'] ?? ''))
            );

            foreach ((array) ($service['indications'] ?? []) as $indication) {
                $tokens = array_merge($tokens, LeadOpsService::extractTokens((string) $indication));
            }

            $services[] = [
                'metricSlug' => str_replace('-', '_', $slug),
                'label' => $label !== '' ? $label : $slug,
                'category' => LeadOpsService::normalizeToken((string) ($service['category'] ?? '')),
                'tokens' => array_values(array_unique($tokens)),
            ];
        }

        self::$catalogCache = [
            'path' => $path,
            'mtime' => $mtime,
            'services' => $services,
        ];

        return [
            'services' => $services,
        ];
    }

public static function funnelSignals(?array $funnelMetrics): array
    {
        $map = [];
        foreach ((array) ($funnelMetrics['serviceFunnel'] ?? []) as $row) {
            if (!is_array($row)) {
                continue;
            }
            $slug = LeadOpsService::normalizeToken((string) ($row['serviceSlug'] ?? ''));
            if ($slug === '') {
                continue;
            }
            $map[$slug] = [
                'detailViews' => (int) ($row['detailViews'] ?? 0),
                'bookingIntent' => (int) ($row['bookingIntent'] ?? 0),
                'checkoutStarts' => (int) ($row['checkoutStarts'] ?? 0),
                'bookingConfirmed' => (int) ($row['bookingConfirmed'] ?? 0),
                'detailToConfirmedPct' => (float) ($row['detailToConfirmedPct'] ?? 0.0),
            ];
        }
        return $map;
    }

public static function servicePriorityBoost(array $service, array $signal): int
    {
        $categoryWeight = self::serviceCategoryBaseWeight((string) ($service['category'] ?? ''));
        $confirmedBoost = min(2, (int) ($signal['bookingConfirmed'] ?? 0));
        $conversionBoost = min(3, (int) round(((float) ($signal['detailToConfirmedPct'] ?? 0.0)) / 20));

        return min(8, $categoryWeight + $confirmedBoost + $conversionBoost);
    }

public static function serviceCategoryBaseWeight(string $category): int
    {
        $category = LeadOpsService::normalizeToken($category);
        if (str_contains($category, 'pediatric') || str_contains($category, 'children') || str_contains($category, 'ninos')) {
            return 4;
        }
        if (str_contains($category, 'clinical') || str_contains($category, 'diagnostic') || str_contains($category, 'medic')) {
            return 3;
        }
        if (str_contains($category, 'telemed')) {
            return 2;
        }
        if (str_contains($category, 'aesthetic') || str_contains($category, 'estet')) {
            return 2;
        }
        return 1;
    }

public static function workerStatusPath(): string
    {
        $baseDir = function_exists('data_dir_path')
            ? data_dir_path()
            : dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'data';

        return rtrim($baseDir, '\\/') . DIRECTORY_SEPARATOR . 'leadops-worker-status.json';
    }

public static function workerStaleAfterSeconds(): int
    {
        $raw = (int) getenv('PIELARMONIA_LEADOPS_WORKER_STALE_AFTER_SECONDS');
        return $raw > 0 ? $raw : 900;
    }

public static function buildCallbackOriginContext(array $callback, array $store): array
    {
        $case = self::findLeadOriginCaseContext($store, $callback);
        $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
        $appointment = self::findLeadOriginAppointmentContext($store, $callback, $case);

        return [
            'source' => LeadOpsService::firstNonEmptyString(
                (string) ($summary['source'] ?? ''),
                (string) ($appointment['source'] ?? '')
            ),
            'campaign' => LeadOpsService::firstNonEmptyString(
                (string) ($summary['campaign'] ?? ''),
                (string) ($appointment['campaign'] ?? '')
            ),
            'surface' => LeadOpsService::firstNonEmptyString(
                (string) ($summary['surface'] ?? ''),
                (string) ($summary['entrySurface'] ?? ''),
                (string) ($appointment['surface'] ?? ''),
                (string) ($appointment['checkoutEntry'] ?? ''),
                (string) ($appointment['telemedicineChannel'] ?? ''),
                (string) ($summary['lastChannel'] ?? '')
            ),
            'service_intent' => LeadOpsService::firstNonEmptyString(
                (string) ($summary['service_intent'] ?? ''),
                (string) ($appointment['service_intent'] ?? ''),
                (string) ($appointment['service'] ?? ''),
                (string) ($summary['serviceLine'] ?? '')
            ),
            'entrySurface' => (string) ($summary['entrySurface'] ?? ''),
            'checkoutEntry' => (string) ($appointment['checkoutEntry'] ?? ''),
            'channel' => LeadOpsService::firstNonEmptyString(
                (string) ($appointment['telemedicineChannel'] ?? ''),
                (string) ($summary['lastChannel'] ?? '')
            ),
            'serviceLine' => (string) ($summary['serviceLine'] ?? ''),
        ];
    }

public static function findLeadOriginCaseContext(array $store, array $callback): array
    {
        $callbacksCaseId = trim((string) ($callback['patientCaseId'] ?? ''));
        $callbackPatientId = trim((string) ($callback['patientId'] ?? ''));
        $callbackId = trim((string) ($callback['id'] ?? ''));
        $callbackPhone = LeadOpsService::normalizeComparablePhone((string) ($callback['telefono'] ?? ''));
        $cases = isset($store['patient_cases']) && is_array($store['patient_cases'])
            ? array_values($store['patient_cases'])
            : [];

        $best = [];
        $bestScore = -1;
        $bestTimestamp = 0;

        foreach ($cases as $case) {
            if (!is_array($case)) {
                continue;
            }

            $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
            $score = 0;
            if ($callbacksCaseId !== '' && trim((string) ($case['id'] ?? '')) === $callbacksCaseId) {
                $score += 12;
            }
            if ($callbackPatientId !== '' && trim((string) ($case['patientId'] ?? '')) === $callbackPatientId) {
                $score += 8;
            }
            if (
                $callbackId !== ''
                && trim((string) ($summary['latestCallbackId'] ?? '')) !== ''
                && trim((string) ($summary['latestCallbackId'] ?? '')) === $callbackId
            ) {
                $score += 4;
            }

            $casePhone = LeadOpsService::normalizeComparablePhone((string) ($summary['contactPhone'] ?? ''));
            if ($callbackPhone !== '' && $casePhone !== '' && $casePhone === $callbackPhone) {
                $score += 6;
            }

            if ($score <= 0) {
                continue;
            }

            $timestamp = max(
                LeadOpsService::timestampValue((string) ($case['latestActivityAt'] ?? '')),
                LeadOpsService::timestampValue((string) ($case['openedAt'] ?? ''))
            );

            if ($best === [] || $score > $bestScore || ($score === $bestScore && $timestamp >= $bestTimestamp)) {
                $best = $case;
                $bestScore = $score;
                $bestTimestamp = $timestamp;
            }
        }

        return $best;
    }

public static function findLeadOriginAppointmentContext(array $store, array $callback, array $case): array
    {
        $caseId = LeadOpsService::firstNonEmptyString(
            trim((string) ($callback['patientCaseId'] ?? '')),
            trim((string) ($case['id'] ?? ''))
        );
        $patientId = LeadOpsService::firstNonEmptyString(
            trim((string) ($callback['patientId'] ?? '')),
            trim((string) ($case['patientId'] ?? ''))
        );
        $callbackPhone = LeadOpsService::normalizeComparablePhone((string) ($callback['telefono'] ?? ''));
        $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
        $latestAppointmentId = trim((string) ($summary['latestAppointmentId'] ?? ''));
        $appointments = isset($store['appointments']) && is_array($store['appointments'])
            ? array_values($store['appointments'])
            : [];

        $best = [];
        $bestScore = -1;
        $bestTimestamp = 0;

        foreach ($appointments as $appointment) {
            if (!is_array($appointment)) {
                continue;
            }

            $score = 0;
            if ($latestAppointmentId !== '' && trim((string) ($appointment['id'] ?? '')) === $latestAppointmentId) {
                $score += 4;
            }
            if (
                $caseId !== ''
                && trim((string) ($appointment['patientCaseId'] ?? $appointment['caseId'] ?? '')) === $caseId
            ) {
                $score += 12;
            }
            if ($patientId !== '' && trim((string) ($appointment['patientId'] ?? '')) === $patientId) {
                $score += 8;
            }

            $appointmentPhone = LeadOpsService::normalizeComparablePhone((string) ($appointment['phone'] ?? ''));
            if ($callbackPhone !== '' && $appointmentPhone !== '' && $appointmentPhone === $callbackPhone) {
                $score += 6;
            }

            if ($score <= 0) {
                continue;
            }

            $timestamp = max(
                LeadOpsService::timestampValue((string) ($appointment['dateBooked'] ?? '')),
                LeadOpsService::buildAppointmentScheduledAt($appointment)?->getTimestamp() ?? 0
            );

            if ($best === [] || $score > $bestScore || ($score === $bestScore && $timestamp >= $bestTimestamp)) {
                $best = $appointment;
                $bestScore = $score;
                $bestTimestamp = $timestamp;
            }
        }

        return $best;
    }

}
