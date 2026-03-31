<?php

declare(strict_types=1);

if (!class_exists('AuroraFallbackLogger', false)) {
    final class AuroraFallbackLogger
    {
        private const SYSLOG_FACILITY_USER = 1;

        private string $channel;
        private ?string $papertrailHost;
        private ?int $papertrailPort;

        public function __construct(string $channel, ?string $papertrailHost, ?int $papertrailPort)
        {
            $this->channel = $channel;
            $this->papertrailHost = $papertrailHost;
            $this->papertrailPort = $papertrailPort;
        }

        public function info(string $message, array $context = []): void
        {
            $this->log('info', 6, $message, $context);
        }

        public function warning(string $message, array $context = []): void
        {
            $this->log('warning', 4, $message, $context);
        }

        public function error(string $message, array $context = []): void
        {
            $this->log('error', 3, $message, $context);
        }

        private function log(string $level, int $severity, string $message, array $context): void
        {
            $this->writeToStderr(sprintf('[%s] %s%s', $level, $message, $this->normalizeContext($context)));

            if ($this->papertrailHost === null || $this->papertrailPort === null) {
                return;
            }

            try {
                $this->writeToPapertrail($severity, $message, $context);
            } catch (Throwable $e) {
                $this->writeToStderr('Aurora Derm: Failed to send Papertrail log: ' . $e->getMessage());
            }
        }

        private function normalizeContext(array $context): string
        {
            if ($context === []) {
                return '';
            }

            $encoded = json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            return is_string($encoded) ? ' ' . $encoded : '';
        }

        private function writeToStderr(string $line): void
        {
            $stderr = @fopen('php://stderr', 'wb');
            if (is_resource($stderr)) {
                @fwrite($stderr, $line . PHP_EOL);
                @fclose($stderr);
                return;
            }

            error_log($line);
        }

        private function writeToPapertrail(int $severity, string $message, array $context): void
        {
            $socket = @stream_socket_client(
                sprintf('udp://%s:%d', $this->papertrailHost, $this->papertrailPort),
                $errno,
                $errstr,
                1,
                STREAM_CLIENT_CONNECT
            );

            if (!is_resource($socket)) {
                throw new RuntimeException(sprintf(
                    'Papertrail UDP socket unavailable: %s (%d)',
                    $errstr !== '' ? $errstr : 'unknown error',
                    (int) $errno
                ));
            }

            $payload = $this->buildSyslogPayload($severity, $message, $context);
            @stream_set_blocking($socket, false);
            $bytes = @fwrite($socket, $payload);
            @fclose($socket);

            if ($bytes === false || $bytes === 0) {
                throw new RuntimeException('Papertrail UDP write failed');
            }
        }

        private function buildSyslogPayload(int $severity, string $message, array $context): string
        {
            $pri = (self::SYSLOG_FACILITY_USER * 8) + $severity;
            $timestamp = date('M d H:i:s');
            $hostname = gethostname();
            if (!is_string($hostname) || trim($hostname) === '') {
                $hostname = 'localhost';
            }

            $payload = json_encode([
                'message' => $message,
                'context' => $context,
                'channel' => $this->channel,
                'level' => $this->levelName($severity),
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

            $body = is_string($payload) ? $payload : $message;

            return sprintf('<%d>%s %s %s: %s', $pri, $timestamp, $hostname, $this->channel, $body);
        }

        private function levelName(int $severity): string
        {
            return match ($severity) {
                3 => 'error',
                4 => 'warning',
                default => 'info',
            };
        }
    }
}

/**
 * Returns a shared logger instance.
 * Falls back to a lightweight internal logger when Monolog is unavailable.
 */
function get_logger()
{
    static $logger = null;

    if ($logger !== null) {
        return $logger;
    }

    $papertrailHost = getenv('PAPERTRAIL_HOST');
    $papertrailPort = getenv('PAPERTRAIL_PORT');
    $papertrailDestinationHost = is_string($papertrailHost) && trim($papertrailHost) !== ''
        ? trim($papertrailHost)
        : null;
    $papertrailDestinationPort = is_string($papertrailPort) && trim($papertrailPort) !== ''
        ? (int) $papertrailPort
        : null;

    $hasMonolog = class_exists('\Monolog\Logger')
        && class_exists('\Monolog\Handler\StreamHandler');
    $hasMonologPapertrail = class_exists('\Monolog\Handler\SyslogUdpHandler')
        && class_exists('\Monolog\Formatter\JsonFormatter');

    if (!$hasMonolog) {
        $logger = new AuroraFallbackLogger('pielarmonia', $papertrailDestinationHost, $papertrailDestinationPort);
        return $logger;
    }

    $logger = new \Monolog\Logger('pielarmonia');
    $logger->pushHandler(new \Monolog\Handler\StreamHandler('php://stderr', \Monolog\Logger::DEBUG));

    if ($papertrailDestinationHost !== null
        && $papertrailDestinationPort !== null
        && $hasMonologPapertrail) {
        try {
            $syslogHandler = new \Monolog\Handler\SyslogUdpHandler($papertrailDestinationHost, $papertrailDestinationPort);
            $syslogHandler->setFormatter(new \Monolog\Formatter\JsonFormatter());
            $logger->pushHandler($syslogHandler);
        } catch (Throwable $e) {
            error_log('Aurora Derm: Failed to initialize Papertrail logger: ' . $e->getMessage());
        }
    }

    return $logger;
}
