<?php
declare(strict_types=1);

/**
 * Database abstraction layer using PDO.
 */

function get_db_connection(): ?PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $host = getenv('PIELARMONIA_DB_HOST');
    $name = getenv('PIELARMONIA_DB_NAME');
    $user = getenv('PIELARMONIA_DB_USER');
    $pass = getenv('PIELARMONIA_DB_PASS');

    if (!is_string($host) || !is_string($name) || !is_string($user) || !is_string($pass) ||
        $host === '' || $name === '' || $user === '') {
        return null;
    }

    try {
        $dsn = "mysql:host={$host};dbname={$name};charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        return $pdo;
    } catch (PDOException $e) {
        // Log generic error to avoid leaking credentials in DSN
        error_log('Piel en Armonía DB Connection Error: Could not connect to database.');
        return null;
    }
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
        if (strpos($trimmedSql, 'SELECT') === 0 || strpos($trimmedSql, 'SHOW') === 0 || strpos($trimmedSql, 'DESCRIBE') === 0) {
            return $stmt->fetchAll();
        }

        return $stmt->rowCount();
    } catch (PDOException $e) {
        error_log('Piel en Armonía DB Query Error: ' . $e->getMessage());
        return false;
    }
}
