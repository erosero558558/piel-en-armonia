<?php

declare(strict_types=1);

if ($argc < 2) {
    echo "Uso: php bin/generate_hash.php <password>\n";
    exit(1);
}

$password = $argv[1];
$hash = password_hash($password, PASSWORD_BCRYPT);

echo "Contraseña: " . $password . "\n";
echo "Hash: " . $hash . "\n";
echo "\n";
echo "Configuración para env.php:\n";
echo "putenv('PIELARMONIA_ADMIN_PASSWORD_HASH=" . $hash . "');\n";
