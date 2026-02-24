<?php

declare(strict_types=1);

$planPath = __DIR__ . '/../PLAN_MAESTRO_OPERATIVO_2026.md';

if (!is_file($planPath)) {
    fwrite(STDERR, "ERROR: No se encontro PLAN_MAESTRO_OPERATIVO_2026.md\n");
    exit(1);
}

$lines = @file($planPath, FILE_IGNORE_NEW_LINES);
if (!is_array($lines)) {
    fwrite(STDERR, "ERROR: No se pudo leer PLAN_MAESTRO_OPERATIVO_2026.md\n");
    exit(1);
}

$currentPhase = '';
$inProgress = [];

foreach ($lines as $index => $line) {
    $lineNumber = $index + 1;

    if (preg_match('/^##\s+Fase\s+\d+\s+-\s+.+$/', $line) === 1) {
        $currentPhase = trim($line);
        continue;
    }

    if (preg_match('/^Estado:\s*`?([A-Z_]+)`?$/', trim($line), $matches) !== 1) {
        continue;
    }

    $status = strtoupper(trim((string) ($matches[1] ?? '')));
    if ($status !== 'IN_PROGRESS') {
        continue;
    }

    $inProgress[] = [
        'phase' => $currentPhase !== '' ? $currentPhase : '(fase no detectada)',
        'line' => $lineNumber,
    ];
}

if (count($inProgress) === 1) {
    $phase = $inProgress[0]['phase'];
    $line = (int) $inProgress[0]['line'];
    fwrite(STDOUT, "OK: una unica fase IN_PROGRESS ($phase, linea $line)\n");
    exit(0);
}

fwrite(STDERR, 'ERROR: se esperaban exactamente 1 fase IN_PROGRESS y se encontraron ' . count($inProgress) . ".\n");
if (count($inProgress) > 0) {
    foreach ($inProgress as $entry) {
        fwrite(
            STDERR,
            '- ' . (string) $entry['phase'] . ' (linea ' . (int) $entry['line'] . ")\n"
        );
    }
} else {
    fwrite(STDERR, "- No se encontro ninguna fase IN_PROGRESS.\n");
}

exit(1);
