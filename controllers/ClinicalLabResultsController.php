<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';
require_once __DIR__ . '/../lib/api_helpers.php';

/**
 * ClinicalLabResultsController — Facade para ingesta de resultados externos.
 *
 * Split arquitectónico de ClinicalHistoryController (S42-02).
 * Cubre: resultados de laboratorio, imágenes diagnósticas, interconsultas,
 * PDFs de lab, y reacciones adversas.
 *
 * Rutas registradas en lib/routes.php:
 *   - receive-lab-result            → receiveLabResult()
 *   - receive-imaging-result        → receiveImagingResult()
 *   - receive-interconsult-report   → receiveInterconsultReport()
 *   - upload-lab-pdf                → uploadLabPdf()
 *   - report-adverse-reaction       → reportAdverseReaction()
 *
 * @see lib/routes.php
 * @see ClinicalHistoryController (monolito origen)
 */
final class ClinicalLabResultsController
{
    /**
     * POST /api.php?resource=receive-lab-result
     * Registra un resultado de laboratorio para un caso clínico.
     */
    public static function receiveLabResult(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $payload = require_json_body();

        self::requireCaseId($payload);

        $service = new ClinicalHistoryService();
        $result = $service->invokeServiceMethod($store, 'receiveLabResult', $payload);
        self::emit($result);
    }

    /**
     * POST /api.php?resource=receive-imaging-result
     * Registra un resultado de imagenología (RX, eco, TC, RMN).
     */
    public static function receiveImagingResult(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $payload = require_json_body();

        self::requireCaseId($payload);

        $service = new ClinicalHistoryService();
        $result = $service->invokeServiceMethod($store, 'receiveImagingResult', $payload);
        self::emit($result);
    }

    /**
     * POST /api.php?resource=receive-interconsult-report
     * Registra un informe de interconsulta de especialidad.
     */
    public static function receiveInterconsultReport(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $payload = require_json_body();

        self::requireCaseId($payload);

        $service = new ClinicalHistoryService();
        $result = $service->invokeServiceMethod($store, 'receiveInterconsultReport', $payload);
        self::emit($result);
    }

    /**
     * POST /api.php?resource=upload-lab-pdf
     * Adjunta el PDF del resultado de laboratorio al caso clínico.
     */
    public static function uploadLabPdf(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $payload = require_json_body();

        self::requireCaseId($payload);

        $service = new ClinicalHistoryService();
        $result = $service->invokeServiceMethod($store, 'uploadLabPdf', $payload);
        self::emit($result);
    }

    /**
     * POST /api.php?resource=report-adverse-reaction
     * Registra una reacción adversa a medicamento o procedimiento.
     */
    public static function reportAdverseReaction(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $payload = require_json_body();

        self::requireCaseId($payload);

        $service = new ClinicalHistoryService();
        $result = $service->invokeServiceMethod($store, 'reportAdverseReaction', $payload);
        self::emit($result);
    }

    // ── Internal ──────────────────────────────────────────────────────────

    private static function requireCaseId(array $payload): void
    {
        $caseId = trim((string) ($payload['caseId'] ?? ($payload['case_id'] ?? '')));
        if ($caseId === '') {
            json_response(['ok' => false, 'error' => 'caseId requerido para ingesta de resultado', 'code' => 'lab_bad_request'], 400);
        }
    }

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
            'receiveLabResult'          => self::receiveLabResult($context),
            'receiveImagingResult'      => self::receiveImagingResult($context),
            'receiveInterconsultReport' => self::receiveInterconsultReport($context),
            'uploadLabPdf'              => self::uploadLabPdf($context),
            'reportAdverseReaction'     => self::reportAdverseReaction($context),
            default => json_response(['ok' => false, 'error' => 'Action not found: ' . $action], 404),
        };
    }
}
