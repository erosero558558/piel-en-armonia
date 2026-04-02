<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/validation.php';
require_once __DIR__ . '/storage.php';
require_once __DIR__ . '/whatsapp_openclaw/bootstrap.php';

final class PatientPortalAuth
{
    private const OTP_TTL_SECONDS = 600;
    private const SESSION_TTL_SECONDS = 604800;
    private const MAX_OTP_ATTEMPTS = 5;
    private const JWT_AUDIENCE = 'patient_portal';
    private const STORAGE_KEY = 'auroraPatientPortalSession';

    public static function storageKey(): string
    {
        return self::STORAGE_KEY;
    }

    public static function startLogin(array $store, string $phone): array
    {
        $phone = trim($phone);
        if ($phone === '') {
            return self::error('WhatsApp obligatorio', 400, 'patient_portal_phone_required');
        }

        if (!validate_phone($phone)) {
            return self::error('El formato de WhatsApp no es valido', 400, 'patient_portal_phone_invalid');
        }

        $snapshot = self::resolvePatientSnapshot($store, $phone);
        if ($snapshot === []) {
            return self::error(
                'No encontramos una cita o expediente asociado a ese WhatsApp.',
                404,
                'patient_portal_not_found'
            );
        }

        $lookupPhone = self::normalizePhoneForLookup($phone);
        if ($lookupPhone === '') {
            return self::error('No pudimos normalizar ese WhatsApp.', 400, 'patient_portal_phone_invalid');
        }

        $challengeId = 'ppc_' . bin2hex(random_bytes(8));
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $createdAt = local_date('c');
        $expiresAt = gmdate('c', time() + self::OTP_TTL_SECONDS);

        $challenge = [
            'id' => $challengeId,
            'phone' => $lookupPhone,
            'codeHash' => self::hashOtp($lookupPhone, $challengeId, $code),
            'attempts' => 0,
            'createdAt' => $createdAt,
            'expiresAt' => $expiresAt,
            'patient' => $snapshot,
        ];

        self::writeChallenge($lookupPhone, $challenge);

        try {
            $outbox = whatsapp_openclaw_repository()->enqueueOutbox([
                'phone' => self::normalizePhoneForDelivery($phone),
                'status' => 'pending',
                'type' => 'text',
                'payload' => [
                    'text' => self::buildOtpWhatsappMessage($snapshot, $code),
                ],
            ]);
        } catch (Throwable $error) {
            self::deleteChallenge($lookupPhone);
            return self::error(
                'No pudimos enviar el codigo por WhatsApp en este momento.',
                503,
                'patient_portal_delivery_failed'
            );
        }

        return [
            'ok' => true,
            'data' => [
                'challengeId' => $challengeId,
                'deliveryChannel' => 'whatsapp',
                'maskedPhone' => (string) ($snapshot['phoneMasked'] ?? self::maskPhone($phone)),
                'expiresAt' => $expiresAt,
                'otpLength' => 6,
                'patient' => self::publicPatientPayload($snapshot),
                'storageKey' => self::storageKey(),
                'outboxId' => (string) ($outbox['id'] ?? ''),
                'debugCode' => self::shouldExposeDebugOtp() ? $code : '',
            ],
        ];
    }

