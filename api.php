<?php
declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';

header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

start_secure_session();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$resource = isset($_GET['resource']) ? (string) $_GET['resource'] : '';
$action = isset($_GET['action']) ? (string) $_GET['action'] : '';

if ($resource === '' && $action !== '') {
    $resource = $action;
}

if ($resource === 'health') {
    json_response([
        'ok' => true,
        'status' => 'ok',
        'timestamp' => gmdate('c')
    ]);
}

$requiresAuth = isset($_GET['auth']) ? parse_bool($_GET['auth']) : true;
if ($requiresAuth && !isset($_SESSION['admin_logged_in'])) {
    $publicEndpoints = [
        ['method' => 'GET', 'resource' => 'availability'],
        ['method' => 'GET', 'resource' => 'reviews'],
        ['method' => 'GET', 'resource' => 'booked-slots'],
        ['method' => 'POST', 'resource' => 'appointments'],
        ['method' => 'POST', 'resource' => 'callbacks'],
        ['method' => 'POST', 'resource' => 'reviews'],
    ];

    $isPublic = false;
    foreach ($publicEndpoints as $endpoint) {
        if ($endpoint['method'] === $method && $endpoint['resource'] === $resource) {
            $isPublic = true;
            break;
        }
    }

    if (!$isPublic) {
        json_response([
            'ok' => false,
            'error' => 'No autorizado'
        ], 401);
    }
}

$store = read_store();

if ($method === 'GET' && $resource === 'data') {
    json_response([
        'ok' => true,
        'data' => $store
    ]);
}

if ($method === 'GET' && $resource === 'appointments') {
    json_response([
        'ok' => true,
        'data' => $store['appointments']
    ]);
}

if ($method === 'GET' && $resource === 'callbacks') {
    json_response([
        'ok' => true,
        'data' => $store['callbacks']
    ]);
}

if ($method === 'GET' && $resource === 'reviews') {
    usort($store['reviews'], static function (array $a, array $b): int {
        return strcmp((string) ($b['date'] ?? ''), (string) ($a['date'] ?? ''));
    });
    json_response([
        'ok' => true,
        'data' => $store['reviews']
    ]);
}

if ($method === 'GET' && $resource === 'availability') {
    json_response([
        'ok' => true,
        'data' => $store['availability']
    ]);
}

if ($method === 'GET' && $resource === 'booked-slots') {
    $date = isset($_GET['date']) ? (string) $_GET['date'] : '';
    if ($date === '') {
        json_response([
            'ok' => false,
            'error' => 'Fecha requerida'
        ], 400);
    }

    $slots = [];
    foreach ($store['appointments'] as $appointment) {
        $status = map_appointment_status((string) ($appointment['status'] ?? 'confirmed'));
        if ($status === 'cancelled') {
            continue;
        }
        if ((string) ($appointment['date'] ?? '') !== $date) {
            continue;
        }
        $time = (string) ($appointment['time'] ?? '');
        if ($time !== '') {
            $slots[] = $time;
        }
    }

    $slots = array_values(array_unique($slots));
    sort($slots);

    json_response([
        'ok' => true,
        'data' => $slots
    ]);
}

if ($method === 'POST' && $resource === 'appointments') {
    $payload = require_json_body();
    $appointment = normalize_appointment($payload);

    if ($appointment['name'] === '' || $appointment['email'] === '' || $appointment['phone'] === '') {
        json_response([
            'ok' => false,
            'error' => 'Nombre, email y teléfono son obligatorios'
        ], 400);
    }

    if ($appointment['date'] === '' || $appointment['time'] === '') {
        json_response([
            'ok' => false,
            'error' => 'Fecha y hora son obligatorias'
        ], 400);
    }

    if (appointment_slot_taken($store['appointments'], $appointment['date'], $appointment['time'])) {
        json_response([
            'ok' => false,
            'error' => 'Ese horario ya fue reservado'
        ], 409);
    }

    $store['appointments'][] = $appointment;
    write_store($store);

    $emailSent = maybe_send_appointment_email($appointment);

    json_response([
        'ok' => true,
        'data' => $appointment,
        'emailSent' => $emailSent
    ], 201);
}

