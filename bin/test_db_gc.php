<?php
require 'api-lib.php';
$now = gmdate('Y-m-d H:i:s');
$cutoffDate = gmdate('Y-m-d H:i:s', strtotime("+14 days"));
$sql = "SELECT * FROM gift_cards WHERE status = 'active' AND balance_cents > 0 AND expires_at IS NOT NULL AND expires_at > ? AND expires_at <= ?";
$res = db_query($sql, [$now, $cutoffDate]);
print_r($res);
