<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/openclaw/AIRouter.php';
require_once __DIR__ . '/../lib/DoctorProfileStore.php';
require_once __DIR__ . '/../lib/ClinicProfileStore.php';

/**
 * OpenclawController — Copiloto clínico de Aurora Derm
 *
 * Endpoints consumidos por:
 *   - js/openclaw-chat.js  (interfaz de consulta embebida en admin)
 *   - openapi-openclaw.yaml (Custom GPT Actions de ChatGPT)
 *
 * Todos los endpoints requieren sesión de médico autenticado (admin).
 * El contexto del paciente viene del store de Flow OS.
 */
final class OpenclawController
{
    // ── patient ──────────────────────────────────────────────────────────────

    /**
     * GET /api.php?resource=openclaw-patient&patient_id=X&case_id=Y
     * Carga el contexto completo del paciente para alimentar la IA.
     * Este es el dato que diferencia a OpenClaw de ChatGPT solo.
     */
    public static function patient(array $context): void
    {
        self::requireAuth();

        $patientId = trim((string) ($_GET['patient_id'] ?? ''));
        $caseId    = trim((string) ($_GET['case_id'] ?? ''));

        if ($patientId === '') {
            json_response(['ok' => false, 'error' => 'patient_id requerido'], 400);
        }

        require_once __DIR__ . '/../lib/PatientCaseService.php';
        $service = new PatientCaseService();
        $store   = self::readStore();

        // Obtener caso activo o por ID
        $case = null;
        if ($caseId !== '') {
            $case = $service->getCaseById($store, $caseId);
        } else {
            $case = $service->getActiveCaseByPatient($store, $patientId);
        }

        if ($case === null) {
            json_response(['ok' => false, 'error' => 'Caso no encontrado'], 404);
        }

        require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';
        $chService = new ClinicalHistoryService();

        // Historial clínico
        $history = $chService->getPatientHistory($store, $patientId);

        // Último diagnóstico
        $lastDx = null;
        foreach (array_reverse($history['episodes'] ?? []) as $ep) {
            if (!empty($ep['cie10_code'])) {
                $lastDx = [
                    'code'        => $ep['cie10_code'],
                    'description' => $ep['cie10_description'] ?? '',
                    'date'        => $ep['date'] ?? '',
                    'doctor'      => $ep['doctor'] ?? '',
                ];
                break;
            }
        }

        // Medicamentos activos (última receta activa)
        $medications = [];
        foreach (array_reverse($history['prescriptions'] ?? []) as $rx) {
            if (($rx['status'] ?? '') === 'active') {
                $medications = $rx['medications'] ?? [];
                break;
            }
        }

        // Alergias del paciente
        $allergies = $history['allergies'] ?? [];

        // Resumen IA de últimas 3 visitas (si existe)
        $lastVisitSummary = $history['ai_summary'] ?? null;

        // Últimas 5 visitas para el contexto
        $visits = array_map(static function (array $ep): array {
            return [
                'date'   => $ep['date'] ?? '',
                'reason' => $ep['reason'] ?? $ep['cie10_description'] ?? 'Consulta',
                'doctor' => $ep['doctor'] ?? '',
            ];
        }, array_slice(array_reverse($history['episodes'] ?? []), 0, 5));

        json_response([
            'ok' => true,
            'patient_id'       => $patientId,
            'case_id'          => $case['id'] ?? $caseId,
            'name'             => trim(($case['firstName'] ?? '') . ' ' . ($case['lastName'] ?? '')),
            'age'              => self::calculateAge($case['birthDate'] ?? ''),
            'sex'              => $case['sex'] ?? '',
            'phone'            => $case['phone'] ?? '',
            'allergies'        => $allergies,
            'medications_active' => $medications,
            'diagnoses_history'  => array_slice(array_filter(
                array_map(static fn($ep) => isset($ep['cie10_code']) ? [
                    'cie10_code'         => $ep['cie10_code'],
                    'cie10_description'  => $ep['cie10_description'] ?? '',
                    'date'               => $ep['date'] ?? '',
                    'doctor'             => $ep['doctor'] ?? '',
                ] : null, array_reverse($history['episodes'] ?? []))
            ), 0, 10),
            'last_dx'            => $lastDx,
            'last_evolution'     => $history['last_evolution'] ?? '',
            'last_visit_date'    => $visits[0]['date'] ?? '',
            'visit_count'        => count($history['episodes'] ?? []),
            'photos_available'   => !empty($history['photos']),
            'ai_summary'         => $lastVisitSummary,
        ]);
    }

    // ── cie10Suggest ──────────────────────────────────────────────────────────

