<?php
// We will test if ClinicalHistoryController::saveAnamnesis exists and works
require_once __DIR__ . '/../controllers/ClinicalHistoryController.php';
require_once __DIR__ . '/../controllers/OpenclawController.php';

// Prepare a mock environment
$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['CONTENT_TYPE'] = 'application/json';
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer admin';
$_SESSION['admin_email'] = 'test@aurora.com';
$_SESSION['admin_role'] = 'doctor';

$json = json_encode([
    'caseId' => 'case-123',
    'sessionId' => 'session-123',
    'motivo_consulta' => 'Mancha en la piel',
    'enfermedad_actual' => 'Hace 3 dias',
    'antecedentes_personales' => [['type' => 'patologico', 'detail' => 'Hipertension']],
    'antecedentes_familiares' => [],
    'medicamentos_actuales' => [],
    'alergias' => [['allergen' => 'Penicilina', 'reaction' => 'Rash', 'severity' => 'leve']],
    'habitos' => ['tabaco_cigarrillos_dia' => 0]
]);

file_put_contents('php://input', $json);

echo "Testing...\n";
