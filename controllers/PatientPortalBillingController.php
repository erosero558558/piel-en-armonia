<?php\n\nrequire_once __DIR__ . '/PatientPortalController.php';\n\nclass PatientPortalBillingController\n{\n    public static function payments(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            self::emit($session);
            return;
        }

        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        $patient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));

        $payments = [];
        $totalPaid = 0.0;
        $lastPaymentDate = null;
        
        $appointments = is_array($snapshot['appointments'] ?? null) ? $snapshot['appointments'] : [];
        
        // Ordenamos las citas de más reciente a más antigua
        usort($appointments, function($a, $b) {
            $d1 = strval($a['date'] ?? '');
            $d2 = strval($b['date'] ?? '');
            return strcmp($d2, $d1);
        });

        foreach ($appointments as $apt) {
            $billing = is_array($apt['billing'] ?? null) ? $apt['billing'] : [];
            $status = (string) ($billing['status'] ?? '');
            $amountPaid = (float) ($billing['amountPaid'] ?? 0);
            $amountDue = (float) ($billing['amountDue'] ?? 0);
            
            if ($status === 'paid' || $status === 'partial' || $status === 'pending') {
                if ($amountPaid <= 0 && $amountDue <= 0) continue;

                $ts = strtotime(strval($apt['date'] ?? 'now'));
                if (!$ts) $ts = time();
                
                $dateLabel = date('d \d\e ', $ts) . ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][intval(date('n',$ts)) - 1] . date(' Y', $ts);
                
                $totalPaid += $amountPaid;
                if ($lastPaymentDate === null && $amountPaid > 0) {
                    $lastPaymentDate = $dateLabel;
                }

                $methodL = (string) ($billing['method'] ?? 'Tarjeta / Efectivo');
                if ($methodL === '') $methodL = 'Tarjeta / Efectivo';

                $receiptUrl = null;
                if ($amountPaid > 0 && !empty($billing['invoiceId'])) {
                    $receiptUrl = '/api.php?resource=patient-portal-document&type=receipt&id=' . rawurlencode((string)$billing['invoiceId']);
                }

                $payments[] = [
                    'id' => (string) ($apt['id'] ?? uniqid()),
                    'dateLabel' => $dateLabel,
                    'serviceName' => (string) ($apt['serviceName'] ?? 'Atencion Dermatologica'),
                    'amountLabel' => sprintf('$%.2f', $amountPaid),
                    'amountDue' => $amountDue,
                    'methodLabel' => $methodL,
                    'status' => $amountDue > 0 ? 'pending' : 'completed',
                    'receipt_url' => $receiptUrl,
                ];
            }
        }

        $totalDue = 0.0;
        foreach ($payments as $p) {
            $totalDue += (float) ($p['amountDue'] ?? 0);
        }

        self::emit([
            'ok' => true,
            'data' => [
                'authenticated' => true,
                'patient' => $patient,
                'summary' => [
                    'totalPaid' => sprintf('$%.2f', $totalPaid),
                    'totalDue'  => $totalDue,          // S42-10: portal-payments.js banner
                    'lastPaymentDate' => $lastPaymentDate,
                    'pendingCount'    => count(array_filter($payments, fn($p) => ($p['amountDue'] ?? 0) > 0)),
                ],
                'payments' => $payments,
                'generatedAt' => local_date('c'),
            ],
        ]);
    }\n\n}\n