<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$result = [
    'ok' => false,
    'phpVersion' => PHP_VERSION,
    'timestamp' => date('c'),
];

try {
    require_once __DIR__ . '/api-lib.php';
    $result['ok'] = true;
    $result['apiLibLoaded'] = true;
    $result['calendarAvailabilityClass'] = class_exists('CalendarAvailabilityService');
    $result['calendarBookingClass'] = class_exists('CalendarBookingService');
    $result['googleClientClass'] = class_exists('GoogleCalendarClient');
    $result['googleTokenClass'] = class_exists('GoogleTokenProvider');
} catch (Throwable $e) {
    http_response_code(500);
    $result['errorClass'] = get_class($e);
    $result['errorMessage'] = $e->getMessage();
    $result['errorFile'] = str_replace('\\', '/', (string) $e->getFile());
    $result['errorLine'] = (int) $e->getLine();
}

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
