<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class TelemedicineIntakeDecisionTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'telemedicine-decision-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        putenv('PIELARMONIA_TELEMED_V2_SHADOW=true');
        ini_set('log_errors', '1');
        ini_set('error_log', $this->tempDir . DIRECTORY_SEPARATOR . 'php-error.log');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../lib/telemedicine/TelemedicineIntakeService.php';

        \ensure_data_file();
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'PIELARMONIA_AVAILABILITY_SOURCE',
            'PIELARMONIA_TELEMED_V2_SHADOW',
        ] as $key) {
            putenv($key);
        }

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
    }

    public function testAdminDecisionValidatesPhotoAiSuggestion(): void
    {
        $store = \read_store();
        $store['telemedicine_intakes'] = [[
            'id' => 901,
            'channel' => 'secure_video',
            'status' => 'review_required',
            'suitability' => 'review_required',
            'reviewRequired' => true,
            'clinicalReason' => 'La lesion se ve mas roja y arde hoy.',
            'photoTriage' => [
                'count' => 3,
                'status' => 'complete',
                'roles' => ['zona', 'primer_plano', 'contexto'],
                'missingRoles' => [],
            ],
            'photoAiTriage' => [
                'status' => 'ready',
                'urgencyLevel' => 4,
                'urgencyLabel' => 'Alta',
                'suggestedConsultType' => 'priority_video',
                'suggestedConsultTypeLabel' => 'Teleconsulta prioritaria',
                'doctorValidationStatus' => 'pending',
            ],
            'createdAt' => '2026-03-30T09:00:00-05:00',
            'updatedAt' => '2026-03-30T09:10:00-05:00',
        ]];

        $service = new \TelemedicineIntakeService();
        $result = $service->applyAdminDecision($store, 901, [
            'decision' => 'approve_remote',
            'reviewedBy' => 'Dra. Laura Mena',
        ]);

        $this->assertTrue((bool) ($result['ok'] ?? false));
        $this->assertSame(
            'validated',
            (string) ($result['intake']['photoAiTriage']['doctorValidationStatus'] ?? '')
        );
        $this->assertTrue(
            (bool) ($result['intake']['photoAiTriage']['doctorValidation']['matchedSuggestion'] ?? false)
        );
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        $entries = array_diff(scandir($dir) ?: [], ['.', '..']);
        foreach ($entries as $entry) {
            $path = $dir . DIRECTORY_SEPARATOR . $entry;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                @unlink($path);
            }
        }

        @rmdir($dir);
    }
}
