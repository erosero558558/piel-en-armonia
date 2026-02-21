<?php

require_once __DIR__ . '/../figo-brain.php';

$reflection = new ReflectionClass('FigoBrain');
print_r($reflection->getMethods());

function test_intent($message, $expectedIntent)
{
    echo "Testing message: '$message' ... ";

    // Use reflection to access private method detectIntent if possible,
    // or just use process() and check the response content to infer intent.
    // FigoBrain::process returns a JSON-like array.

    $response = FigoBrain::process([['role' => 'user', 'content' => $message]]);
    $content = $response['choices'][0]['message']['content'];

    // Check if content matches expected intent response characteristics
    $passed = false;
    if ($expectedIntent === 'handoff') {
        if (strpos($content, 'Entiendo que prefieres hablar con una persona') !== false) {
            $passed = true;
        }
    } elseif ($expectedIntent === 'escalation') {
        if (strpos($content, 'Gerencia de Atención al Paciente') !== false) {
            $passed = true;
        }
    } elseif ($expectedIntent === 'identity') {
        if (strpos($content, 'Soy **Figo**') !== false) {
            $passed = true;
        }
    }

    if ($passed) {
        echo "PASS\n";
    } else {
        echo "FAIL\n";
        echo "Response was: " . substr($content, 0, 100) . "...\n";
    }
}

echo "=== Testing FigoBrain V3 Handoff & Persona ===\n";

// Test Handoff
test_intent('Quiero hablar con una persona real', 'handoff');
test_intent('necesito hablar con un humano', 'handoff');
test_intent('quiero hablar con el doctor', 'handoff'); // "doctor" keyword is in doctors intent too, lets see who wins.
// "doctor" has score 3 (exact). "hablar con el doctor" has "hablar con el doctor" in handoff (phrase).
// If phrase match logic works, it should win.

// Test Escalation (Complaints)
test_intent('esto es una estafa', 'escalation');
test_intent('pesimo servicio', 'escalation');

// Test Identity
test_intent('quien eres', 'identity');

echo "=== Done ===\n";
