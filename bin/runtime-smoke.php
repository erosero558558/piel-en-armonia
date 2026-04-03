<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$failures = [];

$check = static function (bool $condition, string $message) use (&$failures): void {
    if ($condition) {
        fwrite(STDOUT, "[ok] {$message}\n");
        return;
    }

    $failures[] = $message;
    fwrite(STDERR, "[fail] {$message}\n");
};

$removeDirectory = static function (string $dir) use (&$removeDirectory): void {
    if (!is_dir($dir)) {
        return;
    }

    $entries = scandir($dir);
    if (!is_array($entries)) {
        @rmdir($dir);
        return;
    }

    foreach (array_diff($entries, ['.', '..']) as $entry) {
        $path = $dir . DIRECTORY_SEPARATOR . $entry;
        if (is_dir($path)) {
            $removeDirectory($path);
            continue;
        }

        @unlink($path);
    }

    @rmdir($dir);
};

require_once $root . '/lib/LeadOpsService.php';
require_once $root . '/lib/telemedicine/LegacyTelemedicineBridge.php';
require_once $root . '/lib/BookingService.php';
require_once $root . '/controllers/PaymentController.php';
require_once $root . '/controllers/HealthController.php';

$check(class_exists('LeadScoringService', false), 'LeadScoringService loads through LeadOps bootstrap');
$check(class_exists('LegacyTelemedicineBridge', false), 'Legacy telemedicine bridge loads');
$check(LeadOpsService::normalizeBirthdayDate('2026-04-03T10:00:00Z') === '2026-04-03', 'LeadOps normalizes birthday dates');
$check(
    LeadOpsService::normalizeAppointmentReminderTimestamp('2026-04-03T10:00:00Z') instanceof DateTimeImmutable,
    'LeadOps parses appointment reminder timestamps'
);

$origin = LeadOpsService::normalizeLeadOrigin([
    'surface' => 'preconsulta-publica',
    'service_intent' => '',
], []);
$check(($origin['source'] ?? '') === 'public_preconsultation', 'LeadOps infers preconsultation lead origin');

$store = [
    'callbacks' => [[
        'id' => 1,
        'status' => 'pendiente',
        'fecha' => '2026-04-03 10:00:00',
        'telefono' => '0999999999',
        'preferencia' => 'quiero consulta de acne urgente',
        'leadOps' => [],
    ]],
    'appointments' => [],
    'patient_cases' => [],
];

$heuristic = LeadOpsService::buildHeuristic($store['callbacks'][0], $store, null);
$queuePayload = LeadOpsService::buildQueuePayload($store['callbacks'], $store);
$health = LeadOpsService::buildHealthSnapshot($store);
$metrics = LeadOpsService::renderPrometheusMetrics($store);

$check(isset($heuristic['priorityBand']), 'LeadOps heuristic scoring executes');
$check(isset($queuePayload['meta']['worker']), 'LeadOps queue payload builds');
$check(isset($health['mode']), 'LeadOps health snapshot builds');
$check(str_contains($metrics, 'auroraderm_leadops_callbacks_total'), 'LeadOps Prometheus metrics render');

$tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'aurora-runtime-smoke-' . bin2hex(random_bytes(6));
mkdir($tempDir, 0777, true);

putenv('PIELARMONIA_DATA_DIR=' . $tempDir);
putenv('PIELARMONIA_SKIP_ENV_FILE=true');
putenv('PIELARMONIA_WHATSAPP_OPENCLAW_ENABLED=true');
putenv('PIELARMONIA_WHATSAPP_OPENCLAW_MODE=live');

if (!defined('TESTING_ENV')) {
    define('TESTING_ENV', true);
}
if (!defined('AURORADERM_CRON_BOOTSTRAP_ONLY')) {
    define('AURORADERM_CRON_BOOTSTRAP_ONLY', true);
}

require_once $root . '/cron.php';
require_once $root . '/lib/ClinicProfileStore.php';
require_once $root . '/lib/SoftwareSubscriptionService.php';

write_store([
    'appointments' => [],
    'clinical_history_sessions' => [],
    'clinical_history_drafts' => [],
], false);

write_clinic_profile(
    SoftwareSubscriptionService::startTrial([
        'clinicName' => 'Clinica Pro Trial',
        'phone' => '+593999111222',
    ], 'pro', 14, '2026-03-01T09:00:00-05:00')
);

$reminderResult = cron_task_reminders([
    'today' => '2026-03-13',
    'tomorrow' => '2026-03-14',
    'now' => '2026-03-13T12:00:00-05:00',
]);
$reminderProfile = read_clinic_profile();
$outbox = function_exists('whatsapp_openclaw_repository')
    ? whatsapp_openclaw_repository()->listPendingOutbox(10)
    : [];

$check((bool) ($reminderResult['ok'] ?? false), 'Cron reminders task runs in bootstrap mode');
$check((int) ($reminderResult['softwareSubscriptionTrial']['queued'] ?? 0) === 1, 'Cron queues trial reminder on day 12');
$check((string) ($reminderProfile['software_subscription']['trialReminderChannel'] ?? '') === 'whatsapp', 'Cron persists trial reminder channel');
$check(count($outbox) === 1, 'Cron writes WhatsApp outbox reminder');

write_clinic_profile(
    SoftwareSubscriptionService::startTrial([
        'clinicName' => 'Clinica Expirada',
        'phone' => '+593999111222',
    ], 'pro', 14, '2026-03-01T09:00:00-05:00')
);

$downgradeResult = cron_task_reminders([
    'today' => '2026-03-16',
    'tomorrow' => '2026-03-17',
    'now' => '2026-03-16T08:00:00-05:00',
]);
$downgradedProfile = read_clinic_profile();

$check((int) ($downgradeResult['softwareSubscriptionTrial']['downgraded'] ?? 0) === 1, 'Cron downgrades expired trial');
$check((string) ($downgradedProfile['software_plan'] ?? '') === 'Free', 'Expired trial returns clinic profile to Free');
$check((string) ($downgradedProfile['software_subscription']['status'] ?? '') === 'free', 'Expired trial resets subscription status');

if (function_exists('get_db_connection')) {
    get_db_connection(null, true);
}

foreach ([
    'PIELARMONIA_DATA_DIR',
    'PIELARMONIA_SKIP_ENV_FILE',
    'PIELARMONIA_WHATSAPP_OPENCLAW_ENABLED',
    'PIELARMONIA_WHATSAPP_OPENCLAW_MODE',
] as $key) {
    putenv($key);
}

$removeDirectory($tempDir);

if ($failures !== []) {
    fwrite(STDERR, "\nRuntime smoke failed:\n");
    foreach ($failures as $failure) {
        fwrite(STDERR, ' - ' . $failure . "\n");
    }
    exit(1);
}

fwrite(STDOUT, "\nRuntime smoke passed.\n");
