<?php

declare(strict_types=1);

require_once __DIR__ . '/../../clinical_history/ClinicalHistoryRepository.php';
require_once __DIR__ . '/../../clinical_history/ClinicalHistoryService.php';
require_once __DIR__ . '/../../../controllers/OpenclawController.php';

final class OpenclawPrescriptionFacade
{
    public static function savePrescription(array $context): void
    {
        OpenclawController::requireDoctorAuth();
        $payload = require_json_body();

        $caseId      = trim((string) ($payload['case_id'] ?? ''));
        $medications = $payload['medications'] ?? [];

        if ($caseId === '' || empty($medications)) {
            json_response(['ok' => false, 'error' => 'case_id y medications requeridos'], 400);
        }

        // ── S37-04: Validación de campos estructurados de prescripción ─────────
        $validDoseUnits  = ['mg', 'ml', 'UI', 'g', 'mcg', '%', 'meq', 'mmol', 'ug'];
        $validRoutes     = ['oral', 'IM', 'IV', 'topico', 'inhalado', 'sublingual', 'subcutaneo', 'rectal', 'oftalmico', 'otico', 'nasal', 'transdermal'];
        $validationErrors = [];

        foreach ($medications as $idx => $item) {
            if (!is_array($item)) {
                $validationErrors[] = ['field' => '_item', 'item_index' => $idx, 'message' => 'Cada medicamento debe ser un objeto'];
                continue;
            }
            // Nombre obligatorio
            $itemName = trim((string) ($item['medication'] ?? $item['name'] ?? $item['medication_name'] ?? ''));
            if ($itemName === '') {
                $validationErrors[] = ['field' => 'name', 'item_index' => $idx, 'message' => 'Nombre del medicamento requerido'];
            }
            // Dosis
            $doseAmount = $item['dose_amount'] ?? $item['dosis'] ?? null;
            if ($doseAmount === null || (string) $doseAmount === '') {
                $validationErrors[] = ['field' => 'dose_amount', 'item_index' => $idx, 'message' => 'Dosis requerida'];
            } elseif (!is_numeric($doseAmount) || (float) $doseAmount <= 0) {
                $validationErrors[] = ['field' => 'dose_amount', 'item_index' => $idx, 'message' => 'Dosis debe ser un número positivo'];
            }
            // Unidad de dosis
            $doseUnit = trim((string) ($item['dose_unit'] ?? $item['unidad'] ?? ''));
            if ($doseUnit === '') {
                $validationErrors[] = ['field' => 'dose_unit', 'item_index' => $idx, 'message' => 'Unidad de dosis requerida (mg, ml, UI, g, mcg, %, meq, mmol, ug)'];
            } elseif (!in_array($doseUnit, $validDoseUnits, true)) {
                $validationErrors[] = ['field' => 'dose_unit', 'item_index' => $idx, 'message' => "Unidad '$doseUnit' no válida. Use: " . implode(', ', $validDoseUnits)];
            }
            // Frecuencia
            $frequencyHours = $item['frequency_hours'] ?? $item['frecuencia_horas'] ?? null;
            if ($frequencyHours === null || (string) $frequencyHours === '') {
                $validationErrors[] = ['field' => 'frequency_hours', 'item_index' => $idx, 'message' => 'Frecuencia en horas requerida (ej: 8 = cada 8 horas)'];
            } elseif (!is_numeric($frequencyHours) || (int) $frequencyHours < 1) {
                $validationErrors[] = ['field' => 'frequency_hours', 'item_index' => $idx, 'message' => 'Frecuencia debe ser un entero positivo en horas'];
            }
            // Duración
            $durationDays = $item['duration_days'] ?? $item['duracion_dias'] ?? null;
            if ($durationDays === null || (string) $durationDays === '') {
                $validationErrors[] = ['field' => 'duration_days', 'item_index' => $idx, 'message' => 'Duración en días requerida'];
            } elseif (!is_numeric($durationDays) || (int) $durationDays < 1) {
                $validationErrors[] = ['field' => 'duration_days', 'item_index' => $idx, 'message' => 'Duración debe ser un entero positivo en días'];
            }
            // Vía de administración
            $route = trim((string) ($item['route'] ?? $item['via'] ?? ''));
            if ($route === '') {
                $validationErrors[] = ['field' => 'route', 'item_index' => $idx, 'message' => 'Vía de administración requerida (' . implode(', ', $validRoutes) . ')'];
            } elseif (!in_array($route, $validRoutes, true)) {
                $validationErrors[] = ['field' => 'route', 'item_index' => $idx, 'message' => "Vía '$route' no válida. Use: " . implode(', ', $validRoutes)];
            }
        }

        if ($validationErrors !== []) {
            json_response([
                'ok'               => false,
                'error'            => 'Prescripción incompleta — campos requeridos faltantes',
                'validation_errors' => $validationErrors,
            ], 400);
        }

        // ── S37-04: Verificación de sustancias controladas (MSP Ecuador) ──────
        $controlledSubstancesPath = __DIR__ . '/../data/controlled-substances.json';
        $controlledMatches = [];
        if (file_exists($controlledSubstancesPath)) {
            $csDb = json_decode((string) file_get_contents($controlledSubstancesPath), true) ?? [];
            foreach ($medications as $idx => $item) {
                $itemNameKey = strtolower(trim((string) ($item['medication'] ?? $item['name'] ?? $item['medication_name'] ?? '')));
                $itemJustification = trim((string) ($item['justification'] ?? ''));
                foreach ($csDb['controlled'] ?? [] as $controlled) {
                    $matched = false;
                    $controlledKey = strtolower(trim((string) ($controlled['name'] ?? '')));
                    if ($controlledKey !== '' && (str_contains($itemNameKey, $controlledKey) || str_contains($controlledKey, $itemNameKey))) {
                        $matched = true;
                    }
                    if (!$matched) {
                        foreach ((array) ($controlled['aliases'] ?? []) as $alias) {
                            $aliasKey = strtolower(trim((string) $alias));
                            if ($aliasKey !== '' && (str_contains($itemNameKey, $aliasKey) || str_contains($aliasKey, $itemNameKey))) {
                                $matched = true;
                                break;
                            }
                        }
                    }
                    if ($matched) {
                        $controlledMatches[] = [
                            'item_index'    => $idx,
                            'medication'    => $item['medication'] ?? $item['name'] ?? $itemNameKey,
                            'schedule'      => $controlled['schedule'] ?? 'IV',
                            'reason'        => $controlled['reason'] ?? 'Sustancia de control especial MSP Ecuador',
                            'has_justification' => $itemJustification !== '',
                        ];
                        break;
                    }
                }
            }
        }

        // Si hay sustancias controladas SIN justificación → 422 con detalle
        $missingJustification = array_values(array_filter($controlledMatches, static fn ($m) => !$m['has_justification']));
        if ($missingJustification !== []) {
            json_response([
                'ok'                   => false,
                'error'                => 'Prescripción contiene sustancias de control especial (MSP Ecuador). Agregue campo "justification" a cada ítem con la indicación clínica documentada.',
                'controlled_substances' => $missingJustification,
                'action_required'      => 'Agregue justification: "[diagnóstico/indicación clínica]" a cada sustancia listada',
            ], 422);
        }

        // S10-02: log SuggestionAccepted para recetas
        $aiSuggestedMeds = $payload['ai_suggested_medications'] ?? [];
        $rxOutcome = !empty($aiSuggestedMeds) ? 'accepted_as_is' : 'manual';
        if (!empty($aiSuggestedMeds)) {
            $savedNames    = array_map(static fn($m) => trim((string) ($m['medication'] ?? $m['name'] ?? '')), $medications);
            $suggestedNames = array_map(static fn($m) => trim((string) ($m['medication'] ?? $m['name'] ?? '')), $aiSuggestedMeds);
            sort($savedNames); sort($suggestedNames);
            $rxOutcome = ($savedNames === $suggestedNames) ? 'accepted_as_is' : 'edited';
        }
        OpenclawController::logClinicalAiAction([
            'action'        => 'openclaw-prescription',
            'case_id'       => $caseId,
            'outcome'       => $rxOutcome,
            'saved_value'   => implode(', ', array_map(static fn($m) => $m['medication'] ?? $m['name'] ?? '?', $medications)),
            'ai_suggested'  => implode(', ', array_map(static fn($m) => $m['medication'] ?? $m['name'] ?? '?', $aiSuggestedMeds)),
            'diff'          => ($rxOutcome === 'edited') ? [
                'from' => $aiSuggestedMeds,
                'to'   => $medications,
            ] : null,
        ]);

        require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryRepository.php';
        require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';
        $service = new ClinicalHistoryService();
        $rxId    = 'rx-' . bin2hex(random_bytes(8));
        $doctorProfile = doctor_profile_document_fields([
            'name' => trim((string) ($_SESSION['admin_email'] ?? '')),
        ]);

        $result = OpenclawController::mutateStore(static function (array $store) use ($service, $caseId, $medications, $rxId, $doctorProfile): array {
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
            $incomingItems = OpenclawPrescriptionFacade::normalizePrescriptionItemsPayload($medications);
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
        $savedStore = isset($result['store']) && is_array($result['store'])
            ? $result['store']
            : OpenclawController::readStore();
        $patientCtx  = $savedStore['patients'][$caseId] ?? [];
        $phone       = $patientCtx['phone'] ?? '';
        $clinicProfile = read_clinic_profile();
        $clinicName  = $clinicProfile['clinicName'] ?? 'la clínica';
        $waMsg       = urlencode("Su receta médica de {$clinicName} está lista. Para descargarla visite el siguiente enlace o contacte a la clínica.");
        $waUrl       = $phone !== '' ? 'https://wa.me/' . preg_replace('/[^0-9]/', '', $phone) . '?text=' . $waMsg : '';
        $emailSent   = false;

        $deliveryMode = trim((string) ($payload['delivery'] ?? ''));
        if ($deliveryMode === 'email' && isset($savedStore['prescriptions'][$rxId]) && is_array($savedStore['prescriptions'][$rxId])) {
            $emailSent = maybe_send_prescription_ready_email(
                $savedStore,
                $savedStore['prescriptions'][$rxId],
                [],
                [
                    'portalUrl' => AppConfig::BASE_URL . '/es/portal/receta/',
                ]
            );

            if ($emailSent) {
                $savedStore['prescriptions'][$rxId]['deliveryStatus'] = 'email_sent';
                $savedStore['prescriptions'][$rxId]['emailSentAt'] = local_date('c');
                $savedStore['prescriptions'][$rxId]['emailChannel'] = 'email';
                write_store($savedStore, false);
            }
        }

        json_response([
            'ok'              => true,
            'prescription_id' => $rxId,
            'pdf_url'         => $pdfUrl,
            'whatsapp_url'    => $waUrl,
            'email_sent'      => $emailSent,
            'prescription'    => [
                'deliveryStatus' => $emailSent ? 'email_sent' : 'pending',
            ],
        ]);
    }

    // ── getPrescriptionPdf ────────────────────────────────────────────────────



    public static function getPrescriptionPdf(array $context): void
    {
        $rxId = trim((string) ($_GET['id'] ?? ''));
        if ($rxId === '') {
            json_response(['ok' => false, 'error' => 'id requerido'], 400);
        }

        $store = OpenclawController::readStore();
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


    public static function checkInteractions(array $context): void
    {
        OpenclawController::requireAuth();
        $payload = require_json_body();

        $caseId = trim((string) ($payload['case_id'] ?? $payload['caseId'] ?? ''));
        $proposed = OpenclawPrescriptionFacade::normalizeMedicationNameList($payload['proposed_medications'] ?? []);

        if ($caseId === '' || $proposed === []) {
            json_response(['ok' => false, 'error' => 'case_id y proposed_medications requeridos'], 400);
        }

        $active = OpenclawPrescriptionFacade::normalizeMedicationNameList($payload['active_medications'] ?? []);
        if ($active === []) {
            $active = OpenclawPrescriptionFacade::resolveActiveMedicationsForCase($caseId);
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
            $pairA = OpenclawPrescriptionFacade::normalizeMedicationKey((string) ($pair['drug_a'] ?? ''));
            $pairB = OpenclawPrescriptionFacade::normalizeMedicationKey((string) ($pair['drug_b'] ?? ''));
            if ($pairA === '' || $pairB === '') {
                continue;
            }

            foreach ($proposed as $proposedMedication) {
                $proposedKey = OpenclawPrescriptionFacade::normalizeMedicationKey($proposedMedication);
                if ($proposedKey === '') {
                    continue;
                }

                $proposedMatchesA = OpenclawPrescriptionFacade::medicationMatchesInteraction($proposedKey, $pairA);
                $proposedMatchesB = OpenclawPrescriptionFacade::medicationMatchesInteraction($proposedKey, $pairB);
                if (!$proposedMatchesA && !$proposedMatchesB) {
                    continue;
                }

                foreach ($active as $activeMedication) {
                    $activeKey = OpenclawPrescriptionFacade::normalizeMedicationKey($activeMedication);
                    if ($activeKey === '') {
                        continue;
                    }

                    $activeMatchesA = OpenclawPrescriptionFacade::medicationMatchesInteraction($activeKey, $pairA);
                    $activeMatchesB = OpenclawPrescriptionFacade::medicationMatchesInteraction($activeKey, $pairB);

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

        // S30-16: Check de teratogenicidad
        // El GPT "Aurora Derm Clinica" NECESITA esto antes de prescribir a paciente femenina en edad fértil
        $teratogenicityWarning = false;
        $teratogenicDrugsAtRisk = [];
        $pregnancyStatus = null;

        if ($caseId !== '') {
            $store = read_store();
            $weightKg = null;
            // Buscar la sesión activa del caso para obtener datos de la paciente
            foreach (($store['clinical_history_drafts'] ?? []) as $draft) {
                if (trim((string) ($draft['caseId'] ?? '')) === $caseId) {
                    $pregnancyStatus = $draft['intake']['datosPaciente']['embarazo'] ?? null;
                    if (isset($draft['intake']['vitalSigns']['weightKg'])) {
                        $weightKg = (float) $draft['intake']['vitalSigns']['weightKg'];
                    }
                    break;
                }
            }
            // También buscar sexo y edad en el store de appointments/cases
            $patientAgeYears = null;
            $patientSex = '';
            foreach (($store['cases'] ?? $store['patient_cases'] ?? []) as $case) {
                if (trim((string) ($case['id'] ?? $case['caseId'] ?? '')) === $caseId) {
                    $patientAgeYears = isset($case['ageYears']) ? (int) $case['ageYears'] : null;
                    $patientSex = strtolower(trim((string) ($case['sexAtBirth'] ?? $case['sex'] ?? $case['gender'] ?? '')));
                    if ($patientAgeYears === null && isset($case['birthDate']) && $case['birthDate'] !== '') {
                        try {
                            $dob = new DateTimeImmutable($case['birthDate']);
                            $patientAgeYears = (int) $dob->diff(new DateTimeImmutable())->y;
                        } catch (\Throwable $e) {}
                    }
                    break;
                }
            }

            // Lista MSP-validada de teratógenos frecuentes en dermatología y medicina general
            $knownTeratogens = [
                'isotretinoina', 'isotretinoin', 'isotretinoína', 'roaccutan', 'acnotin',
                'metotrexato', 'methotrexate', 'metotrexate',
                'warfarina', 'warfarin', 'acenocumarol',
                'acido valproico', 'valproato', 'valproic acid', 'valproate', 'depakene',
                'talidomida', 'thalidomide',
                'litio', 'lithium', 'carbolit',
                'tetraciclina', 'tetracicline', 'doxiciclina', 'doxycycline', 'minociclina', 'minocycline',
                'misoprostol', 'cytotec',
                'finasterida', 'finasteride', 'propecia',
                'fluconazol', 'fluconazole', // dosis altas
                'ribavirin', 'ribavirina',
                'retinol', 'vitamina a', 'vitamin a', // dosis farmacológicas
            ];

            $isFemaleChilbearing = (
                ($patientSex === 'female' || $patientSex === 'femenino' || $patientSex === 'f' || $patientSex === 'mujer')
                && $patientAgeYears !== null
                && $patientAgeYears >= 14
                && $patientAgeYears <= 55
            );

            if ($isFemaleChilbearing && $pregnancyStatus === null) {
                foreach ($proposed as $proposedMed) {
                    $propKey = strtolower(trim($proposedMed));
                    foreach ($knownTeratogens as $teratogen) {
                        if (str_contains($propKey, $teratogen) || str_contains($teratogen, $propKey)) {
                            $teratogenicDrugsAtRisk[] = $proposedMed;
                            $teratogenicityWarning = true;
                            break;
                        }
                    }
                }
                $teratogenicDrugsAtRisk = array_values(array_unique($teratogenicDrugsAtRisk));
            }
        }

        // S31-06: Pediatric Dose Validation
        $doseWarning = null;
        if (isset($patientAgeYears) && $patientAgeYears < 12) {
            $hasAmoxi = false;
            foreach ($proposed as $med) {
                if (stripos($med, 'amoxicilina') !== false) {
                    $hasAmoxi = true;
                    break;
                }
            }
            
            if ($hasAmoxi) {
                if (isset($weightKg) && $weightKg > 0) {
                    $doseWarning = "Paciente pediátrico: verificar dosis según peso ({$weightKg} kg). Dosis máxima recomendada para amoxicilina: 80-90 mg/kg/día.";
                } else {
                    $doseWarning = "Paciente pediátrico (< 12 años): verificar dosis de amoxicilina. Peso no registrado en signos vitales.";
                }
            }
        }

        // ── S31-01: AINE + Hipertensión arterial ─────────────────────────────
        // NSAIDs aumentan PA, retienen sodio, anulan efecto de antihipertensivos (especialmente IECAS).
        // Si la TA sistólica del paciente > 140 mmHg Y se propone un AINE → advertencia de prescripción.
        $aineHtaWarning = null;
        $aineHtaDrugsAtRisk = [];

        $knownAINEs = [
            'ibuprofeno', 'ibuprofen', 'advil', 'nurofen',
            'naproxeno', 'naproxen', 'naprosyn',
            'diclofenaco', 'diclofenac', 'voltarén', 'voltaren',
            'ketoprofeno', 'ketoprofen',
            'piroxicam',
            'meloxicam', 'mobic',
            'indometacina', 'indomethacin',
            'ketorolaco', 'ketorolac', 'toradol',
            'celecoxib', 'celebrex',
            'etoricoxib', 'arcoxia',
            'nimesulida', 'nimesulide',
            'acido mefenanico', 'mefenamic acid',
            'metamizol', 'dipirona', 'nolotil', // controversial: weak AINE-like effect
        ];

        if ($caseId !== '' && isset($store)) {
            $bpSystolic = null;
            // Leer TA del draft de la sesión activa (ya tenemos $store en scope)
            foreach (($store['clinical_history_sessions'] ?? $store['clinical_history_drafts'] ?? []) as $session) {
                $matchCase = trim((string) ($session['caseId'] ?? $session['case_id'] ?? '')) === $caseId;
                $isOpen    = in_array($session['status'] ?? '', ['open', 'active', 'draft', ''], true);
                if ($matchCase && $isOpen) {
                    $bpSystolic = isset($session['draft']['intake']['vitalSigns']['bloodPressureSystolic'])
                        ? (int) $session['draft']['intake']['vitalSigns']['bloodPressureSystolic']
                        : null;
                    break;
                }
            }

            if ($bpSystolic !== null && $bpSystolic >= 140) {
                foreach ($proposed as $med) {
                    $medKey = strtolower(trim($med));
                    foreach ($knownAINEs as $aine) {
                        if (str_contains($medKey, $aine) || str_contains($aine, $medKey)) {
                            $aineHtaDrugsAtRisk[] = $med;
                            break;
                        }
                    }
                }
                $aineHtaDrugsAtRisk = array_values(array_unique($aineHtaDrugsAtRisk));
                if ($aineHtaDrugsAtRisk !== []) {
                    $aineHtaWarning = sprintf(
                        'ALERTA S31-01: El paciente tiene TA sistólica de %d mmHg (≥140). '
                        . 'Los AINEs propuestos (%s) pueden elevar la presión arterial, retener sodio '
                        . 'y antagonizar el efecto de antihipertensivos (IECAS, ARA-II, diuréticos). '
                        . 'Evalúe paracetamol como alternativa. Si prescribe un AINE, monitorice la PA.',
                        $bpSystolic,
                        implode(', ', $aineHtaDrugsAtRisk)
                    );
                }
            }
        }

        // ── S31-02: Nefrotoxicidad en paciente con función renal comprometida ──
        // Si creatinina sérica reciente > 1.5 mg/dL Y se propone un medicamento nefrotóxico → advertencia.
        $renalRiskWarning = null;
        $renalRiskDrugsAtRisk = [];

        $knownNephrotoxics = [
            // AINEs — ya cubiertos arriba pero también son nefrotóxicos
            'ibuprofeno', 'ibuprofen', 'naproxeno', 'naproxen', 'diclofenaco', 'diclofenac',
            'ketoprofeno', 'ketoprofen', 'ketorolaco', 'ketorolac', 'celecoxib', 'etoricoxib',
            // Aminoglucósidos
            'gentamicina', 'gentamicin', 'tobramicina', 'tobramycin', 'amikacina', 'amikacin',
            'estreptomicina', 'streptomycin',
            // Contraste IV (a evitar pre-procedimiento)
            'contraste yodado', 'iodinated contrast',
            // Antifúngicos
            'anfotericina', 'amphotericin',
            // Antivirales
            'aciclovir', 'acyclovir', 'valaciclovir', 'valacyclovir',
            'tenofovir', 'cidofovir',
            // Litio
            'litio', 'lithium',
            // Metotrexato
            'metotrexato', 'methotrexate',
            // Cisplatino
            'cisplatino', 'cisplatin',
            // Ciclosporina / tacrolimus
            'ciclosporina', 'cyclosporine', 'tacrolimus',
            // Vancomicina
            'vancomicina', 'vancomycin',
            // Colistina
            'colistina', 'colistin', 'polimixina', 'polymyxin',
        ];

        if ($caseId !== '' && isset($store)) {
            // Buscar creatinina reciente en lab results del caso
            $creatinineValue = null;
            $creatinineDate  = null;
            $labSources = array_merge(
                $store['lab_results'][$caseId] ?? [],
                $store['cases'][$caseId]['lab_results'] ?? [],
                $store['patient_cases'][$caseId]['lab_results'] ?? []
            );

            foreach ($labSources as $labResult) {
                foreach ((array) ($labResult['values'] ?? []) as $labValue) {
                    $testKey = strtolower(trim((string) ($labValue['test'] ?? $labValue['name'] ?? '')));
                    if (str_contains($testKey, 'creatinina') || str_contains($testKey, 'creatinine') || $testKey === 'cre') {
                        $val = (float) ($labValue['value'] ?? $labValue['result'] ?? 0);
                        if ($val > 0) {
                            $date = $labResult['received_at'] ?? $labResult['date'] ?? '';
                            if ($creatinineDate === null || $date > $creatinineDate) {
                                $creatinineValue = $val;
                                $creatinineDate  = $date;
                            }
                        }
                    }
                }
            }

            if ($creatinineValue !== null && $creatinineValue > 1.5) {
                foreach ($proposed as $med) {
                    $medKey = strtolower(trim($med));
                    foreach ($knownNephrotoxics as $nephrotoxic) {
                        if (str_contains($medKey, $nephrotoxic) || str_contains($nephrotoxic, $medKey)) {
                            $renalRiskDrugsAtRisk[] = $med;
                            break;
                        }
                    }
                }
                $renalRiskDrugsAtRisk = array_values(array_unique($renalRiskDrugsAtRisk));
                if ($renalRiskDrugsAtRisk !== []) {
                    $renalRiskWarning = sprintf(
                        'ALERTA S31-02: El paciente tiene creatinina sérica de %.2f mg/dL (>1.5, fecha: %s). '
                        . 'Los medicamentos propuestos (%s) tienen riesgo nefrotóxico. '
                        . 'Ajuste dosis según TFGe (Cockcroft-Gault) o considere alternativas. '
                        . 'Monitorice función renal si prescribe.',
                        $creatinineValue,
                        $creatinineDate ?: 'desconocida',
                        implode(', ', $renalRiskDrugsAtRisk)
                    );
                }
            }
        }

        json_response([
            'ok'                    => true,
            'has_interactions'      => count($interactions) > 0,
            'active_medications'    => $active,
            'interactions'          => $interactions,
            'teratogenicity_warning'=> $teratogenicityWarning,
            'drugs_at_risk'         => $teratogenicDrugsAtRisk,
            'pregnancy_status'      => $pregnancyStatus,
            'teratogenicity_note'   => $teratogenicityWarning
                ? 'ADVERTENCIA: medicamento(s) teratogénico(s) detectado(s). Confirme que la paciente no está embarazada antes de prescribir.'
                : null,
            'dose_warning'          => $doseWarning,
            // S31-01
            'aine_hta_warning'      => $aineHtaWarning,
            'aine_hta_drugs'        => $aineHtaDrugsAtRisk,
            // S31-02
            'renal_risk_warning'    => $renalRiskWarning,
            'renal_risk_drugs'      => $renalRiskDrugsAtRisk,
            // summary flag: any prescribing warning active
            'has_prescribing_warning' => ($aineHtaWarning !== null || $renalRiskWarning !== null || $teratogenicityWarning || $doseWarning !== null),
        ]);
    }

    // ── summarizeSession ─────────────────────────────────────────────────────



    public static function normalizePrescriptionItemsPayload(array $medications): array
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
                'durationDays' => (int) ($medication['duration_days'] ?? $medication['durationDays'] ?? 0),
                'instructions' => trim((string) ($medication['instructions'] ?? $medication['notes'] ?? '')),
            ];
        }, $medications);

        return ClinicalHistoryRepository::normalizePrescriptionItems($items);
    }

    public static function normalizeMedicationNameList($medications): array
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

    public static function resolveActiveMedicationsForCase(string $caseId): array
    {
        try {
            require_once __DIR__ . '/../lib/PatientCaseService.php';
            require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';

            $store = OpenclawController::readStore();
            $case = $store['cases'][$caseId]
                ?? $store['patient_cases'][$caseId]
                ?? null;
            if ($case === null) {
                foreach (array_merge($store['cases'] ?? [], $store['patient_cases'] ?? []) as $c) {
                    if (($c['id'] ?? '') === $caseId) { $case = $c; break; }
                }
            }
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

                $active = OpenclawPrescriptionFacade::normalizeMedicationNameList($prescription['medications'] ?? []);
                if ($active !== []) {
                    return $active;
                }
            }
        } catch (Throwable $error) {
            return [];
        }

        return [];
    }

    public static function normalizeMedicationKey(string $value): string
    {
        $normalized = strtolower(trim($value));
        $normalized = preg_replace('/[^a-z0-9]+/i', ' ', $normalized) ?? '';
        return trim((string) $normalized);
    }

    public static function medicationMatchesInteraction(string $medication, string $interactionDrug): bool
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


}
