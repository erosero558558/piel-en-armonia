<?php

declare(strict_types=1);

require_once __DIR__ . '/hosting_runtime_fingerprint.php';

if (!function_exists('public_sync_parse_scalar')) {
    function public_sync_parse_scalar(string $raw)
    {
        $value = trim($raw);
        if ($value === '') {
            return '';
        }
        if ($value === 'true') {
            return true;
        }
        if ($value === 'false') {
            return false;
        }
        if (preg_match('/^-?\d+$/', $value) === 1) {
            return (int) $value;
        }
        if ($value[0] === '"' && substr($value, -1) === '"') {
            return str_replace('\"', '"', substr($value, 1, -1));
        }
        return $value;
    }
}

if (!function_exists('public_sync_registry_path')) {
    function public_sync_registry_path(): string
    {
        $override = trim((string) getenv('PIELARMONIA_AGENT_JOBS_FILE'));
        if ($override !== '') {
            return $override;
        }

        return dirname(__DIR__) . '/AGENT_JOBS.yaml';
    }
}

if (!function_exists('public_sync_runtime_repo_root')) {
    function public_sync_runtime_repo_root(): string
    {
        $override = trim((string) getenv('PIELARMONIA_HOSTING_RUNTIME_REPO_ROOT'));
        if ($override !== '') {
            return $override;
        }

        return dirname(__DIR__);
    }
}

if (!function_exists('public_sync_runtime_release_target_candidates')) {
    /**
     * @return array<int,string>
     */
    function public_sync_runtime_release_target_candidates(): array
    {
        $jsonOverride = trim((string) getenv('PIELARMONIA_HOSTING_RELEASE_TARGET_PATHS_JSON'));
        if ($jsonOverride !== '') {
            $decoded = json_decode($jsonOverride, true);
            if (is_array($decoded)) {
                $normalized = [];
                foreach ($decoded as $candidate) {
                    $path = trim((string) $candidate);
                    if ($path === '') {
                        continue;
                    }
                    $normalized[] = $path;
                }
                if ($normalized !== []) {
                    return $normalized;
                }
            }
        }

        $singleOverride = trim((string) getenv('PIELARMONIA_HOSTING_RELEASE_TARGET_PATH'));
        if ($singleOverride !== '') {
            return [$singleOverride];
        }

        return hosting_runtime_default_release_target_candidates();
    }
}

if (!function_exists('public_sync_parse_registry')) {
    /**
     * @return array{version:mixed,updated_at:string,jobs:array<int,array<string,mixed>>}
     */
    function public_sync_parse_registry(): array
    {
        static $cache = [];

        $path = public_sync_registry_path();
        if (isset($cache[$path]) && is_array($cache[$path])) {
            return $cache[$path];
        }

        $data = [
            'version' => 1,
            'updated_at' => '',
            'jobs' => [],
        ];
        if (!is_file($path)) {
            $cache[$path] = $data;
            return $cache[$path];
        }

        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            $cache[$path] = $data;
            return $cache[$path];
        }

        $lines = preg_split('/\r?\n/', $raw) ?: [];
        $inJobs = false;
        $job = null;
        foreach ($lines as $lineRaw) {
            $line = str_replace("\t", '    ', (string) $lineRaw);
            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '#')) {
                continue;
            }

            if (!$inJobs && preg_match('/^version:\s*(.+)$/', $line, $matches) === 1) {
                $data['version'] = public_sync_parse_scalar((string) $matches[1]);
                continue;
            }
            if (!$inJobs && preg_match('/^updated_at:\s*(.+)$/', $line, $matches) === 1) {
                $data['updated_at'] = (string) public_sync_parse_scalar((string) $matches[1]);
                continue;
            }
            if ($trimmed === 'jobs:') {
                $inJobs = true;
                if (is_array($job)) {
                    $data['jobs'][] = $job;
                    $job = null;
                }
                continue;
            }
            if (!$inJobs) {
                continue;
            }
            if (preg_match('/^\s{2}-\s+key:\s*(.+)$/', $line, $matches) === 1) {
                if (is_array($job)) {
                    $data['jobs'][] = $job;
                }
                $job = ['key' => public_sync_parse_scalar((string) $matches[1])];
                continue;
            }
            if (
                is_array($job) &&
                preg_match('/^\s{4}([a-zA-Z_][\w-]*):\s*(.*)$/', $line, $matches) === 1
            ) {
                $job[(string) $matches[1]] = public_sync_parse_scalar((string) $matches[2]);
            }
        }

        if (is_array($job)) {
            $data['jobs'][] = $job;
        }

        $cache[$path] = $data;
        return $cache[$path];
    }
}