    public static function completeLogin(array $store, string $phone, string $code, string $challengeId = ''): array
    {
        $phone = trim($phone);
        $code = preg_replace('/\D+/', '', $code);
        $code = is_string($code) ? $code : '';
        $challengeId = trim($challengeId);

        if ($phone === '') {
            return self::error('WhatsApp obligatorio', 400, 'patient_portal_phone_required');
        }

        if (!validate_phone($phone)) {
            return self::error('El formato de WhatsApp no es valido', 400, 'patient_portal_phone_invalid');
        }

        if (strlen($code) !== 6) {
            return self::error('Ingresa el codigo de 6 digitos.', 400, 'patient_portal_otp_invalid_format');
        }

        $lookupPhone = self::normalizePhoneForLookup($phone);
        if ($lookupPhone === '') {
            return self::error('No pudimos normalizar ese WhatsApp.', 400, 'patient_portal_phone_invalid');
        }

        $challenge = self::readChallenge($lookupPhone);
        if ($challenge === []) {
            return self::error('Solicita un codigo nuevo para continuar.', 401, 'patient_portal_challenge_missing');
        }

        if ($challengeId !== '' && !hash_equals((string) ($challenge['id'] ?? ''), $challengeId)) {
            return self::error('Ese codigo ya no corresponde a la solicitud activa.', 401, 'patient_portal_challenge_mismatch');
        }

        $expiresAt = strtotime((string) ($challenge['expiresAt'] ?? ''));
        if ($expiresAt === false || $expiresAt < time()) {
            self::deleteChallenge($lookupPhone);
            return self::error('El codigo expiro. Solicita uno nuevo.', 410, 'patient_portal_otp_expired');
        }

        $attempts = (int) ($challenge['attempts'] ?? 0);
        if ($attempts >= self::MAX_OTP_ATTEMPTS) {
            self::deleteChallenge($lookupPhone);
            return self::error(
                'Superaste el numero de intentos. Solicita un codigo nuevo.',
                429,
                'patient_portal_otp_locked'
            );
        }

        $expectedHash = (string) ($challenge['codeHash'] ?? '');
        $providedHash = self::hashOtp($lookupPhone, (string) ($challenge['id'] ?? ''), $code);
        if ($expectedHash === '' || !hash_equals($expectedHash, $providedHash)) {
            $challenge['attempts'] = $attempts + 1;
            self::writeChallenge($lookupPhone, $challenge);
            return self::error('El codigo no coincide. Revisa tu WhatsApp.', 401, 'patient_portal_otp_invalid');
        }

        self::deleteChallenge($lookupPhone);

        $snapshot = self::resolvePatientSnapshot($store, $phone);
        if ($snapshot === []) {
            $snapshot = is_array($challenge['patient'] ?? null) ? $challenge['patient'] : [];
        }
        if ($snapshot === []) {
            return self::error(
                'No pudimos reconstruir tu perfil del portal. Intenta nuevamente.',
                409,
                'patient_portal_patient_missing'
            );
        }

        $issuedAt = time();
        $expiresAtTs = $issuedAt + self::sessionTtlSeconds();
        $claims = [
            'iss' => self::issuer(),
            'aud' => self::JWT_AUDIENCE,
            'sub' => (string) ($snapshot['subject'] ?? ''),
            'iat' => $issuedAt,
            'exp' => $expiresAtTs,
            'phone' => (string) ($snapshot['phone'] ?? ''),
            'patient_id' => (string) ($snapshot['patientId'] ?? ''),
            'patient_case_id' => (string) ($snapshot['patientCaseId'] ?? ''),
            'name' => (string) ($snapshot['name'] ?? ''),
            'scope' => 'portal_patient',
        ];

        $token = self::encodeJwt($claims);
        if ($token === '') {
            return self::error(
                'No pudimos abrir la sesion del portal en este momento.',
                503,
                'patient_portal_token_failed'
            );
        }

        return [
            'ok' => true,
            'data' => [
                'token' => $token,
                'expiresAt' => gmdate('c', $expiresAtTs),
                'patient' => self::publicPatientPayload($snapshot),
                'storageKey' => self::storageKey(),
                'portalHome' => '/es/portal/',
            ],
        ];
    }

    public static function readStatus(array $store, ?string $token): array
    {
        $token = trim((string) $token);
        if ($token === '') {
            return [
                'ok' => true,
                'data' => [
                    'authenticated' => false,
                    'storageKey' => self::storageKey(),
                ],
            ];
        }

        $session = self::authenticateSession($store, $token);
        if (($session['ok'] ?? false) !== true) {
            return [
                'ok' => true,
                'data' => [
                    'authenticated' => false,
                    'storageKey' => self::storageKey(),
                ],
            ];
        }

        return [
            'ok' => true,
            'data' => [
                'authenticated' => true,
                'expiresAt' => (string) ($session['data']['expiresAt'] ?? gmdate('c')),
                'patient' => is_array($session['data']['patient'] ?? null) ? $session['data']['patient'] : [],
                'storageKey' => self::storageKey(),
            ],
        ];
    }

