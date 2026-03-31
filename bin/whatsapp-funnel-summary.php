#!/usr/bin/env php
<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/common.php';
require_once __DIR__ . '/../lib/whatsapp_openclaw/bootstrap.php';

try {
    $funnel = whatsapp_openclaw_repository()->generateFunnelArtifact();
    echo "Funcionalidad funnel generada correctamente.\n";
    echo "Inbound: {$funnel['inbound']}\n";
    echo "Availability Lookup: {$funnel['availability_lookup']}\n";
    echo "Hold Created: {$funnel['hold_created']}\n";
    echo "Checkout Ready: {$funnel['checkout_ready']}\n";
    echo "Appointment Created: {$funnel['appointment_created']}\n";
    echo "Handoff: {$funnel['handoff']}\n";
} catch (Throwable $e) {
    if (defined('STDERR')) {
        fwrite(STDERR, "[FATAL] generate-whatsapp-funnel: " . $e->getMessage() . "\n");
    }
    exit(1);
}

exit(0);
