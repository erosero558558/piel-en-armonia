<?php

declare(strict_types=1);

require_once __DIR__ . '/storage.php';

class PushPreferencesService
{
    private const STORAGE_FILENAME = 'push-preferences.json';

    public function getPreferences(string $patientId): array
    {
        $patientId = trim($patientId);
        if ($patientId === '') {
            return $this->getDefaults();
        }

        $all = $this->readAll();
        $prefs = is_array($all[$patientId] ?? null) ? $all[$patientId] : [];

        return array_merge($this->getDefaults(), $prefs);
    }

    public function setPreferences(string $patientId, array $preferences): bool
    {
        $patientId = trim($patientId);
        if ($patientId === '') {
            return false;
        }

        $all = $this->readAll();
        $current = is_array($all[$patientId] ?? null) ? $all[$patientId] : $this->getDefaults();
        
        $all[$patientId] = [
            'appointments' => array_key_exists('appointments', $preferences) ? (bool)$preferences['appointments'] : $current['appointments'],
            'queue_updates' => array_key_exists('queue_updates', $preferences) ? (bool)$preferences['queue_updates'] : $current['queue_updates'],
            'documents_ready' => array_key_exists('documents_ready', $preferences) ? (bool)$preferences['documents_ready'] : $current['documents_ready'],
            'marketing' => array_key_exists('marketing', $preferences) ? (bool)$preferences['marketing'] : $current['marketing'],
            'updated_at' => local_date('c')
        ];

        return $this->writeAll($all);
    }

    public function wants(string $patientId, string $category): bool
    {
        $prefs = $this->getPreferences($patientId);
        return (bool)($prefs[$category] ?? true);
    }

    private function getDefaults(): array
    {
        return [
            'appointments' => true,
            'queue_updates' => true,
            'documents_ready' => true,
            'marketing' => false
        ];
    }

    private function storagePath(): string
    {
        return data_dir_path() . DIRECTORY_SEPARATOR . self::STORAGE_FILENAME;
    }

    private function readAll(): array
    {
        $path = $this->storagePath();
        if (!is_file($path)) {
            return [];
        }

        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            return [];
        }

        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function writeAll(array $data): bool
    {
        $path = $this->storagePath();
        $dir = dirname($path);
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            return false;
        }

        $encoded = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded) || trim($encoded) === '') {
            return false;
        }

        return @file_put_contents($path, $encoded . PHP_EOL, LOCK_EX) !== false;
    }
}
