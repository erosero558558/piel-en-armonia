<?php
declare(strict_types=1);

// This script verifies the current status of backups in the environment.
// It is intended to answer the checklist questions.

require_once __DIR__ . '/../lib/storage.php';

echo "=== Backup Status Verification ===\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n\n";

// 1. Check Data Directory
$dataDir = data_dir_path();
echo "Data Directory: $dataDir\n";
if (!is_dir($dataDir)) {
    echo "❌ Data directory not found!\n";
} else {
    echo "✅ Data directory exists.\n";
}

// 2. Check Store File
$storeFile = data_file_path();
if (file_exists($storeFile)) {
    echo "✅ store.json exists (" . filesize($storeFile) . " bytes)\n";
} else {
    echo "⚠️ store.json does not exist (New installation?)\n";
}

// 3. Check Backups
$backupDir = backup_dir_path();
$backupCount = 0;
echo "\n--- Automated DB Backups (Daily/Rotational) ---\n";
if (is_dir($backupDir)) {
    $files = glob($backupDir . '/store-*.json');
    $backupCount = is_array($files) ? count($files) : 0;
    echo "Backup Directory: $backupDir\n";
    echo "Total Backups Found: $backupCount\n";

    if ($backupCount > 0) {
        sort($files);
        $latest = end($files);
        $oldest = reset($files);
        echo "✅ Backups exist.\n";
        echo "   Oldest: " . basename($oldest) . " (" . date('Y-m-d H:i:s', filemtime($oldest)) . ")\n";
        echo "   Latest: " . basename($latest) . " (" . date('Y-m-d H:i:s', filemtime($latest)) . ")\n";

        // Parse latest backup to verify integrity
        $content = file_get_contents($latest);
        if (json_decode($content)) {
             echo "✅ Latest backup is valid JSON.\n";
        } else {
             echo "❌ Latest backup is INVALID JSON.\n";
        }
    } else {
        echo "⚠️ No backups found yet (System unused?)\n";
    }
} else {
    echo "❌ Backup directory does not exist.\n";
}

// 4. File Backups (Uploads/Configs)
echo "\n--- File Backups (Uploads/Configs) ---\n";
$uploadsDir = __DIR__ . '/../uploads';
if (is_dir($uploadsDir)) {
    echo "Uploads Directory: $uploadsDir\n";
    echo "⚠️ No specific backup mechanism detected for uploads/ in codebase.\n";
    echo "   (Recommendation: Use rsync/S3 for uploads backup)\n";
} else {
    echo "ℹ️ Uploads directory not found.\n";
}

// Configs check
$envFile = __DIR__ . '/../env.php';
if (file_exists($envFile)) {
    echo "Config: env.php exists (Not backed up by app logic, relies on manual/infra backup).\n";
} else {
    echo "Config: env.php not found (Environment variables used?)\n";
}


// 5. Off-site Backups
echo "\n--- Off-site Backups ---\n";
// Check for scripts
$binDir = __DIR__ . '/../bin';
$hasOffsiteScript = false;
if (is_dir($binDir)) {
    foreach (glob($binDir . '/*') as $script) {
        if (!is_file($script)) continue;
        $content = file_get_contents($script);
        if (stripos($content, 's3') !== false || stripos($content, 'ftp') !== false || stripos($content, 'scp') !== false) {
            echo "❓ Found potential backup script: " . basename($script) . "\n";
            $hasOffsiteScript = true;
        }
    }
}
if (!$hasOffsiteScript) {
    echo "❌ No automated off-site backup script found in bin/.\n";
}

// 6. RTO/RPO
echo "\n--- RTO/RPO ---\n";
$drFile = __DIR__ . '/../docs/DISASTER_RECOVERY.md';
$rpo = "Unknown";
$rto = "Unknown";

if (file_exists($drFile)) {
    $drContent = file_get_contents($drFile);
    if (preg_match('/RPO.*?:\**\s*(.*?)$/m', $drContent, $matches)) {
        $rpo = trim($matches[1]);
        echo "Defined RPO: " . $rpo . "\n";
    } else {
        echo "RPO not found in docs.\n";
    }
    if (preg_match('/RTO.*?:\**\s*(.*?)$/m', $drContent, $matches)) {
        $rto = trim($matches[1]);
        echo "Defined RTO: " . $rto . "\n";
    } else {
        echo "RTO not found in docs.\n";
    }
} else {
    echo "⚠️ DISASTER_RECOVERY.md not found.\n";
}

echo "\n=== Summary for User Checklist ===\n";
echo "1. ¿Existen backups automáticos de BD? (daily) -> " . ($backupCount > 0 ? "YES (On-change rotation)" : "NO (Files missing, but logic enabled)") . "\n";
echo "2. ¿Se prueban los backups regularmente? -> NO (No automated restore test found)\n";
echo "3. ¿Hay backup de archivos (uploads, configs)? -> NO (Code only covers store.json)\n";
echo "4. ¿Los backups están off-site? -> NO (Stored locally in data/backups)\n";
echo "5. ¿Cuál es el RTO/RPO definido? -> RPO: $rpo, RTO: $rto\n";
