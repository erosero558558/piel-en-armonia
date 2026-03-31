<?php
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['resource'] = 'clinical-photos';
$_GET['caseId'] = 'TEST';
$context = ['isAdmin' => true];

function json_response($data, $code = 200) {
    echo json_encode($data);
    exit;
}

require_once 'controllers/ClinicalHistoryController.php';

ClinicalHistoryController::getClinicalPhotos($context);
