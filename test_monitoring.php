<?php
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['resource'] = 'monitoring-config';
$_SERVER['HTTP_HOST'] = 'localhost';
require __DIR__ . '/api.php';
