<?php
declare(strict_types=1);

/**
 * Common configuration and helper functions.
 */

const APP_TIMEZONE = 'America/Guayaquil';

date_default_timezone_set(APP_TIMEZONE);

function local_date(string $format): string
{
    return date($format);
}

function app_runtime_version(): string
{
    static $resolved = null;
    if (is_string($resolved) && $resolved !== '') {
        return $resolved;
    }

    $candidates = [
        getenv('PIELARMONIA_APP_VERSION'),
        getenv('APP_VERSION')
    ];

    foreach ($candidates as $candidate) {
        if (is_string($candidate) && trim($candidate) !== '') {
            $resolved = trim($candidate);
            return $resolved;
        }
    }

    $versionSources = [
        __DIR__ . '/../index.php',
        __DIR__ . '/../index.html',
        __DIR__ . '/../script.js',
        __DIR__ . '/../styles.css',
        __DIR__ . '/../api.php',
        __DIR__ . '/../figo-chat.php'
    ];

    $versionGlobs = [
        __DIR__ . '/../*.js',
        __DIR__ . '/../*.css',
        __DIR__ . '/../*.html',
        __DIR__ . '/../js/*.js',
        __DIR__ . '/../lib/*.php',
        __DIR__ . '/../controllers/*.php'
    ];

    $indexed = [];
    foreach ($versionSources as $source) {
        $indexed[$source] = true;
    }

    foreach ($versionGlobs as $pattern) {
        $matches = glob($pattern);
        if (!is_array($matches)) {
            continue;
        }
        foreach ($matches as $match) {
            if (is_string($match) && $match !== '') {
                $indexed[$match] = true;
            }
        }
    }

    $versionSources = array_keys($indexed);

    $latestMtime = 0;
    foreach ($versionSources as $source) {
        if (!is_file($source)) {
            continue;
        }
        $mtime = @filemtime($source);
        if (is_int($mtime) && $mtime > $latestMtime) {
            $latestMtime = $mtime;
        }
    }

    if ($latestMtime > 0) {
        $resolved = gmdate('YmdHis', $latestMtime);
    } else {
        $resolved = 'dev';
    }

    return $resolved;
}
