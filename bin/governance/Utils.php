<?php

declare(strict_types=1);

namespace Governance;

class Utils
{
    public static function readFileStrict(string $path, array &$errors): string
    {
        if (!is_file($path)) {
            $errors[] = "No existe archivo requerido: {$path}";
            return '';
        }

        $content = @file_get_contents($path);
        if ($content === false) {
            $errors[] = "No se pudo leer archivo requerido: {$path}";
            return '';
        }

        return str_replace("\r\n", "\n", $content);
    }

    public static function normalizePathToken(string $value): string
    {
        $normalized = str_replace('\\', '/', trim($value));
        $normalized = preg_replace('/^\.\//', '', $normalized) ?? $normalized;
        return strtolower($normalized);
    }

    public static function hasWildcard(string $value): bool
    {
        return strpos($value, '*') !== false;
    }

    public static function wildcardToRegex(string $pattern): string
    {
        $quoted = preg_quote($pattern, '/');
        return '/^' . str_replace('\*', '.*', $quoted) . '$/i';
    }

    public static function classifyFileLaneForDualCodex(string $rawFile): string
    {
        $file = self::normalizePathToken($rawFile);
        if ($file === '') {
            return 'backend_ops';
        }
        $backendPatterns = [
            'controllers/**',
            'lib/**',
            'api.php',
            'figo-*.php',
            '.github/workflows/**',
            'cron.php',
            'env*.php',
            'bin/**',
        ];
        $frontendPatterns = [
            'src/apps/**',
            'js/**',
            'styles*.css',
            'templates/**',
            'content/**',
            '*.html',
        ];
        $matchesBackend = false;
        foreach ($backendPatterns as $pattern) {
            if (preg_match(self::wildcardToRegex($pattern), $file) === 1) {
                $matchesBackend = true;
                break;
            }
        }
        $matchesFrontend = false;
        foreach ($frontendPatterns as $pattern) {
            if (preg_match(self::wildcardToRegex($pattern), $file) === 1) {
                $matchesFrontend = true;
                break;
            }
        }

        // Conservative fallback: dudas o no-match se asignan a backend_ops.
        if (($matchesBackend && $matchesFrontend) || (!$matchesBackend && !$matchesFrontend)) {
            return 'backend_ops';
        }
        return $matchesFrontend ? 'frontend_content' : 'backend_ops';
    }

    /**
     * @return array{any_overlap:bool, overlap_files:array<int,string>, ambiguous_wildcard_overlap:bool}
     */
    public static function analyzeFileOverlap(array $filesA, array $filesB): array
    {
        $overlapFiles = [];
        $seen = [];
        $anyOverlap = false;
        $ambiguous = false;

        foreach ($filesA as $rawA) {
            foreach ($filesB as $rawB) {
                $a = self::normalizePathToken((string) $rawA);
                $b = self::normalizePathToken((string) $rawB);
                if ($a === '' || $b === '') {
                    continue;
                }
                if ($a === $b) {
                    $anyOverlap = true;
                    if (!isset($seen[$a])) {
                        $seen[$a] = true;
                        $overlapFiles[] = $a;
                    }
                    continue;
                }

                $aWild = self::hasWildcard($a);
                $bWild = self::hasWildcard($b);

                if (!$aWild && $bWild && preg_match(self::wildcardToRegex($b), $a) === 1) {
                    $anyOverlap = true;
                    if (!isset($seen[$a])) {
                        $seen[$a] = true;
                        $overlapFiles[] = $a;
                    }
                    continue;
                }

                if ($aWild && !$bWild && preg_match(self::wildcardToRegex($a), $b) === 1) {
                    $anyOverlap = true;
                    if (!isset($seen[$b])) {
                        $seen[$b] = true;
                        $overlapFiles[] = $b;
                    }
                    continue;
                }

                if ($aWild && $bWild) {
                    if (preg_match(self::wildcardToRegex($a), $b) === 1 || preg_match(self::wildcardToRegex($b), $a) === 1) {
                        $anyOverlap = true;
                        $ambiguous = true;
                    }
                }
            }
        }

        sort($overlapFiles);
        return [
            'any_overlap' => $anyOverlap,
            'overlap_files' => $overlapFiles,
            'ambiguous_wildcard_overlap' => $ambiguous,
        ];
    }

    public static function isActiveStatus(string $status): bool
    {
        return in_array($status, ['ready', 'in_progress', 'review', 'blocked'], true);
    }
}
