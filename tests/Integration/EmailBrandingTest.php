<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 * @preserveGlobalState disabled
 */
final class EmailBrandingTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_EMAIL_OUTBOX'], $GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'email-branding-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('AURORADERM_SKIP_ENV_FILE=1');
        putenv('PIELARMONIA_SKIP_ENV_FILE=1');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../lib/ClinicProfileStore.php';
        require_once __DIR__ . '/../../lib/DoctorProfileStore.php';
        require_once __DIR__ . '/../../lib/email.php';

        \write_clinic_profile([
            'clinicName' => 'Clinic Demo',
            'address' => 'Av. Demo 123, Quito',
            'phone' => '0991112233',
            'logoImage' => '',
            'software_plan' => 'Pro',
        ]);
        \write_doctor_profile([
            'fullName' => 'Dra. Aurora Demo',
            'specialty' => 'Dermatologia clinica',
            'mspNumber' => 'MSP-445566',
            'signatureImage' => '',
            'updatedAt' => '2026-03-31T08:00:00-05:00',
        ]);
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'AURORADERM_SKIP_ENV_FILE',
            'PIELARMONIA_SKIP_ENV_FILE',
        ] as $key) {
            putenv($key);
        }

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
        unset($GLOBALS['__TEST_EMAIL_OUTBOX'], $GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
    }

    public function testRescheduleEmailUsesBrandedHtmlTemplate(): void
    {
        $sent = \maybe_send_reschedule_email([
            'name' => 'Paciente Reagenda',
            'email' => 'reagenda@example.com',
            'service' => 'consulta',
            'doctor' => 'rosero',
            'date' => '2026-04-05',
            'time' => '11:30',
            'rescheduleToken' => 'tok-reschedule-001',
        ]);

        self::assertTrue($sent);

        $outbox = $GLOBALS['__TEST_EMAIL_OUTBOX'] ?? [];
        self::assertCount(1, $outbox);
        self::assertSame('reagenda@example.com', (string) ($outbox[0]['to'] ?? ''));
        self::assertSame(\build_email_subject('Cita reprogramada'), (string) ($outbox[0]['subject'] ?? ''));
        self::assertTrue((bool) ($outbox[0]['isHtml'] ?? false));
        self::assertStringContainsString('Cita Reprogramada', (string) ($outbox[0]['body'] ?? ''));
        self::assertStringContainsString('?reschedule=tok-reschedule-001', (string) ($outbox[0]['body'] ?? ''));
        self::assertStringContainsString('Tu cita ha sido reprogramada exitosamente', (string) ($outbox[0]['altBody'] ?? ''));
    }

    public function testPrescriptionReadyEmailAttachesPdfAndPortalLink(): void
    {
        $store = \read_store();
        $store['patient_cases'][] = [
            'id' => 'pc_email_branding_001',
            'summary' => [
                'patientLabel' => 'Lucia Demo',
                'contactPhone' => '0995556677',
            ],
        ];
        $store['patients']['pc_email_branding_001'] = [
            'firstName' => 'Lucia',
            'lastName' => 'Demo',
            'ci' => '0102030405',
            'birthDate' => '1990-04-10',
        ];
        $store['appointments'][] = \normalize_appointment([
            'id' => 8801,
            'patientCaseId' => 'pc_email_branding_001',
            'name' => 'Lucia Demo',
            'email' => 'lucia.demo@example.com',
            'phone' => '0995556677',
            'service' => 'consulta',
            'doctor' => 'rosero',
            'date' => '2026-03-31',
            'time' => '09:00',
            'status' => 'completed',
        ]);
        \write_store($store, false);

        $sent = \maybe_send_prescription_ready_email(
            $store,
            [
                'id' => 'rx-email-001',
                'caseId' => 'pc_email_branding_001',
                'issued_at' => '2026-03-31T09:30:00-05:00',
                'doctor' => [
                    'name' => 'Dra. Aurora Demo',
                    'specialty' => 'Dermatologia clinica',
                    'msp' => 'MSP-445566',
                ],
                'medications' => [[
                    'medication' => 'Doxiciclina 100 mg',
                    'dose' => '1 capsula',
                    'frequency' => 'cada 12 horas',
                    'duration' => '14 dias',
                    'instructions' => 'Tomar despues de alimentos.',
                ]],
            ],
            [],
            [
                'portalUrl' => 'https://pielarmonia.com/es/portal/receta/',
            ]
        );

        self::assertTrue($sent);

        $outbox = $GLOBALS['__TEST_EMAIL_OUTBOX'] ?? [];
        self::assertCount(1, $outbox);
        self::assertSame('lucia.demo@example.com', (string) ($outbox[0]['to'] ?? ''));
        self::assertSame(\build_email_subject('Tu receta esta lista'), (string) ($outbox[0]['subject'] ?? ''));
        self::assertTrue((bool) ($outbox[0]['isHtml'] ?? false));
        self::assertSame(1, (int) ($outbox[0]['attachmentsCount'] ?? 0));
        self::assertStringContainsString('Tu receta ya está lista', (string) ($outbox[0]['body'] ?? ''));
        self::assertStringContainsString('es/portal/receta/', (string) ($outbox[0]['body'] ?? ''));
        self::assertSame(
            'receta-rx-email-001.pdf',
            (string) (($outbox[0]['attachments'][0]['name'] ?? ''))
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
