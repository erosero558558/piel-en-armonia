<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

final class TelemedicineStorageParityTest extends TestCase
{
    private array $envKeys = [
        'PIELARMONIA_DATA_DIR',
        'PIELARMONIA_FORCE_SQLITE_UNAVAILABLE',
        'PIELARMONIA_STORAGE_JSON_FALLBACK',
    ];

    /**
     * @runInSeparateProcess
     */
    public function testJsonFallbackPersistsTelemedicineCollections(): void
    {
        $tempDir = $this->createTempDataDir('telemedicine-json');
        putenv('PIELARMONIA_DATA_DIR=' . $tempDir);
        putenv('PIELARMONIA_FORCE_SQLITE_UNAVAILABLE=true');
        putenv('PIELARMONIA_STORAGE_JSON_FALLBACK=true');
        ini_set('log_errors', '1');
        ini_set('error_log', $tempDir . DIRECTORY_SEPARATOR . 'php-error.log');

        require_once __DIR__ . '/../../lib/storage.php';

        $store = \read_store();
        $store['telemedicine_intakes'][] = ['id' => 1, 'status' => 'draft', 'channel' => 'phone', 'legacyService' => 'telefono'];
        $store['clinical_uploads'][] = ['id' => 1, 'kind' => 'legacy_unclassified', 'storageMode' => 'staging_legacy'];
        $this->assertTrue(\write_store($store, false));

        $roundtrip = \read_store();
        $this->assertCount(1, $roundtrip['telemedicine_intakes']);
        $this->assertCount(1, $roundtrip['clinical_uploads']);
    }

    /**
     * @runInSeparateProcess
     */
    public function testSqlitePersistsTelemedicineCollectionsWhenAvailable(): void
    {
        $tempDir = $this->createTempDataDir('telemedicine-sqlite');
        putenv('PIELARMONIA_DATA_DIR=' . $tempDir);
        putenv('PIELARMONIA_FORCE_SQLITE_UNAVAILABLE=false');
        putenv('PIELARMONIA_STORAGE_JSON_FALLBACK=true');
        ini_set('log_errors', '1');
        ini_set('error_log', $tempDir . DIRECTORY_SEPARATOR . 'php-error.log');

        require_once __DIR__ . '/../../lib/storage.php';
        if (!\storage_sqlite_available()) {
            $this->markTestSkipped('SQLite no disponible en este entorno.');
        }

        $store = \read_store();
        $store['telemedicine_intakes'][] = ['id' => 1, 'status' => 'draft', 'channel' => 'secure_video', 'legacyService' => 'video'];
        $store['clinical_uploads'][] = ['id' => 1, 'kind' => 'case_photo', 'storageMode' => 'private_clinical'];
        $this->assertTrue(\write_store($store, false));

        $roundtrip = \read_store();
        $this->assertCount(1, $roundtrip['telemedicine_intakes']);
        $this->assertSame('secure_video', $roundtrip['telemedicine_intakes'][0]['channel']);
        $this->assertCount(1, $roundtrip['clinical_uploads']);
        $this->assertSame('case_photo', $roundtrip['clinical_uploads'][0]['kind']);
    }

    private function createTempDataDir(string $suffix): string
    {
        $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pielarmonia-tests-' . $suffix . '-' . uniqid('', true);
        if (!is_dir($dir) && !mkdir($dir, 0777, true) && !is_dir($dir)) {
            self::fail('No se pudo crear directorio temporal.');
        }

        return $dir;
    }

    protected function tearDown(): void
    {
        foreach ($this->envKeys as $key) {
            putenv($key);
        }
        if (function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }
    }
}