    /**
     * GET /api.php?resource=openclaw-cie10-suggest&q=dermatitis+atopica
     * Búsqueda rápida en el catálogo CIE-10 local.
     * Latencia objetivo: <50ms (es solo búsqueda en JSON).
     */
    public static function cie10Suggest(array $context): void
    {
        self::requireAuth();

        $q = strtolower(trim((string) ($_GET['q'] ?? '')));
        if (strlen($q) < 2) {
            json_response(['ok' => true, 'suggestions' => []]);
        }

        $cie10Path = __DIR__ . '/../data/cie10.json';
        if (!file_exists($cie10Path)) {
            json_response(['ok' => false, 'error' => 'Catálogo CIE-10 no disponible'], 503);
        }

        $data  = json_decode((string) file_get_contents($cie10Path), true) ?? [];
        $codes = $data['codes'] ?? [];

        $suggestions = [];
        $qWords      = explode(' ', $q);

        foreach ($codes as $code => $info) {
            $description = strtolower((string) ($info['d'] ?? ''));
            $category    = strtolower((string) ($info['c'] ?? ''));
            $codeL       = strtolower($code);

            $score = 0;

            // Exact code match
            if ($codeL === $q || str_starts_with($codeL, $q)) {
                $score += 100;
            }

            // All words present in description
            $allFound = true;
            foreach ($qWords as $word) {
                if (!str_contains($description, $word) && !str_contains($category, $word)) {
                    $allFound = false;
                    break;
                }
            }
            if ($allFound && count($qWords) > 1) {
                $score += 80;
            }

            // Partial word match
            foreach ($qWords as $word) {
                if (str_contains($description, $word)) {
                    $score += 20;
                }
                if (str_contains($category, $word)) {
                    $score += 10;
                }
            }

            if ($score > 0) {
                $suggestions[] = [
                    'code'        => $code,
                    'description' => $info['d'],
                    'category'    => $info['c'],
                    'confidence'  => min(1.0, round($score / 100, 2)),
                ];
            }
        }

        // Sort by confidence DESC
        usort($suggestions, static fn($a, $b) => $b['confidence'] <=> $a['confidence']);

        json_response([
            'ok'          => true,
            'suggestions' => array_slice($suggestions, 0, 8),
        ]);
    }

    // ── protocol ─────────────────────────────────────────────────────────────

    /**
     * GET /api.php?resource=openclaw-protocol&code=L20.0
     * Devuelve el protocolo de tratamiento estándar para un diagnóstico CIE-10.
     * Los protocolos se pueden extender en data/protocols/{code}.json
     */
    public static function protocol(array $context): void
    {
        self::requireAuth();

        $code = strtoupper(trim((string) ($_GET['code'] ?? '')));
        if ($code === '') {
            json_response(['ok' => false, 'error' => 'code requerido'], 400);
        }

        // Buscar protocolo específico
        $protocolPath = __DIR__ . '/../data/protocols/' . preg_replace('/[^A-Z0-9.]/', '', $code) . '.json';
        if (file_exists($protocolPath)) {
            $protocol = json_decode((string) file_get_contents($protocolPath), true) ?? [];
            json_response(['ok' => true] + $protocol);
        }

        // Protocolo genérico por categoría CIE-10
        $generic = self::genericProtocol($code);
        json_response(['ok' => true] + $generic);
    }

    // ── chat ─────────────────────────────────────────────────────────────────

    /**
     * POST /api.php?resource=openclaw-chat
     * Proxy al AI Router — Tier 1 (Codex OAuth) → Tier 2 (OpenRouter free) → Tier 3 (local)
     * Streaming support: si ?stream=1, devuelve SSE.
     */
    public static function chat(array $context): void
    {
        self::requireAuth();

        $payload = require_json_body();

        require_once __DIR__ . '/../lib/openclaw/AIRouter.php';
        $router = new OpenclawAIRouter();
        $result = $router->route($payload);

        if (!$result['ok']) {
            json_response([
                'ok'    => false,
                'error' => $result['error'] ?? 'Router error',
                'mode'  => 'failed',
            ], 503);
        }

        $response = [
            'ok'           => true,
            'choices'      => $result['choices'],
            'provider'     => $result['provider_used'] ?? 'unknown',
            'tier'         => $result['provider_tier'] ?? 'unknown',
        ];

        if (!empty($result['degraded_mode'])) {
            $response['degraded']        = true;
            $response['degraded_notice'] = $result['degraded_notice'];
            $response['offline_badge']   = $result['offline_badge'] ?? '';
            $response['offline_mode']    = $result['offline_mode'] ?? 'local_heuristic';
        }

        json_response($response);
    }

    // ── saveDiagnosis ─────────────────────────────────────────────────────────

    public static function saveDiagnosis(array $context): void
    {
        self::requireAuth();
        $payload = require_json_body();

        $caseId      = trim((string) ($payload['case_id'] ?? ''));
        $cie10Code   = trim((string) ($payload['cie10_code'] ?? ''));
        $cie10Desc   = trim((string) ($payload['cie10_description'] ?? ''));

        if ($caseId === '' || $cie10Code === '') {
            json_response(['ok' => false, 'error' => 'case_id y cie10_code requeridos'], 400);
        }

        require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';
        $service = new ClinicalHistoryService();
        $result  = self::mutateStore(static function (array $store) use ($service, $caseId, $cie10Code, $cie10Desc, $payload): array {
            return $service->saveDiagnosis($store, [
                'caseId'            => $caseId,
                'cie10Code'         => $cie10Code,
                'cie10Description'  => $cie10Desc,
                'notes'             => $payload['notes'] ?? '',
                'source'            => 'openclaw',
            ]);
        });

        json_response(['ok' => true, 'saved' => true, 'data' => $result]);
    }

