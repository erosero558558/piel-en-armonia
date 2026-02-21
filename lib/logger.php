<?php

declare(strict_types=1);

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

    $hasMonolog = class_exists('\Monolog\Logger')
        && class_exists('\Monolog\Handler\ErrorLogHandler')
        && class_exists('\Monolog\Handler\SyslogUdpHandler')
        && class_exists('\Monolog\Formatter\JsonFormatter');

    if (!$hasMonolog) {
        $logger = new class () {
            private function normalizeContext($context): string
            {
                if (!is_array($context) || $context === []) {
                    return '';
                }
                $encoded = json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                return is_string($encoded) ? ' ' . $encoded : '';
            }

            public function info(string $message, array $context = []): void
            {
                error_log('[info] ' . $message . $this->normalizeContext($context));
            }

            public function warning(string $message, array $context = []): void
            {
                error_log('[warning] ' . $message . $this->normalizeContext($context));
            }

            public function error(string $message, array $context = []): void
            {
                error_log('[error] ' . $message . $this->normalizeContext($context));
            }
        };
        return $logger;
    }

    $logger = new \Monolog\Logger('pielarmonia');
    $logger->pushHandler(
        new \Monolog\Handler\ErrorLogHandler(
            \Monolog\Handler\ErrorLogHandler::OPERATING_SYSTEM,
            \Monolog\Logger::DEBUG
        )
    );

    $papertrailHost = getenv('PAPERTRAIL_HOST');
    $papertrailPort = getenv('PAPERTRAIL_PORT');

    if (is_string($papertrailHost) && trim($papertrailHost) !== ''
        && is_string($papertrailPort) && trim($papertrailPort) !== '') {
        $host = trim($papertrailHost);
        $port = (int) $papertrailPort;

        try {
            $syslogHandler = new \Monolog\Handler\SyslogUdpHandler($host, $port);
            $syslogHandler->setFormatter(new \Monolog\Formatter\JsonFormatter());
            $logger->pushHandler($syslogHandler);
        } catch (Throwable $e) {
            error_log('Piel en Armonia: Failed to initialize Papertrail logger: ' . $e->getMessage());
        }
    }

    return $logger;
}
