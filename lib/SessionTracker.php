<?php

declare(strict_types=1);

require_once __DIR__ . '/storage.php';

class SessionTracker
{
    private static function getFilePath(): string
    {
        return data_dir_path() . DIRECTORY_SEPARATOR . 'active-sessions.json';
    }

    /**
     * Registra actividad de sesión. Utiliza debounce de 60 segundos para evitar I/O excesivo.
     */
    public static function recordSessionPing(string $email, string $ip, string $sessionId): void
    {
        if ($email === '' || $sessionId === '') {
            return;
        }

        $file = self::getFilePath();
        
        // Bloqueo simple sin with_store_lock() para ser más ligero
        $fp = @fopen($file, 'c+');
        if (!$fp) {
            return;
        }

        if (!@flock($fp, LOCK_EX)) {
            fclose($fp);
            return;
        }

        $size = filesize($file);
        $content = $size > 0 ? fread($fp, $size) : '';
        $data = $content ? json_decode($content, true) : [];
        if (!is_array($data)) {
            $data = [];
        }

        $now = time();
        $isDirty = false;

        // GC: Limpiar sesiones expiradas (> 1 hora)
        foreach ($data as $e => $sessions) {
            if (is_array($sessions)) {
                foreach ($sessions as $sId => $info) {
                    if (($now - ($info['last_active'] ?? 0)) > 3600) {
                        unset($data[$e][$sId]);
                        $isDirty = true;
                    }
                }
                if (empty($data[$e])) {
                    unset($data[$e]);
                    $isDirty = true;
                }
            }
        }

        // Registrar/Actualizar sesión actual
        $currentSession = $data[$email][$sessionId] ?? null;
        if ($currentSession === null) {
            $data[$email][$sessionId] = [
                'ip' => $ip,
                'started_at' => $now,
                'last_active' => $now
            ];
            $isDirty = true;
        } else {
            // Debounce: solo actualizamos a disco si pasaron > 60 segundos
            if (($now - $currentSession['last_active']) > 60) {
                $data[$email][$sessionId]['last_active'] = $now;
                // Update IP in case it changed
                $data[$email][$sessionId]['ip'] = $ip;
                $isDirty = true;
            }
        }

        if ($isDirty) {
            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        }

        flock($fp, LOCK_UN);
        fclose($fp);
    }

    /**
     * Retorna lista de sesiones concurrentes activas para el email dado
     */
    public static function getActiveSessions(string $email): array
    {
        $file = self::getFilePath();
        if (!file_exists($file)) {
            return [];
        }

        $content = @file_get_contents($file);
        $data = $content ? json_decode($content, true) : [];
        $sessions = is_array($data) && isset($data[$email]) ? $data[$email] : [];
        
        $now = time();
        $activeOnly = [];
        foreach ($sessions as $sId => $info) {
            if (($now - ($info['last_active'] ?? 0)) <= 3600) {
                // Return explicitly mapped struct, avoiding leaking session IDs
                $activeOnly[] = [
                    'ip' => $info['ip'] ?? '',
                    'started_at' => $info['started_at'] ?? 0,
                    'last_active' => $info['last_active'] ?? 0,
                    'is_current' => $sId === session_id()
                ];
            }
        }

        // Ordenar más recientes primero
        usort($activeOnly, function($a, $b) {
            return $b['last_active'] <=> $a['last_active'];
        });

        return $activeOnly;
    }

    public static function revokeOtherSessions(string $email, string $keepSessionId): void
    {
        // Opcional: elimina del jsonl todo lo que no sea $keepSessionId para forzar logout de las demás IP (si PHP usara filesystem handlers)
        // Por ahora, como es stateless, solo lo borramos del tracker. 
        $file = self::getFilePath();
        $fp = @fopen($file, 'c+');
        if (!$fp) return;
        if (!@flock($fp, LOCK_EX)) { fclose($fp); return; }
        
        $size = filesize($file);
        $content = $size > 0 ? fread($fp, $size) : '';
        $data = $content ? json_decode($content, true) : [];
        
        if (isset($data[$email]) && is_array($data[$email])) {
            foreach ($data[$email] as $sId => $info) {
                if ($sId !== $keepSessionId) {
                    unset($data[$email][$sId]);
                }
            }
            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        }
        flock($fp, LOCK_UN);
        fclose($fp);
    }
}
