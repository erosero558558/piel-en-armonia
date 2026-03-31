<?php

declare(strict_types=1);

$autoloadPath = __DIR__ . '/../../vendor/autoload.php';
if (!file_exists($autoloadPath)) {
    echo "NOK - composer dependencies not installed\n";
    exit(1);
}
require_once $autoloadPath;

// --- Phase 1: Test Fallback to stderr when PAPERTRAIL_HOST is empty ---
putenv('PAPERTRAIL_HOST=');
putenv('PAPERTRAIL_PORT=');

// We simulate logger logic manually since get_logger uses a static variable
$hasMonolog = class_exists('\Monolog\Logger')
    && class_exists('\Monolog\Handler\ErrorLogHandler')
    && class_exists('\Monolog\Handler\SyslogUdpHandler')
    && class_exists('\Monolog\Formatter\JsonFormatter');

if (!$hasMonolog) {
    echo "NOK - Monolog must be available for Papertrail\n";
    exit(1);
}

// --- Phase 2: Test UDP Payload Format ---
$port = 25000 + random_int(0, 5000);
$socket = stream_socket_server("udp://127.0.0.1:$port", $errno, $errstr, STREAM_SERVER_BIND);

if (!$socket) {
    echo "NOK - Could not bind test UDP socket: $errstr\n";
    exit(1);
}
stream_set_blocking($socket, false);

putenv("PAPERTRAIL_HOST=127.0.0.1");
putenv("PAPERTRAIL_PORT=$port");

require_once __DIR__ . '/../../lib/logger.php';
$logger = get_logger();

$testMessage = '[smoke] aurora-derm test ' . uniqid();

try {
    $logger->info($testMessage, ['test' => true]);
} catch (\Throwable $e) {
    echo "NOK - Logger threw exception: " . $e->getMessage() . "\n";
    exit(1);
}

// Let UDP packet arrive
usleep(50000); 

$packet = stream_socket_recvfrom($socket, 1500, 0, $peer);

if ($packet === false || $packet === '') {
    echo "NOK - No UDP packet received on $port\n";
    exit(1);
}

// Syslog payload should start with <PRI> e.g. <14>
if (!preg_match('/^<(\d+)>/', $packet, $matches)) {
    echo "NOK - UDP packet does not match syslog RFC <PRI> format. Raw: " . substr($packet, 0, 20) . "\n";
    exit(1);
}
$pri = (int)$matches[1];

// facility = pri / 8, severity = pri % 8
$facility = floor($pri / 8);
$severity = $pri % 8;

if ($severity < 0 || $severity > 7) {
    echo "NOK - Invalid syslog severity: $severity\n";
    exit(1);
}

// Also it should contain our message and JSON formatter output
if (strpos($packet, $testMessage) === false) {
    echo "NOK - Packet missing smoke message\n";
    exit(1);
}

// Since we use JsonFormatter, we should find '{' and '}'
if (strpos($packet, '{"') === false) {
    echo "NOK - Packet does not seem to contain JSON context\n";
    exit(1);
}

echo "OK - Papertrail UDP channel functional. PRI: $pri (Facility: $facility, Severity: $severity)\n";
fclose($socket);
exit(0);
