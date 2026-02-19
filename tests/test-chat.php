<?php
require_once __DIR__ . '/../api-lib.php';
require_once __DIR__ . '/../figo-brain.php';

$tests = [
    // Greeting
    ['hola', 'Bienvenido a **Piel en Armonía**'],
    ['buenas tardes', 'Soy Figo'],

    // Robustness Tests (New)
    // "hialuronico" contains "hi" -> Should match Rejuvenation (not Greeting)
    ['acido hialuronico', 'Toxina Botulínica'],
    // "ahora" contains "hora" -> Should NOT match Booking blindly (unless "quiero" is present, but "hora" alone is weak)
    // We expect Unknown or generic fallback if no other strong signal is present, or perhaps just NOT booking.
    // Let's test "quiero pagar ahora" -> Should match Payment.
    ['quiero pagar ahora', 'formas de pago'],

    // Identity
    ['quien eres', 'Soy **Figo**'],
    ['eres un bot', 'asistente virtual'],

    // Pricing (Dynamic)
    ['precio consulta', 'valores referenciales'],
    ['cuanto cuesta acne', '$89.60'],

    // Services
    ['que tratamientos hacen', 'Nuestras Especialidades'],
    ['tienen laser', 'Nuestra tecnología láser'],

    // Booking
    ['agendar cita', 'Excelente decisión'],
    ['quiero sacar turno', 'Haz clic aquí'],

    // Location
    ['donde estan', 'Edificio Citimed'],
    ['direccion', 'Mariana de Jesús'],

    // Hours
    ['horario', 'Lunes a Viernes'],
    ['atienden sabado', '09:00 - 13:00'],

    // Doctors
    ['dr rosero', 'Javier Rosero'],
    ['dra carolina', 'Carolina Narváez'],

    // Specific Treatments
    ['rejuvenecimiento', 'Toxina Botulínica'],
    ['online', 'Videoconsulta'],

    // Contact
    ['telefono', '098 245 3672'],
];

echo "Running Standard Tests...\n";
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

echo "\nRunning Context Tests...\n";
// Context Test 1: Pricing -> Acne
$messages = [
    ['role' => 'user', 'content' => 'cuanto cuesta la consulta'],
    ['role' => 'assistant', 'content' => 'El precio es...'],
    ['role' => 'user', 'content' => 'y de acne']
];
$response = FigoBrain::process($messages);
$content = $response['choices'][0]['message']['content'];
if (stripos($content, '$89.60') !== false) { // Should show acne pricing
    echo "[PASS] Context: Pricing -> Acne found price.\n";
    $passed++;
} else {
    echo "[FAIL] Context: Pricing -> Acne failed. Got: " . substr($content, 0, 100) . "...\n";
    $failed++;
}

echo "\nResult: $passed passed, $failed failed.\n";

if ($failed > 0) {
    exit(1);
}
