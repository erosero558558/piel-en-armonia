<?php
define('AURORADERM_CRON_BOOTSTRAP_ONLY', true);
require __DIR__ . '/../cron.php';
$result = cron_task_gift_cards_reminders(['days' => 14]);
echo json_encode($result, JSON_PRETTY_PRINT);
