<?php
require_once __DIR__ . '/../api-lib.php';
require_once __DIR__ . '/../figo-brain.php';

$tests = [
    // --- Basic Tests ---
    ['hola', 'Bienvenido a **Piel en Armonía**'],
    ['buenas tardes', 'Soy Figo'],

    // --- Robustness (Fuzzy Matching) ---
    // "prcio" -> precio (1 char diff)
    ['prcio consulta', 'valores referenciales'],
    // "cunto" -> cuanto
    ['cunto cuesta acne', '$89.60'],
    // "angendar" -> agendar
    ['quiero angendar', 'Perfecto'],

    // --- Temporal Awareness ---
    // Response depends on time, but should contain "atendiendo" or "cerrados"
    ['estan atendiendo ahora', 'atendiendo'],

    // --- Sentiment / Escalation ---
    ['pesimo servicio', 'Lamento mucho'],
    ['quiero poner una queja', 'hablar con un humano'],
    ['nadie contesta el telefono', 'WhatsApp de Gerencia'],

    // --- New Medical Topics ---
    ['tengo la cara roja', 'Rosácea'], // Intent: Rosacea
    ['manchas oscuras', 'Melasma'], // Intent: Melasma
    ['se me cae el cabello', 'Caída de Cabello'], // Intent: Hair Loss
    ['tengo verrugas', 'Verrugas y Lunares'], // Intent: Warts

    // --- Standard Topics ---
    ['precio consulta', 'valores referenciales'],
    ['agendar cita', 'Perfecto'],
    ['donde estan', 'Edificio Citimed'],
    ['horario', 'Lunes a Viernes'],
    ['dr rosero', 'Javier Rosero'],
    ['rejuvenecimiento', 'Rejuvenecimiento Natural'],
    ['online', 'Videoconsulta'],
    ['telefono', '098 245 3672'],
];

echo "Running Advanced Tests...\n";
$passed = 0;
$failed = 0;

foreach ($tests as $test) {
    $input = $test[0];
    $expected = $test[1];

    $messages = [['role' => 'user', 'content' => $input]];
    $response = FigoBrain::process($messages);
    $content = $response['choices'][0]['message']['content'];

    // Fuzzy matching for "atendiendo" or "cerrados" in temporal test
    if ($input === 'estan atendiendo ahora') {
        if (stripos($content, 'atendiendo') !== false || stripos($content, 'cerrados') !== false) {
            echo "[PASS] Input: '$input' -> Found temporal status.\n";
            $passed++;
            continue;
        }
    }

    if (stripos($content, $expected) !== false) {
        echo "[PASS] Input: '$input' -> Found: '$expected'\n";
        $passed++;
    } else {
        echo "[FAIL] Input: '$input'\nExpected to find: '$expected'\nGot: " . substr($content, 0, 100) . "...\n";
        $failed++;
    }
}

echo "\nRunning Context Tests...\n";
// Context Test 1: Rosacea -> Pricing
$messages = [
    ['role' => 'user', 'content' => 'tengo rosacea'],
    ['role' => 'assistant', 'content' => 'Para la Rosácea...'],
    ['role' => 'user', 'content' => 'cuanto cuesta'] // Should trigger pricing_specific
];
$response = FigoBrain::process($messages);
$content = $response['choices'][0]['message']['content'];
if (stripos($content, 'valores referenciales') !== false) {
    echo "[PASS] Context: Rosacea -> Pricing found.\n";
    $passed++;
} else {
    echo "[FAIL] Context: Rosacea -> Pricing failed. Got: " . substr($content, 0, 100) . "...\n";
    $failed++;
}

echo "\nResult: $passed passed, $failed failed.\n";

if ($failed > 0) {
    exit(1);
}
