<?php
require_once __DIR__ . '/../api-lib.php';
require_once __DIR__ . '/../figo-brain.php';

$tests = [
    ['hola', 'Dr. Virtual'],
    ['precio consulta', 'Nuestros Precios'],
    ['cuanto cuesta acne', 'Acné:'],
    ['agendar cita', 'Reservar Cita Online'],
    ['donde estan', 'Nuestra Ubicación'],
    ['horario', 'Horarios de Atención'],
    ['dr rosero', 'Javier Rosero'],
    ['rejuvenecimiento', 'Toxina Botulínica'],
    ['online', 'Videoconsulta'],
    ['telefono', 'WhatsApp'],
];

$passed = 0;
$failed = 0;

foreach ($tests as $test) {
    $input = $test[0];
    $expected = $test[1];

    $messages = [['role' => 'user', 'content' => $input]];
    $response = FigoBrain::process($messages);
    $content = $response['choices'][0]['message']['content'];

    if (strpos($content, $expected) !== false) {
        echo "[PASS] Input: '$input' -> Found: '$expected'\n";
        $passed++;
    } else {
        echo "[FAIL] Input: '$input'\nExpected to find: '$expected'\nGot: " . substr($content, 0, 100) . "...\n";
        $failed++;
    }
}

echo "\nResult: $passed passed, $failed failed.\n";

if ($failed > 0) {
    exit(1);
}
