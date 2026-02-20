<?php
declare(strict_types=1);

use Monolog\Logger;
use Monolog\Handler\ErrorLogHandler;
use Monolog\Handler\SyslogUdpHandler;
use Monolog\Formatter\JsonFormatter;

/**
 * Returns a shared Logger instance.
 */
function get_logger(): Logger
{
    static $logger = null;

    if ($logger === null) {
        $logger = new Logger('pielarmonia');

        // 1. Default handler: Send to PHP's error_log()
        // This ensures logs appear in the server's standard error log file or stderr.
        $logger->pushHandler(new ErrorLogHandler(ErrorLogHandler::OPERATING_SYSTEM, Logger::DEBUG));

        // 2. Papertrail Handler (if configured)
        $papertrailHost = getenv('PAPERTRAIL_HOST');
        $papertrailPort = getenv('PAPERTRAIL_PORT');

        if (is_string($papertrailHost) && trim($papertrailHost) !== '' &&
            is_string($papertrailPort) && trim($papertrailPort) !== '') {

            $host = trim($papertrailHost);
            $port = (int) $papertrailPort;

            try {
                $syslogHandler = new SyslogUdpHandler($host, $port);
                // Use JSON formatter for structured logs in Papertrail
                $syslogHandler->setFormatter(new JsonFormatter());
                $logger->pushHandler($syslogHandler);
            } catch (Throwable $e) {
                // If Papertrail fails, fallback to error_log is already in place.
                error_log('Piel en Armonía: Failed to initialize Papertrail logger: ' . $e->getMessage());
            }
        }
    }

    return $logger;
}
