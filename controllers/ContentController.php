<?php

declare(strict_types=1);

class ContentController
{
    public static function get(array $context): void
    {
        $lang = isset($_GET['lang']) ? trim((string)$_GET['lang']) : 'es';
        if (!in_array($lang, ['es', 'en'], true)) {
            $lang = 'es';
        }

        $file = __DIR__ . '/../content/' . $lang . '.json';

        // Security check to prevent directory traversal
        $realPath = realpath($file);
        $contentDir = realpath(__DIR__ . '/../content');

        if ($realPath === false || strpos($realPath, $contentDir) !== 0 || !file_exists($realPath)) {
            json_response(['ok' => false, 'error' => 'Content not found'], 404);
        }

        $content = file_get_contents($realPath);

        // Cache for 1 hour
        header('Cache-Control: public, max-age=3600');
        header('Content-Type: application/json; charset=utf-8');
        echo $content;
    }
}