if (!function_exists('public_sync_override_status_path')) {
    function public_sync_override_status_path(): string
    {
        return trim((string) getenv('PIELARMONIA_PUBLIC_SYNC_STATUS_PATH'));
    }
}

if (!function_exists('public_sync_job_config')) {
    /**
     * @return array<string,mixed>
     */
    function public_sync_job_config(): array
    {
        static $cache = [];

        $cacheKey = public_sync_registry_path() . '|' . public_sync_override_status_path();
        if (isset($cache[$cacheKey]) && is_array($cache[$cacheKey])) {
            return $cache[$cacheKey];
        }

        $registry = public_sync_parse_registry();
        $job = null;
        foreach ($registry['jobs'] as $candidate) {
            if (trim((string) ($candidate['key'] ?? '')) === 'public_main_sync') {
                $job = $candidate;
                break;
            }
        }

        if (!is_array($job)) {
            $cache[$cacheKey] = [
                'configured' => false,
                'key' => 'public_main_sync',
                'job_id' => '',
                'enabled' => false,
                'type' => 'external_cron',
                'owner' => 'codex_backend_ops',
                'environment' => 'production',
                'repo_path' => '',
                'branch' => 'main',
                'schedule' => '',
                'command' => '',
                'wrapper_fallback' => '',
                'lock_file' => '',
                'log_path' => '',
                'status_path' => '',
                'health_url' => '',
                'expected_max_lag_seconds' => 120,
                'source_of_truth' => 'host_cron',
                'publish_strategy' => 'main_auto_guarded',
            ];
            return $cache[$cacheKey];
        }

        $statusPathOverride = public_sync_override_status_path();
        $cache[$cacheKey] = [
            'configured' => true,
            'key' => trim((string) ($job['key'] ?? 'public_main_sync')),
            'job_id' => trim((string) ($job['job_id'] ?? '')),
            'enabled' => (bool) ($job['enabled'] ?? true),
            'type' => trim((string) ($job['type'] ?? 'external_cron')),
            'owner' => trim((string) ($job['owner'] ?? 'codex_backend_ops')),
            'environment' => trim((string) ($job['environment'] ?? 'production')),
            'repo_path' => trim((string) ($job['repo_path'] ?? '')),
            'branch' => trim((string) ($job['branch'] ?? 'main')),
            'schedule' => trim((string) ($job['schedule'] ?? '')),
            'command' => trim((string) ($job['command'] ?? '')),
            'wrapper_fallback' => trim((string) ($job['wrapper_fallback'] ?? '')),
            'lock_file' => trim((string) ($job['lock_file'] ?? '')),
            'log_path' => trim((string) ($job['log_path'] ?? '')),
            'status_path' => $statusPathOverride !== ''
                ? $statusPathOverride
                : trim((string) ($job['status_path'] ?? '')),
            'health_url' => trim((string) ($job['health_url'] ?? '')),
            'expected_max_lag_seconds' => max(1, (int) ($job['expected_max_lag_seconds'] ?? 120)),
            'source_of_truth' => trim((string) ($job['source_of_truth'] ?? 'host_cron')),
            'publish_strategy' => trim((string) ($job['publish_strategy'] ?? 'main_auto_guarded')),
        ];
        return $cache[$cacheKey];
    }
}

if (!function_exists('public_sync_sibling_path')) {
    function public_sync_sibling_path(string $path, string $basename): string
    {
        $lastSlash = strrpos($path, '/');
        $lastBackslash = strrpos($path, '\\');
        $separatorPosition = max(
            $lastSlash === false ? -1 : $lastSlash,
            $lastBackslash === false ? -1 : $lastBackslash
        );

        if ($separatorPosition < 0) {
            return $basename;
        }

        return substr($path, 0, $separatorPosition + 1) . $basename;
    }
}