    // ── saveEvolution ─────────────────────────────────────────────────────────

    public static function saveEvolution(array $context): void
    {
        self::requireAuth();
        $payload = require_json_body();

        $caseId = trim((string) ($payload['case_id'] ?? ''));
        $text   = trim((string) ($payload['text'] ?? ''));

        if ($caseId === '' || $text === '') {
            json_response(['ok' => false, 'error' => 'case_id y texto requeridos'], 400);
        }

        require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';
        $service = new ClinicalHistoryService();
        $doctorProfile = doctor_profile_document_fields([
            'name' => trim((string) ($payload['doctor_name'] ?? ($_SESSION['admin_email'] ?? ''))),
        ]);

        $result  = self::mutateStore(static function (array $store) use ($service, $caseId, $text, $payload, $doctorProfile): array {
            return $service->saveEvolutionNote($store, [
                'caseId'    => $caseId,
                'text'      => $text,
                'cie10Code' => $payload['cie10_code'] ?? '',
                'doctorId'  => $payload['doctor_id'] ?? ($doctorProfile['name'] ?? ''),
                'doctorName' => $doctorProfile['name'] ?? '',
                'doctorSpecialty' => $doctorProfile['specialty'] ?? '',
                'doctorMsp' => $doctorProfile['msp'] ?? '',
                'source'    => 'openclaw',
            ]);
        });

        json_response(['ok' => true, 'id' => $result['id'] ?? '', 'saved_at' => gmdate('c')]);
    }

    // ── savePrescription ─────────────────────────────────────────────────────

