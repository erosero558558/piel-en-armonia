const fs = require('fs');

const authPath = 'lib/auth.php';
let authContent = fs.readFileSync(authPath, 'utf8');

const cuts = [
    // Chunk 1: password + fallbacks + 2fa configured
    {
        start: 'function verify_admin_password(string $password): bool',
        end: "function operator_auth_recommended_mode(): string\n{\n    return OPERATOR_AUTH_SOURCE;\n}"
    },
    // Chunk 2: verify_2fa_code + require_admin_auth
    {
        start: 'function verify_2fa_code(string $code): bool',
        end: "function operator_auth_mode(): string\n{\n    $raw = app_env('AURORADERM_OPERATOR_AUTH_MODE');"
    },
    // Chunk 3: skew
    {
        start: 'function operator_auth_bridge_timestamp_skew_seconds(): int',
        end: "function operator_auth_allow_any_authenticated_email(): bool\n{\n    return operator_auth_env_flag"
    },
    // Chunk 4: bridge config 640-667
    {
        start: 'function operator_auth_bridge_token(): string',
        end: "function operator_auth_is_enabled(): bool\n{\n    return operator_auth_mode() !== 'disabled';"
    },
    // Chunk 5: bridge payloads 1541-1758
    {
        start: 'function operator_auth_bridge_signature_payload(array $payload): string',
        end: "function operator_auth_broker_request(string $method, string $url"
    }
];

let success = true;

for (let i = 0; i < cuts.length; i++) {
    const cut = cuts[i];
    const startIndex = authContent.indexOf(cut.start);
    const endIndex = authContent.indexOf(cut.end, startIndex);
    
    if (startIndex !== -1 && endIndex !== -1) {
        authContent = authContent.substring(0, startIndex) + authContent.substring(endIndex);
        console.log(`Removed chunk ${i} successfully.`);
    } else {
        console.error(`FAILED TO FIND CHUNK ${i}: startIndex=${startIndex}, endIndex=${endIndex}`);
        success = false;
    }
}

if (success) {
    // Add require_once at top
    const requireBlock = `\nrequire_once __DIR__ . '/auth/legacy-password.php';\nrequire_once __DIR__ . '/auth/2fa-temporal-bypass.php';\nrequire_once __DIR__ . '/auth/operator-bridge.php';\n`;
    authContent = authContent.replace("require_once __DIR__ . '/totp.php';", "require_once __DIR__ . '/totp.php';" + requireBlock);
    
    fs.writeFileSync(authPath, authContent, 'utf8');
    console.log("Successfully patched lib/auth.php.");
} else {
    process.exit(1);
}