if (!function_exists('public_sync_status_source_kind')) {
    function public_sync_status_source_kind(string $path): string
    {
        $normalized = str_replace('\\', '/', strtolower(trim($path)));
        if ($normalized === '') {
            return 'unknown';
        }
        if (str_ends_with($normalized, '/main-sync-status.json') || str_ends_with($normalized, 'main-sync-status.json')) {
            return 'windows_main_sync';
        }
        if (str_ends_with($normalized, '/public-sync-status.json') || str_ends_with($normalized, 'public-sync-status.json')) {
            return 'legacy_public_sync';
        }
        return 'configured_status';
    }
}

if (!function_exists('public_sync_read_status_file')) {
    /**
     * @return array<string,mixed>
     */
    function public_sync_read_status_file(string $statusPath): array
    {
        $result = [
            'exists' => false,
            'path' => $statusPath,
            'status' => [],
            'error' => '',
            'mtime' => null,
            'source_kind' => public_sync_status_source_kind($statusPath),
        ];

        if ($statusPath === '') {
            return $result;
        }

        if (!is_file($statusPath)) {
            $result['error'] = 'status_file_missing';
            return $result;
        }

        $mtime = @filemtime($statusPath);
        if ($mtime !== false) {
            $result['mtime'] = (int) $mtime;
        }

        $raw = @file_get_contents($statusPath);
        if (!is_string($raw) || trim($raw) === '') {
            $result['error'] = 'status_file_unreadable';
            return $result;
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            $result['error'] = 'status_file_invalid_json';
            return $result;
        }

        $result['exists'] = true;
        $result['status'] = $decoded;
        return $result;
    }
}

if (!function_exists('public_sync_candidate_status_paths')) {
    /**
     * @return array<int,string>
     */
    function public_sync_candidate_status_paths(string $configuredPath): array
    {
        $configuredPath = trim($configuredPath);
        if ($configuredPath === '') {
            return [];
        }

        $candidates = [$configuredPath];
        $sourceKind = public_sync_status_source_kind($configuredPath);
        if ($sourceKind === 'legacy_public_sync') {
            $candidates[] = public_sync_sibling_path($configuredPath, 'main-sync-status.json');
        } elseif ($sourceKind === 'windows_main_sync') {
            $candidates[] = public_sync_sibling_path($configuredPath, 'public-sync-status.json');
        }

        $seen = [];
        $normalized = [];
        foreach ($candidates as $candidatePath) {
            $candidate = trim((string) $candidatePath);
            if ($candidate === '') {
                continue;
            }
            $fingerprint = str_replace('\\', '/', strtolower($candidate));
            if (isset($seen[$fingerprint])) {
                continue;
            }
            $seen[$fingerprint] = true;
            $normalized[] = $candidate;
        }

        return $normalized;
    }
}

