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
        $tempDir = $this->bootstrapBackfillFixture();
        $service = new \TelemedicineBackfillService();
        $result = $service->backfill(\read_store());
        $this->assertSame(1, (int) ($result['created'] ?? 0));
        $this->assertSame(0, (int) ($result['updated'] ?? 0));

        \write_store($result['store'], false);
        $roundtrip = \read_store();
        $this->assertCount(1, $roundtrip['telemedicine_intakes']);
        $this->assertSame('legacy_migrated', $roundtrip['telemedicine_intakes'][0]['status']);
        $this->assertGreaterThan(0, (int) ($roundtrip['appointments'][0]['telemedicineIntakeId'] ?? 0));

        $this->teardownBackfillFixture($tempDir);
    }

    /**
     * @runInSeparateProcess
     */
    public function testBackfillDryRunDoesNotMutateStoreAndReportsPlannedChanges(): void
    {
        $tempDir = $this->bootstrapBackfillFixture();
        $service = new \TelemedicineBackfillService();
        $before = \json_encode(\read_store(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $result = $service->backfill(\read_store(), ['dryRun' => true]);
        $this->assertTrue((bool) ($result['dryRun'] ?? false));
        $this->assertSame(1, (int) ($result['created'] ?? 0));
        $this->assertSame(0, (int) ($result['updated'] ?? 0));
        $this->assertSame(1, (int) (($result['stats']['processed'] ?? 0)));

        $after = \json_encode(\read_store(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $this->assertSame($before, $after, 'dry-run no debe mutar store');

        $this->teardownBackfillFixture($tempDir);
    }

    /**
     * @runInSeparateProcess
     */
    public function testBackfillIsIdempotentAndSkipsAlreadyMigratedByDefault(): void
    {
        $tempDir = $this->bootstrapBackfillFixture();
        $service = new \TelemedicineBackfillService();

        $first = $service->backfill(\read_store());
        $this->assertSame(1, (int) ($first['created'] ?? 0));
        \write_store($first['store'], false);

        $second = $service->backfill(\read_store());
        $this->assertSame(0, (int) ($second['created'] ?? 0));
        $this->assertSame(0, (int) ($second['updated'] ?? 0));
        $this->assertSame(1, (int) (($second['stats']['skippedAlreadyMigrated'] ?? 0)));

        $this->teardownBackfillFixture($tempDir);
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

    private function bootstrapBackfillFixture(): string
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

        return $tempDir;
    }

    private function teardownBackfillFixture(string $tempDir): void
    {
        \get_db_connection(null, true);
        putenv('PIELARMONIA_DATA_DIR');
        $this->removeDirectory($tempDir);
    }
}
