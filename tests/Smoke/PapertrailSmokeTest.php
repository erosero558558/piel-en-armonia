<?php

declare(strict_types=1);

$repoRoot = dirname(__DIR__, 2);

assertFallbackToStderr($repoRoot);
assertPapertrailUdpDelivery($repoRoot);

echo "OK - Papertrail stderr fallback and UDP delivery smoke passed\n";
exit(0);

function assertFallbackToStderr(string $repoRoot): void
{
    $message = '[smoke] aurora-derm test fallback ' . bin2hex(random_bytes(4));
    $result = runLoggerChild($repoRoot, $message, [
        'PAPERTRAIL_HOST' => '',
        'PAPERTRAIL_PORT' => '',
    ]);

    if ($result['exit_code'] !== 0) {
        fail(sprintf(
            'stderr fallback child failed (%d): %s%s',
            $result['exit_code'],
            $result['stdout'],
            $result['stderr']
        ));
    }

    if (strpos($result['stderr'], $message) === false) {
        fail('stderr fallback did not include the smoke message');
    }
}

function assertPapertrailUdpDelivery(string $repoRoot): void
{
    $port = 25000 + random_int(0, 2000);
    $socket = @stream_socket_server("udp://127.0.0.1:$port", $errno, $errstr, STREAM_SERVER_BIND);
    if (!is_resource($socket)) {
        fail("could not bind test UDP socket: $errstr ($errno)");
    }

    stream_set_blocking($socket, false);

    $message = '[smoke] aurora-derm test udp ' . bin2hex(random_bytes(4));
    $result = runLoggerChild($repoRoot, $message, [
        'PAPERTRAIL_HOST' => '127.0.0.1',
        'PAPERTRAIL_PORT' => (string) $port,
    ]);

    if ($result['exit_code'] !== 0) {
        fclose($socket);
        fail(sprintf(
            'UDP child failed (%d): %s%s',
            $result['exit_code'],
            $result['stdout'],
            $result['stderr']
        ));
    }

    $packet = receiveUdpPacket($socket);
    fclose($socket);

    if ($packet === null) {
        fail('no UDP packet received from logger');
    }

    if (!preg_match('/^<(\d+)>([A-Z][a-z]{2}\s+\d{1,2}\s\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\S+):\s+(.+)$/', $packet, $matches)) {
        fail('UDP packet does not match minimal syslog format: ' . $packet);
    }

    $pri = (int) $matches[1];
    $facility = intdiv($pri, 8);
    $severity = $pri % 8;
    $payload = $matches[5];

    if ($facility < 0) {
        fail("invalid syslog facility: $facility");
    }

    if ($severity < 0 || $severity > 7) {
        fail("invalid syslog severity: $severity");
    }

    if (strpos($payload, $message) === false) {
        fail('UDP payload is missing the smoke message');
    }

    if (strpos($payload, '"context"') === false && strpos($payload, '{"') === false) {
        fail('UDP payload is missing JSON metadata');
    }
}

/**
 * @return array{exit_code:int,stdout:string,stderr:string}
 */
function runLoggerChild(string $repoRoot, string $message, array $envOverrides): array
{
    $scriptPath = createLoggerChildScript();
    $env = buildChildEnv($repoRoot, $message, $envOverrides);

    $command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($scriptPath);
    $descriptorSpec = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];

    $process = proc_open($command, $descriptorSpec, $pipes, $repoRoot, $env);
    if (!is_resource($process)) {
        @unlink($scriptPath);
        fail('could not start logger child process');
    }

    fclose($pipes[0]);
    $stdout = stream_get_contents($pipes[1]);
    fclose($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[2]);
    $exitCode = proc_close($process);
    @unlink($scriptPath);

    return [
        'exit_code' => $exitCode,
        'stdout' => is_string($stdout) ? $stdout : '',
        'stderr' => is_string($stderr) ? $stderr : '',
    ];
}

function createLoggerChildScript(): string
{
    $path = tempnam(sys_get_temp_dir(), 'aurora-papertrail-smoke-');
    if ($path === false) {
        fail('could not allocate temporary child script');
    }

    $script = <<<'PHP'
<?php

declare(strict_types=1);

$repoRoot = getenv('AURORA_SMOKE_REPO_ROOT');
if (!is_string($repoRoot) || $repoRoot === '') {
    fwrite(STDERR, "missing repo root\n");
    exit(2);
}

$autoloadPath = $repoRoot . '/vendor/autoload.php';
if (file_exists($autoloadPath)) {
    require_once $autoloadPath;
}

require_once $repoRoot . '/lib/logger.php';

$message = getenv('AURORA_SMOKE_MESSAGE');
if (!is_string($message) || $message === '') {
    fwrite(STDERR, "missing smoke message\n");
    exit(3);
}

get_logger()->info($message, [
    'test' => true,
    'source' => 'PapertrailSmokeTest',
]);
PHP;

    if (file_put_contents($path, $script) === false) {
        @unlink($path);
        fail('could not write temporary child script');
    }

    return $path;
}

function buildChildEnv(string $repoRoot, string $message, array $envOverrides): array
{
    $env = [];
    foreach (['HOME', 'PATH', 'TMPDIR', 'TMP', 'TEMP'] as $key) {
        $value = getenv($key);
        if (is_string($value)) {
            $env[$key] = $value;
        }
    }

    $env['AURORA_SMOKE_REPO_ROOT'] = $repoRoot;
    $env['AURORA_SMOKE_MESSAGE'] = $message;

    foreach ($envOverrides as $key => $value) {
        $env[$key] = $value;
    }

    return $env;
}

function receiveUdpPacket($socket): ?string
{
    $deadline = microtime(true) + 2.0;
    do {
        $packet = @stream_socket_recvfrom($socket, 4096, 0, $peer);
        if (is_string($packet) && $packet !== '') {
            return $packet;
        }

        usleep(20000);
    } while (microtime(true) < $deadline);

    return null;
}

function fail(string $message): void
{
    fwrite(STDOUT, "NOK - $message\n");
    exit(1);
}
