<?php

declare(strict_types=1);

/**
 * OpenclawTelemedicineFacade — Facade para rutinas de telemedicina.
 *
 * Extraído de OpenclawController (S42-05) para aislar la gestión de cierre, flujo rápido (fastClose)
 * y enrutamiento a salas de atención telemedicina.
 */
class OpenclawTelemedicineFacade
{

    public static function closeTelemedicine(array $context): void
    {
        OpenclawController::requireDoctorAuth();
        $payload     = require_json_body();
        $chatSummary = trim((string) ($payload['chat_summary'] ?? ''));
        $caseId      = trim((string) ($payload['case_id'] ?? ''));

        if ($chatSummary === '' || $caseId === '') {
            json_response(['ok' => false, 'error' => 'chat_summary y case_id requeridos'], 400);
        }

        $router  = new OpenclawAIRouter();
        $aiResult = $router->route([
            'messages' => [
                [
                    'role'    => 'system',
                    'content' => 'Eres un asistente médico inteligente. Genera el resumen estructurado de la teleconsulta. Responde SOLO con JSON válido con estas claves: evolution_text (nota clínica profesional), patient_summary_wa (resumen simplificado y amigable para WhatsApp de MÁXIMO 300 palabras: incluye diagnóstico simple, plan, fecha proxy o sugerida de control, señal de alarma), suggested_followup_days (int, días sugeridos para control si es necesario, 0 si no) y pending_actions (array de tareas internas).',
                ],
                [
                    'role'    => 'user',
                    'content' => "Resumen de la consulta:\n{$chatSummary}\n\nGenera el JSON de cierre.",
                ],
            ],
            'max_tokens'  => 900,
            'temperature' => 0.2,
        ]);

        $evolutionText = '';
        $patientSummary = '';
        $pendingActions = [];
        $followupDays = 0;

        if ($aiResult['ok'] && isset($aiResult['choices'][0]['message']['content'])) {
            $raw = trim((string) $aiResult['choices'][0]['message']['content']);
            if (preg_match('/```(?:json)?\s*(\{.*?\})\s*```/s', $raw, $m)) {
                $raw = $m[1];
            }
            $parsed = @json_decode($raw, true);
            if (is_array($parsed)) {
                $evolutionText  = (string) ($parsed['evolution_text'] ?? '');
                $patientSummary = (string) ($parsed['patient_summary_wa'] ?? $parsed['patient_summary'] ?? '');
                $pendingActions = (array) ($parsed['pending_actions'] ?? []);
                $followupDays   = (int) ($parsed['suggested_followup_days'] ?? 0);
            }
        }

        if ($evolutionText === '') {
            $evolutionText = "Atención de Telemedicina completada. {$chatSummary}";
        }

        require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';
        $service = new ClinicalHistoryService();
        $doctorProfile = doctor_profile_document_fields([
            'name' => trim((string) ($_SESSION['admin_email'] ?? '')),
        ]);

        $result = OpenclawController::mutateStore(static function (array $store) use ($service, $caseId, $evolutionText, $doctorProfile, $followupDays): array {
            $evolutionResult = $service->saveEvolutionNote($store, [
                'caseId'          => $caseId,
                'text'            => $evolutionText,
                'cie10Code'       => '',
                'doctorId'        => $doctorProfile['name'] ?? '',
                'doctorName'      => $doctorProfile['name'] ?? '',
                'doctorSpecialty' => $doctorProfile['specialty'] ?? '',
                'doctorMsp'       => $doctorProfile['msp'] ?? '',
                'source'          => 'openclaw-close-telemedicine',
            ]);

            $store = $evolutionResult['store'] ?? $store;

            $session = ClinicalHistorySessionRepository::findSessionByCaseId($store, $caseId);
            if ($session !== null) {
                $session['status'] = 'closed';
                $saveSession = ClinicalHistorySessionRepository::upsertSession($store, $session);
                $store = $saveSession['store'];
                
                $draft = ClinicalHistorySessionRepository::findDraftBySessionId($store, (string) $session['sessionId']);
                if ($draft !== null) {
                    $draft['status'] = 'closed';
                    $saveDraft = ClinicalHistorySessionRepository::upsertDraft($store, $draft);
                    $store = $saveDraft['store'];
                }
            }

            $patientId = '';
            if (isset($store['cases'][$caseId])) {
                $store['cases'][$caseId]['stage'] = 'completed';
                $store['cases'][$caseId]['closed_at'] = local_date('c');
                $patientId = $store['cases'][$caseId]['patientId'] ?? '';
            } elseif (isset($store['patient_cases'][$caseId])) {
                $store['patient_cases'][$caseId]['status'] = 'completed';
                $patientId = $store['patient_cases'][$caseId]['patientId'] ?? '';
            }

            if ($patientId !== '') {
                foreach (($store['appointments'] ?? []) as $i => $apt) {
                    if (($apt['patientId'] ?? '') === $patientId && ($apt['status'] ?? '') === 'active') {
                        $store['appointments'][$i]['status'] = 'completed';
                    }
                }
            }

            if ($followupDays > 0) {
                $store['pending_followups'] = is_array($store['pending_followups'] ?? null) ? $store['pending_followups'] : [];
                $store['pending_followups'][] = [
                    'id'             => 'fu_' . uniqid(),
                    'caseId'         => $caseId,
                    'patientId'      => $patientId,
                    'reason'         => 'Control clínico diferido por teleconsulta',
                    'due_date'       => date('Y-m-d', time() + ($followupDays * 86400)),
                    'contact_method' => 'whatsapp',
                    'status'         => 'pending',
                    'createdAt'      => local_date('c'),
                ];
            }

            return ['ok' => true, 'store' => $store, 'storeDirty' => true];
        });

        $waUrl = '';
        if ($caseId !== '' && $patientSummary !== '') {
            $patientCtx = OpenclawController::readStore()['patients'][$caseId] ?? [];
            $phone      = trim((string) ($patientCtx['phone'] ?? ''));
            if ($phone !== '') {
                $waUrl = 'https://wa.me/' . preg_replace('/[^0-9]/', '', $phone) . '?text=' . urlencode($patientSummary);
            }
        }

        json_response([
            'ok'                 => true,
            'hce_updated'        => true,
            'appointment_closed' => true,
            'wa_summary_sent'    => $waUrl !== '', 
            'evolution_text'     => $evolutionText,
            'patient_summary_wa' => $patientSummary,
            'pending_actions'    => $pendingActions,
            'followup_days'      => $followupDays,
            'whatsapp_url'       => $waUrl,
        ]);
    }

