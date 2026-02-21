<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';

/**
 * Tenant configuration and management.
 */

function get_current_tenant_id(): string
{
    // For now, default to 'pielarmonia'. In future, this can be resolved from request context.
    $envTenant = getenv('PIELARMONIA_TENANT_ID');
    if (is_string($envTenant) && trim($envTenant) !== '') {
        return trim($envTenant);
    }
    return 'pielarmonia';
}

function get_tenant_config(?string $tenantId = null): array
{
    $id = $tenantId ?? get_current_tenant_id();

    // Default configuration (Piel en Armonia)
    $defaults = [
        'id' => 'pielarmonia',
        'name' => 'Piel en Armonía',
        'address' => 'Av. Amazonas y Naciones Unidas, Edificio La Previsora, Torre A, Oficina 802',
        'phone' => '+593999999999', // Placeholder, adjust if needed
        'email' => 'info@pielarmonia.ec',
        'currency' => 'USD',
        'locale' => 'es_EC',
        'timezone' => 'America/Guayaquil',
        'website' => 'https://pielarmonia.com'
    ];

    if ($id === 'pielarmonia') {
        return $defaults;
    }

    // Fallback for unknown tenants, could return defaults or empty
    return array_merge($defaults, ['id' => $id, 'name' => 'Unknown Tenant']);
}
