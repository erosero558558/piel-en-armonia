<?php
require_once __DIR__ . '/lib/storage.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/schema.php'; 
require_once __DIR__ . '/lib.php'; 
require_once __DIR__ . '/payment-lib.php'; 
require_once __DIR__ . '/lib/memberships/MembershipService.php';
require_once __DIR__ . '/lib/CheckoutOrderService.php';

$pdo = get_db_connection(DATA_FILE);
ensure_db_schema();

$svc = new MembershipService();
$svc->issue('email:test@pielarmonia.com', 'gold');

$request = CheckoutOrderService::buildCardIntentRequest([
    'name' => 'Test Patient',
    'email' => 'test@pielarmonia.com',
    'whatsapp' => '593999999999',
    'concept' => 'Consulta dermatologica',
    'amount' => '40.00',
]);

echo "Amount cents: " . $request['order']['amountCents'] . "\n";