    // ── routerStatus ─────────────────────────────────────────────────────────

    public static function routerStatus(array $context): void
    {
        OpenclawController::requireAuth();
        $router = new OpenclawAIRouter();
        $status = $router->getStatus();

        // Simplify for the Custom GPT — just tell it if AI chat is available
        $aiAvailable = ($status['active_provider'] ?? 'local_heuristic') !== 'local_heuristic';
        json_response([
            'ok'           => true,
            'ai_available' => $aiAvailable,
            'mode'         => $status['router_mode'] ?? 'auto',
            'provider'     => $status['active_provider'] ?? 'local_heuristic',
            'note'         => $aiAvailable
                ? 'IA conectada. Todas las funciones disponibles.'
                : 'Modo local activo. Puedes cargar pacientes, buscar CIE-10, guardar diagnósticos y recetas normalmente. Solo el chat IA directo usa modo offline.',
            'router'       => $status,
        ]);
    }

    // ── nextPatient ───────────────────────────────────────────────────────────

    /**
     * GET /api/openclaw/next-patient
     * Devuelve el paciente que está actualmente en consulta (o el siguiente en cola).
     * Permite al Custom GPT auto-cargar al paciente sin que el médico escriba el ID.
     */
    public static function nextPatient(array $context): void
    {
        OpenclawController::requireAuth();

        $store = OpenclawController::readStore();

        // Buscar ticket en estado 'in_consultation' o 'called'
        $tickets = $store['queue']['tickets'] ?? [];
        $currentTicket = null;

        foreach ($tickets as $ticket) {
            $status = $ticket['status'] ?? '';
            if (in_array($status, ['in_consultation', 'called'], true)) {
                $currentTicket = $ticket;
                break;
            }
        }

        // Si no hay ninguno en consulta, tomar el primero en espera
        if ($currentTicket === null) {
            foreach ($tickets as $ticket) {
                if (($ticket['status'] ?? '') === 'waiting') {
                    $currentTicket = $ticket;
                    break;
                }
            }
        }

        if ($currentTicket === null) {
            json_response([
                'ok'      => false,
                'error'   => 'No hay pacientes en cola en este momento.',
                'queue_empty' => true,
            ], 404);
        }

        $patientId = trim((string) ($currentTicket['patientId'] ?? $currentTicket['patient_id'] ?? ''));
        $caseId    = trim((string) ($currentTicket['caseId'] ?? $currentTicket['case_id'] ?? ''));

        if ($patientId === '' && $caseId === '') {
            json_response([
                'ok'     => false,
                'error'  => 'Ticket en cola sin ID de paciente asociado.',
                'ticket' => $currentTicket,
            ], 422);
        }

        // Reusar la lógica de patient() inyectando los parámetros
        if ($patientId !== '') {
            $_GET['patient_id'] = $patientId;
        }
        if ($caseId !== '') {
            $_GET['case_id'] = $caseId;
        }

        // Adjuntar info del ticket para contexto
        $_GET['_ticket_status'] = $currentTicket['status'] ?? '';
        $_GET['_queue_position'] = (string) ($currentTicket['position'] ?? '');

        // Llamar directamente al método patient con el contexto ya configurado
        OpenclawController::patient($context);
    }

