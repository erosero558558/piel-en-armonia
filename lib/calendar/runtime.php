<?php

declare(strict_types=1);

if (!function_exists('calendar_runtime_load')) {
    function calendar_runtime_load(): void
    {
        static $loaded = false;
        if ($loaded) {
            return;
        }

        $baseDir = __DIR__;
        $compatFile = $baseDir . DIRECTORY_SEPARATOR . 'compat.php';
        $nativeFiles = [
            $baseDir . DIRECTORY_SEPARATOR . 'GoogleTokenProvider.php',
            $baseDir . DIRECTORY_SEPARATOR . 'GoogleCalendarClient.php',
            $baseDir . DIRECTORY_SEPARATOR . 'CalendarAvailabilityService.php',
            $baseDir . DIRECTORY_SEPARATOR . 'CalendarBookingService.php',
        ];

        $nativeLoaded = false;
        if (PHP_VERSION_ID >= 70400) {
            try {
                foreach ($nativeFiles as $nativeFile) {
                    if (is_file($nativeFile)) {
                        require_once $nativeFile;
                    }
                }
                $nativeLoaded = class_exists('CalendarAvailabilityService') && class_exists('CalendarBookingService');
            } catch (Throwable $runtimeError) {
                error_log('Piel en Armonia: calendar runtime native fallback - ' . $runtimeError->getMessage());
            }
        }

        if (!$nativeLoaded && is_file($compatFile)) {
            require_once $compatFile;
        }

        $loaded = true;
    }
}

calendar_runtime_load();
