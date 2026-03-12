<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class CaseMediaFlowControllerTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_POST = [];
        $_SESSION = [];
        $_SERVER = [
            'REQUEST_METHOD' => 'GET',
            'REMOTE_ADDR' => '127.0.0.1',
        ];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'case-media-flow-test';
        $this->removeDirectory($this->tempDir);
        mkdir($this->tempDir, 0777, true);
        mkdir($this->tempDir . DIRECTORY_SEPARATOR . 'clinical-media', 0777, true);
        mkdir($this->tempDir . DIRECTORY_SEPARATOR . 'public-case-media', 0777, true);

        file_put_contents($this->tempDir . DIRECTORY_SEPARATOR . 'clinical-media' . DIRECTORY_SEPARATOR . 'before-case.jpg', 'before');
        file_put_contents($this->tempDir . DIRECTORY_SEPARATOR . 'clinical-media' . DIRECTORY_SEPARATOR . 'after-case.jpg', 'after');
        file_put_contents($this->tempDir . DIRECTORY_SEPARATOR . 'clinical-media' . DIRECTORY_SEPARATOR . 'blocked-case.jpg', 'blocked');

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_PUBLIC_CASE_MEDIA_DIR=' . $this->tempDir . DIRECTORY_SEPARATOR . 'public-case-media');
        putenv('PIELARMONIA_PUBLIC_CASE_MEDIA_BASE_URL=/api.php?resource=public-case-media-file&name={name}');
        putenv('PIELARMONIA_MEDIA_FLOW_OPENCLAW_ENDPOINT');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/CaseMediaFlowController.php';

        \ensure_data_file();
        $this->seedStore();
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'PIELARMONIA_PUBLIC_CASE_MEDIA_DIR',
            'PIELARMONIA_PUBLIC_CASE_MEDIA_BASE_URL',
            'PIELARMONIA_MEDIA_FLOW_OPENCLAW_ENDPOINT',
        ] as $key) {
            putenv($key);
        }

        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_POST = [];
        $_SESSION = [];
        $_SERVER = [];

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
    }

    public function testProposalGenerationReflectsBlockedConsentPolicy(): void
    {
        $_GET = [];
        $queue = $this->captureResponse(static function (): void {
            \CaseMediaFlowController::queue([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        });

        self::assertSame(200, $queue['status']);
        self::assertTrue((bool) ($queue['payload']['ok'] ?? false));
        self::assertCount(2, $queue['payload']['data']['queue'] ?? []);

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'caseId' => 'CASE-BLOCKED',
        ], JSON_UNESCAPED_UNICODE);

        $generate = $this->captureResponse(static function (): void {
            \CaseMediaFlowController::proposalGenerate([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        }, 'POST');

        self::assertSame(201, $generate['status']);
        self::assertSame(
            'blocked',
            (string) ($generate['payload']['data']['proposal']['recommendation'] ?? '')
        );
        self::assertContains(
            'missing_publication_consent',
            $generate['payload']['data']['proposal']['policyFlags'] ?? []
        );
    }

    public function testEditAndPublishCreatesPublicStoryWithoutPrivatePathExposure(): void
    {
        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'caseId' => 'CASE-PUBLISH',
        ], JSON_UNESCAPED_UNICODE);

        $generate = $this->captureResponse(static function (): void {
            \CaseMediaFlowController::proposalGenerate([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        }, 'POST');

        self::assertSame(201, $generate['status']);
        $proposal = $generate['payload']['data']['proposal'] ?? [];
        self::assertSame('CASE-PUBLISH', (string) ($proposal['caseId'] ?? ''));

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'caseId' => 'CASE-PUBLISH',
            'proposalId' => (string) ($proposal['proposalId'] ?? ''),
            'decision' => 'edit_and_publish',
            'edits' => [
                'copy' => [
                    'es' => [
                        'title' => 'Caso acne editorial',
                        'summary' => 'Seguimiento de acne preparado desde el flujo clinico.',
                    ],
                    'en' => [
                        'title' => 'Editorial acne case',
                        'summary' => 'Acne follow-up prepared from the clinical flow.',
                    ],
                ],
                'alt' => [
                    'es' => ['cover' => 'Caso publicado desde media flow'],
                    'en' => ['cover' => 'Case story published from media flow'],
                ],
                'category' => 'Acne controlado',
                'tags' => ['Acne', 'Seguimiento'],
            ],
        ], JSON_UNESCAPED_UNICODE);

        $review = $this->captureResponse(static function (): void {
            \CaseMediaFlowController::proposalReview([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        }, 'POST');

        self::assertSame(200, $review['status']);
        self::assertSame(
            'published',
            (string) ($review['payload']['data']['publication']['status'] ?? '')
        );

        $_GET = ['locale' => 'es'];
        $publicStories = $this->captureResponse(static function (): void {
            \CaseMediaFlowController::publicStories([
                'store' => \read_store(),
            ]);
        });

        self::assertSame(200, $publicStories['status']);
        self::assertTrue((bool) ($publicStories['payload']['ok'] ?? false));
        $items = $publicStories['payload']['data']['items'] ?? [];
        self::assertCount(1, $items);
        self::assertSame('Caso acne editorial', (string) ($items[0]['title'] ?? ''));
        self::assertStringContainsString(
            'public-case-media-file',
            (string) ($items[0]['cover']['url'] ?? '')
        );
        self::assertStringNotContainsString(
            'privatePath',
            json_encode($items[0], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        );
    }

    private function seedStore(): void
    {
        $store = \read_store();
        $store['appointments'] = [
            [
                'id' => 991,
                'name' => 'Paola Adulta',
                'email' => 'paola@example.com',
                'service' => 'acne',
                'privacyConsent' => true,
                'privacyConsentAt' => date('c', strtotime('-4 day')),
                'mediaPublicationConsent' => true,
                'mediaPublicationConsentAt' => date('c', strtotime('-3 day')),
                'createdAt' => date('c', strtotime('-5 day')),
                'updatedAt' => date('c', strtotime('-1 day')),
            ],
            [
                'id' => 992,
                'name' => 'Caso Bloqueado',
                'email' => 'blocked@example.com',
                'service' => 'consulta_dermatologica',
                'privacyConsent' => true,
                'createdAt' => date('c', strtotime('-2 day')),
                'updatedAt' => date('c', strtotime('-1 day')),
            ],
        ];
        $store['clinical_history_sessions'] = [
            [
                'sessionId' => 'chs_publish',
                'caseId' => 'CASE-PUBLISH',
                'appointmentId' => 991,
                'patient' => [
                    'name' => 'Paola Adulta',
                    'ageYears' => 34,
                    'sexAtBirth' => 'femenino',
                ],
                'createdAt' => date('c', strtotime('-4 day')),
                'updatedAt' => date('c', strtotime('-1 day')),
            ],
            [
                'sessionId' => 'chs_blocked',
                'caseId' => 'CASE-BLOCKED',
                'appointmentId' => 992,
                'patient' => [
                    'name' => 'Caso Bloqueado',
                    'ageYears' => 28,
                    'sexAtBirth' => 'femenino',
                ],
                'createdAt' => date('c', strtotime('-2 day')),
                'updatedAt' => date('c', strtotime('-1 day')),
            ],
        ];
        $store['clinical_history_drafts'] = [
            [
                'sessionId' => 'chs_publish',
                'caseId' => 'CASE-PUBLISH',
                'clinicianDraft' => [
                    'resumen' => 'Seguimiento dermatologico para acne inflamatorio.',
                ],
                'intake' => [
                    'resumenClinico' => 'Caso con secuencia before/after lista.',
                    'datosPaciente' => [
                        'edadAnios' => 34,
                    ],
                ],
                'updatedAt' => date('c', strtotime('-1 day')),
                'createdAt' => date('c', strtotime('-4 day')),
            ],
        ];
        $store['clinical_uploads'] = [
            [
                'id' => 1,
                'appointmentId' => 991,
                'kind' => 'case_photo',
                'storageMode' => 'private_clinical',
                'privatePath' => 'clinical-media/before-case.jpg',
                'mime' => 'image/jpeg',
                'size' => 24000,
                'sha256' => sha1('before'),
                'originalName' => 'before-case.jpg',
                'createdAt' => date('c', strtotime('-4 day')),
                'updatedAt' => date('c', strtotime('-3 day')),
            ],
            [
                'id' => 2,
                'appointmentId' => 991,
                'kind' => 'case_photo',
                'storageMode' => 'private_clinical',
                'privatePath' => 'clinical-media/after-case.jpg',
                'mime' => 'image/jpeg',
                'size' => 26000,
                'sha256' => sha1('after'),
                'originalName' => 'after-case.jpg',
                'createdAt' => date('c', strtotime('-2 day')),
                'updatedAt' => date('c', strtotime('-1 day')),
            ],
            [
                'id' => 3,
                'appointmentId' => 992,
                'kind' => 'case_photo',
                'storageMode' => 'private_clinical',
                'privatePath' => 'clinical-media/blocked-case.jpg',
                'mime' => 'image/jpeg',
                'size' => 18000,
                'sha256' => sha1('blocked'),
                'originalName' => 'blocked-case.jpg',
                'createdAt' => date('c', strtotime('-2 day')),
                'updatedAt' => date('c', strtotime('-1 day')),
            ],
        ];
        \write_store($store, false);
    }

    /**
     * @param callable():void $callback
     * @return array{status:int,payload:array<string,mixed>}
     */
    private function captureResponse(callable $callback, string $method = 'GET'): array
    {
        $_SERVER['REQUEST_METHOD'] = strtoupper($method);

        try {
            $callback();
            self::fail('Expected TestingExitException');
        } catch (\TestingExitException $exception) {
            return [
                'status' => (int) $exception->status,
                'payload' => is_array($exception->payload)
                    ? $exception->payload
                    : [],
            ];
        } finally {
            unset($GLOBALS['__TEST_JSON_BODY']);
        }
    }

    private function removeDirectory(string $path): void
    {
        if (!is_dir($path)) {
            return;
        }

        $items = array_diff(scandir($path) ?: [], ['.', '..']);
        foreach ($items as $item) {
            $target = $path . DIRECTORY_SEPARATOR . $item;
            if (is_dir($target)) {
                $this->removeDirectory($target);
                continue;
            }
            @unlink($target);
        }

        @rmdir($path);
    }
}
