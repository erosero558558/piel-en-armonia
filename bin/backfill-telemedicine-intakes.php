<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/storage.php';
require_once __DIR__ . '/../lib/telemedicine/TelemedicineBackfillService.php';

$store = read_store();
$service = new TelemedicineBackfillService();
$result = $service->backfill($store);

if (!write_store($result['store'], false)) {
    fwrite(STDERR, "No se pudo persistir el backfill de telemedicina.\n");
    exit(1);
}

echo json_encode([
    'ok' => true,
    'created' => (int) ($result['created'] ?? 0),
    'updated' => (int) ($result['updated'] ?? 0),
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . PHP_EOL;
exit(0);