if (!function_exists('public_sync_status_reference_timestamp')) {
    function public_sync_status_reference_timestamp(array $status): string
    {
        foreach ([
            'checked_at',
            'timestamp',
            'finished_at',
            'last_success_at',
            'last_successful_deploy_at',
            'started_at',
        ] as $key) {
            $value = trim((string) ($status[$key] ?? ''));
            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }
}

if (!function_exists('public_sync_status_reference_epoch')) {
    function public_sync_status_reference_epoch(array $status): ?int
    {
        $timestamp = public_sync_status_reference_timestamp($status);
        if ($timestamp === '') {
            return null;
        }

        try {
            return (new DateTimeImmutable($timestamp))->getTimestamp();
        } catch (Throwable $throwable) {
            return null;
        }
    }
}

if (!function_exists('public_sync_is_newer_envelope')) {
    /**
     * @param array<string,mixed> $candidate
     * @param array<string,mixed> $baseline
     */
    function public_sync_is_newer_envelope(array $candidate, array $baseline): bool
    {
        $candidateStatus = is_array($candidate['status'] ?? null) ? $candidate['status'] : [];
        $baselineStatus = is_array($baseline['status'] ?? null) ? $baseline['status'] : [];
        $candidateEpoch = public_sync_status_reference_epoch($candidateStatus);
        $baselineEpoch = public_sync_status_reference_epoch($baselineStatus);

        if ($candidateEpoch !== null && $baselineEpoch !== null) {
            return $candidateEpoch > $baselineEpoch;
        }
        if ($candidateEpoch !== null) {
            return true;
        }
        if ($baselineEpoch !== null) {
            return false;
        }

        return (int) ($candidate['mtime'] ?? 0) > (int) ($baseline['mtime'] ?? 0);
    }
}

if (!function_exists('public_sync_read_status')) {
    /**
     * @return array<string,mixed>
     */
    function public_sync_read_status(): array
    {
        $config = public_sync_job_config();
        $configuredPath = trim((string) ($config['status_path'] ?? ''));
        $configuredEnvelope = [
            'configured' => (bool) ($config['configured'] ?? false),
            'configured_path' => $configuredPath,
            'exists' => false,
            'path' => $configuredPath,
            'status' => [],
            'error' => '',
            'source_kind' => public_sync_status_source_kind($configuredPath),
            'mtime' => null,
        ];

        if (!(bool) ($config['configured'] ?? false) || $configuredPath === '') {
            return $configuredEnvelope;
        }

        $candidates = [];
        foreach (public_sync_candidate_status_paths($configuredPath) as $candidatePath) {
            $candidateEnvelope = public_sync_read_status_file($candidatePath);
            $candidateEnvelope['configured'] = true;
            $candidateEnvelope['configured_path'] = $configuredPath;
            $candidates[] = $candidateEnvelope;
        }

        if ($candidates === []) {
            return $configuredEnvelope;
        }

        $configuredEnvelope = $candidates[0];
        $resolvedEnvelope = $configuredEnvelope;
        if ((bool) ($configuredEnvelope['exists'] ?? false) && trim((string) ($configuredEnvelope['error'] ?? '')) === '') {
            $resolvedEnvelope = $configuredEnvelope;
        } else {
            foreach ($candidates as $candidateEnvelope) {
                if ((bool) ($candidateEnvelope['exists'] ?? false) && trim((string) ($candidateEnvelope['error'] ?? '')) === '') {
                    $resolvedEnvelope = $candidateEnvelope;
                    break;
                }
            }
        }

        if (public_sync_status_source_kind($configuredPath) === 'legacy_public_sync') {
            foreach ($candidates as $candidateEnvelope) {
                if (
                    trim((string) ($candidateEnvelope['source_kind'] ?? '')) === 'windows_main_sync' &&
                    (bool) ($candidateEnvelope['exists'] ?? false) &&
                    trim((string) ($candidateEnvelope['error'] ?? '')) === '' &&
                    public_sync_is_newer_envelope($candidateEnvelope, $configuredEnvelope)
                ) {
                    $resolvedEnvelope = $candidateEnvelope;
                    break;
                }
            }
        }

        $resolvedEnvelope['configured'] = true;
        $resolvedEnvelope['configured_path'] = $configuredPath;
        return $resolvedEnvelope;
    }
}

if (!function_exists('public_sync_normalize_string_list')) {
    /**
     * @return array<int,string>
     */
    function public_sync_normalize_string_list($value): array
    {
        if (!is_array($value)) {
            return [];
        }

        $normalized = [];
        foreach ($value as $item) {
            $candidate = trim((string) $item);
            if ($candidate === '') {
                continue;
            }
            $normalized[] = $candidate;
        }

        return $normalized;
    }
}

if (!function_exists('public_sync_compute_head_drift')) {
    function public_sync_compute_head_drift(string $currentHead, string $remoteHead): bool
    {
        return $currentHead !== '' && $remoteHead !== '' && $currentHead !== $remoteHead;
    }
}

if (!function_exists('public_sync_has_dirty_path_evidence')) {
    /**
     * @param array<int,string> $dirtyPathsSample
     * @param array<int,string> $dirtyPaths
     */
    function public_sync_has_dirty_path_evidence(
        int $dirtyPathsCount,
        array $dirtyPathsSample,
        array $dirtyPaths
    ): bool {
        return $dirtyPathsCount > 0 || count($dirtyPathsSample) > 0 || count($dirtyPaths) > 0;
    }
}

if (!function_exists('public_sync_compute_telemetry_gap')) {
    /**
     * @param array<int,string> $dirtyPathsSample
     * @param array<int,string> $dirtyPaths
     */
    function public_sync_compute_telemetry_gap(
        bool $healthy,
        string $lastErrorMessage,
        string $currentHead,
        string $remoteHead,
        int $dirtyPathsCount,
        array $dirtyPathsSample,
        array $dirtyPaths
    ): bool {
        return !$healthy &&
            $lastErrorMessage !== '' &&
            $currentHead === '' &&
            $remoteHead === '' &&
            $dirtyPathsCount <= 0 &&
            count($dirtyPathsSample) === 0 &&
            count($dirtyPaths) === 0;
    }
}

if (!function_exists('public_sync_compute_failure_reason')) {
    /**
     * @param array<string,mixed> $snapshot
     */
    function public_sync_compute_failure_reason(array $snapshot): string
    {
        if (!(bool) ($snapshot['configured'] ?? false)) {
            return 'unconfigured';
        }

        $ageSeconds = $snapshot['ageSeconds'] ?? null;
        $expectedMaxLagSeconds = max(1, (int) ($snapshot['expectedMaxLagSeconds'] ?? 120));
        if ($ageSeconds !== null && (int) $ageSeconds > $expectedMaxLagSeconds) {
            return 'stale';
        }

        $lastErrorMessage = trim((string) ($snapshot['lastErrorMessage'] ?? ''));
        if ($lastErrorMessage !== '') {
            return $lastErrorMessage;
        }

        $state = trim((string) ($snapshot['state'] ?? 'unknown'));
        if ($state === 'failed') {
            return 'failed';
        }

        if (!(bool) ($snapshot['healthy'] ?? false)) {
            return 'unhealthy';
        }

        return '';
    }
}

if (!function_exists('public_sync_compute_repo_hygiene_issue')) {
    /**
     * @param array<int,string> $dirtyPathsSample
     * @param array<int,string> $dirtyPaths
     */
    function public_sync_compute_repo_hygiene_issue(
        string $failureReason,
        bool $headDrift,
        bool $telemetryGap,
        int $dirtyPathsCount,
        array $dirtyPathsSample,
        array $dirtyPaths
    ): bool {
        return $failureReason === 'working_tree_dirty' &&
            !$headDrift &&
            !$telemetryGap &&
            public_sync_has_dirty_path_evidence($dirtyPathsCount, $dirtyPathsSample, $dirtyPaths);
    }
}

if (!function_exists('public_sync_compute_operational_health')) {
    function public_sync_compute_operational_health(
        bool $configured,
        bool $statusExists,
        string $state,
        ?int $ageSeconds,
        int $expectedMaxLagSeconds,
        bool $headDrift,
        bool $telemetryGap,
        bool $repoHygieneIssue
    ): bool {
        if (
            !$configured ||
            !$statusExists ||
            $state === '' ||
            $state === 'unknown' ||
            $ageSeconds === null ||
            $ageSeconds > $expectedMaxLagSeconds ||
            $headDrift ||
            $telemetryGap
        ) {
            return false;
        }

        if ($state === 'failed' && !$repoHygieneIssue) {
            return false;
        }

        return true;
    }
}

if (!function_exists('public_sync_first_string')) {
    /**
     * @param array<int,string> $keys
     */
    function public_sync_first_string(array $payload, array $keys): string
    {
        foreach ($keys as $key) {
            $value = trim((string) ($payload[$key] ?? ''));
            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }
}

if (!function_exists('public_sync_normalize_status_payload')) {
    /**
     * @param array<string,mixed> $status
     * @param array<string,mixed> $config
     * @param array<string,mixed> $statusEnvelope
     * @return array<string,mixed>
     */
    function public_sync_normalize_status_payload(
        array $status,
        array $config,
        array $statusEnvelope
    ): array {
        $lastCheckedAt = public_sync_status_reference_timestamp($status);
        $lastSuccessAt = public_sync_first_string($status, [
            'last_success_at',
            'last_successful_deploy_at',
        ]);
        $state = public_sync_first_string($status, ['state']);
        if ($lastSuccessAt === '' && $state === 'ok') {
            $lastSuccessAt = $lastCheckedAt;
        }

        $lastErrorMessage = public_sync_first_string($status, [
            'last_error_message',
            'error',
            'last_failure_reason',
        ]);
        $lastErrorAt = public_sync_first_string($status, ['last_error_at']);
        if ($lastErrorAt === '' && $state === 'failed' && $lastErrorMessage !== '') {
            $lastErrorAt = $lastCheckedAt;
        }

        $currentHead = public_sync_first_string($status, [
            'current_head',
            'current_commit',
        ]);
        $remoteHead = public_sync_first_string($status, [
            'remote_head',
            'desired_commit',
        ]);
        $statusReportedCommit = public_sync_first_string($status, [
            'deployed_commit',
            'served_commit',
            'current_commit',
            'current_head',
            'remote_head',
            'desired_commit',
        ]);

        return [
            'statusPathConfigured' => trim((string) ($statusEnvelope['configured_path'] ?? $config['status_path'] ?? '')),
            'statusPathResolved' => trim((string) ($statusEnvelope['path'] ?? $config['status_path'] ?? '')),
            'statusSourceKind' => trim((string) ($statusEnvelope['source_kind'] ?? 'configured_status')),
            'statusReportedCommit' => $statusReportedCommit,
            'repoPath' => public_sync_first_string($status, ['repo_path', 'mirror_repo_path']) !== ''
                ? public_sync_first_string($status, ['repo_path', 'mirror_repo_path'])
                : trim((string) ($config['repo_path'] ?? '')),
            'branch' => public_sync_first_string($status, ['branch']) !== ''
                ? public_sync_first_string($status, ['branch'])
                : trim((string) ($config['branch'] ?? 'main')),
            'state' => $state !== '' ? $state : 'unknown',
            'lastCheckedAt' => $lastCheckedAt,
            'lastSuccessAt' => $lastSuccessAt,
            'lastErrorAt' => $lastErrorAt,
            'lastErrorMessage' => $lastErrorMessage !== ''
                ? $lastErrorMessage
                : trim((string) ($statusEnvelope['error'] ?? '')),
            'deployedCommit' => $statusReportedCommit,
            'currentHead' => $currentHead,
            'remoteHead' => $remoteHead,
            'durationMs' => array_key_exists('duration_ms', $status)
                ? (int) $status['duration_ms']
                : null,
            'dirtyPathsCount' => max(0, (int) ($status['dirty_paths_count'] ?? 0)),
            'dirtyPathsSample' => public_sync_normalize_string_list($status['dirty_paths_sample'] ?? []),
            'dirtyPaths' => public_sync_normalize_string_list($status['dirty_paths'] ?? []),
        ];
    }
}

if (!function_exists('public_sync_runtime_fingerprint')) {
    /**
     * @return array<string,string>
     */
    function public_sync_runtime_fingerprint(): array
    {
        $fingerprint = hosting_runtime_build_fingerprint(
            public_sync_runtime_repo_root(),
            public_sync_runtime_release_target_candidates()
        );

        return [
            'site_root' => trim((string) ($fingerprint['site_root'] ?? '')),
            'current_commit' => trim((string) ($fingerprint['current_commit'] ?? '')),
            'desired_commit' => trim((string) ($fingerprint['desired_commit'] ?? '')),
            'release_target_path' => trim((string) ($fingerprint['release_target_path'] ?? '')),
            'status_source' => trim((string) ($fingerprint['status_source'] ?? 'hosting_runtime_fingerprint')),
            'caddy_runtime_config_path' => trim((string) ($fingerprint['caddy_runtime_config_path'] ?? '')),
        ];
    }
}

if (!function_exists('public_sync_reconcile_runtime_identity')) {
    /**
     * @param array<string,mixed> $snapshot
     * @param array<string,string> $runtime
     * @return array<string,mixed>
     */
    function public_sync_reconcile_runtime_identity(array $snapshot, array $runtime): array
    {
        $runtimeCurrentCommit = trim((string) ($runtime['current_commit'] ?? ''));
        $runtimeDesiredCommit = trim((string) ($runtime['desired_commit'] ?? ''));
        $statusReportedCommit = trim((string) ($snapshot['statusReportedCommit'] ?? ''));
        $statusCurrentHead = trim((string) ($snapshot['currentHead'] ?? ''));
        $statusRemoteHead = trim((string) ($snapshot['remoteHead'] ?? ''));

        $statusCommitMismatch = false;
        if (
            $runtimeCurrentCommit !== '' &&
            (
                ($statusReportedCommit !== '' && $statusReportedCommit !== $runtimeCurrentCommit) ||
                ($statusCurrentHead !== '' && $statusCurrentHead !== $runtimeCurrentCommit)
            )
        ) {
            $statusCommitMismatch = true;
        }
        if (
            $runtimeDesiredCommit !== '' &&
            (
                ($statusRemoteHead !== '' && $statusRemoteHead !== $runtimeDesiredCommit) ||
                ($runtimeCurrentCommit === '' && $statusReportedCommit !== '' && $statusReportedCommit !== $runtimeDesiredCommit)
            )
        ) {
            $statusCommitMismatch = true;
        }

        if ($runtimeCurrentCommit !== '' || $runtimeDesiredCommit !== '') {
            if ($runtimeCurrentCommit !== '') {
                $snapshot['deployedCommit'] = $runtimeCurrentCommit;
                $snapshot['currentHead'] = $runtimeCurrentCommit;
            }
            if ($runtimeDesiredCommit !== '') {
                $snapshot['remoteHead'] = $runtimeDesiredCommit;
            } elseif (trim((string) ($snapshot['remoteHead'] ?? '')) === '' && $runtimeCurrentCommit !== '') {
                $snapshot['remoteHead'] = $runtimeCurrentCommit;
            }
        }

        $snapshot['runtimeCurrentCommit'] = $runtimeCurrentCommit;
        $snapshot['runtimeDesiredCommit'] = $runtimeDesiredCommit;
        $snapshot['statusCommitMismatch'] = $statusCommitMismatch;

        return $snapshot;
    }
}

if (!function_exists('public_sync_health_snapshot')) {
    /**
     * @return array<string,mixed>
     */
    function public_sync_health_snapshot(): array
    {
        $config = public_sync_job_config();
        $statusEnvelope = public_sync_read_status();
        $status = is_array($statusEnvelope['status'] ?? null) ? $statusEnvelope['status'] : [];
        $normalized = public_sync_normalize_status_payload($status, $config, $statusEnvelope);
        $runtimeFingerprint = public_sync_runtime_fingerprint();
        if ((bool) ($statusEnvelope['exists'] ?? false)) {
            $normalized = public_sync_reconcile_runtime_identity($normalized, $runtimeFingerprint);
        }

        $lastCheckedAt = trim((string) ($normalized['lastCheckedAt'] ?? ''));
        $lastSuccessAt = trim((string) ($normalized['lastSuccessAt'] ?? ''));
        $lastErrorAt = trim((string) ($normalized['lastErrorAt'] ?? ''));
        $lastErrorMessage = trim((string) ($normalized['lastErrorMessage'] ?? ''));
        $state = trim((string) ($normalized['state'] ?? 'unknown'));
        $repoPath = trim((string) ($normalized['repoPath'] ?? ''));
        $branch = trim((string) ($normalized['branch'] ?? 'main'));
        $currentHead = trim((string) ($normalized['currentHead'] ?? ''));
        $remoteHead = trim((string) ($normalized['remoteHead'] ?? ''));
        $dirtyPathsCount = max(0, (int) ($normalized['dirtyPathsCount'] ?? 0));
        $dirtyPathsSample = public_sync_normalize_string_list($normalized['dirtyPathsSample'] ?? []);
        $dirtyPaths = public_sync_normalize_string_list($normalized['dirtyPaths'] ?? []);
        $durationMs = array_key_exists('durationMs', $normalized) ? $normalized['durationMs'] : null;
        $expectedMaxLagSeconds = max(1, (int) ($config['expected_max_lag_seconds'] ?? 120));
        $ageSeconds = null;
        $headDrift = public_sync_compute_head_drift($currentHead, $remoteHead);

        if ($lastCheckedAt !== '') {
            try {
                $checkedAt = new DateTimeImmutable($lastCheckedAt);
                $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
                $ageSeconds = max(0, $now->getTimestamp() - $checkedAt->getTimestamp());
            } catch (Throwable $throwable) {
                $ageSeconds = null;
            }
        }

        $reportedHealthy = false;
        if (
            (bool) ($config['configured'] ?? false) &&
            (bool) ($statusEnvelope['exists'] ?? false) &&
            $state !== '' &&
            $state !== 'failed' &&
            $ageSeconds !== null &&
            $ageSeconds <= $expectedMaxLagSeconds
        ) {
            $reportedHealthy = true;
        }

        $telemetryGap = public_sync_compute_telemetry_gap(
            $reportedHealthy,
            $lastErrorMessage,
            $currentHead,
            $remoteHead,
            $dirtyPathsCount,
            $dirtyPathsSample,
            $dirtyPaths
        );
        $failureReason = public_sync_compute_failure_reason([
            'configured' => (bool) ($config['configured'] ?? false),
            'healthy' => $reportedHealthy,
            'state' => $state !== '' ? $state : 'unknown',
            'ageSeconds' => $ageSeconds,
            'expectedMaxLagSeconds' => $expectedMaxLagSeconds,
            'lastErrorMessage' => $lastErrorMessage,
        ]);
        $repoHygieneIssue = public_sync_compute_repo_hygiene_issue(
            $failureReason,
            $headDrift,
            $telemetryGap,
            $dirtyPathsCount,
            $dirtyPathsSample,
            $dirtyPaths
        );
        $operationallyHealthy = public_sync_compute_operational_health(
            (bool) ($config['configured'] ?? false),
            (bool) ($statusEnvelope['exists'] ?? false),
            $state !== '' ? $state : 'unknown',
            $ageSeconds,
            $expectedMaxLagSeconds,
            $headDrift,
            $telemetryGap,
            $repoHygieneIssue
        );

        return [
            'configured' => (bool) ($config['configured'] ?? false),
            'jobId' => trim((string) ($config['job_id'] ?? '')),
            'jobKey' => trim((string) ($config['key'] ?? 'public_main_sync')),
            'mode' => trim((string) ($config['type'] ?? 'external_cron')),
            'schedule' => trim((string) ($config['schedule'] ?? '')),
            'statusPath' => trim((string) ($normalized['statusPathResolved'] ?? $config['status_path'] ?? '')),
            'logPath' => trim((string) ($config['log_path'] ?? '')),
            'lockFile' => trim((string) ($config['lock_file'] ?? '')),
            'repoPath' => $repoPath,
            'branch' => $branch,
            'state' => $state !== '' ? $state : 'unknown',
            'healthy' => $operationallyHealthy,
            'operationallyHealthy' => $operationallyHealthy,
            'repoHygieneIssue' => $repoHygieneIssue,
            'ageSeconds' => $ageSeconds,
            'expectedMaxLagSeconds' => $expectedMaxLagSeconds,
            'lastCheckedAt' => $lastCheckedAt,
            'lastSuccessAt' => $lastSuccessAt,
            'lastErrorAt' => $lastErrorAt,
            'lastErrorMessage' => $lastErrorMessage,
            'failureReason' => $failureReason,
            'deployedCommit' => trim((string) ($normalized['deployedCommit'] ?? '')),
            'currentHead' => $currentHead,
            'remoteHead' => $remoteHead,
            'headDrift' => $headDrift,
            'durationMs' => $durationMs,
            'dirtyPathsCount' => $dirtyPathsCount,
            'dirtyPathsSample' => $dirtyPathsSample,
            'dirtyPaths' => $dirtyPaths,
            'telemetryGap' => $telemetryGap,
            'statusPathConfigured' => trim((string) ($normalized['statusPathConfigured'] ?? $config['status_path'] ?? '')),
            'statusPathResolved' => trim((string) ($normalized['statusPathResolved'] ?? $config['status_path'] ?? '')),
            'statusSourceKind' => trim((string) ($normalized['statusSourceKind'] ?? 'configured_status')),
            'runtimeCurrentCommit' => trim((string) ($normalized['runtimeCurrentCommit'] ?? '')),
            'runtimeDesiredCommit' => trim((string) ($normalized['runtimeDesiredCommit'] ?? '')),
            'statusReportedCommit' => trim((string) ($normalized['statusReportedCommit'] ?? '')),
            'statusCommitMismatch' => (bool) ($normalized['statusCommitMismatch'] ?? false),
        ];
    }
}