    public static function authenticateSession(array $store, ?string $token): array
    {
        $token = trim((string) $token);
        if ($token === '') {
            return self::error(
                'Necesitas iniciar sesion en el portal para ver tus datos.',
                401,
                'patient_portal_auth_required'
            );
        }

        $claims = self::decodeJwt($token);
        if ($claims === []) {
            return self::error(
                'Tu sesion del portal expiro. Ingresa nuevamente con tu codigo.',
                401,
                'patient_portal_session_invalid'
            );
        }

        $snapshot = self::resolvePatientSnapshot($store, (string) ($claims['phone'] ?? ''));
        if ($snapshot === []) {
            $snapshot = [
                'subject' => (string) ($claims['sub'] ?? ''),
                'patientId' => (string) ($claims['patient_id'] ?? ''),
                'patientCaseId' => (string) ($claims['patient_case_id'] ?? ''),
                'name' => (string) ($claims['name'] ?? ''),
                'phone' => (string) ($claims['phone'] ?? ''),
                'phoneMasked' => self::maskPhone((string) ($claims['phone'] ?? '')),
                'lastAppointmentId' => 0,
                'source' => 'token',
            ];
        }

        return [
            'ok' => true,
            'data' => [
                'claims' => $claims,
                'expiresAt' => gmdate('c', (int) ($claims['exp'] ?? time())),
                'patient' => self::publicPatientPayload($snapshot),
                'snapshot' => $snapshot,
                'storageKey' => self::storageKey(),
            ],
        ];
    }
    public static function authenticateDownloadToken(array $store, string $token): array
    {
        $token = trim($token);
        if ($token === '') {
            return self::error('Token de descarga requerido.', 401, 'patient_portal_download_token_required');
        }

        $claims = self::decodeJwt($token);
        if ($claims === []) {
            return self::error('Enlace de descarga caducado o inválido.', 401, 'patient_portal_download_token_invalid');
        }

        if (($claims['scope'] ?? '') !== 'document_download') {
            return self::error('El token no permite descarga.', 403, 'patient_portal_download_token_scope');
        }

        $snapshot = self::resolvePatientSnapshot($store, (string) ($claims['phone'] ?? ''));
        if ($snapshot === []) {
            return self::error('Paciente no encontrado.', 404, 'patient_portal_download_patient_missing');
        }

        return [
            'ok' => true,
            'data' => [
                'claims' => $claims,
                'patient' => self::publicPatientPayload($snapshot),
                'snapshot' => $snapshot,
            ],
        ];
    }

    public static function generateDownloadToken(array $sessionData): string
    {
        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        if ($snapshot === []) {
            return '';
        }

        $issuedAt = time();
        $expiresAtTs = $issuedAt + 3600; // 1h TTL
        $claims = [
            'iss' => self::issuer(),
            'aud' => self::JWT_AUDIENCE,
            'sub' => (string) ($snapshot['subject'] ?? ''),
            'iat' => $issuedAt,
            'exp' => $expiresAtTs,
            'phone' => (string) ($snapshot['phone'] ?? ''),
            'patient_id' => (string) ($snapshot['patientId'] ?? ''),
            'scope' => 'document_download',
            'jti' => bin2hex(random_bytes(16)), // One-time token identifier
        ];

        return self::encodeJwt($claims);
    }
    public static function matchesPatientPhone(string $left, string $right): bool
    {
        return self::phonesMatch($left, $right);
    }

    public static function bearerTokenFromRequest(): string
    {
        $headers = [
            $_SERVER['HTTP_AUTHORIZATION'] ?? '',
            $_SERVER['Authorization'] ?? '',
        ];

        foreach ($headers as $header) {
            if (!is_string($header)) {
                continue;
            }
            if (preg_match('/^\s*Bearer\s+(.+)\s*$/i', $header, $matches) === 1) {
                return trim((string) ($matches[1] ?? ''));
            }
        }

        return '';
    }

