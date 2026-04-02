<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';
require_once __DIR__ . '/../lib/PatientPortalAuth.php';
require_once __DIR__ . '/../lib/api_helpers.php';

/**
 * ClinicalMediaController — Facade para gestión de fotos y media clínica.
 *
 * Split arquitectónico de ClinicalHistoryController (S42-01).
 * Delega al servicio clínico canónico sin cambiar comportamiento.
 * Permite refactorizar el dominio sin riesgo de regresión.
 *
 * Rutas registradas en lib/routes.php:
 *   - clinical-photo-gallery  → photos()
 *   - clinical-photo-upload   → upload()
 *
 * @see lib/routes.php
 * @see ClinicalHistoryController (monolito origen)
 */
final class ClinicalMediaController
{
    /**
     * GET /api.php?resource=clinical-photo-gallery
     * Devuelve galería de fotos clínicas de un caso.
     */
    public static function photos(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $caseId = trim((string) ($_GET['caseId'] ?? ($_GET['case_id'] ?? '')));

        if ($caseId === '') {
            json_response(['ok' => false, 'error' => 'caseId requerido', 'code' => 'media_bad_request'], 400);
        }

        $service = new ClinicalHistoryService();
        $result = $service->invokeServiceMethod($store, 'getClinicalPhotos', [
            'caseId' => $caseId,
        ]);

        self::emit($result);
    }

    /**
     * POST /api.php?resource=clinical-photo-upload
     * Sube una foto clínica a un caso activo.
     */
    public static function upload(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $payload = require_json_body();

        $caseId = trim((string) ($payload['caseId'] ?? ($payload['case_id'] ?? '')));
        if ($caseId === '') {
            json_response(['ok' => false, 'error' => 'caseId requerido', 'code' => 'media_bad_request'], 400);
        }

        $service = new ClinicalHistoryService();
        $result = $service->invokeServiceMethod($store, 'uploadClinicalPhoto', array_merge($payload, [
            'caseId' => $caseId,
        ]));

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
            'photos' => self::photos($context),
            'upload' => self::upload($context),
            default  => json_response(['ok' => false, 'error' => 'Action not found: ' . $action], 404),
        };
    }
}
