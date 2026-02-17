<?php
/**
 * Test de configuración del servidor
 * Accede a: http://tu-ip/test.php
 */

header('Content-Type: text/html; charset=utf-8');

$tests = [];

// Test 1: PHP funciona
$tests['PHP'] = [
    'status' => true,
    'message' => 'PHP ' . phpversion() . ' funcionando'
];

// Test 2: cURL instalado
$tests['cURL'] = [
    'status' => function_exists('curl_init'),
    'message' => function_exists('curl_init') ? 'cURL instalado' : 'cURL NO instalado - Necesario para Kimi API'
];

// Test 3: cURL puede salir a internet
if (function_exists('curl_init')) {
    $ch = curl_init('https://api.moonshot.cn/v1/models');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($httpCode == 401) {
        $tests['Conexión Externa'] = [
            'status' => true,
            'message' => 'Puede conectar a Kimi API (401 = normal sin API key)'
        ];
    } elseif ($error) {
        $tests['Conexión Externa'] = [
            'status' => false,
            'message' => 'No puede salir a internet: ' . $error
        ];
    } else {
        $tests['Conexión Externa'] = [
            'status' => false,
            'message' => 'Código HTTP: ' . $httpCode
        ];
    }
} else {
    $tests['Conexión Externa'] = [
        'status' => false,
        'message' => 'No se puede probar sin cURL'
    ];
}

// Test 4: Escritura en disco
$tests['Escritura'] = [
    'status' => is_writable(__DIR__),
    'message' => is_writable(__DIR__) ? 'Puede escribir en directorio' : 'NO puede escribir - Revisar permisos'
];

// Mostrar resultados
?>
<!DOCTYPE html>
<html>
<head>
    <title>Test - Piel en Armonía</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        h1 { color: #333; }
        .test { padding: 15px; margin: 10px 0; border-radius: 5px; }
        .ok { background: #d4edda; border-left: 5px solid #28a745; }
        .error { background: #f8d7da; border-left: 5px solid #dc3545; }
        .status { font-weight: bold; }
        .ok .status { color: #28a745; }
        .error .status { color: #dc3545; }
        code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>🩺 Test de Configuración - Piel en Armonía</h1>
    
    <?php foreach ($tests as $name => $test): ?>
        <div class="test <?= $test['status'] ? 'ok' : 'error' ?>">
            <strong><?= htmlspecialchars($name) ?>:</strong>
            <span class="status"><?= $test['status'] ? '✅ OK' : '❌ ERROR' ?></span><br>
            <?= htmlspecialchars($test['message']) ?>
        </div>
    <?php endforeach; ?>
    
    <h2>Próximos pasos:</h2>
    <ol>
        <li>Si todo está ✅, prueba el chatbot en <a href="index.html">index.html</a></li>
        <li>Si cURL está ❌, instálalo: <code>sudo apt install php-curl</code></li>
        <li>Si Conexión Externa está ❌, revisa el firewall</li>
    </ol>
    
    <p><small>IP del servidor: <?= $_SERVER['SERVER_ADDR'] ?></small></p>
</body>
</html>