    private static function resolvePatientSnapshot(array $store, string $phone): array
    {
        $appointment = self::findLatestAppointment($store, $phone);
        $case = self::findLatestPatientCase($store, $phone);

        if ($appointment === [] && $case === []) {
            return [];
        }

        $summary = is_array($case['summary'] ?? null) ? $case['summary'] : [];
        $resolvedPhone = self::firstNonEmptyString(
            (string) ($appointment['phone'] ?? ''),
            (string) ($summary['contactPhone'] ?? ''),
            $phone
        );
        $lookupPhone = self::normalizePhoneForLookup($resolvedPhone);
        $patientId = self::firstNonEmptyString(
            (string) ($appointment['patientId'] ?? ''),
            (string) ($case['patientId'] ?? ''),
            $lookupPhone !== '' ? 'phone:' . $lookupPhone : ''
        );
        $patientCaseId = self::firstNonEmptyString(
            (string) ($appointment['patientCaseId'] ?? ''),
            (string) ($case['id'] ?? '')
        );
        $name = self::firstNonEmptyString(
            trim((string) ($appointment['name'] ?? '')),
            trim((string) ($summary['patientLabel'] ?? '')),
            'Paciente Aurora Derm'
        );

        return [
            'subject' => $patientId !== '' ? $patientId : ('phone:' . $lookupPhone),
            'patientId' => $patientId,
            'patientCaseId' => $patientCaseId,
            'name' => $name,
            'phone' => $lookupPhone,
            'phoneMasked' => self::maskPhone($resolvedPhone),
            'email' => self::firstNonEmptyString(
                (string) ($appointment['email'] ?? ''),
                (string) ($summary['contactEmail'] ?? '')
            ),
            'lastAppointmentId' => (int) ($appointment['id'] ?? 0),
            'source' => $appointment !== [] ? 'appointment' : 'patient_case',
        ];
    }

    private static function publicPatientPayload(array $snapshot): array
    {
        return [
            'subject' => (string) ($snapshot['subject'] ?? ''),
            'patientId' => (string) ($snapshot['patientId'] ?? ''),
            'patientCaseId' => (string) ($snapshot['patientCaseId'] ?? ''),
            'name' => (string) ($snapshot['name'] ?? ''),
            'phoneMasked' => (string) ($snapshot['phoneMasked'] ?? ''),
            'lastAppointmentId' => (int) ($snapshot['lastAppointmentId'] ?? 0),
            'source' => (string) ($snapshot['source'] ?? ''),
        ];
    }

    private static function findLatestAppointment(array $store, string $phone): array
    {
        $matches = [];
        foreach (($store['appointments'] ?? []) as $appointment) {
            if (!is_array($appointment)) {
                continue;
            }
            if (!self::phonesMatch((string) ($appointment['phone'] ?? ''), $phone)) {
                continue;
            }
            $matches[] = $appointment;
        }

        usort($matches, static function (array $left, array $right): int {
            return self::recordSortTimestamp($right) <=> self::recordSortTimestamp($left);
        });

        return $matches[0] ?? [];
    }

    private static function findLatestPatientCase(array $store, string $phone): array
    {
        $matches = [];
        foreach (($store['patient_cases'] ?? []) as $case) {
            if (!is_array($case)) {
                continue;
            }
            $summary = is_array($case['summary'] ?? null) ? $case['summary'] : [];
            $candidatePhones = [
                (string) ($summary['contactPhone'] ?? ''),
                (string) ($case['contactPhone'] ?? ''),
                (string) ($summary['patientPhone'] ?? ''),
            ];

            $isMatch = false;
            foreach ($candidatePhones as $candidatePhone) {
                if (self::phonesMatch($candidatePhone, $phone)) {
                    $isMatch = true;
                    break;
                }
            }

            if ($isMatch) {
                $matches[] = $case;
            }
        }

        usort($matches, static function (array $left, array $right): int {
            return self::recordSortTimestamp($right) <=> self::recordSortTimestamp($left);
        });

        return $matches[0] ?? [];
    }

    private static function recordSortTimestamp(array $record): int
    {
        $candidates = [
            (string) ($record['latestActivityAt'] ?? ''),
            (string) ($record['dateBooked'] ?? ''),
            trim((string) ($record['date'] ?? '') . ' ' . (string) ($record['time'] ?? '')),
            (string) ($record['openedAt'] ?? ''),
            (string) ($record['createdAt'] ?? ''),
        ];

        foreach ($candidates as $candidate) {
            $candidate = trim($candidate);
            if ($candidate === '') {
                continue;
            }
            $timestamp = strtotime($candidate);
            if ($timestamp !== false) {
                return $timestamp;
            }
        }

        return 0;
    }

    private static function buildOtpWhatsappMessage(array $snapshot, string $code): string
    {
        $name = trim((string) ($snapshot['name'] ?? 'Paciente'));

        return implode("\n", [
            'Hola ' . $name . ',',
            '',
            'Tu codigo para ingresar al portal de Aurora Derm es: *' . $code . '*',
            '',
            'Vence en 10 minutos. Si no lo solicitaste, ignora este mensaje.',
        ]);
    }