    // ── Utilities ─────────────────────────────────────────────────────────────


    public static function fastClose(array $context): void
    {
        OpenclawController::requireAuth();
        $payload = require_json_body();

        $caseId     = trim((string) ($payload['case_id'] ?? ''));
        $cie10Code  = trim((string) ($payload['cie10_code'] ?? ''));
        $evolution  = trim((string) ($payload['evolution'] ?? ''));

        if ($caseId === '') {
            json_response(['ok' => false, 'error' => 'case_id requerido'], 400);
        }
        if ($cie10Code === '') {
            json_response(['ok' => false, 'error' => 'cie10_code requerido para cerrar la consulta'], 400);
        }
        if (strlen($evolution) < 10) {
            json_response(['ok' => false, 'error' => 'La nota de evolución debe tener al menos 10 caracteres'], 400);
        }

        $cie10Desc   = trim((string) ($payload['cie10_description'] ?? ''));
        $closeStage  = in_array($payload['close_stage'] ?? '', ['completed', 'follow_up', 'referred'], true)
            ? $payload['close_stage']
            : 'completed';

        // S10-02: audit de sugestión de IA en fast-close
        $aiSuggested = trim((string) ($payload['ai_suggested_code'] ?? ''));
        $outcome = $aiSuggested === '' ? 'manual' : ($aiSuggested === $cie10Code ? 'accepted_as_is' : 'edited');
        OpenclawController::logClinicalAiAction([
            'action'       => 'openclaw-fast-close',
            'case_id'      => $caseId,
            'outcome'      => $outcome,
            'saved_value'  => $cie10Code . ' ' . $cie10Desc,
            'ai_suggested' => $aiSuggested,
            'diff'         => ($outcome === 'edited') ? ['from' => $aiSuggested, 'to' => $cie10Code] : null,
        ]);

        require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';
        $service      = new ClinicalHistoryService();
        $doctorProfile = doctor_profile_document_fields([
            'name' => trim((string) ($payload['doctor_name'] ?? ($_SESSION['admin_email'] ?? ''))),
        ]);

        $closedAt    = gmdate('c');
        $evolutionId = null;

        $result = OpenclawController::mutateStore(static function (array $store) use (
            $service, $caseId, $cie10Code, $cie10Desc, $evolution,
            $closeStage, $closedAt, $doctorProfile, $payload, &$evolutionId
        ): array {
            // 1. Guardar diagnóstico
            $store = $service->saveDiagnosis($store, [
                'caseId'           => $caseId,
                'cie10Code'        => $cie10Code,
                'cie10Description' => $cie10Desc,
                'notes'            => $payload['notes'] ?? '',
                'source'           => 'openclaw-fast-close',
            ]);

            // 2. Guardar nota de evolución (incluyendo indicaciones si vienen)
            $evolutionText = $evolution;
            $postInstructions = trim((string) ($payload['post_instructions'] ?? ''));
            if ($postInstructions !== '') {
                $evolutionText .= "\n\n**Indicaciones para el paciente:**\n" . $postInstructions;
            }
            $evolutionResult = $service->saveEvolutionNote($store, [
                'caseId'          => $caseId,
                'text'            => $evolutionText,
                'cie10Code'       => $cie10Code,
                'doctorId'        => $payload['doctor_id'] ?? ($doctorProfile['name'] ?? ''),
                'doctorName'      => $doctorProfile['name'] ?? '',
                'doctorSpecialty' => $doctorProfile['specialty'] ?? '',
                'doctorMsp'       => $doctorProfile['msp'] ?? '',
                'source'          => 'openclaw-fast-close',
            ]);
            $evolutionId = $evolutionResult['id'] ?? null;
            $store       = $evolutionResult['store'] ?? $store;

            // 3. Cambiar el stage del caso a closed
            if (isset($store['cases'][$caseId])) {
                $store['cases'][$caseId]['stage']     = $closeStage;
                $store['cases'][$caseId]['closed_at'] = $closedAt;
            }

            return $store;
        });

        json_response([
            'ok'              => true,
            'closed_at'       => $closedAt,
            'diagnosis_saved' => true,
            'evolution_id'    => $evolutionId,
            'stage'           => $closeStage,
        ]);
    }

    // ── logClinicalAiAction (S10-02) ─────────────────────────────────────────

    /**
     * Escribe un evento de auditoría de IA clínica en data/clinical_ai_actions.jsonl
     *
     * Formato JSONL: un JSON por línea, append-only, nunca se modifica.
     * Campos: action, case_id, outcome, saved_value, ai_suggested, diff, doctor, ts.
     *
     * outcome: 'accepted_as_is' | 'edited' | 'rejected' | 'manual'
     */

}
