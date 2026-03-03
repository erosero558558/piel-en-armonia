<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

final class TelemedicineBackfillTest extends TestCase
{
    /**
     * @runInSeparateProcess
     */
    public function testBackfillCreatesLegacyMigratedTelemedicineIntakes(): void
    {
        $tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'telemedicine-backfill-' . uniqid('', true);
        mkdir($tempDir, 0777, true);
        putenv('PIELARMONIA_DATA_DIR=' . $tempDir);

        require_once __DIR__ . '/../../lib/storage.php';
        require_once __DIR__ . '/../../lib/models.php';
        require_once __DIR__ . '/../../lib/telemedicine/TelemedicineBackfillService.php';

        $store = \read_store();
        $store['appointments'][] = \normalize_appointment([
            'id' => 1001,
            'service' => 'telefono',
            'doctor' => 'rosero',
            'date' => date('Y-m-d', strtotime('next wednesday')),
            'time' => '15:00',
            'name' => 'Paciente Legacy',
            'email' => 'legacy@example.com',
            'phone' => '0991111111',
            'reason' => 'Seguimiento de dermatitis controlada a distancia.',
            'affectedArea' => 'brazos',
            'evolutionTime' => '1 mes',
            'privacyConsent' => true,
            'paymentMethod' => 'cash',
        ]);
        \write_store($store, false);

        $service = new \TelemedicineBackfillService();
        $result = $service->backfill(\read_store());
        $this->assertSame(1, $result['created']);

        \write_store($result['store'], false);
        $roundtrip = \read_store();
        $this->assertCount(1, $roundtrip['telemedicine_intakes']);
        $this->assertSame('legacy_migrated', $roundtrip['telemedicine_intakes'][0]['status']);
        $this->assertGreaterThan(0, (int) ($roundtrip['appointments'][0]['telemedicineIntakeId'] ?? 0));

        \get_db_connection(null, true);
        putenv('PIELARMONIA_DATA_DIR');
        $this->removeDirectory($tempDir);
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        $items = array_diff(scandir($dir) ?: [], ['.', '..']);
        foreach ($items as $item) {
            $path = $dir . DIRECTORY_SEPARATOR . $item;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                @unlink($path);
            }
        }
        @rmdir($dir);
    }
}
