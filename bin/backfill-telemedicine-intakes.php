<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/storage.php';
require_once __DIR__ . '/../lib/telemedicine/TelemedicineBackfillService.php';

$options = parse_backfill_options($argv ?? []);
$store = read_store();
$service = new TelemedicineBackfillService();
$result = $service->backfill($store, [
    'dryRun' => $options['dryRun'],
    'force' => $options['force'],
    'limit' => $options['limit'],
]);

if (!$options['dryRun']) {
    if (!write_store($result['store'], false)) {
        fwrite(STDERR, "No se pudo persistir el backfill de telemedicina.\n");
        exit(1);
    }
}

$changes = isset($result['changes']) && is_array($result['changes']) ? $result['changes'] : [];
if (count($changes) > 50) {
    $changes = array_slice($changes, 0, 50);
}

echo json_encode([
    'ok' => true,
    'dryRun' => (bool) ($result['dryRun'] ?? false),
    'force' => (bool) $options['force'],
    'limit' => (int) $options['limit'],
    'created' => (int) ($result['created'] ?? 0),
    'updated' => (int) ($result['updated'] ?? 0),
    'changed' => (bool) ($result['changed'] ?? false),
    'stats' => is_array($result['stats'] ?? null) ? $result['stats'] : [],
    'changesPreview' => $changes,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . PHP_EOL;
exit(0);

/**
 * @param array<int,string> $argv
 * @return array{dryRun:bool,force:bool,limit:int}
 */
function parse_backfill_options(array $argv): array
{
    $options = [
        'dryRun' => false,
        'force' => false,
        'limit' => 0,
    ];

    foreach ($argv as $index => $arg) {
        $value = trim((string) $arg);
        if ($value === '--dry-run') {
            $options['dryRun'] = true;
            continue;
        }
        if ($value === '--force') {
            $options['force'] = true;
            continue;
        }
        if ($value === '--limit') {
            $rawLimit = isset($argv[$index + 1]) ? (int) $argv[$index + 1] : 0;
            $options['limit'] = max(0, $rawLimit);
            continue;
        }
    }

    return $options;
}