    private static function shouldExposeDebugOtp(): bool
    {
        if (defined('TESTING_ENV')) {
            return true;
        }

        $flag = strtolower(trim((string) app_env('AURORADERM_PATIENT_PORTAL_EXPOSE_OTP', '')));
        if (in_array($flag, ['1', 'true', 'yes', 'on'], true)) {
            return true;
        }

        $environment = strtolower(trim((string) app_env('APP_ENV', app_env('PIELARMONIA_APP_ENV', ''))));
        return in_array($environment, ['local', 'development', 'dev', 'test'], true);
    }

    private static function jwtSecret(): string
    {
        $candidates = [
            app_env('AURORADERM_PATIENT_PORTAL_JWT_SECRET', ''),
            app_env('PIELARMONIA_PATIENT_PORTAL_JWT_SECRET', ''),
        ];

        foreach ($candidates as $candidate) {
            $secret = self::normalizeSecret((string) $candidate);
            if ($secret !== '') {
                return $secret;
            }
        }

        $derived = function_exists('data_encryption_key') ? data_encryption_key() : '';
        if (is_string($derived) && $derived !== '') {
            return hash('sha256', $derived . '|patient-portal-jwt', true);
        }

        if (defined('TESTING_ENV') || self::shouldExposeDebugOtp()) {
            return hash('sha256', data_dir_path() . '|patient-portal-dev', true);
        }

        return '';
    }

    private static function normalizeSecret(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        if (str_starts_with($value, 'base64:')) {
            $decoded = base64_decode(substr($value, 7), true);
            if (is_string($decoded) && $decoded !== '') {
                $value = $decoded;
            }
        }

        return strlen($value) === 32 ? $value : hash('sha256', $value, true);
    }

    private static function sessionTtlSeconds(): int
    {
        $raw = trim((string) app_env('AURORADERM_PATIENT_PORTAL_SESSION_TTL_SECONDS', ''));
        if ($raw === '' || !preg_match('/^\d+$/', $raw)) {
            return self::SESSION_TTL_SECONDS;
        }

        return max(3600, min(2592000, (int) $raw));
    }

    private static function issuer(): string
    {
        $baseUrl = trim((string) app_env('AURORADERM_BASE_URL', app_env('PIELARMONIA_BASE_URL', '')));
        if ($baseUrl !== '') {
            return rtrim($baseUrl, '/');
        }

        $host = trim((string) ($_SERVER['HTTP_HOST'] ?? '127.0.0.1'));
        $scheme = is_https_request() ? 'https' : 'http';
        return $scheme . '://' . $host;
    }

