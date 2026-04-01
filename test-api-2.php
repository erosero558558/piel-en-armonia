<?php
require_once __DIR__ . '/controllers/ConsentStatusController.php';

$_SERVER['REQUEST_METHOD'] = 'POST';
$_REQUEST['patient_id'] = 'pat-1234';
$_REQUEST['consent_type'] = 'privacy_policy';
$_REQUEST['version'] = '1.0';
ConsentStatusController::handle(['method' => 'POST']);
