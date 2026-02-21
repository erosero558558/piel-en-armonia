<?php

declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';

apply_security_headers(false);

// Ensure Composer autoload is loaded
if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    require_once __DIR__ . '/vendor/autoload.php';
}

// --- CORS & Headers ---
$requestOrigin = isset($_SERVER['HTTP_ORIGIN']) ? trim((string) $_SERVER['HTTP_ORIGIN']) : '';
$allowedOrigin = getenv('PIELARMONIA_ALLOWED_ORIGIN');
$allowedList = [];
if (is_string($allowedOrigin) && trim($allowedOrigin) !== '') {
    foreach (explode(',', $allowedOrigin) as $origin) {
        $origin = trim((string) $origin);
        if ($origin !== '') {
            $allowedList[] = rtrim($origin, '/');
        }
    }
}

$host = isset($_SERVER['HTTP_HOST']) ? trim((string) $_SERVER['HTTP_HOST']) : '';
if ($host !== '') {
    $allowedList[] = (is_https_request() ? 'https' : 'http') . '://' . $host;
}

$allowedList = array_values(array_unique(array_filter($allowedList)));
if ($requestOrigin !== '') {
    $normalizedOrigin = rtrim($requestOrigin, '/');
    foreach ($allowedList as $origin) {
        if (strcasecmp($normalizedOrigin, $origin) === 0) {
            header('Access-Control-Allow-Origin: ' . $requestOrigin);
            header('Access-Control-Allow-Credentials: true');
            header('Vary: Origin');
            header('Cross-Origin-Resource-Policy: cross-origin');
            break;
        }
    }
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

header('Content-Type: application/json; charset=UTF-8');

// --- GraphQL Dependencies ---
require_once __DIR__ . '/lib/GraphQL/Schema.php';

use GraphQL\GraphQL;
use GraphQL\Error\DebugFlag;

// --- Auth ---
start_secure_session();
$isAdmin = isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;

$clientIp = rate_limit_client_ip();
// Bypass for localhost (IPv4 and IPv6) to allow local testing
if ($clientIp !== '127.0.0.1' && $clientIp !== '::1') {
    require_rate_limit('graphql', 60, 60);
}

// --- Context ---
$store = read_store();
$context = [
    'store' => $store,
    'isAdmin' => $isAdmin,
    'requestStartedAt' => microtime(true)
];

// --- Execution ---
try {
    $rawInput = file_get_contents('php://input');
    if ($rawInput === false) {
        throw new RuntimeException('Failed to read input');
    }

    $input = json_decode($rawInput, true);
    if (!is_array($input)) {
        throw new RuntimeException('Invalid JSON input');
    }
    $query = $input['query'] ?? '';
    $variableValues = $input['variables'] ?? null;
    $operationName = $input['operationName'] ?? null;

    $schema = new \App\GraphQL\Schema();

    $debugEnabled = parse_bool(getenv('PIELARMONIA_DEBUG_EXCEPTIONS') ?: false);
    $debug = $debugEnabled ? (DebugFlag::INCLUDE_DEBUG_MESSAGE | DebugFlag::INCLUDE_TRACE) : DebugFlag::NONE;

    $result = GraphQL::executeQuery($schema, $query, null, $context, $variableValues, $operationName);
    $output = $result->toArray($debug);

} catch (\Throwable $e) {
    $debugEnabled = parse_bool(getenv('PIELARMONIA_DEBUG_EXCEPTIONS') ?: false);
    $errorData = ['message' => $e->getMessage()];

    if ($debugEnabled) {
        $errorData['trace'] = $e->getTraceAsString();
    }

    $output = [
        'errors' => [$errorData]
    ];
}

echo json_encode($output);