if (($method === 'PATCH' || $method === 'PUT') && $resource === 'appointments') {
    $payload = require_json_body();
    $id = isset($payload['id']) ? (int) $payload['id'] : 0;
    if ($id <= 0) {
        json_response([
            'ok' => false,
            'error' => 'Id inválido'
        ], 400);
    }
    $found = false;
    foreach ($store['appointments'] as &$appt) {
        if ((int) ($appt['id'] ?? 0) !== $id) {
            continue;
        }
        $found = true;
        if (isset($payload['status'])) {
            $appt['status'] = map_appointment_status((string) $payload['status']);
        }
        if (isset($payload['paymentStatus'])) {
            $appt['paymentStatus'] = (string) $payload['paymentStatus'];
        }
        if (isset($payload['paymentMethod'])) {
            $appt['paymentMethod'] = (string) $payload['paymentMethod'];
        }
    }
    unset($appt);
    if (!$found) {
        json_response([
            'ok' => false,
            'error' => 'Cita no encontrada'
        ], 404);
    }
    write_store($store);
    json_response([
        'ok' => true
    ]);
}

if ($method === 'POST' && $resource === 'callbacks') {
    $payload = require_json_body();
    $callback = normalize_callback($payload);

    if ($callback['telefono'] === '') {
        json_response([
            'ok' => false,
            'error' => 'Teléfono obligatorio'
        ], 400);
    }

    $store['callbacks'][] = $callback;
    write_store($store);
    json_response([
        'ok' => true,
        'data' => $callback
    ], 201);
}

if (($method === 'PATCH' || $method === 'PUT') && $resource === 'callbacks') {
    $payload = require_json_body();
    $id = isset($payload['id']) ? (int) $payload['id'] : 0;
    if ($id <= 0) {
        json_response([
            'ok' => false,
            'error' => 'Id inválido'
        ], 400);
    }
    $found = false;
    foreach ($store['callbacks'] as &$callback) {
        if ((int) ($callback['id'] ?? 0) !== $id) {
            continue;
        }
        $found = true;
        if (isset($payload['status'])) {
            $callback['status'] = map_callback_status((string) $payload['status']);
        }
    }
    unset($callback);
    if (!$found) {
        json_response([
            'ok' => false,
            'error' => 'Callback no encontrado'
        ], 404);
    }
    write_store($store);
    json_response([
        'ok' => true
    ]);
}

if ($method === 'POST' && $resource === 'reviews') {
    $payload = require_json_body();
    $review = normalize_review($payload);
    if ($review['name'] === '' || $review['text'] === '') {
        json_response([
            'ok' => false,
            'error' => 'Nombre y reseña son obligatorios'
        ], 400);
    }
    $store['reviews'][] = $review;
    write_store($store);
    json_response([
        'ok' => true,
        'data' => $review
    ], 201);
}

if ($method === 'POST' && $resource === 'availability') {
    $payload = require_json_body();
    $availability = isset($payload['availability']) && is_array($payload['availability'])
        ? $payload['availability']
        : [];
    $store['availability'] = $availability;
    write_store($store);
    json_response([
        'ok' => true,
        'data' => $store['availability']
    ]);
}

if ($method === 'POST' && $resource === 'import') {
    $payload = require_json_body();
    $store['appointments'] = isset($payload['appointments']) && is_array($payload['appointments']) ? $payload['appointments'] : [];
    $store['callbacks'] = isset($payload['callbacks']) && is_array($payload['callbacks']) ? $payload['callbacks'] : [];
    $store['reviews'] = isset($payload['reviews']) && is_array($payload['reviews']) ? $payload['reviews'] : [];
    $store['availability'] = isset($payload['availability']) && is_array($payload['availability']) ? $payload['availability'] : [];
    write_store($store);
    json_response([
        'ok' => true
    ]);
}

json_response([
    'ok' => false,
    'error' => 'Ruta no soportada'
], 404);
