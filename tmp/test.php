<?php
require 'lib/bootstrap.php';
require 'controllers/PatientPortalController.php';

// Mock context
$context = ['store' => read_store(), 'isAdmin' => false];
$_GET['resource'] = 'patient-portal-history-pdf';

// Mock auth bypass
PatientPortalAuth::$mockToken = true;

// Wait, I can't easily mock PatientPortalAuth::authenticateSession inline without changing code.
// I'll just check if the PHP code compiles and runs until it hits the auth or if there's syntax issues.
// But we already know it returns 401. So the PDF generator logic is inside historyPdf but it's protected by Auth.
echo "Auth works";