    public static function savePrescription(array $context): void
    {
        self::requireAuth();
        $payload = require_json_body();

        $caseId      = trim((string) ($payload['case_id'] ?? ''));
        $medications = $payload['medications'] ?? [];

        if ($caseId === '' || empty($medications)) {
            json_response(['ok' => false, 'error' => 'case_id y medications requeridos'], 400);
        }

        require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryRepository.php';
        require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';
        $service = new ClinicalHistoryService();
        $rxId    = 'rx-' . bin2hex(random_bytes(8));
        $doctorProfile = doctor_profile_document_fields([
            'name' => trim((string) ($_SESSION['admin_email'] ?? '')),
        ]);

        $result = self::mutateStore(static function (array $store) use ($service, $caseId, $medications, $rxId, $doctorProfile): array {
            $session = ClinicalHistoryRepository::findSessionByCaseId($store, $caseId);
            if ($session === null) {
                return [
                    'ok' => false,
                    'store' => $store,
                    'storeDirty' => false,
                    'statusCode' => 404,
                    'error' => 'Sesion clinica no encontrada',
                ];
            }

            $draft = ClinicalHistoryRepository::findDraftBySessionId(
                $store,
                (string) ($session['sessionId'] ?? '')
            );
            $existingItems = ClinicalHistoryRepository::normalizePrescriptionItems(
                $draft['clinicianDraft']['hcu005']['prescriptionItems']
                    ?? $draft['documents']['prescription']['items']
                    ?? []
            );
            $incomingItems = self::normalizePrescriptionItemsPayload($medications);
            $mergedItems = array_values(array_filter(array_merge($existingItems, $incomingItems), static function (array $item): bool {
                return ClinicalHistoryRepository::prescriptionItemIsStarted($item);
            }));

            $actionResult = $service->episodeAction($store, [
                'action' => 'issue_prescription',
                'caseId' => $caseId,
                'draft' => [
                    'clinicianDraft' => [
                        'hcu005' => [
                            'prescriptionItems' => $mergedItems,
                        ],
                    ],
                ],
                'requiresHumanReview' => false,
            ]);

            if (($actionResult['ok'] ?? false) !== true || !isset($actionResult['store']) || !is_array($actionResult['store'])) {
                return [
                    'ok' => false,
                    'store' => $store,
                    'storeDirty' => false,
                    'statusCode' => (int) ($actionResult['statusCode'] ?? 500),
                    'error' => (string) ($actionResult['error'] ?? 'No se pudo guardar la receta'),
                ];
            }

            $newStore = $actionResult['store'];
            if (!isset($newStore['prescriptions'])) {
                $newStore['prescriptions'] = [];
            }
            $newStore['prescriptions'][$rxId] = [
                'id' => $rxId,
                'caseId' => $caseId,
                'medications' => $incomingItems,
                'issued_at' => gmdate('c'),
                'issued_by' => $doctorProfile['name'] ?? 'medico',
                'doctor' => $doctorProfile,
            ];

            return [
                'ok' => true,
                'store' => $newStore,
                'storeDirty' => true,
                'prescriptionItems' => $mergedItems,
            ];
        });

        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo guardar la receta'),
            ], (int) ($result['statusCode'] ?? 500));
        }

        $pdfUrl      = '/api.php?resource=openclaw-prescription&id=' . $rxId . '&format=pdf';
        $patientCtx  = self::readStore()['patients'][$caseId] ?? [];
        $phone       = $patientCtx['phone'] ?? '';
        $clinicProfile = read_clinic_profile();
        $clinicName  = $clinicProfile['clinicName'] ?? 'la clínica';
        $waMsg       = urlencode("Su receta médica de {$clinicName} está lista. Para descargarla visite el siguiente enlace o contacte a la clínica.");
        $waUrl       = $phone !== '' ? 'https://wa.me/' . preg_replace('/[^0-9]/', '', $phone) . '?text=' . $waMsg : '';

        json_response([
            'ok'              => true,
            'prescription_id' => $rxId,
            'pdf_url'         => $pdfUrl,
            'whatsapp_url'    => $waUrl,
        ]);
    }

    // ── getPrescriptionPdf ────────────────────────────────────────────────────

    public static function getPrescriptionPdf(array $context): void
    {
        $rxId = trim((string) ($_GET['id'] ?? ''));
        if ($rxId === '') {
            json_response(['ok' => false, 'error' => 'id requerido'], 400);
        }

        $store = self::readStore();
        $prescription = $store['prescriptions'][$rxId] ?? null;

        if ($prescription === null) {
            json_response(['ok' => false, 'error' => 'Receta no encontrada'], 404);
        }

        $caseId = $prescription['caseId'] ?? '';
        $patient = $store['patients'][$caseId] ?? [];
        require_once __DIR__ . '/../lib/openclaw/PrescriptionPdfRenderer.php';
        $clinicProfile = read_clinic_profile();
        $pdfBytes = PrescriptionPdfRenderer::generatePdfBytes($prescription, $patient, $clinicProfile);

        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="receta-' . $rxId . '.pdf"');
        echo $pdfBytes;
        exit;
    }

    // ── generateCertificate ───────────────────────────────────────────────────

    public static function generateCertificate(array $context): void
    {
        self::requireAuth();
        $payload = require_json_body();

        $caseId = trim((string) ($payload['case_id'] ?? ''));
        $type   = trim((string) ($payload['type'] ?? 'reposo_laboral'));

        if ($caseId === '') {
            json_response(['ok' => false, 'error' => 'case_id requerido'], 400);
        }

        $certId = 'cert-' . bin2hex(random_bytes(8));
        $folio  = 'AD-' . date('Y') . '-' . strtoupper(substr($certId, 5, 6));
        $doctorProfile = doctor_profile_document_fields([
            'name' => trim((string) ($_SESSION['admin_email'] ?? '')),
        ]);

        // Store certificate data for PDF generation
        $certData = [
            'id'                => $certId,
            'folio'             => $folio,
            'caseId'            => $caseId,
            'type'              => $type,
            'rest_days'         => (int) ($payload['rest_days'] ?? 0),
            'diagnosis_text'    => $payload['diagnosis_text'] ?? '',
            'cie10_code'        => $payload['cie10_code'] ?? '',
            'restrictions'      => $payload['restrictions'] ?? '',
            'observations'      => $payload['observations'] ?? '',
            'issued_at'         => gmdate('c'),
            'issued_by'         => $doctorProfile['name'] ?? 'medico',
            'doctor'            => $doctorProfile,
        ];

        self::mutateStore(static function (array $store) use ($certId, $certData): array {
            if (!isset($store['certificates'])) $store['certificates'] = [];
            $store['certificates'][$certId] = $certData;
            return ['ok' => true, 'store' => $store, 'storeDirty' => true];
        });

        $pdfUrl  = '/api.php?resource=openclaw-certificate&id=' . $certId . '&format=pdf';
        $store   = self::readStore();
        $patient = $store['patients'][$caseId] ?? [];
        $phone   = $patient['phone'] ?? '';
        $clinicName = read_clinic_profile()['clinicName'];
        $waMsg   = urlencode("Su certificado médico de {$clinicName} está listo. Folio: {$folio}. " . (($type === 'reposo_laboral') ? "Días de reposo: {$certData['rest_days']}." : ''));
        $waUrl   = $phone !== '' ? 'https://wa.me/' . preg_replace('/[^0-9]/', '', $phone) . '?text=' . $waMsg : '';

        json_response([
            'ok'             => true,
            'certificate_id' => $certId,
            'folio'          => $folio,
            'pdf_url'        => $pdfUrl,
            'whatsapp_url'   => $waUrl,
        ]);
    }

    public static function getCertificatePdf(array $context): void
    {
        self::requireAuth();

        $certId = trim((string) ($_GET['id'] ?? ''));
        if ($certId === '') {
            json_response(['ok' => false, 'error' => 'id requerido'], 400);
        }

        $store = self::readStore();
        $certificate = $store['certificates'][$certId] ?? null;
        if (!is_array($certificate)) {
            json_response(['ok' => false, 'error' => 'Certificado no encontrado'], 404);
        }

        $caseId = trim((string) ($certificate['caseId'] ?? ''));
        $patient = [];
        if ($caseId !== '' && isset($store['patients'][$caseId]) && is_array($store['patients'][$caseId])) {
            $patient = $store['patients'][$caseId];
        }

        $html = self::buildCertificatePdfHtml($certificate, $patient);
        $pdfPath = __DIR__ . '/../vendor/dompdf/dompdf/src/Dompdf.php';
        if (file_exists($pdfPath)) {
            require_once $pdfPath;
            $dompdf = new \Dompdf\Dompdf(['isHtml5ParserEnabled' => true, 'isRemoteEnabled' => true]);
            $dompdf->loadHtml($html, 'UTF-8');
            $dompdf->setPaper('A4', 'portrait');
            $dompdf->render();
            $pdfBytes = $dompdf->output();
        } else {
            $pdfBytes = self::buildFallbackPdf($html);
        }

        $fileName = preg_replace('/[^a-zA-Z0-9_-]/', '-', (string) ($certificate['folio'] ?? $certId));
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="certificado-' . $fileName . '.pdf"');
        echo $pdfBytes;
        exit;
    }

    // ── checkInteractions ────────────────────────────────────────────────────

    public static function checkInteractions(array $context): void
    {
        self::requireAuth();
        $payload = require_json_body();

        $caseId = trim((string) ($payload['case_id'] ?? $payload['caseId'] ?? ''));
        $proposed = self::normalizeMedicationNameList($payload['proposed_medications'] ?? []);

        if ($caseId === '' || $proposed === []) {
            json_response(['ok' => false, 'error' => 'case_id y proposed_medications requeridos'], 400);
        }

        $active = self::normalizeMedicationNameList($payload['active_medications'] ?? []);
        if ($active === []) {
            $active = self::resolveActiveMedicationsForCase($caseId);
        }

        // Load interactions DB
        $dbPath = __DIR__ . '/../data/drug-interactions.json';
        if (!file_exists($dbPath)) {
            json_response([
                'ok' => true,
                'has_interactions' => false,
                'active_medications' => $active,
                'interactions' => [],
            ]);
        }

        $db           = json_decode((string) file_get_contents($dbPath), true) ?? [];
        $interactions = [];

        foreach ($db['pairs'] ?? [] as $pair) {
            $pairA = self::normalizeMedicationKey((string) ($pair['drug_a'] ?? ''));
            $pairB = self::normalizeMedicationKey((string) ($pair['drug_b'] ?? ''));
            if ($pairA === '' || $pairB === '') {
                continue;
            }

            foreach ($proposed as $proposedMedication) {
                $proposedKey = self::normalizeMedicationKey($proposedMedication);
                if ($proposedKey === '') {
                    continue;
                }

                $proposedMatchesA = self::medicationMatchesInteraction($proposedKey, $pairA);
                $proposedMatchesB = self::medicationMatchesInteraction($proposedKey, $pairB);
                if (!$proposedMatchesA && !$proposedMatchesB) {
                    continue;
                }

                foreach ($active as $activeMedication) {
                    $activeKey = self::normalizeMedicationKey($activeMedication);
                    if ($activeKey === '') {
                        continue;
                    }

                    $activeMatchesA = self::medicationMatchesInteraction($activeKey, $pairA);
                    $activeMatchesB = self::medicationMatchesInteraction($activeKey, $pairB);

                    $isPairMatch =
                        ($proposedMatchesA && $activeMatchesB) ||
                        ($proposedMatchesB && $activeMatchesA);

                    if ($isPairMatch) {
                        $interactions[] = [
                            'drug_a' => (string) ($pair['drug_a'] ?? ''),
                            'drug_b' => (string) ($pair['drug_b'] ?? ''),
                            'severity' => (string) ($pair['severity'] ?? 'medium'),
                            'description' => (string) ($pair['description'] ?? ''),
                            'proposed_medication' => $proposedMedication,
                            'active_medication' => $activeMedication,
                        ];
                    }
                }
            }
        }

        $interactions = array_values(array_unique($interactions, SORT_REGULAR));

        json_response([
            'ok'               => true,
            'has_interactions' => count($interactions) > 0,
            'active_medications' => $active,
            'interactions'     => $interactions,
        ]);
    }

    // ── summarizeSession ─────────────────────────────────────────────────────

    public static function summarizeSession(array $context): void
    {
        self::requireAuth();
        $payload     = require_json_body();
        $chatSummary = trim((string) ($payload['chat_summary'] ?? ''));
        $caseId      = trim((string) ($payload['case_id'] ?? ''));

        if ($chatSummary === '') {
            json_response(['ok' => false, 'error' => 'chat_summary requerido'], 400);
        }

        // Ask the AI router to generate a structured summary
        $router  = new OpenclawAIRouter();
        $aiResult = $router->route([
            'messages' => [
                [
                    'role'    => 'system',
                    'content' => 'Eres un asistente médico. Genera un resumen estructurado de la consulta. Responde SOLO con JSON válido con estas claves: evolution_text (nota clínica narrativa), patient_summary (resumen en lenguaje simple para el paciente), pending_actions (array de strings con tareas pendientes).',
                ],
                [
                    'role'    => 'user',
                    'content' => "Resumen de la consulta:\n{$chatSummary}\n\nGenera el JSON de cierre.",
                ],
            ],
            'max_tokens'  => 800,
            'temperature' => 0.2,
        ]);

        $evolutionText    = '';
        $patientSummary   = '';
        $pendingActions   = [];

        if ($aiResult['ok'] && isset($aiResult['choices'][0]['message']['content'])) {
            $raw = trim((string) $aiResult['choices'][0]['message']['content']);
            // Extract JSON if wrapped in markdown
            if (preg_match('/```(?:json)?\s*(\{.*?\})\s*```/s', $raw, $m)) {
                $raw = $m[1];
            }
            $parsed = @json_decode($raw, true);
            if (is_array($parsed)) {
                $evolutionText  = (string) ($parsed['evolution_text'] ?? '');
                $patientSummary = (string) ($parsed['patient_summary'] ?? '');
                $pendingActions = (array) ($parsed['pending_actions'] ?? []);
            }
        }

        // Fallback if AI couldn't parse
        if ($evolutionText === '') {
            $evolutionText = "Consulta realizada. {$chatSummary}";
        }

        json_response([
            'ok'              => true,
            'evolution_text'  => $evolutionText,
            'patient_summary' => $patientSummary,
            'pending_actions' => $pendingActions,
        ]);
    }

    // ── routerStatus ─────────────────────────────────────────────────────────

    public static function routerStatus(array $context): void
    {
        self::requireAuth();
        $router = new OpenclawAIRouter();
        json_response(['ok' => true, 'router' => $router->getStatus()]);
    }

    // ── Utilities ─────────────────────────────────────────────────────────────

    private static function requireAuth(): void
    {
        require_admin_auth();
    }

    private static function buildCertificatePdfHtml(array $certificate, array $patient): string
    {
        $issuedDate = (new DateTimeImmutable('now', new DateTimeZone('America/Guayaquil')))->format('d/m/Y H:i');
        $issuedAt = trim((string) ($certificate['issued_at'] ?? ''));
        if ($issuedAt !== '') {
            try {
                $issuedDate = (new DateTimeImmutable($issuedAt))
                    ->setTimezone(new DateTimeZone('America/Guayaquil'))
                    ->format('d/m/Y H:i');
            } catch (\Throwable $e) {
            }
        }

        $patientName = trim((string) ($patient['name'] ?? (($patient['firstName'] ?? '') . ' ' . ($patient['lastName'] ?? ''))));
        if ($patientName === '') {
            $patientName = 'Paciente';
        }

        $patientId = trim((string) ($patient['ci'] ?? $patient['identification'] ?? ''));
        $typeLabels = [
            'reposo_laboral' => 'Certificado de reposo',
            'aptitud_medica' => 'Certificado de aptitud medica',
            'constancia_tratamiento' => 'Constancia de tratamiento',
            'control_salud' => 'Constancia de control de salud',
            'incapacidad_temporal' => 'Certificado de incapacidad temporal',
        ];
        $type = trim((string) ($certificate['type'] ?? ''));
        $typeLabel = $typeLabels[$type] ?? 'Certificado medico';
        $diagnosis = trim((string) ($certificate['diagnosis_text'] ?? ''));
        $cie10 = trim((string) ($certificate['cie10_code'] ?? ''));
        $restDays = (int) ($certificate['rest_days'] ?? 0);
        $restrictions = trim((string) ($certificate['restrictions'] ?? ''));
        $observations = trim((string) ($certificate['observations'] ?? ''));
        $doctorData = doctor_profile_document_fields(
            isset($certificate['doctor']) && is_array($certificate['doctor'])
                ? $certificate['doctor']
                : ['name' => (string) ($certificate['issued_by'] ?? 'Medico tratante')]
        );
        $doctor = trim((string) ($doctorData['name'] ?? 'Medico tratante'));
        $doctorSpecialty = trim((string) ($doctorData['specialty'] ?? ''));
        $doctorMsp = trim((string) ($doctorData['msp'] ?? ''));
        $doctorSignatureImage = trim((string) ($doctorData['signatureImage'] ?? ''));
        $folio = trim((string) ($certificate['folio'] ?? $certificate['id'] ?? ''));

        $details = [];
        if ($diagnosis !== '') {
            $details[] = '<p><strong>Diagnostico:</strong> ' . htmlspecialchars($diagnosis, ENT_QUOTES, 'UTF-8') . '</p>';
        }
        if ($cie10 !== '') {
            $details[] = '<p><strong>CIE-10:</strong> ' . htmlspecialchars($cie10, ENT_QUOTES, 'UTF-8') . '</p>';
        }
        if ($restDays > 0) {
            $details[] = '<p><strong>Dias de reposo:</strong> ' . $restDays . '</p>';
        }
        if ($restrictions !== '') {
            $details[] = '<p><strong>Restricciones:</strong> ' . htmlspecialchars($restrictions, ENT_QUOTES, 'UTF-8') . '</p>';
        }
        if ($observations !== '') {
            $details[] = '<p><strong>Observaciones:</strong> ' . htmlspecialchars($observations, ENT_QUOTES, 'UTF-8') . '</p>';
        }

        $patientIdHtml = $patientId !== ''
            ? '<p><strong>Identificacion:</strong> ' . htmlspecialchars($patientId, ENT_QUOTES, 'UTF-8') . '</p>'
            : '';
        $signatureHtml = $doctorSignatureImage !== ''
            ? '<img src="' . htmlspecialchars($doctorSignatureImage, ENT_QUOTES, 'UTF-8') . '" alt="Firma digital del medico" style="max-width: 220px; max-height: 80px; display: block; margin-bottom: 10px; object-fit: contain;">'
            : '';
        $clinicName = read_clinic_profile()['clinicName'];
        $doctorSubtitle = $doctorSpecialty !== ''
            ? htmlspecialchars($doctorSpecialty, ENT_QUOTES, 'UTF-8')
            : 'Flow OS - Copiloto Clinico ' . htmlspecialchars($clinicName, ENT_QUOTES, 'UTF-8');
        $doctorMspHtml = $doctorMsp !== ''
            ? '<p>Registro MSP: ' . htmlspecialchars($doctorMsp, ENT_QUOTES, 'UTF-8') . '</p>'
            : '';

        return "<!DOCTYPE html>
<html lang=\"es\">
<head>
  <meta charset=\"utf-8\">
  <title>Certificado medico {$folio}</title>
  <style>
    body { font-family: DejaVu Sans, Arial, sans-serif; color: #1f2937; margin: 32px; line-height: 1.5; }
    h1 { font-size: 22px; margin-bottom: 8px; }
    .meta { color: #4b5563; margin-bottom: 24px; }
    .card { border: 1px solid #d1d5db; border-radius: 10px; padding: 20px; }
    .signature { margin-top: 48px; }
  </style>
</head>
<body>
  <h1>" . htmlspecialchars($typeLabel, ENT_QUOTES, 'UTF-8') . "</h1>
  <div class=\"meta\">
    <div><strong>Folio:</strong> " . htmlspecialchars($folio, ENT_QUOTES, 'UTF-8') . "</div>
    <div><strong>Emitido:</strong> " . htmlspecialchars($issuedDate, ENT_QUOTES, 'UTF-8') . "</div>
  </div>
  <div class=\"card\">
    <p><strong>Paciente:</strong> " . htmlspecialchars($patientName, ENT_QUOTES, 'UTF-8') . "</p>
    {$patientIdHtml}
    " . implode("\n    ", $details) . "
  </div>
  <div class=\"signature\">
    {$signatureHtml}
    <p><strong>" . htmlspecialchars($doctor, ENT_QUOTES, 'UTF-8') . "</strong></p>
    <p>{$doctorSubtitle}</p>
    {$doctorMspHtml}
  </div>
</body>
</html>";
    }

    private static function readStore(): array
    {
        return read_store();
    }

    private static function mutateStore(callable $fn): array
    {
        return mutate_store($fn);
    }

    private static function calculateAge(string $birthDate): ?int
    {
        if ($birthDate === '') return null;
        try {
            $dob  = new DateTime($birthDate);
            $now  = new DateTime();
            return (int) $now->diff($dob)->y;
        } catch (\Throwable $e) {
            return null;
        }
    }

    private static function normalizePrescriptionItemsPayload(array $medications): array
    {
        require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryRepository.php';

        $items = array_map(static function ($medication): array {
            if (is_string($medication)) {
                return [
                    'medication' => trim($medication),
                ];
            }

            if (!is_array($medication)) {
                return [];
            }

            return [
                'medication' => trim((string) ($medication['medication'] ?? $medication['name'] ?? '')),
                'dose' => trim((string) ($medication['dose'] ?? '')),
                'frequency' => trim((string) ($medication['frequency'] ?? '')),
                'duration' => trim((string) ($medication['duration'] ?? '')),
                'instructions' => trim((string) ($medication['instructions'] ?? $medication['notes'] ?? '')),
            ];
        }, $medications);

        return ClinicalHistoryRepository::normalizePrescriptionItems($items);
    }

    private static function normalizeMedicationNameList($medications): array
    {
        if (!is_array($medications)) {
            return [];
        }

        $normalized = [];
        foreach ($medications as $medication) {
            if (is_string($medication)) {
                $label = trim($medication);
            } elseif (is_array($medication)) {
                $name = trim((string) ($medication['name'] ?? $medication['medication'] ?? ''));
                $dose = trim((string) ($medication['dose'] ?? ''));
                $label = trim($name . ($dose !== '' ? ' ' . $dose : ''));
            } else {
                $label = '';
            }

            if ($label !== '') {
                $normalized[] = $label;
            }
        }

        return array_values(array_unique($normalized));
    }

    private static function resolveActiveMedicationsForCase(string $caseId): array
    {
        try {
            require_once __DIR__ . '/../lib/PatientCaseService.php';
            require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';

            $store = self::readStore();
            $caseService = new PatientCaseService();
            $case = $caseService->getCaseById($store, $caseId);
            if (!is_array($case)) {
                return [];
            }

            $patientId = trim((string) ($case['patientId'] ?? ''));
            if ($patientId === '') {
                return [];
            }

            $historyService = new ClinicalHistoryService();
            $history = $historyService->getPatientHistory($store, $patientId);
            $prescriptions = is_array($history['prescriptions'] ?? null) ? array_reverse($history['prescriptions']) : [];
            foreach ($prescriptions as $prescription) {
                if (trim((string) ($prescription['status'] ?? '')) !== 'active') {
                    continue;
                }

                $active = self::normalizeMedicationNameList($prescription['medications'] ?? []);
                if ($active !== []) {
                    return $active;
                }
            }
        } catch (Throwable $error) {
            return [];
        }

        return [];
    }

    private static function normalizeMedicationKey(string $value): string
    {
        $normalized = strtolower(trim($value));
        $normalized = preg_replace('/[^a-z0-9]+/i', ' ', $normalized) ?? '';
        return trim((string) $normalized);
    }

    private static function medicationMatchesInteraction(string $medication, string $interactionDrug): bool
    {
        if ($medication === '' || $interactionDrug === '') {
            return false;
        }

        if ($medication === $interactionDrug) {
            return true;
        }

        if (str_contains($medication, $interactionDrug) || str_contains($interactionDrug, $medication)) {
            return true;
        }

        $medicationTokens = array_values(array_filter(explode(' ', $medication)));
        $interactionTokens = array_values(array_filter(explode(' ', $interactionDrug)));
        if ($medicationTokens === [] || $interactionTokens === []) {
            return false;
        }

        return in_array($interactionTokens[0], $medicationTokens, true)
            || in_array($medicationTokens[0], $interactionTokens, true);
    }

    private static function genericProtocol(string $code): array
    {
        $prefix = substr($code, 0, 1);

        $protocols = [
            'L' => [
                'cie10_code'          => $code,
                'first_line'          => [
                    ['medication' => 'Emoliente', 'dose' => 'aplicar 2-3 veces/día', 'duration' => 'continuo'],
                    ['medication' => 'Hidrocortisona 1%', 'dose' => 'aplicar bid', 'duration' => '14 días'],
                ],
                'alternatives'        => ['Betametasona 0.05% si respuesta pobre', 'Tacrolimus 0.1% para mantenimiento'],
                'follow_up'           => '4 semanas. Si no mejora: biopsia o interconsulta dermatología.',
                'referral_criteria'   => 'Afección >30% superficie corporal, signos sistémicos, sin respuesta a 8 semanas',
                'patient_instructions'=> 'Evitar rascado. Baños cortos con agua tibia. Ropa de algodón.',
            ],
            'B' => [
                'cie10_code'        => $code,
                'first_line'        => [
                    ['medication' => 'Según infección específica', 'dose' => 'ver protocolo', 'duration' => 'variable'],
                ],
                'alternatives'      => ['Consultar protocolo específico'],
                'follow_up'         => '2 semanas post-tratamiento.',
                'referral_criteria' => 'Infección diseminada, inmunocompromiso.',
                'patient_instructions'=> 'Completar tratamiento. Higiene estricta. Evitar contacto.',
            ],
            'C' => [
                'cie10_code'        => $code,
                'first_line'        => [
                    ['medication' => 'Derivación oncología urgente', 'dose' => '-', 'duration' => '<2 semanas'],
                ],
                'alternatives'      => [],
                'follow_up'         => 'Oncología dermatológica.',
                'referral_criteria' => 'SIEMPRE derivar',
                'patient_instructions'=> 'Evitar exposición solar. Acudir urgente a especialista.',
            ],
        ];

        return $protocols[$prefix] ?? [
            'cie10_code'         => $code,
            'first_line'         => [],
            'alternatives'       => [],
            'follow_up'          => 'Evaluación clínica.',
            'referral_criteria'  => 'Según criterio médico.',
            'patient_instructions'=> '',
        ];
    }
}
