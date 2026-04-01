<?php
$content = file_get_contents('lib/auth.php');

$oldDoctorAuth = <<<'EOD'
function require_doctor_auth(): void
{
    require_admin_auth();
    
    if (!admin_agent_has_editorial_access()) {
        json_response([
            'ok'    => false,
            'error' => 'Permisos insuficientes. Se requiere rol medico para esta operacion.',
        ], 403);
    }
}
EOD;

$newDoctorAuth = <<<'EOD'
function operator_auth_doctor_emails(): array
{
    $rawCandidates = [
        app_env('AURORADERM_DOCTOR_EMAILS'),
    ];
    $emails = [];

    foreach ($rawCandidates as $raw) {
        if (!is_string($raw) || trim($raw) === '') continue;
        foreach (explode(',', $raw) as $item) {
            $email = operator_auth_normalize_email((string) $item);
            if ($email !== '') $emails[] = $email;
        }
    }
    return array_values(array_unique($emails));
}

function operator_auth_receptionist_emails(): array
{
    $rawCandidates = [
        app_env('AURORADERM_RECEPTIONIST_EMAILS'),
    ];
    $emails = [];

    foreach ($rawCandidates as $raw) {
        if (!is_string($raw) || trim($raw) === '') continue;
        foreach (explode(',', $raw) as $item) {
            $email = operator_auth_normalize_email((string) $item);
            if ($email !== '') $emails[] = $email;
        }
    }
    return array_values(array_unique($emails));
}

function operator_auth_has_role(string $role): bool
{
    if (operator_auth_is_superadmin()) {
        return true;
    }
    
    $identity = operator_auth_current_identity(false);
    if (!is_array($identity)) return false;
    
    $email = operator_auth_normalize_email((string) ($identity['email'] ?? ''));
    if ($email === '') return false;
    
    if ($role === 'doctor') {
        return in_array($email, operator_auth_doctor_emails(), true) || admin_agent_is_in_local_demomode();
    }
    
    if ($role === 'receptionist') {
        return in_array($email, operator_auth_receptionist_emails(), true) || admin_agent_is_in_local_demomode();
    }
    
    return false;
}

function require_doctor_auth(): void
{
    require_admin_auth();
    
    if (!operator_auth_has_role('doctor') && !admin_agent_has_editorial_access()) {
        json_response([
            'ok'    => false,
            'error' => 'Permisos insuficientes. Se requiere rol medico para esta operacion.',
        ], 403);
    }
}

function require_receptionist_auth(): void
{
    require_admin_auth();
    
    if (!operator_auth_has_role('receptionist') && !operator_auth_has_role('doctor') && !admin_agent_has_editorial_access()) {
        json_response([
            'ok'    => false,
            'error' => 'Permisos insuficientes. Se requiere rol recepcionista o superior para esta operacion.',
        ], 403);
    }
}
EOD;

file_put_contents('lib/auth.php', str_replace($oldDoctorAuth, $newDoctorAuth, $content));
echo "Patched lib/auth.php\n";
