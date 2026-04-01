<?php
require_once __DIR__ . '/controllers/ConsentStatusController.php';

echo "GET:\n";
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['patient_id'] = 'pat-1234';
$_GET['consent_type'] = 'privacy_policy';
ConsentStatusController::handle(['method' => 'GET']);
echo "\n\nPOST:\n";
$_SERVER['REQUEST_METHOD'] = 'POST';
$_GET = [];
$_REQUEST['patient_id'] = 'pat-1234';
$_REQUEST['consent_type'] = 'privacy_policy';
$_REQUEST['version'] = 'v1.0.0';
ConsentStatusController::handle(['method' => 'POST']);
echo "\n";
