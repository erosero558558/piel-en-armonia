<?php

declare(strict_types=1);

require_once __DIR__ . '/../DoctorProfileStore.php';

final class ClinicalHistoryLegalReadiness
{
    /**
     * @param array<string,mixed> $session
     * @param array<string,mixed> $draft
     * @param array<int,array<string,mixed>> $events
     * @return array<string,mixed>
     */
    public static function build(array $session, array $draft, array $events): array
    {
        $session = ClinicalHistoryRepository::adminSession($session);
        $draft = ClinicalHistoryRepository::adminDraft($draft);
        $draft = ClinicalHistoryRepository::syncInterconsultationArtifacts($draft, $session);
        $draft = ClinicalHistoryRepository::syncLabOrderArtifacts($draft, $session);
        $draft = ClinicalHistoryRepository::syncImagingOrderArtifacts($draft, $session);
        $draft = ClinicalHistoryRepository::syncConsentArtifacts($draft, $session);
        $interconsultations = ClinicalHistoryRepository::normalizeInterconsultations(
            $draft['interconsultations'] ?? []
        );
        $labOrders = ClinicalHistoryRepository::normalizeLabOrders(
            $draft['labOrders'] ?? []
        );
        $imagingOrders = ClinicalHistoryRepository::normalizeImagingOrders(
            $draft['imagingOrders'] ?? []
        );
        $consent = ClinicalHistoryRepository::normalizeConsentRecord(
            is_array($draft['consent'] ?? null) ? $draft['consent'] : []
        );
        $consentPackets = ClinicalHistoryRepository::normalizeConsentPackets(
            $draft['consentPackets'] ?? []
        );
        $documents = ClinicalHistoryRepository::normalizeClinicalDocuments(
            is_array($draft['documents'] ?? null) ? $draft['documents'] : []
        );
        $clinicianDraft = ClinicalHistoryRepository::normalizeClinicianDraft(
            is_array($draft['clinicianDraft'] ?? null) ? $draft['clinicianDraft'] : []
        );
        $admission001 = ClinicalHistoryRepository::normalizeAdmission001(
            is_array($draft['admission001'] ?? null) ? $draft['admission001'] : [],
            is_array($session['patient'] ?? null) ? $session['patient'] : [],
            is_array($draft['intake'] ?? null) ? $draft['intake'] : [],
            ['draft' => $draft]
        );
        $hcu001Evaluation = ClinicalHistoryRepository::evaluateHcu001($admission001, [
            'patient' => $session['patient'] ?? [],
            'intake' => $draft['intake'] ?? [],
            'draft' => $draft,
        ]);
        $hcu005 = ClinicalHistoryRepository::normalizeHcu005Draft(
            $clinicianDraft['hcu005'] ?? []
        );
        $hcu005Evaluation = ClinicalHistoryRepository::evaluateHcu005($hcu005);
        $writtenConsentPackets = [];
        $writtenConsentEvaluations = [];
        foreach ($consentPackets as $packet) {
            if (($packet['writtenRequired'] ?? true) !== true) {
                continue;
            }
            $writtenConsentPackets[] = $packet;
            $writtenConsentEvaluations[] = ClinicalHistoryRepository::evaluateConsentPacket($packet);
        }
        $requiredInterconsultations = array_values(array_filter($interconsultations, static function (array $interconsultation): bool {
            return ($interconsultation['requiredForCurrentPlan'] ?? false) === true;
        }));
        $interconsultationScope = $requiredInterconsultations !== []
            ? $requiredInterconsultations
            : $interconsultations;
        $interconsultationEvaluations = array_map(
            static fn (array $interconsultation): array => ClinicalHistoryRepository::evaluateInterconsultation($interconsultation),
            $interconsultationScope
        );
        $interconsultationReportEvaluations = array_map(
            static fn (array $interconsultation): array => ClinicalHistoryRepository::evaluateInterconsultReport(
                isset($interconsultation['report']) && is_array($interconsultation['report']) ? $interconsultation['report'] : []
            ),
            $interconsultationScope
        );
        $requiredLabOrders = array_values(array_filter($labOrders, static function (array $labOrder): bool {
            return ($labOrder['requiredForCurrentPlan'] ?? false) === true;
        }));
        $labOrderScope = $requiredLabOrders !== []
            ? $requiredLabOrders
            : $labOrders;
        $labOrderEvaluations = array_map(
            static fn (array $labOrder): array => ClinicalHistoryRepository::evaluateLabOrder($labOrder),
            $labOrderScope
        );
        $requiredImagingOrders = array_values(array_filter($imagingOrders, static function (array $imagingOrder): bool {
            return ($imagingOrder['requiredForCurrentPlan'] ?? false) === true;
        }));
        $imagingOrderReportEvaluations = array_map(
            static function (array $imagingOrder): array {
                return ClinicalHistoryRepository::evaluateImagingReport(
                    is_array($imagingOrder['result'] ?? null) ? $imagingOrder['result'] : []
                );
            },
            $imagingOrders
        );
        $imagingOrderScope = $requiredImagingOrders !== []
            ? $requiredImagingOrders
            : $imagingOrders;
        $imagingOrderEvaluations = array_map(
            static fn (array $imagingOrder): array => ClinicalHistoryRepository::evaluateImagingOrder($imagingOrder),
            $imagingOrderScope
        );
        $activeConsentPacketId = ClinicalHistoryRepository::trimString($draft['activeConsentPacketId'] ?? '');
        $activeConsentEvaluation = null;
        foreach ($writtenConsentPackets as $index => $packet) {
            if (ClinicalHistoryRepository::trimString($packet['packetId'] ?? '') === $activeConsentPacketId) {
                $activeConsentEvaluation = $writtenConsentEvaluations[$index] ?? null;
                break;
            }
        }
        if ($activeConsentEvaluation === null && $writtenConsentEvaluations !== []) {
            $activeConsentEvaluation = $writtenConsentEvaluations[0];
        }

        $pendingAi = ClinicalHistoryRepository::normalizePendingAi(
            is_array($session['pendingAi'] ?? null)
                ? $session['pendingAi']
                : (is_array($draft['pendingAi'] ?? null) ? $draft['pendingAi'] : [])
        );
        $pendingAiStatus = ClinicalHistoryRepository::trimString($pendingAi['status'] ?? '');
        $summary = ClinicalHistoryRepository::trimString(
            ($hcu005['evolutionNote'] ?? '')
                ?: ($clinicianDraft['resumen'] ?? '')
                ?: ($draft['intake']['resumenClinico'] ?? '')
        );
        $treatment = ClinicalHistoryRepository::trimString(
            ($documents['prescription']['medication'] ?? '') ?: ($clinicianDraft['tratamientoBorrador'] ?? '')
        );
        $posology = is_array($clinicianDraft['posologiaBorrador'] ?? null)
            ? $clinicianDraft['posologiaBorrador']
            : [];
        $missingFields = ClinicalHistoryRepository::normalizeStringList(
            $draft['intake']['preguntasFaltantes'] ?? []
        );

        $hasCriticalOpenEvent = false;
        foreach ($events as $event) {
            if (!is_array($event)) {
                continue;
            }
            $status = ClinicalHistoryRepository::trimString($event['status'] ?? '');
            $severity = ClinicalHistoryRepository::trimString($event['severity'] ?? '');
            if ($status === 'open' && $severity === 'critical') {
                $hasCriticalOpenEvent = true;
                break;
            }
        }

        $checklist = [];
        $blockingReasons = [];

        $hcu001Pass = ($hcu001Evaluation['blocksApproval'] ?? false) !== true;
        self::appendChecklist(
            $checklist,
            'hcu001_admission',
            $hcu001Pass,
            'HCU-001 admision',
            match ((string) ($hcu001Evaluation['status'] ?? 'missing')) {
                'complete' => 'La admision HCU-001 cubre los datos nucleares del expediente.',
                'legacy_partial' => 'Expediente heredado: la admision requiere regularizacion, pero no congela la aprobacion clinica en esta fase.',
                'partial' => 'La admision HCU-001 ya tiene datos, pero aun faltan campos nucleares para el expediente nuevo.',
                default => 'Todavia falta registrar la admision HCU-001 del expediente.',
            },
            [
                'hcu001Status' => (string) ($hcu001Evaluation['status'] ?? 'missing'),
                'missingCoreFields' => $hcu001Evaluation['missingCoreFields'] ?? [],
                'transitionMode' => $hcu001Evaluation['transitionMode'] ?? 'legacy_inferred',
            ]
        );
        if (($hcu001Evaluation['blocksApproval'] ?? false) === true) {
            $blockingReasons[] = self::blockingReason(
                'hcu001_admission_incomplete',
                'Falta admision HCU-001 defendible',
                'Completa la identidad, admision y contacto base del expediente antes de aprobar la nota final.',
                [
                    'hcu001Status' => (string) ($hcu001Evaluation['status'] ?? 'missing'),
                    'missingCoreFields' => $hcu001Evaluation['missingCoreFields'] ?? [],
                ]
            );
        }

        self::appendChecklist(
            $checklist,
            'minimum_clinical_data',
            $missingFields === [],
            'Datos minimos clinicos',
            $missingFields === []
                ? 'No hay preguntas faltantes abiertas en el intake.'
                : 'Aun faltan datos clinicos minimos para sostener el cierre.',
            $missingFields === []
                ? []
                : ['missingFields' => $missingFields]
        );
        if ($missingFields !== []) {
            $blockingReasons[] = self::blockingReason(
                'missing_minimum_clinical_data',
                'Faltan datos clinicos minimos',
                'Completa intake y preguntas faltantes antes de aprobar.',
                ['missingFields' => $missingFields]
            );
        }

        self::appendChecklist(
            $checklist,
            'hcu005_evolution_note',
            $hcu005Evaluation['hasEvolutionNote'] === true,
            'HCU-005 evolucion clinica',
            $hcu005Evaluation['hasEvolutionNote'] === true
                ? 'La evolucion clinica ya esta documentada en el bloque HCU-005.'
                : 'Falta documentar la evolucion clinica del episodio en HCU-005.',
            ['hcu005Status' => $hcu005Evaluation['status']]
        );
        if ($hcu005Evaluation['hasEvolutionNote'] !== true) {
            $blockingReasons[] = self::blockingReason(
                'hcu005_evolution_missing',
                'Falta la evolucion clinica',
                'Completa la evolucion clinica antes de aprobar la nota final.',
                ['hcu005Status' => $hcu005Evaluation['status']]
            );
        }

        self::appendChecklist(
            $checklist,
            'hcu005_diagnostic_impression',
            $hcu005Evaluation['hasDiagnosticImpression'] === true,
            'HCU-005 impresion diagnostica',
            $hcu005Evaluation['hasDiagnosticImpression'] === true
                ? 'La impresion diagnostica ya quedo documentada.'
                : 'Falta registrar la impresion diagnostica del episodio.',
            ['hcu005Status' => $hcu005Evaluation['status']]
        );
        if ($hcu005Evaluation['hasDiagnosticImpression'] !== true) {
            $blockingReasons[] = self::blockingReason(
                'hcu005_diagnostic_impression_missing',
                'Falta la impresion diagnostica',
                'Completa la impresion diagnostica antes de aprobar la nota final.',
                ['hcu005Status' => $hcu005Evaluation['status']]
            );
        }

        self::appendChecklist(
            $checklist,
            'hcu005_plan_of_care',
            $hcu005Evaluation['hasPlanOrCare'] === true,
            'HCU-005 plan e indicaciones',
            $hcu005Evaluation['hasPlanOrCare'] === true
                ? 'El plan terapeutico o las indicaciones de cuidado ya estan visibles.'
                : 'Falta documentar plan terapeutico o indicaciones de cuidado.',
            ['hcu005Status' => $hcu005Evaluation['status']]
        );
        if ($hcu005Evaluation['hasPlanOrCare'] !== true) {
            $blockingReasons[] = self::blockingReason(
                'hcu005_plan_missing',
                'Falta plan terapeutico o indicaciones',
                'Documenta plan terapeutico o indicaciones antes de aprobar la nota final.',
                ['hcu005Status' => $hcu005Evaluation['status']]
            );
        }

        self::appendChecklist(
            $checklist,
            'hcu005_prescription_items',
            (int) ($hcu005Evaluation['incompletePrescriptionItems'] ?? 0) === 0,
            'HCU-005 prescripciones',
            (int) ($hcu005Evaluation['startedPrescriptionItems'] ?? 0) === 0
                ? 'No hay prescripciones iniciadas con campos parciales.'
                : (
                    (int) ($hcu005Evaluation['incompletePrescriptionItems'] ?? 0) === 0
                        ? 'Las prescripciones iniciadas tienen todos los campos minimos completos.'
                        : 'Hay prescripciones iniciadas con campos todavia incompletos.'
                ),
            [
                'startedPrescriptionItems' => (int) ($hcu005Evaluation['startedPrescriptionItems'] ?? 0),
                'incompletePrescriptionItems' => (int) ($hcu005Evaluation['incompletePrescriptionItems'] ?? 0),
            ]
        );
        if ((int) ($hcu005Evaluation['incompletePrescriptionItems'] ?? 0) > 0) {
            $blockingReasons[] = self::blockingReason(
                'hcu005_prescription_incomplete',
                'Hay prescripciones incompletas',
                'Completa todos los campos minimos de cada prescripcion iniciada antes de aprobar.',
                [
                    'incompletePrescriptionItems' => (int) ($hcu005Evaluation['incompletePrescriptionItems'] ?? 0),
                ]
            );
        }

        $hcu007Status = 'not_applicable';
        if ($interconsultationEvaluations !== []) {
            $statuses = array_map(
                static fn (array $evaluation): string => ClinicalHistoryRepository::trimString($evaluation['status'] ?? 'draft'),
                $interconsultationEvaluations
            );
            $pendingStatuses = array_values(array_intersect($statuses, ['draft', 'ready_to_issue', 'incomplete']));
            if ($pendingStatuses === []) {
                $hasReceived = count(array_filter($statuses, static fn (string $status): bool => $status === 'received')) > 0;
                $hasIssued = count(array_filter($statuses, static fn (string $status): bool => $status === 'issued')) > 0;
                $hcu007Status = $hasReceived
                    ? 'received'
                    : ($hasIssued ? 'issued' : 'cancelled');
            } elseif (in_array('incomplete', $statuses, true)) {
                $hcu007Status = 'incomplete';
            } elseif (in_array('draft', $statuses, true)) {
                $hcu007Status = 'draft';
            } else {
                $hcu007Status = 'ready_to_issue';
            }
        }
        $hcu007ReportStatus = 'not_received';
        if ($interconsultationReportEvaluations !== []) {
            $reportStatuses = array_map(
                static fn (array $evaluation): string => ClinicalHistoryRepository::trimString($evaluation['status'] ?? 'not_received'),
                $interconsultationReportEvaluations
            );
            if (in_array('received', $reportStatuses, true)) {
                $hcu007ReportStatus = 'received';
            } elseif (in_array('ready_to_receive', $reportStatuses, true)) {
                $hcu007ReportStatus = 'ready_to_receive';
            } elseif (in_array('draft', $reportStatuses, true)) {
                $hcu007ReportStatus = 'draft';
            }
        }
        $requiredInterconsultationPending = count(array_filter(
            array_map(
                static fn (array $interconsultation): array => ClinicalHistoryRepository::evaluateInterconsultation($interconsultation),
                $requiredInterconsultations
            ),
            static fn (array $evaluation): bool => !in_array(
                ClinicalHistoryRepository::trimString($evaluation['status'] ?? ''),
                ['issued', 'received', 'cancelled'],
                true
            )
        ));
        $hcu007Ready = $requiredInterconsultationPending === 0;
        self::appendChecklist(
            $checklist,
            'hcu007_interconsultation',
            $hcu007Ready,
            'HCU-007 interconsulta',
            $requiredInterconsultations === []
                ? ($interconsultations === []
                    ? 'No hay interconsultas exigibles para este episodio.'
                    : 'Las interconsultas del episodio no fueron marcadas como obligatorias para aprobar el plan actual.')
                : ($hcu007Ready
                    ? 'Las interconsultas marcadas como parte del plan actual ya fueron emitidas o canceladas.'
                    : 'Todavia hay interconsultas requeridas que no se han emitido o cancelado.'),
            [
                'status' => $hcu007Status,
                'requiredInterconsultations' => count($requiredInterconsultations),
                'pendingRequiredInterconsultations' => $requiredInterconsultationPending,
            ]
        );
        if (!$hcu007Ready) {
            $blockingReasons[] = self::blockingReason(
                'hcu007_interconsultation_pending_issue',
                'Falta emitir o cancelar una interconsulta requerida',
                'Emite o cancela la interconsulta marcada como parte del plan actual antes de aprobar la nota final.',
                [
                    'status' => $hcu007Status,
                    'pendingRequiredInterconsultations' => $requiredInterconsultationPending,
                ]
            );
        }

        $hcu010AStatus = 'not_applicable';
        if ($labOrderEvaluations !== []) {
            $statuses = array_map(
                static fn (array $evaluation): string => ClinicalHistoryRepository::trimString($evaluation['status'] ?? 'draft'),
                $labOrderEvaluations
            );
            $pendingStatuses = array_values(array_intersect($statuses, ['draft', 'ready_to_issue', 'incomplete']));
            if ($pendingStatuses === []) {
                $hasIssued = count(array_filter($statuses, static fn (string $status): bool => $status === 'issued')) > 0;
                $hcu010AStatus = $hasIssued ? 'issued' : 'cancelled';
            } elseif (in_array('incomplete', $statuses, true)) {
                $hcu010AStatus = 'incomplete';
            } elseif (in_array('draft', $statuses, true)) {
                $hcu010AStatus = 'draft';
            } else {
                $hcu010AStatus = 'ready_to_issue';
            }
        }
        $requiredLabOrderPending = count(array_filter(
            array_map(
                static fn (array $labOrder): array => ClinicalHistoryRepository::evaluateLabOrder($labOrder),
                $requiredLabOrders
            ),
            static fn (array $evaluation): bool => !in_array(
                ClinicalHistoryRepository::trimString($evaluation['status'] ?? ''),
                ['issued', 'cancelled'],
                true
            )
        ));
        $hcu010AReady = $requiredLabOrderPending === 0;
        self::appendChecklist(
            $checklist,
            'hcu010a_laboratory',
            $hcu010AReady,
            'HCU-010A laboratorio',
            $requiredLabOrders === []
                ? ($labOrders === []
                    ? 'No hay solicitudes de laboratorio exigibles para este episodio.'
                    : 'Las solicitudes de laboratorio del episodio no fueron marcadas como obligatorias para aprobar el plan actual.')
                : ($hcu010AReady
                    ? 'Las solicitudes de laboratorio marcadas como parte del plan actual ya fueron emitidas o canceladas.'
                    : 'Todavia hay solicitudes de laboratorio requeridas que no se han emitido o cancelado.'),
            [
                'status' => $hcu010AStatus,
                'requiredLabOrders' => count($requiredLabOrders),
                'pendingRequiredLabOrders' => $requiredLabOrderPending,
            ]
        );
        if (!$hcu010AReady) {
            $blockingReasons[] = self::blockingReason(
                'hcu010a_lab_order_pending_issue',
                'Falta emitir o cancelar una solicitud de laboratorio requerida',
                'Emite o cancela la solicitud HCU-010A marcada como parte del plan actual antes de aprobar la nota final.',
                [
                    'status' => $hcu010AStatus,
                    'pendingRequiredLabOrders' => $requiredLabOrderPending,
                ]
            );
        }

        $hcu012AStatus = 'not_applicable';
        if ($imagingOrderEvaluations !== []) {
            $statuses = array_map(
                static fn (array $evaluation): string => ClinicalHistoryRepository::trimString($evaluation['status'] ?? 'draft'),
                $imagingOrderEvaluations
            );
            $pendingStatuses = array_values(array_intersect($statuses, ['draft', 'ready_to_issue', 'incomplete']));
            if ($pendingStatuses === []) {
                $hasReceived = count(array_filter($statuses, static fn (string $status): bool => $status === 'received')) > 0;
                $hasIssued = count(array_filter($statuses, static fn (string $status): bool => $status === 'issued')) > 0;
                $hcu012AStatus = $hasReceived
                    ? 'received'
                    : ($hasIssued ? 'issued' : 'cancelled');
            } elseif (in_array('incomplete', $statuses, true)) {
                $hcu012AStatus = 'incomplete';
            } elseif (in_array('draft', $statuses, true)) {
                $hcu012AStatus = 'draft';
            } else {
                $hcu012AStatus = 'ready_to_issue';
            }
        }
        $hcu012AReportStatus = 'not_applicable';
        if ($imagingOrderReportEvaluations !== []) {
            $hcu012AReportStatus = 'not_received';
            $reportStatuses = array_map(
                static fn (array $evaluation): string => ClinicalHistoryRepository::trimString($evaluation['status'] ?? 'not_received'),
                $imagingOrderReportEvaluations
            );
            if (in_array('received', $reportStatuses, true)) {
                $hcu012AReportStatus = 'received';
            } elseif (in_array('ready_to_receive', $reportStatuses, true)) {
                $hcu012AReportStatus = 'ready_to_receive';
            } elseif (in_array('draft', $reportStatuses, true)) {
                $hcu012AReportStatus = 'draft';
            }
        }
        $requiredImagingOrderPending = count(array_filter(
            array_map(
                static fn (array $imagingOrder): array => ClinicalHistoryRepository::evaluateImagingOrder($imagingOrder),
                $requiredImagingOrders
            ),
            static fn (array $evaluation): bool => !in_array(
                ClinicalHistoryRepository::trimString($evaluation['status'] ?? ''),
                ['issued', 'cancelled'],
                true
            )
        ));
        $hcu012AReady = $requiredImagingOrderPending === 0;
        self::appendChecklist(
            $checklist,
            'hcu012a_imaging',
            $hcu012AReady,
            'HCU-012A imagenologia',
            $requiredImagingOrders === []
                ? ($imagingOrders === []
                    ? 'No hay solicitudes de imagenología exigibles para este episodio.'
                    : 'Las solicitudes de imagenología del episodio no fueron marcadas como obligatorias para aprobar el plan actual.')
                : ($hcu012AReady
                    ? 'Las solicitudes de imagenología marcadas como parte del plan actual ya fueron emitidas o canceladas.'
                    : 'Todavía hay solicitudes de imagenología requeridas que no se han emitido o cancelado.'),
            [
                'status' => $hcu012AStatus,
                'requiredImagingOrders' => count($requiredImagingOrders),
                'pendingRequiredImagingOrders' => $requiredImagingOrderPending,
            ]
        );
        if (!$hcu012AReady) {
            $blockingReasons[] = self::blockingReason(
                'hcu012a_imaging_order_pending_issue',
                'Falta emitir o cancelar una solicitud de imagenología requerida',
                'Emite o cancela la solicitud HCU-012A marcada como parte del plan actual antes de aprobar la nota final.',
                [
                    'status' => $hcu012AStatus,
                    'pendingRequiredImagingOrders' => $requiredImagingOrderPending,
                ]
            );
        }

        $aiTerminal = $pendingAi === []
            || in_array($pendingAiStatus, ['completed', 'failed', 'superseded', 'closed'], true);
        self::appendChecklist(
            $checklist,
            'pending_ai',
            $aiTerminal,
            'IA pendiente',
            $aiTerminal
                ? 'No hay una tarea de IA no reconciliada bloqueando el caso.'
                : 'Existe una ejecucion de IA pendiente o en curso.',
            $pendingAi === [] ? [] : ['pendingAi' => $pendingAi]
        );
        if (!$aiTerminal) {
            $blockingReasons[] = self::blockingReason(
                'pending_ai_non_terminal',
                'IA pendiente sin reconciliar',
                'Espera o concilia la respuesta de IA antes de aprobar.',
                ['pendingAi' => $pendingAi]
            );
        }

        self::appendChecklist(
            $checklist,
            'critical_events',
            !$hasCriticalOpenEvent,
            'Alertas criticas abiertas',
            !$hasCriticalOpenEvent
                ? 'No hay eventos clinicos criticos abiertos.'
                : 'El episodio mantiene una alerta clinica critica abierta.',
            []
        );
        if ($hasCriticalOpenEvent) {
            $blockingReasons[] = self::blockingReason(
                'critical_alert_open',
                'Existe una alerta clinica critica abierta',
                'Resuelve la alerta critica antes de aprobar la nota final.',
                []
            );
        }

        $posologyAmbiguous = $treatment !== '' && ((bool) ($posology['ambiguous'] ?? true));
        self::appendChecklist(
            $checklist,
            'posology',
            !$posologyAmbiguous,
            'Posologia defendible',
            !$posologyAmbiguous
                ? 'La posologia no esta marcada como ambigua.'
                : 'Hay tratamiento propuesto con posologia aun ambigua.',
            []
        );
        if ($posologyAmbiguous) {
            $blockingReasons[] = self::blockingReason(
                'ambiguous_posology',
                'La posologia sigue ambigua',
                'Aclara la posologia antes de emitir la aprobacion final.',
                []
            );
        }

        $hcu024Status = 'not_applicable';
        if ($writtenConsentEvaluations !== []) {
            $statuses = array_map(
                static fn (array $evaluation): string => ClinicalHistoryRepository::trimString($evaluation['status'] ?? 'draft'),
                $writtenConsentEvaluations
            );
            $allAccepted = count(array_filter($statuses, static fn (string $status): bool => $status === 'accepted')) === count($statuses);
            if (in_array('revoked', $statuses, true)) {
                $hcu024Status = 'revoked';
            } elseif (in_array('declined', $statuses, true)) {
                $hcu024Status = 'declined';
            } elseif ($allAccepted) {
                $hcu024Status = 'accepted';
            } elseif (in_array('ready_for_declaration', $statuses, true)
                && !array_intersect($statuses, ['draft', 'incomplete'])
            ) {
                $hcu024Status = 'ready_for_declaration';
            } elseif (in_array('draft', $statuses, true)) {
                $hcu024Status = 'draft';
            } else {
                $hcu024Status = 'incomplete';
            }
        } elseif (($consent['required'] ?? false) === true) {
            $hcu024Status = ClinicalHistoryRepository::trimString($consent['status'] ?? 'incomplete');
            if ($hcu024Status === '' || $hcu024Status === 'pending') {
                $hcu024Status = 'incomplete';
            }
        }
        $consentReady = $writtenConsentEvaluations === []
            ? !($consent['required'] ?? false) || ClinicalHistoryRepository::trimString($consent['status'] ?? '') === 'accepted'
            : $hcu024Status === 'accepted';
        self::appendChecklist(
            $checklist,
            'hcu024_consent',
            $consentReady,
            'HCU-024 consentimiento por procedimiento',
            $consentReady
                ? 'El consentimiento exigible ya esta resuelto para este episodio.'
                : 'Todavia falta resolver el consentimiento HCU-024 del procedimiento indicado.',
            [
                'status' => $hcu024Status,
                'activePacketStatus' => $activeConsentEvaluation['status'] ?? '',
            ]
        );
        if (!$consentReady) {
            $code = match ($hcu024Status) {
                'declined' => 'hcu024_consent_declined',
                'revoked' => 'hcu024_consent_revoked',
                default => 'hcu024_consent_incomplete',
            };
            $blockingReasons[] = self::blockingReason(
                $code,
                $hcu024Status === 'declined'
                    ? 'El consentimiento del procedimiento fue negado'
                    : ($hcu024Status === 'revoked'
                        ? 'El consentimiento del procedimiento fue revocado'
                        : 'Falta consentimiento HCU-024 por procedimiento'),
                'No se puede aprobar mientras el consentimiento HCU-024 exigible no este aceptado.',
                ['status' => $hcu024Status]
            );
        }

        $doctorProfile = function_exists('doctor_profile_document_fields')
            ? doctor_profile_document_fields([])
            : [];
        $complianceMspMissing = ComplianceMSP::validate([
            'patient' => $session['patient'] ?? [],
            'intake' => $draft['intake'] ?? [],
            'hcu005' => $hcu005,
            'doctor' => $session['doctor'] ?? '',
            'doctor_msp' => self::resolveDoctorMsp($session, $doctorProfile),
            'doctor_profile' => $doctorProfile,
        ]);
        $complianceMspMissingLabels = ComplianceMSP::labelsFor($complianceMspMissing);

        self::appendChecklist(
            $checklist,
            'compliance_msp',
            $complianceMspMissing === [],
            'Compliance MSP',
            $complianceMspMissing === []
                ? 'Todos los campos clínicos mínimos obligatorios están cubiertos.'
                : 'Faltan campos clínicos mínimos MVP: ' . implode(', ', $complianceMspMissingLabels) . '.',
            [
                'missingFields' => $complianceMspMissing,
                'missingFieldLabels' => $complianceMspMissingLabels,
            ]
        );
        if ($complianceMspMissing !== []) {
            $blockingReasons[] = self::blockingReason(
                'compliance_msp_incomplete',
                'Faltan campos mínimos de Compliance MSP',
                'Revisa y completa los siguientes campos: ' . implode(', ', $complianceMspMissingLabels),
                [
                    'missingFields' => $complianceMspMissing,
                    'missingFieldLabels' => $complianceMspMissingLabels,
                ]
            );
        }

        $ready = $blockingReasons === [];

        return [
            'status' => $ready ? 'ready' : 'blocked',
            'ready' => $ready,
            'label' => $ready ? 'Lista para aprobar' : 'Bloqueada',
            'summary' => $ready
                ? 'La historia clinica cubre HCU-001, HCU-005, HCU-007, HCU-010A, HCU-012A, HCU-024 y los bloqueos medico-legales minimos para aprobar.'
                : 'La aprobacion esta bloqueada hasta completar la admision HCU-001, HCU-005, HCU-007, HCU-010A, HCU-012A, HCU-024 y los faltantes medico-legales visibles.',
            'checklist' => $checklist,
            'blockingReasons' => $blockingReasons,
            'approvalBlockedReasons' => $blockingReasons,
            'hcu001Status' => [
                'status' => (string) ($hcu001Evaluation['status'] ?? 'missing'),
                'label' => match ((string) ($hcu001Evaluation['status'] ?? 'missing')) {
                    'complete' => 'HCU-001 completa',
                    'legacy_partial' => 'HCU-001 heredada por regularizar',
                    'partial' => 'HCU-001 parcial',
                    default => 'HCU-001 faltante',
                },
                'summary' => match ((string) ($hcu001Evaluation['status'] ?? 'missing')) {
                    'complete' => 'La admision longitudinal ya deja identidad y contacto base defendibles.',
                    'legacy_partial' => 'El expediente heredado necesita regularizacion de admision, pero no se congela por eso.',
                    'partial' => 'La admision ya tiene datos, pero aun faltan campos nucleo del expediente.',
                    default => 'Todavia falta registrar la admision HCU-001 del expediente.',
                },
                'missingCoreFields' => $hcu001Evaluation['missingCoreFields'] ?? [],
                'transitionMode' => $hcu001Evaluation['transitionMode'] ?? 'legacy_inferred',
            ],
            'hcu005Status' => [
                'status' => (string) ($hcu005Evaluation['status'] ?? 'missing'),
                'label' => match ((string) ($hcu005Evaluation['status'] ?? 'missing')) {
                    'complete' => 'HCU-005 completo',
                    'partial' => 'HCU-005 parcial',
                    default => 'HCU-005 pendiente',
                },
                'summary' => match ((string) ($hcu005Evaluation['status'] ?? 'missing')) {
                    'complete' => 'La evolucion, la impresion diagnostica y el plan ya sostienen el HCU-005 del episodio.',
                    'partial' => 'El episodio ya tiene contenido HCU-005, pero todavia faltan bloques o prescripciones por cerrar.',
                    default => 'Todavia no hay cobertura suficiente del HCU-005 para este episodio.',
                },
            ],
            'hcu007Status' => [
                'status' => $hcu007Status,
                'label' => match ($hcu007Status) {
                    'received' => 'HCU-007 informe recibido',
                    'issued' => 'HCU-007 emitida',
                    'ready_to_issue' => 'HCU-007 lista para emitir',
                    'cancelled' => 'HCU-007 cancelada',
                    'incomplete' => 'HCU-007 incompleta',
                    'draft' => 'HCU-007 borrador',
                    default => 'HCU-007 no aplica',
                },
                'summary' => match ($hcu007Status) {
                    'received' => 'La interconsulta ya fue emitida y el informe del consultado quedó recibido como respaldo documental.',
                    'issued' => 'La interconsulta requerida ya fue emitida sin esperar respuesta del consultado.',
                    'ready_to_issue' => 'La interconsulta ya cubre los campos minimos del MSP y esta lista para emitirse.',
                    'cancelled' => 'La interconsulta del episodio fue cancelada y no bloquea el cierre actual.',
                    'incomplete' => 'Existe una interconsulta requerida con campos clinicos todavia incompletos.',
                    'draft' => 'Existe una interconsulta en borrador que aun no se ha emitido.',
                    default => 'No hay interconsulta formal exigible para este episodio.',
                },
            ],
            'hcu010AStatus' => [
                'status' => $hcu010AStatus,
                'label' => match ($hcu010AStatus) {
                    'issued' => 'HCU-010A emitida',
                    'ready_to_issue' => 'HCU-010A lista para emitir',
                    'cancelled' => 'HCU-010A cancelada',
                    'incomplete' => 'HCU-010A incompleta',
                    'draft' => 'HCU-010A borrador',
                    default => 'HCU-010A no aplica',
                },
                'summary' => match ($hcu010AStatus) {
                    'issued' => 'La solicitud de laboratorio requerida ya fue emitida dentro del episodio.',
                    'ready_to_issue' => 'La solicitud de laboratorio ya cubre los campos mínimos del MSP y está lista para emitirse.',
                    'cancelled' => 'La solicitud de laboratorio del episodio fue cancelada y no bloquea el cierre actual.',
                    'incomplete' => 'Existe una solicitud de laboratorio requerida con campos todavía incompletos.',
                    'draft' => 'Existe una solicitud de laboratorio en borrador aún no emitida.',
                    default => 'No hay solicitud formal de laboratorio exigible para este episodio.',
                },
            ],
            'hcu012AStatus' => [
                'status' => $hcu012AStatus,
                'label' => match ($hcu012AStatus) {
                    'received' => 'HCU-012A resultado recibido',
                    'issued' => 'HCU-012A emitida',
                    'ready_to_issue' => 'HCU-012A lista para emitir',
                    'cancelled' => 'HCU-012A cancelada',
                    'incomplete' => 'HCU-012A incompleta',
                    'draft' => 'HCU-012A borrador',
                    default => 'HCU-012A no aplica',
                },
                'summary' => match ($hcu012AStatus) {
                    'received' => 'La solicitud de imagenología ya fue emitida y su resultado radiológico quedó recibido como respaldo documental.',
                    'issued' => 'La solicitud de imagenología requerida ya fue emitida dentro del episodio.',
                    'ready_to_issue' => 'La solicitud de imagenología ya cubre los campos mínimos del MSP y está lista para emitirse.',
                    'cancelled' => 'La solicitud de imagenología del episodio fue cancelada y no bloquea el cierre actual.',
                    'incomplete' => 'Existe una solicitud de imagenología requerida con campos todavía incompletos.',
                    'draft' => 'Existe una solicitud de imagenología en borrador aún no emitida.',
                    default => 'No hay solicitud formal de imagenología exigible para este episodio.',
                },
            ],
            'hcu007ReportStatus' => [
                'status' => $hcu007ReportStatus,
                'label' => match ($hcu007ReportStatus) {
                    'received' => 'Informe del consultado recibido',
                    'ready_to_receive' => 'Informe listo para recibir',
                    'draft' => 'Informe del consultado en borrador',
                    default => 'Informe del consultado no recibido',
                },
                'summary' => match ($hcu007ReportStatus) {
                    'received' => 'El informe del consultado ya quedó capturado y anexado al episodio.',
                    'ready_to_receive' => 'El informe del consultado ya cubre los campos mínimos para recepción formal.',
                    'draft' => 'Existe un borrador del informe del consultado aún sin recepción formal.',
                    default => 'Todavía no se ha recibido informe del consultado.',
                },
            ],
            'hcu012AReportStatus' => [
                'status' => $hcu012AReportStatus,
                'label' => match ($hcu012AReportStatus) {
                    'received' => 'Resultado radiológico recibido',
                    'ready_to_receive' => 'Resultado listo para recibir',
                    'draft' => 'Resultado radiológico en borrador',
                    'not_received' => 'Resultado radiológico no recibido',
                    default => 'Resultado radiológico no aplica',
                },
                'summary' => match ($hcu012AReportStatus) {
                    'received' => 'El resultado radiológico ya quedó capturado y anexado al episodio.',
                    'ready_to_receive' => 'El resultado radiológico ya cubre los campos mínimos para recepción formal.',
                    'draft' => 'Existe un borrador del resultado radiológico aún sin recepción formal.',
                    'not_received' => 'Todavía no se ha recibido resultado radiológico para las órdenes emitidas.',
                    default => 'No hay resultado radiológico aplicable para este episodio.',
                },
            ],
            'hcu024Status' => [
                'status' => $hcu024Status,
                'label' => match ($hcu024Status) {
                    'accepted' => 'HCU-024 aceptado',
                    'ready_for_declaration' => 'HCU-024 lista para declarar',
                    'declined' => 'HCU-024 negado',
                    'revoked' => 'HCU-024 revocado',
                    'draft' => 'HCU-024 borrador',
                    'incomplete' => 'HCU-024 incompleto',
                    default => 'HCU-024 no aplica',
                },
                'summary' => match ($hcu024Status) {
                    'accepted' => 'El consentimiento escrito por procedimiento ya quedo aceptado.',
                    'ready_for_declaration' => 'El formulario ya cubre los bloques obligatorios y esta listo para declarar.',
                    'declined' => 'Existe una negativa registrada para el procedimiento escrito del episodio.',
                    'revoked' => 'El consentimiento escrito fue revocado y exige reconciliar la indicacion del procedimiento.',
                    'draft' => 'Existe un consentimiento por procedimiento aun en borrador.',
                    'incomplete' => 'El consentimiento por procedimiento todavia no cubre todos los campos del HCU-024.',
                    default => 'No hay consentimiento escrito por procedimiento exigible para este episodio.',
                },
            ],
            'complianceMspStatus' => [
                'status' => $complianceMspMissing === [] ? 'complete' : 'incomplete',
                'missingFields' => $complianceMspMissing,
                'missingFieldLabels' => $complianceMspMissingLabels,
                'label' => $complianceMspMissing === [] ? 'Compliance MSP OK' : 'Faltan campos MVP',
                'summary' => $complianceMspMissing === []
                    ? 'Cumple con los campos mínimos requeridos.'
                    : 'Faltan campos obligatorios descritos en ComplianceMSP para cerrar el registro: ' . implode(', ', $complianceMspMissingLabels) . '.',
            ],
            'normativeSources' => [
                'MSP-AM-5216A',
                'MSP-AM-0457-ref',
                'MSP-AM-5316',
                'MSP-HCU-FORM-001',
                'MSP-HCU-FORM-005',
                'MSP-HCU-FORM-007',
                'MSP-HCU-FORM-010A',
                'MSP-HCU-FORM-012A',
                'MSP-HCU-FORM-024',
            ],
        ];
    }

    /**
     * @param array<string,mixed> $session
     * @param array<string,mixed> $doctorProfile
     */
    private static function resolveDoctorMsp(array $session, array $doctorProfile): string
    {
        $doctor = is_array($session['doctor'] ?? null) ? $session['doctor'] : [];

        return ClinicalHistoryRepository::trimString(
            $session['doctorMsp'] ?? $session['doctor_msp'] ?? $doctor['msp'] ?? $doctor['mspNumber'] ?? $doctorProfile['msp'] ?? ''
        );
    }

    /**
     * @param array<int,array<string,mixed>> $checklist
     * @param array<string,mixed> $meta
     */
    private static function appendChecklist(
        array &$checklist,
        string $code,
        bool $passed,
        string $label,
        string $message,
        array $meta
    ): void {
        $checklist[] = [
            'code' => $code,
            'status' => $passed ? 'pass' : 'fail',
            'label' => $label,
            'message' => $message,
            'meta' => $meta,
        ];
    }

    /**
     * @param array<string,mixed> $meta
     * @return array<string,mixed>
     */
    private static function blockingReason(string $code, string $label, string $message, array $meta): array
    {
        return [
            'code' => $code,
            'label' => $label,
            'message' => $message,
            'meta' => $meta,
        ];
    }
}
