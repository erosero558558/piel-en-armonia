<?php\n\nrequire_once __DIR__ . '/PatientPortalController.php';\n\nclass PatientPortalCarePlanController\n{\n    public static function plan(array $context): void
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
        $nextAppointment = self::findNextAppointment($store, $snapshot, $tenantId);

        self::emit([
            'ok' => true,
            'data' => [
                'authenticated' => true,
                'patient' => $patient,
                'treatmentPlan' => self::buildTreatmentPlanDetail($store, $snapshot, $patient, $nextAppointment, $tenantId),
                'generatedAt' => local_date('c'),
            ],
        ]);
    }\n\n}\n