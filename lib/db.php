<?php

declare(strict_types=1);

/**
 * Database abstraction layer using PDO.
 */

if (!function_exists('db_parse_bool_env')) {
    function db_parse_bool_env($value): bool
    {
        $normalized = strtolower(trim((string) $value));
        return in_array($normalized, ['1', 'true', 'yes', 'on'], true);
    }
}

if (!function_exists('db_log_once')) {
    function db_log_once(string $key, string $message): void
    {
        static $seen = [];
        if (isset($seen[$key])) {
            return;
        }
        $seen[$key] = true;
        error_log($message);
    }
}

if (!function_exists('db_force_sqlite_unavailable')) {
    function db_force_sqlite_unavailable(): bool
    {
        $raw = getenv('PIELARMONIA_FORCE_SQLITE_UNAVAILABLE');
        if (!is_string($raw) || trim($raw) === '') {
            return false;
        }
        return db_parse_bool_env($raw);
    }
}

if (!function_exists('db_sqlite_driver_available')) {
    function db_sqlite_driver_available(): bool
    {
        static $available = null;
        static $lastForcedUnavailable = null;
        $forcedUnavailable = db_force_sqlite_unavailable();
        if ($lastForcedUnavailable !== $forcedUnavailable) {
            $available = null;
            $lastForcedUnavailable = $forcedUnavailable;
        }

        if (is_bool($available)) {
            return $available;
        }

        if ($forcedUnavailable) {
            $available = false;
            return $available;
        }

        if (!class_exists('PDO') || !extension_loaded('pdo_sqlite')) {
            $available = false;
            return $available;
        }

        try {
            $drivers = PDO::getAvailableDrivers();
            $available = is_array($drivers) && in_array('sqlite', $drivers, true);
        } catch (Throwable $e) {
            $available = false;
        }

        return $available;
    }
}

function get_db_connection(?string $dbPath = null, bool $reset = false): ?PDO
{
    static $pdo = null;
    static $connectionKey = null;

    if ($reset) {
        $pdo = null;
        $connectionKey = null;
        return null;
    }

    if ($pdo !== null && $dbPath === null) {
        return $pdo;
    }

    $requestedConnectionKey = $dbPath !== null ? 'sqlite:' . $dbPath : null;
    if ($pdo !== null && $requestedConnectionKey !== null && $connectionKey === $requestedConnectionKey) {
        return $pdo;
    }
    if ($pdo !== null && $requestedConnectionKey !== null && $connectionKey !== $requestedConnectionKey) {
        $pdo = null;
        $connectionKey = null;
    }

    // Try SQLite if path provided
    if ($dbPath !== null) {
        if (!db_sqlite_driver_available()) {
            db_log_once(
                'sqlite_driver_unavailable',
                'Aurora Derm DB: SQLite driver unavailable; fallback storage required.'
            );
            return null;
        }

        try {
            $dsn = "sqlite:" . $dbPath;
            $pdo = new PDO($dsn, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
            $connectionKey = $requestedConnectionKey;
            // Optimize SQLite
            // $pdo->exec('PRAGMA journal_mode = WAL;'); // Disabled to simplify file-based backups
            $pdo->exec('PRAGMA synchronous = NORMAL;');
            return $pdo;
        } catch (PDOException $e) {
            $reason = trim($e->getMessage());
            $reasonKey = $reason === '' ? 'unknown' : md5($reason);
            db_log_once(
                'sqlite_connect_error_' . $reasonKey,
                'Aurora Derm DB: SQLite connection error: ' . $reason
            );
            return null;
        }
    }

    // Try Environment Variables (MySQL)
    $host = getenv('DB_HOST') ?: getenv('PIELARMONIA_DB_HOST');
    $name = getenv('DB_NAME') ?: getenv('PIELARMONIA_DB_NAME');
    $user = getenv('DB_USER') ?: getenv('PIELARMONIA_DB_USER');
    $pass = getenv('DB_PASS') ?: getenv('PIELARMONIA_DB_PASS');

    if (is_string($host) && is_string($name) && is_string($user) && is_string($pass) &&
        $host !== '' && $name !== '' && $user !== '') {
        try {
            $dsn = "mysql:host={$host};dbname={$name};charset=utf8mb4";
            $pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
            $connectionKey = 'mysql:' . $host . ':' . $name . ':' . $user;
            return $pdo;
        } catch (PDOException $e) {
            error_log('Aurora Derm DB Connection Error: Could not connect to database MySQL.');
            return null;
        }
    }

    return null;
}

/**
 * Executes a prepared statement securely.
 *
 * @param string $sql SQL query with placeholders (?)
 * @param array $params Parameters to bind
 * @return array|int|bool Result set (array), affected rows (int for INSERT/UPDATE/DELETE), or false on failure.
 */
function db_query(string $sql, array $params = [])
{
    $pdo = get_db_connection();
    if ($pdo === null) {
        return false;
    }

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $trimmedSql = strtoupper(trim($sql));
        if (strpos($trimmedSql, 'SELECT') === 0 || strpos($trimmedSql, 'SHOW') === 0 || strpos($trimmedSql, 'DESCRIBE') === 0 || strpos($trimmedSql, 'PRAGMA') === 0) {
            return $stmt->fetchAll();
        }

        return $stmt->rowCount();
    } catch (PDOException $e) {
        error_log('Aurora Derm DB Query Error: ' . $e->getMessage());
        return false;
    }
}

function close_db_connection(): void
{
    get_db_connection(null, true);
}

function ensure_db_schema(): void
{
    // EN LA ARQUITECTURA 2.0 (RELACIONAL):
    // El esquema ya no se fuerza con 'json_data TEXT' como antes en SQLite.
    // Usar 'database.sql' y poblar MySQL local en vez de autogenerar tablas flat.
}

/**
 * Fetch a patient from the new MySQL normalized table
 */
function fetch_patient_by_id(string $patientId): ?array
{
    $pdo = get_db_connection();
    if (!$pdo) return null;

    $stmt = $pdo->prepare("SELECT * FROM patients WHERE id = ? LIMIT 1");
    $stmt->execute([$patientId]);
    $result = $stmt->fetch();
    return $result ?: null;
}

