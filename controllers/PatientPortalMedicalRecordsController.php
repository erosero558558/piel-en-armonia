<?php\n\nrequire_once __DIR__ . '/PatientPortalController.php';\n\nclass PatientPortalMedicalRecordsController\n{\n    public static function history(array $context): void
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
        $consultations = self::buildPortalHistory($store, $snapshot, $patient, $tenantId);

        self::emit([
            'ok' => true,
            'data' => [
                'authenticated' => true,
                'patient' => $patient,
                'downloadToken' => PatientPortalAuth::generateDownloadToken($sessionData),
                'consultations' => $consultations,
                'export' => PatientPortalDocumentController::buildHistoryExportSummary($snapshot, $patient, $consultations),
                'generatedAt' => local_date('c'),
            ],
        ]);
    }\n\n    public static function selfVitals(array $context): void
    {
        $payload = require_json_body();
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
        $patientId = trim((string) ($patient['documentNumber'] ?? ''));
        
        $nextAppointment = self::findNextAppointment($store, $snapshot, $tenantId);
        if (!$nextAppointment) {
            self::emit(['ok' => false, 'error' => 'No tienes una cita activa asignada']);
            return;
        }

        $caseId = '';
        foreach (($store['cases'] ?? $store['patient_cases'] ?? []) as $c) {
            if (($c['patientId'] ?? '') === $patientId && (($c['status'] ?? '') === 'active' || ($c['status'] ?? '') === 'open')) {
                $caseId = $c['id'];
                break;
            }
        }
        if ($caseId === '') {
            self::emit(['ok' => false, 'error' => 'No se encontró un caso activo', 'statusCode' => 404]);
            return;
        }

        $lock = mutate_store(static function (array $store) use ($caseId, $payload) {
            $activeSession = ClinicalHistorySessionRepository::findSessionByCaseId($store, $caseId);
            if ($activeSession === null) {
                $activeSession = ClinicalHistorySessionRepository::defaultSession(['caseId' => $caseId]);
                $saveSession = ClinicalHistorySessionRepository::upsertSession($store, $activeSession);
                $store = $saveSession['store'];
                $activeSession = $saveSession['session'];
            }

            $draft = ClinicalHistorySessionRepository::findDraftBySessionId($store, (string) $activeSession['sessionId']);
            if ($draft === null) {
                $draft = ClinicalHistorySessionRepository::defaultDraft($activeSession, ['caseId' => $caseId]);
            }

            if (!isset($draft['intake']['vitalSigns'])) {
                $draft['intake']['vitalSigns'] = [];
            }

            $vitalsParams = [
                'bloodPressure' => trim((string) ($payload['bloodPressure'] ?? '')),
                'heartRate' => trim((string) ($payload['heartRate'] ?? '')),
                'glucose' => trim((string) ($payload['glucose'] ?? '')),
                'weightKg' => trim((string) ($payload['weightKg'] ?? '')),
            ];

            $newVitals = array_merge($draft['intake']['vitalSigns'], $vitalsParams);
            $newVitals['source'] = 'patient_self_report';
            $newVitals['reportedAt'] = local_date('c');

            $draft['intake']['vitalSigns'] = $newVitals;

            $saveDraft = ClinicalHistorySessionRepository::upsertDraft($store, $draft);
            $store = $saveDraft['store'];

            return ['ok' => true, 'store' => $store, 'storeDirty' => true];
        });

        if (($lock['ok'] ?? false) !== true) {
             self::emit(['ok' => false, 'error' => 'No se pudieron guardar los vitales concurrencia']);
             return;
        }

        self::emit(['ok' => true]);
    }\n\n}\n