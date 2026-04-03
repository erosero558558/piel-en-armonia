<?php\n\nrequire_once __DIR__ . '/PatientPortalController.php';\n\nclass PatientPortalDashboardController\n{\n    public static function start(array $context): void
    {
        $payload = require_json_body();
        $phone = trim((string) ($payload['phone'] ?? ($payload['whatsapp'] ?? '')));

        $result = PatientPortalAuth::startLogin(
            is_array($context['store'] ?? null) ? $context['store'] : [],
            $phone
        );

        self::emit($result);
    }\n\n    public static function complete(array $context): void
    {
        $payload = require_json_body();
        $phone = trim((string) ($payload['phone'] ?? ($payload['whatsapp'] ?? '')));
        $code = trim((string) ($payload['code'] ?? ($payload['otp'] ?? '')));
        $challengeId = trim((string) ($payload['challengeId'] ?? ''));

        $result = PatientPortalAuth::completeLogin(
            is_array($context['store'] ?? null) ? $context['store'] : [],
            $phone,
            $code,
            $challengeId
        );

        self::emit($result);
    }\n\n    public static function status(array $context): void
    {
        $result = PatientPortalAuth::readStatus(
            is_array($context['store'] ?? null) ? $context['store'] : [],
            PatientPortalAuth::bearerTokenFromRequest()
        );

        self::emit($result);
    }\n\n    public static function dashboard(array $context): void
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
                'nextAppointment' => $nextAppointment === []
                    ? null
                    : self::buildAppointmentSummary($nextAppointment, $patient),
                'treatmentPlan' => self::buildTreatmentPlanSummary($store, $snapshot, $patient, $nextAppointment, $tenantId),
                'billing' => self::buildBillingSummary($store, $snapshot, $tenantId),
                'evolution' => self::buildEvolutionSummary($store, $snapshot, $tenantId),
                'alerts' => self::buildPatientRedFlags($store, $snapshot, $tenantId),
                'pendingSurvey' => self::findPendingSurvey($store, $snapshot, $patient, $tenantId),
                'support' => [
                    'bookingUrl' => app_api_relative_url('appointments'),
                    'historyUrl' => app_api_relative_url('patient-portal-history'),
                    'planUrl' => app_api_relative_url('patient-portal-plan'),
                    'prescriptionUrl' => app_api_relative_url('patient-portal-prescription'),
                    'photosUrl' => app_api_relative_url('patient-portal-photos'),
                    'whatsappUrl' => self::buildSupportWhatsappUrl($patient, $nextAppointment),
                ],
                'generatedAt' => local_date('c'),
            ],
        ]);
    }\n\n    public static function getPushPreferences(array $context): void
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

        require_once __DIR__ . '/../lib/PushPreferencesService.php';
        
        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $patient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $patientId = trim((string) ($patient['patientId'] ?? ''));

        $service = new PushPreferencesService();
        $preferences = $service->getPreferences($patientId);

        self::emit([
            'ok' => true,
            'data' => [
                'preferences' => $preferences
            ]
        ]);
    }\n\n    public static function setPushPreferences(array $context): void
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

        require_once __DIR__ . '/../lib/PushPreferencesService.php';

        $payload = require_json_body();
        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $patient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $patientId = trim((string) ($patient['patientId'] ?? ''));

        $service = new PushPreferencesService();
        if (!$service->setPreferences($patientId, $payload)) {
            json_response([
                'ok' => false,
                'error' => 'No se pudieron guardar las preferencias'
            ], 500);
        }

        self::emit([
            'ok' => true,
            'data' => [
                'preferences' => $service->getPreferences($patientId)
            ]
        ]);
    }\n\n    public static function submitSurvey(array $context): void
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
        $patient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $patientId = trim((string) ($patient['documentNumber'] ?? ''));

        $appointmentId = (int) ($payload['appointmentId'] ?? 0);
        $rating = (int) ($payload['rating'] ?? 0);
        $text = trim((string) ($payload['text'] ?? ''));

        if ($appointmentId <= 0 || $rating < 1 || $rating > 5) {
            self::emit(['ok' => false, 'error' => 'Datos de encuesta inválidos']);
            return;
        }

        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        $appointments = is_array($snapshot['appointments'] ?? null) ? $snapshot['appointments'] : [];
        $validAppointment = null;

        foreach ($appointments as $apt) {
            if (isset($apt['id']) && (int) $apt['id'] === $appointmentId) {
                $validAppointment = $apt;
                break;
            }
        }

        if (!$validAppointment || trim((string) ($validAppointment['patientId'] ?? '')) !== $patientId) {
            self::emit(['ok' => false, 'error' => 'Cita no encontrada o no autorizada']);
            return;
        }

        $mutation = mutate_store(static function (array $store) use ($appointmentId, $patientId, $validAppointment, $rating, $text, $patient) {
            $surveys = is_array($store['nps_surveys'] ?? null) ? $store['nps_surveys'] : [];
            foreach ($surveys as $survey) {
                if (isset($survey['appointmentId']) && (int) $survey['appointmentId'] === $appointmentId) {
                    return ['ok' => false, 'error' => 'Esta cita ya fue evaluada'];
                }
            }

            $store['nps_surveys'][] = normalize_nps_survey([
                'appointmentId' => $appointmentId,
                'patientId' => $patientId,
                'doctor' => $validAppointment['doctor'] ?? '',
                'rating' => $rating,
                'text' => $text,
                'name' => $patient['fullName'] ?? 'Anónimo',
            ]);

            return ['ok' => true, 'store' => $store, 'storeDirty' => true];
        });

        if (($mutation['ok'] ?? false) === true) {
            self::emit(['ok' => true]);
        } else {
            self::emit(['ok' => false, 'error' => $mutation['error'] ?? 'No se pudo guardar la encuesta']);
        }
    }\n\n    public static function summary(array $context): void
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
        $treatmentPlan = self::buildTreatmentPlanSummary($store, $snapshot, $patient, $nextAppointment, $tenantId);
        $alerts = self::buildPatientRedFlags($store, $snapshot, $tenantId);

        $activeDiagnosis = null;
        if (is_array($treatmentPlan) && isset($treatmentPlan['diagnosis'])) {
            $activeDiagnosis = $treatmentPlan['diagnosis'];
        }

        $prescription = self::buildActivePrescriptionSummary($store, $snapshot, $tenantId);
        $pendingDocs = 0;
        if (is_array($prescription) && ($prescription['hasActive'] ?? false) === true) {
            $pendingDocs++;
        }

        $consultations = self::buildPortalHistory($store, $snapshot, $patient, $tenantId);
        $lastVisit = null;
        if (count($consultations) > 0) {
            $lastVisit = $consultations[0]['dateLabel'] ?? null;
        }

        self::emit([
            'ok' => true,
            'data' => [
                'authenticated' => true,
                'patient' => $patient,
                'summary' => [
                    'upcomingAppointment' => $nextAppointment === [] ? null : self::buildAppointmentSummary($nextAppointment, $patient),
                    'activeDiagnosis' => $activeDiagnosis,
                    'pendingDocs' => $pendingDocs,
                    'lastVisit' => $lastVisit,
                    'alertCount' => is_array($alerts) ? count($alerts) : 0,
                ],
                'generatedAt' => local_date('c'),
            ],
        ]);
    }\n\n}\n