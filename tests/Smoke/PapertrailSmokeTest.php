<?php

declare(strict_types=1);

/**
 * Papertrail / UDP Logging Smoke Test
 * 
 * Verifies that:
 * 1. The Monolog SyslogUdpHandler correctly formats and emits UDP packets.
 * 2. It does not crash if the host is unavailable (fallback).
 */

require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/../../lib/logger.php';

function run_test(): void
{
    echo "Starting Papertrail Smoke Test...\n";

    // Fase 1: Validar envío exitoso por UDP
    echo "1. Creando servidor UDP local temporal...\n";
    $server = stream_socket_server("udp://127.0.0.1:0", $errno, $errstr, STREAM_SERVER_BIND);
    if (!$server) {
        throw new RuntimeException("No se pudo crear el socket UDP de prueba: $errstr ($errno)");
    }

    $socketName = stream_socket_get_name($server, false);
    [$host, $port] = explode(':', $socketName);

    echo "   -> Escuchando en $host:$port\n";

    // Forzar variables de entorno para apuntar hacia nuestro servidor local
    putenv("PAPERTRAIL_HOST=$host");
    putenv("PAPERTRAIL_PORT=$port");

    $logger = get_logger();
    
    echo "2. Emitiendo mensaje('[smoke] aurora-derm test')...\n";
    $logger->info('[smoke] aurora-derm test', ['source' => 'smoke-test']);

    echo "3. Esperando paquete UDP (timeout 2s)...\n";
    $read = [$server];
    $write = null;
    $except = null;
    $numChangedStreams = stream_select($read, $write, $except, 2);

    if ($numChangedStreams === false) {
        throw new RuntimeException("Error en stream_select()");
    } elseif ($numChangedStreams === 0) {
        throw new RuntimeException(" Timeout: No se recibió ningún paquete UDP en 2 segundos. El canal de logeo a Papertrail está roto o el firewall bloqueó el envío local.");
    }

    $packet = stream_socket_recvfrom($server, 1500, 0, $peer);
    if ($packet === false) {
        throw new RuntimeException("Error leyendo paquete UDP.");
    }

    echo "4. Analizando payload recibido...\n";
    // El formato Syslog de Monolog (RFC 5424 o 3164) generalmente inicia con <PRIVAL> o similar.
    // Ejemplo: <14>1 2026-03-31T03:00:00.000000+00:00 hostname pielarmonia - - - {"message":"[smoke] aurora-derm test",...}
    
    // Validaremos que contenga el mensaje JSON
    if (strpos($packet, '[smoke] aurora-derm test') === false) {
        echo "Payload crudo:\n$packet\n";
        throw new RuntimeException("El paquete UDP fue recibido pero no contiene el mensaje esperado.");
    }

    // Validaremos formato Syslog mínimo (empieza con '<' y tiene facility/severity codificado en número)
    if (!preg_match('/^<\d+>/', $packet)) {
        echo "Payload crudo:\n$packet\n";
        throw new RuntimeException("El paquete UDP fue recibido pero carece del header PRIVAL de Syslog (ej: <14> o <22>).");
    }

    echo "   -> Payload válido: Syslog header presente y JSON de Monolog incluido.\n";

    fclose($server);

    echo "5. Verificando resiliencia frente a caídas (Fallback)...\n";
    // Si reseteamos lib/logger para que levante puerto inaccesible, no debe tirar fatal error
    // Sin embargo get_logger es estático, así que forzamos la inicialización local del driver real para probar
    
    putenv("PAPERTRAIL_HOST=localhostxyz_inexistente.com");
    putenv("PAPERTRAIL_PORT=99999");
    
    try {
        $syslogHandler = new \Monolog\Handler\SyslogUdpHandler("localhostxyz_inexistente.com", 99999);
        $syslogHandler->setFormatter(new \Monolog\Formatter\JsonFormatter());
        
        $fallbackLogger = new \Monolog\Logger('pielarmonia');
        $fallbackLogger->pushHandler($syslogHandler);
        
        // Lo mandamos a escribir. Debería atrapar o ignorar elegantemente (según configuración de Monolog)
        $fallbackLogger->info("Este log va hacia un host que no existe D:");
        echo "   -> Envío a host muerto procesado sin colapso fatal.\n";
    } catch (Throwable $e) {
        throw new RuntimeException("El fallback falló: se generó una excepción fatal al enviar a un host DNS irresoluble: " . $e->getMessage());
    }

    echo "\n=== [OK] Papertrail Smoke Test Completado Exitosamente ===\n";
}

try {
    run_test();
    exit(0);
} catch (Throwable $e) {
    echo "\n=== [FAIL] Error en Papertrail Smoke Test ===\n";
    echo $e->getMessage() . "\n";
    exit(1);
}
