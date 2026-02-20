<?php
require_once __DIR__ . '/../api-lib.php';
require_once __DIR__ . '/../figo-brain.php';

$tests = [
    // --- V3 Safety & Triage Tests ---
    ['tengo sangrado', 'IMPORTANTE: Mensaje de Seguridad'],
    ['dolor insoportable', 'acude inmediatamente a urgencias'],
    ['ayuda medica urgente', '911'],

    // --- V3 Trust & Technology ---
    ['porque elegirlos', 'excelencia médica y calidez humana'],
    ['que tecnologia tienen', 'Láser CO2 Fraccionado'],
    ['tienen laser fotona', 'tecnología de vanguardia'],

    // --- Basic Interaction ---
    ['hola', 'Bienvenido a **Piel en Armonía**'],

    // --- Robustness (Fuzzy) ---
    ['prcio consulta', 'valores referenciales'], // "precio"

    // Updated expectation: Bot now gives a conversational description for acne, not just the price.
    // We check for the starting phrase of the acne response.
    ['cunto cuesta acne', 'El **Acné** no es solo estético'],

    // --- Core Business ---
    ['agendar cita', 'Maravillosa elección'],
    ['donde estan', 'Edificio Citimed'],
    ['dr rosero', 'Especialista en Dermatología Clínica'],

    // --- Medical Topics ---
    ['manchas oscuras', 'Melasma'],
    ['se me cae el cabello', 'Caída de Cabello'],
    ['tengo verrugas', 'Verrugas y Lunares'],

    // --- Sentiment ---
    ['pesimo servicio', 'Siento mucho que estés pasando'],
    ['quiero poner una queja', 'Gerencia de Atención'],
];

echo "Running FigoBrain V3 Tests...\n";
$passed = 0;
$failed = 0;

foreach ($tests as $test) {
    $input = $test[0];
    $expected = $test[1];

    $messages = [['role' => 'user', 'content' => $input]];
    $response = FigoBrain::process($messages);
    $content = $response['choices'][0]['message']['content'];

    if (stripos($content, $expected) !== false) {
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
