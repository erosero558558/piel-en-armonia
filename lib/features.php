<?php
declare(strict_types=1);

/**
 * Feature flags configuration and helpers.
 */

function get_feature_flags(): array
{
    $defaults = [
        'new_booking_ui' => false,
        'stripe_elements' => false,
        'dark_mode' => false,
        'chatgpt_integration' => false,
    ];

    $flags = [];
    foreach ($defaults as $key => $default) {
        $envKey = 'FEATURE_' . strtoupper($key);
        $val = getenv($envKey);

        if ($val !== false && $val !== '') {
            // FILTER_VALIDATE_BOOLEAN returns true for "1", "true", "on" and "yes".
            // Returns false otherwise.
            $flags[$key] = filter_var($val, FILTER_VALIDATE_BOOLEAN);
        } else {
            $flags[$key] = $default;
        }
    }

    return $flags;
}

function feature_enabled(string $key): bool
{
    $flags = get_feature_flags();
    return isset($flags[$key]) && $flags[$key] === true;
}
