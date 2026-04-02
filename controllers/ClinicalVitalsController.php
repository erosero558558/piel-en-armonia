<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';
require_once __DIR__ . '/../lib/api_helpers.php';

/**
 * ClinicalVitalsController — Facade para gestión de signos vitales.
 *
 * Split arquitectónico de ClinicalHistoryController (S42-03).
 * Cubre: registro de signos vitales en consulta presencial y
 * consulta del historial de vitales de un caso.
 *
 * Rutas registradas en lib/routes.php:
 *   - clinical-vitals         → store()
 *   - clinical-vitals-history → history()
 *
 * @see lib/routes.php
 * @see ClinicalHistoryController (monolito origen, 2065 líneas)
 * @see S40-09 self_reported_vitals de telemedicina
 */
final class ClinicalVitalsController
{
    /**
     * POST /api.php?resource=clinical-vitals
     * Registra signos vitales para un caso activo (tomados en consulta o self-reported).
     *
     * Payload esperado:
     *   caseId         string  — ID del caso clínico
     *   source         string  — 'measured_in_clinic' | 'patient_self_report'
     *   heartRate      int?
     *   bloodPressure  string? — ej: "120/80"
     *   temperature    float?  — Celsius
     *   o2Saturation   int?    — porcentaje
     *   weight         float?  — kg
     *   height         float?  — cm
     *   bmi            float?
     *   notes          string?
     */
    public static function store(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $payload = require_json_body();

        $caseId = trim((string) ($payload['caseId'] ?? ($payload['case_id'] ?? '')));
        if ($caseId === '') {
            json_response(['ok' => false, 'error' => 'caseId requerido', 'code' => 'vitals_bad_request'], 400);
        }

        // Validar source
        $source = trim((string) ($payload['source'] ?? 'measured_in_clinic'));
        if (!in_array($source, ['measured_in_clinic', 'patient_self_report'], true)) {
            $source = 'measured_in_clinic';
        }
        $payload['source'] = $source;

        $service = new ClinicalHistoryService();
        $result = $service->invokeServiceMethod($store, 'storeVitalSigns', $payload);
        self::emit($result);
    }

    /**
     * GET /api.php?resource=clinical-vitals-history&caseId=XXX
     * Devuelve el historial de signos vitales de un caso.
     * Distingue entre measured_in_clinic y patient_self_report.
     */
    public static function history(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $caseId = trim((string) ($_GET['caseId'] ?? ($_GET['case_id'] ?? '')));

        if ($caseId === '') {
            json_response(['ok' => false, 'error' => 'caseId requerido', 'code' => 'vitals_bad_request'], 400);
        }

        $service = new ClinicalHistoryService();
        $result = $service->invokeServiceMethod($store, 'getVitalSignsHistory', [
            'caseId' => $caseId,
        ]);

        self::emit($result);
    }

    // ── Internal ──────────────────────────────────────────────────────────

    private static function emit(array $result): void
    {
        $statusCode = (int) ($result['statusCode'] ?? 200);
        if ($statusCode <= 0) {
            $statusCode = ($result['ok'] ?? false) ? 200 : 500;
        }
        json_response($result, ($result['ok'] ?? false) ? 200 : $statusCode);
    }

    /** Route dispatcher (internal) */
    public static function handle(string $action, array $context): void
    {
        match ($action) {
            'store'   => self::store($context),
            'history' => self::history($context),
            default   => json_response(['ok' => false, 'error' => 'Action not found: ' . $action], 404),
        };
    }
}
