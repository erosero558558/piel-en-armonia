<?php

declare(strict_types=1);

require_once __DIR__ . '/../../api-lib.php';
require_once __DIR__ . '/../../lib/NotificationService.php';
require_once __DIR__ . '/../../lib/PushService.php';

use PHPUnit\Framework\TestCase;

class NotificationServicePushAutomationsTest extends TestCase
{
    private array $capturedPayloads;
    private ?string $originalSubs = null;
    private ?string $originalPrefs = null;

    protected function setUp(): void
    {
        $this->capturedPayloads = [];

        // Custom transport to capture calls without sending
        $GLOBALS['__TEST_PUSH_TRANSPORT'] = function ($items, $payload, $criteria) {
            $this->capturedPayloads[] = [
                'items' => $items,
                'payload' => $payload,
                'criteria' => $criteria,
            ];

            return [
                'success' => count($items),
                'failed' => 0,
                'errors' => []
            ];
        };
        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        // Add dummy subscriptions so PushService does not return early
        $dataDir = __DIR__ . '/../../data';
        if (!is_dir($dataDir)) {
            @mkdir($dataDir, 0777, true);
        }
        $subsPath = $dataDir . '/push-subscriptions.json';
        $prefsPath = $dataDir . '/push-preferences.json';
        
        $this->originalSubs = file_exists($subsPath) ? file_get_contents($subsPath) : null;
        $this->originalPrefs = file_exists($prefsPath) ? file_get_contents($prefsPath) : null;

        file_put_contents($subsPath, json_encode([
            'items' => [
                [
                    'patientId' => 'test-pat-1',
                    'channel' => 'patient_portal',
                    'scope' => 'appointment_reminder_24h',
                    'endpoint' => 'https://fcm.test/1',
                    'keys' => ['auth' => 'a', 'p256dh' => 'b']
                ],
                [
                    'phone' => '0999999999',
                    'channel' => 'patient_portal',
                    'endpoint' => 'https://fcm.test/2',
                    'keys' => ['auth' => 'c', 'p256dh' => 'd']
                ],
                [
                    'patientId' => 'pat_xyz',
                    'channel' => 'patient_portal',
                    'endpoint' => 'https://fcm.test/3',
                    'keys' => ['auth' => 'e', 'p256dh' => 'f']
                ]
            ]
        ]));

        file_put_contents($prefsPath, json_encode([
            'preferences' => []
        ]));
    }

    protected function tearDown(): void
    {
        unset($GLOBALS['__TEST_PUSH_TRANSPORT']);
        
        $dataDir = __DIR__ . '/../../data';
        $subsPath = $dataDir . '/push-subscriptions.json';
        $prefsPath = $dataDir . '/push-preferences.json';
        
        if ($this->originalSubs !== null) {
            file_put_contents($subsPath, $this->originalSubs);
        } else {
            @unlink($subsPath);
        }
        
        if ($this->originalPrefs !== null) {
            file_put_contents($prefsPath, $this->originalPrefs);
        } else {
            @unlink($prefsPath);
        }
    }

    public function testSendAppointmentCreatedPushFormat(): void
    {
        $appointment = [
            'id' => 1234,
            'patientId' => 'test-pat-1',
            'doctor' => 'Dr. House',
            'date' => '2026-04-01',
            'time' => '10:00'
        ];

        NotificationService::sendAppointmentCreatedPush($appointment);

        $this->assertCount(1, $this->capturedPayloads);
        $call = $this->capturedPayloads[0];
        $payload = $call['payload'];

        $this->assertEquals('appointments', $payload['category']);
        $this->assertEquals('Cita Reservada', $payload['title']);
        $this->assertEquals('appointment_created', $payload['data']['type']);
        $this->assertEquals(1234, $payload['data']['appointmentId']);
        $this->assertStringContainsString('10:00', $payload['body']);
        $this->assertStringContainsString('abril', $payload['body']);
        $this->assertEquals(['patientId' => 'test-pat-1', 'channel' => 'patient_portal', 'scope' => 'appointment_reminder_24h'], $call['criteria']);
    }

    public function testSendQueueCallNextPushFormat(): void
    {
        $ticket = [
            'id' => 99,
            'patientId' => 'test-pat-1',
            'code' => 'A-01',
            'phone' => ''
        ];

        NotificationService::sendQueueCallNextPush($ticket, 3);

        $this->assertCount(1, $this->capturedPayloads);
        $call = $this->capturedPayloads[0];
        $payload = $call['payload'];

        $this->assertEquals('queue_updates', $payload['category']);
        $this->assertEquals('¡Es tu turno!', $payload['title']);
        $this->assertEquals('queue_call_next', $payload['data']['type']);
        $this->assertEquals('A-01', $ticket['code']);
        $this->assertStringContainsString('al consultorio 3', $payload['body']);
        $this->assertEquals(['patientId' => 'test-pat-1', 'channel' => 'patient_portal'], $call['criteria']);
    }

    public function testSendDocumentReadyPushFormatPrescription(): void
    {
        $patient = [
            'id' => 'pat_xyz',
            'phone' => '0999999999'
        ];

        NotificationService::sendDocumentReadyPush($patient, 'prescription', 'rx-555');

        $this->assertCount(1, $this->capturedPayloads);
        $call = $this->capturedPayloads[0];
        $payload = $call['payload'];

        $this->assertEquals('documents_ready', $payload['category']);
        $this->assertEquals('Documento Listo', $payload['title']);
        $this->assertEquals('document_ready', $payload['data']['type']);
        $this->assertStringContainsString('receta médica', $payload['body']);
        $this->assertEquals(['patientId' => 'pat_xyz', 'channel' => 'patient_portal'], $call['criteria']);
    }
}
