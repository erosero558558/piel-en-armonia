<?php
require_once 'api-lib.php';
echo "Timezone: " . date_default_timezone_get() . "\n";
echo "Local Date: " . local_date('c') . "\n";
echo "Version: " . app_runtime_version() . "\n";
echo "Session Timeout: " . SESSION_TIMEOUT . "\n";
