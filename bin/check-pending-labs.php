<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/common.php';
require_once __DIR__ . '/../lib/whatsapp_openclaw/bootstrap.php';

$options = getopt('', ['dry']);
$isDryRun = isset($options['dry']);

$store = read_store();
$drafts = $store['clinical_history_drafts'] ?? [];
$patients = $store['patients'] ?? [];

$now = time();
$fiveDaysInSeconds = 5 * 24 * 60 * 60;
$updated = false;
$sentCount = 0;

foreach ($drafts as &$draft) {
    if (!isset($draft['labOrders']) || !is_array($draft['labOrders'])) {
        continue;
    }

    $caseId = $draft['caseId'] ?? '';
    if ($caseId === '') {
        continue;
    }

    $patient = $patients[$caseId] ?? null;
    if (!$patient) {
        continue;
    }

    $phone = $patient['phone'] ?? '';
    $phone = preg_replace('/\D+/', '', $phone);
    if ($phone === '') {
        continue;
    }

    foreach ($draft['labOrders'] as &$order) {
        $status = $order['status'] ?? '';
        $resultStatus = $order['resultStatus'] ?? 'not_received';
        
        if ($status === 'issued' && $resultStatus === 'not_received') {
            $issuedAtStr = $order['requestedAt'] ?? $draft['createdAt'] ?? '';
            $issuedAt = strtotime($issuedAtStr);
            if (!$issuedAt) {
                continue;
            }

            if (($now - $issuedAt) > $fiveDaysInSeconds) {
                if (!isset($order['remindedAt'])) {
                    
                    $studies = [];
                    foreach (($order['studySelections'] ?? []) as $study) {
                        $name = $study['studyName'] ?? '';
                        if ($name !== '') {
                            $studies[] = $name;
                        }
                    }
                    $labName = !empty($studies) ? implode(', ', $studies) : 'laboratorio';

                    $message = "Sus resultados de {$labName} ya deberían estar listos. Por favor visítenos para revisarlos.";
                    
                    if ($isDryRun) {
                        echo "[DRY RUN] Case {$caseId} - Enviar WhatsApp a +{$phone} para labOrder {$order['labOrderId']}: '{$message}'\n";
                    } else {
                        whatsapp_openclaw_repository()->enqueueOutbox([
                            'to' => '+' . $phone,
                            'text' => $message,
                            'context' => 'lab_pending_reminder',
                        ]);
                        $order['remindedAt'] = gmdate('c');
                        $updated = true;
                        echo "Recordatorio encolado para +{$phone} (Caso: {$caseId}, Lab: {$order['labOrderId']})\n";
                    }
                    $sentCount++;
                }
            }
        }
    }
    unset($order);
}
unset($draft);

if ($updated && !$isDryRun) {
    $store['clinical_history_drafts'] = array_values($drafts);
    write_store($store, false);
}

echo "Procesados {$sentCount} recordatorios de laboratorios pendientes.\n";
