<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/common.php';
require_once __DIR__ . '/../lib/whatsapp_openclaw/bootstrap.php';
require_once __DIR__ . '/../lib/DoctorProfileStore.php';

$options = getopt('', ['case_id:', 'test:', 'value:']);
$caseId = trim((string) ($options['case_id'] ?? ''));
$testName = trim((string) ($options['test'] ?? ''));
$value = trim((string) ($options['value'] ?? ''));

if ($caseId === '' || $testName === '' || $value === '') {
    echo "Usage: php notify-lab-critical.php --case_id=X --test=T --value=V\n";
    exit(1);
}

$store = read_store();
// Fake patient entry just in case it's a test run
$patient = $store['patients'][$caseId] ?? [
    'firstName' => 'Paciente',
    'lastName' => 'Prueba',
    'assignedDoctorPhone' => '+593999999999'
];

$patientName = trim(($patient['firstName'] ?? '') . ' ' . ($patient['lastName'] ?? ''));
$doctorPhone = $patient['assignedDoctorPhone'] ?? '+593999999999';

$baseUrl = defined('AppConfig::BASE_URL') ? AppConfig::BASE_URL : 'https://auroraderm.com';
$adminLink = $baseUrl . '/admin/clinical-history.php?case_id=' . urlencode($caseId);

$message = "⚠️ Resultado crítico en caso {$patientName}: {$testName} = {$value}. Revisar urgente.\n\nEnlace HCE: {$adminLink}";

$outbox = whatsapp_openclaw_repository()->enqueueOutbox([
    'to' => $doctorPhone,
    'text' => $message,
    'context' => 'lab_critical_alert',
]);

echo "WhatsApp generado con los datos del caso y el valor crítico. Outbox ID: {$outbox['id']}\n";
