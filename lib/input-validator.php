<?php

declare(strict_types=1);

/**
 * Global Input Sanitizer
 * Mitiga XSS y SQLi validando el input expuesto a todo el sistema.
 */
class InputValidator
{
    /**
     * Valida y sanea cualquier input como string libre de HTML riesgoso.
     * @param string $key Clave de $_REQUEST, $_POST o $_GET.
     * @param string $default Valor por defecto si no existe.
     * @param array $source Fuente superglobal explícita. Omitir para leer de $_REQUEST.
     * @return string
     */
    public static function string(string $key, string $default = '', ?array $source = null): string
    {
        $data = $source !== null ? $source : $_REQUEST;
        if (!isset($data[$key])) {
            return $default;
        }

        $raw = (string) $data[$key];
        // Saneamiento de XSS simple escapando tags HTML para el display contextual.
        return htmlspecialchars(trim($raw), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    /**
     * Valida y fuerza un entero.
     * @param string $key Clave del input.
     * @param int $default Valor por defecto.
     * @param array $source Fuente superglobal explícita.
     * @return int
     */
    public static function int(string $key, int $default = 0, ?array $source = null): int
    {
        $data = $source !== null ? $source : $_REQUEST;
        if (!isset($data[$key])) {
            return $default;
        }

        $filtered = filter_var($data[$key], FILTER_VALIDATE_INT);
        return $filtered !== false ? (int)$filtered : $default;
    }

    /**
     * Valida y fuerza un flotante.
     * @param string $key Clave del input.
     * @param float $default Valor por defecto.
     * @param array $source Fuente superglobal explícita.
     * @return float
     */
    public static function float(string $key, float $default = 0.0, ?array $source = null): float
    {
        $data = $source !== null ? $source : $_REQUEST;
        if (!isset($data[$key])) {
            return $default;
        }

        $filtered = filter_var($data[$key], FILTER_VALIDATE_FLOAT);
        return $filtered !== false ? (float)$filtered : $default;
    }

    /**
     * Extrae un email válido, caso contrario devuelve vacío/default.
     * @param string $key Clave del input.
     * @param string $default Valor por defecto.
     * @param array $source Fuente superglobal explícita.
     * @return string
     */
    public static function email(string $key, string $default = '', ?array $source = null): string
    {
        $data = $source !== null ? $source : $_REQUEST;
        if (!isset($data[$key])) {
            return $default;
        }

        $filtered = filter_var(trim((string)$data[$key]), FILTER_VALIDATE_EMAIL);
        return $filtered !== false ? $filtered : $default;
    }

    /**
     * Extracción CRUDA intencional (DEBE usar prepared statements si va a SQL).
     * @param string $key Clave del input.
     * @param mixed $default Valor por defecto.
     * @param array $source Fuente superglobal explícita.
     * @return mixed
     */
    public static function raw(string $key, $default = null, ?array $source = null)
    {
        $data = $source !== null ? $source : $_REQUEST;
        return isset($data[$key]) ? $data[$key] : $default;
    }
}
