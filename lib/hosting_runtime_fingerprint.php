<?php

declare(strict_types=1);

if (!function_exists('hosting_runtime_read_json_file')) {
    function hosting_runtime_read_json_file(string $path): ?array
    {
        if (!is_file($path)) {
            return null;
        }

        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            return null;
        }

        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : null;
    }
}

if (!function_exists('hosting_runtime_resolve_git_dir')) {
    function hosting_runtime_resolve_git_dir(string $repoRoot): ?string
    {
        $gitPath = $repoRoot . DIRECTORY_SEPARATOR . '.git';
        if (is_dir($gitPath)) {
            return $gitPath;
        }

        if (!is_file($gitPath)) {
            return null;
        }

        $raw = @file_get_contents($gitPath);
        if (!is_string($raw)) {
            return null;
        }

        if (!preg_match('/gitdir:\s*(.+)\s*$/i', $raw, $matches)) {
            return null;
        }

        $candidate = trim((string) $matches[1]);
        if ($candidate === '') {
            return null;
        }

        if (
            preg_match('/^[A-Za-z]:[\\\\\\/]/', $candidate) === 1 ||
            str_starts_with($candidate, DIRECTORY_SEPARATOR)
        ) {
            return $candidate;
        }

        return realpath(dirname($gitPath) . DIRECTORY_SEPARATOR . $candidate) ?: null;
    }
}

if (!function_exists('hosting_runtime_resolve_git_ref')) {
    function hosting_runtime_resolve_git_ref(string $gitDir, string $ref): string
    {
        $refPath = $gitDir . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $ref);
        if (is_file($refPath)) {
            $contents = @file_get_contents($refPath);
            if (is_string($contents)) {
                $commit = trim($contents);
                if ($commit !== '') {
                    return $commit;
                }
            }
        }

        $packedRefsPath = $gitDir . DIRECTORY_SEPARATOR . 'packed-refs';
        if (is_file($packedRefsPath)) {
            $lines = @file($packedRefsPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if (is_array($lines)) {
                foreach ($lines as $line) {
                    if ($line === '' || $line[0] === '#' || $line[0] === '^') {
                        continue;
                    }
                    $parts = preg_split('/\s+/', trim($line), 2);
                    if (
                        is_array($parts) &&
                        count($parts) === 2 &&
                        trim((string) $parts[1]) === $ref
                    ) {
                        return trim((string) $parts[0]);
                    }
                }
            }
        }

        return '';
    }
}

if (!function_exists('hosting_runtime_current_commit')) {
    function hosting_runtime_current_commit(string $repoRoot): string
    {
        $gitDir = hosting_runtime_resolve_git_dir($repoRoot);
        if ($gitDir === null || $gitDir === '') {
            return '';
        }

        $headPath = $gitDir . DIRECTORY_SEPARATOR . 'HEAD';
        if (!is_file($headPath)) {
            return '';
        }

        $head = @file_get_contents($headPath);
        if (!is_string($head)) {
            return '';
        }

        $head = trim($head);
        if ($head === '') {
            return '';
        }

        if (str_starts_with($head, 'ref: ')) {
            return hosting_runtime_resolve_git_ref($gitDir, trim(substr($head, 5)));
        }

        return $head;
    }
}

if (!function_exists('hosting_runtime_default_release_target_candidates')) {
    /**
     * @return array<int,string>
     */
    function hosting_runtime_default_release_target_candidates(): array
    {
        return [
            'C:\\ProgramData\\Pielarmonia\\hosting\\release-target.runtime.json',
            'C:\\ProgramData\\Pielarmonia\\hosting\\release-target.json',
        ];
    }
}

if (!function_exists('hosting_runtime_resolve_release_target')) {
    /**
     * @param array<int,string>|null $candidatePaths
     * @return array{path:string,payload:?array}
     */
    function hosting_runtime_resolve_release_target(?array $candidatePaths = null): array
    {
        $paths = [];
        foreach ($candidatePaths ?? hosting_runtime_default_release_target_candidates() as $candidatePath) {
            $candidate = trim((string) $candidatePath);
            if ($candidate === '') {
                continue;
            }
            $paths[] = $candidate;
        }

        if ($paths === []) {
            return [
                'path' => '',
                'payload' => null,
            ];
        }

        $resolvedPath = $paths[0];
        $resolvedPayload = null;
        foreach ($paths as $candidatePath) {
            $candidatePayload = hosting_runtime_read_json_file($candidatePath);
            if ($resolvedPayload === null) {
                $resolvedPayload = $candidatePayload;
                $resolvedPath = $candidatePath;
            }

            if (
                is_array($candidatePayload) &&
                isset($candidatePayload['target_commit']) &&
                trim((string) $candidatePayload['target_commit']) !== ''
            ) {
                $resolvedPayload = $candidatePayload;
                $resolvedPath = $candidatePath;
                break;
            }
        }

        return [
            'path' => $resolvedPath,
            'payload' => $resolvedPayload,
        ];
    }
}

if (!function_exists('hosting_runtime_build_fingerprint')) {
    /**
     * @param array<int,string>|null $releaseTargetCandidates
     * @return array{site_root:string,current_commit:string,desired_commit:string,release_target_path:string,status_source:string,caddy_runtime_config_path:string}
     */
    function hosting_runtime_build_fingerprint(
        ?string $repoRoot = null,
        ?array $releaseTargetCandidates = null
    ): array {
        $siteRoot = $repoRoot ?? dirname(__DIR__);
        $siteRoot = realpath($siteRoot) ?: $siteRoot;

        $releaseTarget = hosting_runtime_resolve_release_target($releaseTargetCandidates);
        $releaseTargetPayload = is_array($releaseTarget['payload'] ?? null)
            ? $releaseTarget['payload']
            : null;

        $desiredCommit = '';
        if (
            is_array($releaseTargetPayload) &&
            isset($releaseTargetPayload['target_commit']) &&
            is_string($releaseTargetPayload['target_commit'])
        ) {
            $desiredCommit = trim($releaseTargetPayload['target_commit']);
        }

        return [
            'site_root' => $siteRoot,
            'current_commit' => hosting_runtime_current_commit($siteRoot),
            'desired_commit' => $desiredCommit,
            'release_target_path' => (string) ($releaseTarget['path'] ?? ''),
            'status_source' => 'hosting_runtime_fingerprint',
            'caddy_runtime_config_path' => $siteRoot . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'runtime' . DIRECTORY_SEPARATOR . 'hosting' . DIRECTORY_SEPARATOR . 'Caddyfile.runtime',
        ];
    }
}
