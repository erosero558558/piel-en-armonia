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
        $consent = ClinicalHistoryRepository::normalizeConsentRecord(
            is_array($draft['consent'] ?? null) ? $draft['consent'] : []
        );
        $documents = ClinicalHistoryRepository::normalizeClinicalDocuments(
            is_array($draft['documents'] ?? null) ? $draft['documents'] : []
        );

        $pendingAi = ClinicalHistoryRepository::normalizePendingAi(
            is_array($session['pendingAi'] ?? null)
                ? $session['pendingAi']
                : (is_array($draft['pendingAi'] ?? null) ? $draft['pendingAi'] : [])
        );
        $pendingAiStatus = ClinicalHistoryRepository::trimString($pendingAi['status'] ?? '');
        $summary = ClinicalHistoryRepository::trimString(
            ($draft['clinicianDraft']['resumen'] ?? '') ?: ($draft['intake']['resumenClinico'] ?? '')
        );
        $treatment = ClinicalHistoryRepository::trimString(
            ($documents['prescription']['medication'] ?? '') ?: ($draft['clinicianDraft']['tratamientoBorrador'] ?? '')
        );
        $posology = is_array($draft['clinicianDraft']['posologiaBorrador'] ?? null)
            ? $draft['clinicianDraft']['posologiaBorrador']
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
            'final_summary',
            $summary !== '',
            'Resumen clinico final',
            $summary !== ''
                ? 'La nota tiene una sintesis clinica final documentada.'
                : 'Todavia no existe un resumen clinico final defendible.',
            []
        );
        if ($summary === '') {
            $blockingReasons[] = self::blockingReason(
                'final_summary_missing',
                'Falta el resumen clinico final',
                'La nota final no puede aprobarse sin una sintesis clinica clara.',
                []
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

        $consentStatus = ClinicalHistoryRepository::trimString($consent['status'] ?? 'not_required');
        $consentReady = !$consent['required']
            || $consentStatus === 'accepted';
        self::appendChecklist(
            $checklist,
            'consent',
            $consentReady,
            'Consentimiento informado',
            $consentReady
                ? 'El consentimiento exigible ya esta resuelto para este episodio.'
                : 'El consentimiento requerido aun no esta aceptado.',
            ['status' => $consentStatus]
        );
        if (!$consentReady) {
            $code = $consentStatus === 'revoked' ? 'consent_revoked' : 'consent_incomplete';
            $blockingReasons[] = self::blockingReason(
                $code,
                $consentStatus === 'revoked'
                    ? 'El consentimiento fue revocado'
                    : 'Falta consentimiento informado',
                'No se puede aprobar mientras el consentimiento exigible no este aceptado.',
                ['status' => $consentStatus]
            );
        }

        $ready = $blockingReasons === [];

        return [
            'status' => $ready ? 'ready' : 'blocked',
            'ready' => $ready,
            'label' => $ready ? 'Lista para aprobar' : 'Bloqueada',
            'summary' => $ready
                ? 'La historia clinica cumple los bloqueos medico-legales minimos para aprobar.'
                : 'La aprobacion esta bloqueada hasta resolver los faltantes medico-legales visibles.',
            'checklist' => $checklist,
            'blockingReasons' => $blockingReasons,
            'approvalBlockedReasons' => $blockingReasons,
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
