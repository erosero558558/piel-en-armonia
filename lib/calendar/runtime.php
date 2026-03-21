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
        $nativeFiles = [
            $baseDir . DIRECTORY_SEPARATOR . 'GoogleTokenProvider.php',
            $baseDir . DIRECTORY_SEPARATOR . 'GoogleCalendarClient.php',
            $baseDir . DIRECTORY_SEPARATOR . 'CalendarAvailabilityService.php',
            $baseDir . DIRECTORY_SEPARATOR . 'CalendarBookingService.php',
        ];

        foreach ($nativeFiles as $nativeFile) {
            if (!is_file($nativeFile)) {
                throw new RuntimeException(
                    'Aurora Derm: calendar runtime missing file: ' . $nativeFile
                );
            }

            require_once $nativeFile;
        }

        $requiredClasses = [
            'GoogleTokenProvider',
            'GoogleCalendarClient',
            'CalendarAvailabilityService',
            'CalendarBookingService',
        ];

        foreach ($requiredClasses as $requiredClass) {
            if (!class_exists($requiredClass)) {
                throw new RuntimeException(
                    'Aurora Derm: calendar runtime missing class: ' . $requiredClass
                );
            }
        }

        $loaded = true;
    }
}

calendar_runtime_load();
