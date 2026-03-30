<?php

declare(strict_types=1);

/**
 * Aurora Derm Global Input Sanitizer
 * S13-09: Esterilización XSS / Básica en Punto de Entrada
 */
class InputValidator
{
    /**
     * Sanitiza strings recursivamente (strip_tags y htmlspecialchars)
     */
    public static function sanitizeString(string $input): string
    {
        $input = trim($input);
        $input = strip_tags($input);
        return htmlspecialchars($input, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    /**
     * Esteriliza arrays multidimensionales
     */
    public static function sanitizeArray(array $input): array
    {
        $clean = [];
        foreach ($input as $key => $val) {
            $cleanKey = self::sanitizeString((string)$key);

            if (is_array($val)) {
                $clean[$cleanKey] = self::sanitizeArray($val);
            } elseif (is_string($val)) {
                $clean[$cleanKey] = self::sanitizeString($val);
            } elseif (is_numeric($val) || is_bool($val)) {
                $clean[$cleanKey] = $val;
            } else {
                $clean[$cleanKey] = null;
            }
        }
        return $clean;
    }

    /**
     * Validador forzado de enteros
     */
    public static function sanitizeInt($input): int
    {
        return intval($input);
    }

    /**
     * Limpia y valida estrictamente un email
     */
    public static function sanitizeEmail($input): ?string
    {
        if (!is_string($input)) {
            return null;
        }
        $email = filter_var(trim($input), FILTER_SANITIZE_EMAIL);
        return filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null;
    }

    /**
     * Lee y sanitiza JSON proveniente de php://input
     * (Reemplazo seguro de file_get_contents('php://input'))
     */
    public static function getJsonPayload(): array
    {
        $raw = file_get_contents('php://input');
        if (trim($raw) === '') {
            return [];
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return [];
        }

        return self::sanitizeArray($decoded);
    }

    /**
     * Hook principal. Sobreescribe superglobales a la fuerza.
     */
    public static function sanitizeGlobals(): void
    {
        $_GET = self::sanitizeArray($_GET ?? []);
        $_POST = self::sanitizeArray($_POST ?? []);
        $_COOKIE = self::sanitizeArray($_COOKIE ?? []);
        $_REQUEST = self::sanitizeArray($_REQUEST ?? []);
    }
}
