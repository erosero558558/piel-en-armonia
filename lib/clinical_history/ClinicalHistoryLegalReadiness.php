<?php

declare(strict_types=1);

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
        $draft = ClinicalHistoryRepository::syncConsentArtifacts($draft, $session);
        $interconsultations = ClinicalHistoryRepository::normalizeInterconsultations(
            $draft['interconsultations'] ?? []
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
                $hasIssued = count(array_filter($statuses, static fn (string $status): bool => $status === 'issued')) > 0;
                $hcu007Status = $hasIssued ? 'issued' : 'cancelled';
            } elseif (in_array('incomplete', $statuses, true)) {
                $hcu007Status = 'incomplete';
            } elseif (in_array('draft', $statuses, true)) {
                $hcu007Status = 'draft';
            } else {
                $hcu007Status = 'ready_to_issue';
            }
        }
        $requiredInterconsultationPending = count(array_filter(
            array_map(
                static fn (array $interconsultation): array => ClinicalHistoryRepository::evaluateInterconsultation($interconsultation),
                $requiredInterconsultations
            ),
            static fn (array $evaluation): bool => !in_array(
                ClinicalHistoryRepository::trimString($evaluation['status'] ?? ''),
                ['issued', 'cancelled'],
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

        $ready = $blockingReasons === [];

        return [
            'status' => $ready ? 'ready' : 'blocked',
            'ready' => $ready,
            'label' => $ready ? 'Lista para aprobar' : 'Bloqueada',
            'summary' => $ready
                ? 'La historia clinica cubre HCU-001, HCU-005, HCU-007, HCU-024 y los bloqueos medico-legales minimos para aprobar.'
                : 'La aprobacion esta bloqueada hasta completar la admision HCU-001, HCU-005, HCU-007, HCU-024 y los faltantes medico-legales visibles.',
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
                    'issued' => 'HCU-007 emitida',
                    'ready_to_issue' => 'HCU-007 lista para emitir',
                    'cancelled' => 'HCU-007 cancelada',
                    'incomplete' => 'HCU-007 incompleta',
                    'draft' => 'HCU-007 borrador',
                    default => 'HCU-007 no aplica',
                },
                'summary' => match ($hcu007Status) {
                    'issued' => 'La interconsulta requerida ya fue emitida sin esperar respuesta del consultado.',
                    'ready_to_issue' => 'La interconsulta ya cubre los campos minimos del MSP y esta lista para emitirse.',
                    'cancelled' => 'La interconsulta del episodio fue cancelada y no bloquea el cierre actual.',
                    'incomplete' => 'Existe una interconsulta requerida con campos clinicos todavia incompletos.',
                    'draft' => 'Existe una interconsulta en borrador que aun no se ha emitido.',
                    default => 'No hay interconsulta formal exigible para este episodio.',
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
            'normativeSources' => [
                'MSP-AM-5216A',
                'MSP-AM-0457-ref',
                'MSP-AM-5316',
                'MSP-HCU-FORM-001',
                'MSP-HCU-FORM-005',
                'MSP-HCU-FORM-007',
                'MSP-HCU-FORM-024',
            ],
        ];
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