    private static function encodeJwt(array $claims): string
    {
        $secret = self::jwtSecret();
        if ($secret === '') {
            return '';
        }

        $header = self::base64UrlEncode((string) json_encode([
            'alg' => 'HS256',
            'typ' => 'JWT',
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $payload = self::base64UrlEncode((string) json_encode($claims, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $signature = self::base64UrlEncode(hash_hmac('sha256', $header . '.' . $payload, $secret, true));

        return $header . '.' . $payload . '.' . $signature;
    }

    private static function decodeJwt(string $token): array
    {
        $secret = self::jwtSecret();
        if ($secret === '') {
            return [];
        }

        $parts = explode('.', trim($token));
        if (count($parts) !== 3) {
            return [];
        }

        [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;
        $expectedSignature = self::base64UrlEncode(
            hash_hmac('sha256', $encodedHeader . '.' . $encodedPayload, $secret, true)
        );
        if (!hash_equals($expectedSignature, $encodedSignature)) {
            return [];
        }

        $header = json_decode(self::base64UrlDecode($encodedHeader), true);
        $payload = json_decode(self::base64UrlDecode($encodedPayload), true);
        if (!is_array($header) || !is_array($payload)) {
            return [];
        }

        if (($header['alg'] ?? '') !== 'HS256') {
            return [];
        }

        if (($payload['aud'] ?? '') !== self::JWT_AUDIENCE) {
            return [];
        }

        if ((int) ($payload['exp'] ?? 0) < time()) {
            return [];
        }

        return $payload;
    }

    private static function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $value): string
    {
        $padding = strlen($value) % 4;
        if ($padding > 0) {
            $value .= str_repeat('=', 4 - $padding);
        }

        $decoded = base64_decode(strtr($value, '-_', '+/'), true);
        return is_string($decoded) ? $decoded : '';
    }

    private static function hashOtp(string $phone, string $challengeId, string $code): string
    {
        $secret = self::jwtSecret();
        return hash_hmac('sha256', $phone . '|' . $challengeId . '|' . $code, $secret !== '' ? $secret : 'patient-portal-otp');
    }

    private static function challengePath(string $phone): string
    {
        return self::challengeDirectory() . DIRECTORY_SEPARATOR . sha1($phone) . '.json';
    }

    private static function challengeDirectory(): string
    {
        $dir = data_dir_path() . DIRECTORY_SEPARATOR . 'patient-portal-auth';
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
        }

        return $dir;
    }

    private static function writeChallenge(string $phone, array $challenge): void
    {
        $path = self::challengePath($phone);
        file_put_contents($path, json_encode($challenge, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }

    private static function readChallenge(string $phone): array
    {
        $path = self::challengePath($phone);
        if (!is_file($path)) {
            return [];
        }

        $decoded = json_decode((string) file_get_contents($path), true);
        return is_array($decoded) ? $decoded : [];
    }

    private static function deleteChallenge(string $phone): void
    {
        $path = self::challengePath($phone);
        if (is_file($path)) {
            @unlink($path);
        }
    }

    private static function phonesMatch(string $left, string $right): bool
    {
        $leftVariants = self::phoneVariants($left);
        $rightVariants = self::phoneVariants($right);
        if ($leftVariants === [] || $rightVariants === []) {
            return false;
        }

        foreach ($leftVariants as $candidate) {
            if (in_array($candidate, $rightVariants, true)) {
                return true;
            }
        }

        return false;
    }

    private static function phoneVariants(string $value): array
    {
        $digits = preg_replace('/\D+/', '', $value);
        if (!is_string($digits) || $digits === '') {
            return [];
        }

        $variants = [$digits];
        $trimmed = ltrim($digits, '0');
        if ($trimmed !== '') {
            $variants[] = $trimmed;
        }

        if (str_starts_with($digits, '593') && strlen($digits) >= 11) {
            $local = '0' . substr($digits, 3);
            $variants[] = $local;
            $variants[] = substr($local, 1);
        }

        if (str_starts_with($digits, '09') && strlen($digits) === 10) {
            $variants[] = substr($digits, 1);
            $variants[] = '593' . substr($digits, 1);
        }

        if (strlen($digits) === 9 && str_starts_with($digits, '9')) {
            $variants[] = '0' . $digits;
            $variants[] = '593' . $digits;
        }

        $normalized = [];
        foreach ($variants as $variant) {
            $variant = trim((string) $variant);
            if ($variant === '') {
                continue;
            }
            $normalized[$variant] = true;
        }

        return array_keys($normalized);
    }

    private static function normalizePhoneForLookup(string $value): string
    {
        $variants = self::phoneVariants($value);
        if ($variants === []) {
            return '';
        }

        foreach ($variants as $variant) {
            $variantStr = (string) $variant;
            if (str_starts_with($variantStr, '09') && strlen($variantStr) === 10) {
                return $variantStr;
            }
        }

        return (string) $variants[0];
    }

    private static function normalizePhoneForDelivery(string $value): string
    {
        $digits = preg_replace('/\D+/', '', $value);
        if (!is_string($digits) || $digits === '') {
            return '';
        }

        if (str_starts_with($digits, '09') && strlen($digits) === 10) {
            return '593' . substr($digits, 1);
        }

        if (strlen($digits) === 9 && str_starts_with($digits, '9')) {
            return '593' . $digits;
        }

        return $digits;
    }

    private static function maskPhone(string $value): string
    {
        $digits = preg_replace('/\D+/', '', $value);
        if (!is_string($digits) || $digits === '') {
            return 'Sin telefono';
        }

        $tail = substr($digits, -4);
        return str_repeat('*', max(0, strlen($digits) - 4)) . $tail;
    }

    private static function firstNonEmptyString(string ...$values): string
    {
        foreach ($values as $value) {
            $trimmed = trim($value);
            if ($trimmed !== '') {
                return $trimmed;
            }
        }

        return '';
    }

    private static function error(string $message, int $status, string $code): array
    {
        return [
            'ok' => false,
            'error' => $message,
            'status' => $status,
            'code' => $code,
        ];
    }
}
