<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/certificate/CertificateGeneratorService.php';


/**
 * CertificateController — Generador de certificados médicos
 *
 * S3-OC3: El documento más pedido en consulta diaria.
 * Objetivo: médico emite certificado en <60 segundos.
 *
 * Tipos de certificado:
 *   reposo_laboral       — días de reposo (el más común)
 *   aptitud_medica       — apto para actividad (trabajo/deporte/viaje)
 *   constancia_tratamiento — en tratamiento médico activo
 *   control_salud        — asistencia a control de salud
 *   incapacidad_temporal — incapacidad temporal (para seguro)
 *
 * Endpoints:
 *   GET  /api.php?resource=certificate&case_id=X  → lista certificados del caso
 *   POST /api.php?resource=certificate             → crear + devolver PDF
 *   GET  /api.php?resource=certificate&id=CERT-X&format=pdf → descargar PDF
 */

require_once __DIR__ . '/../lib/storage.php';
require_once __DIR__ . '/../lib/api_helpers.php';
require_once __DIR__ . '/../lib/DoctorProfileStore.php';
require_once __DIR__ . '/../lib/ClinicProfileStore.php';

final class CertificateController
{
    public static function index(array $context): void
    {
        require_admin_auth();

        $certId = trim((string) ($_GET['id'] ?? ''));
        $format = strtolower(trim((string) ($_GET['format'] ?? '')));
        $caseId = trim((string) ($_GET['case_id'] ?? ''));

        // Descargar PDF específico
        if ($certId !== '' && $format === 'pdf') {
            self::servePdf($certId);
            return;
        }

        // Listar certificados del caso
        if ($caseId !== '') {
            $store = read_store();
            $certs = array_values(array_filter(
                $store['certificates'] ?? [],
                fn($c) => ($c['caseId'] ?? '') === $caseId
            ));
            usort($certs, fn($a, $b) => strcmp($b['issuedAt'] ?? '', $a['issuedAt'] ?? ''));
            json_response(['ok' => true, 'certificates' => $certs]);
            return;
        }

        json_response(['ok' => false, 'error' => 'case_id o id requerido'], 400);
    }

    // ── POST — crear certificado ──────────────────────────────────────────────

    public static function store(array $context): void
    {
        require_admin_auth();

        $payload = require_json_body();

        $caseId   = trim((string) ($payload['case_id'] ?? ''));
        $type     = trim((string) ($payload['type'] ?? 'reposo_laboral'));
        $restDays = max(0, (int) ($payload['rest_days'] ?? 0));
        $diagText = trim((string) ($payload['diagnosis_text'] ?? ''));
        $cie10    = strtoupper(trim((string) ($payload['cie10_code'] ?? '')));
        $restrict = trim((string) ($payload['restrictions'] ?? ''));
        $obs      = trim((string) ($payload['observations'] ?? ''));
        $doctorId = trim((string) ($payload['doctor_id'] ?? ''));

        if ($caseId === '') {
            json_response(['ok' => false, 'error' => 'case_id requerido'], 400);
        }
        if (!array_key_exists($type, self::CERT_TYPES)) {
            json_response(['ok' => false, 'error' => 'Tipo de certificado no válido'], 400);
        }

        // Cargar datos del caso
        $store   = read_store();
        $patient = self::resolvePatient($store, $caseId);
        if ($patient === null) {
            json_response(['ok' => false, 'error' => 'Caso no encontrado'], 404);
        }

        // Datos del médico (del perfil o del payload)
        $doctor = self::resolveDoctor($store, $doctorId);

        // Generar folio secuencial
        $folio = self::nextFolio($store);

        $certId = 'cert-' . bin2hex(random_bytes(6));
        $now    = gmdate('c');

        $clinicProfile = read_clinic_profile();
        $certData = [
            'id'               => $certId,
            'folio'            => $folio,
            'caseId'           => $caseId,
            'type'             => $type,
            'typeLabel'        => self::CERT_TYPES[$type],
            'restDays'         => $restDays,
            'diagnosisText'    => $diagText,
            'cie10Code'        => $cie10,
            'restrictions'     => $restrict,
            'observations'     => $obs,
            'patient'          => $patient,
            'doctor'           => $doctor,
            'clinicName'       => $clinicProfile['clinicName'],
            'clinicAddress'    => $clinicProfile['address'] ?: 'Quito, Ecuador',
            'clinicPhone'      => $clinicProfile['phone'] ?: '',
            'issuedAt'         => $now,
            'issuedDateLocal'  => (new DateTime('now', new DateTimeZone('America/Guayaquil')))->format('d/m/Y'),
        ];

        // Guardar bajo lock — folio secuencial y escritura deben ser atómicos
        $savedResult = mutate_store(static function (array $store) use ($certId, $certData) {
            $store['certificates'] = isset($store['certificates']) && is_array($store['certificates'])
                ? $store['certificates']
                : [];
            // Recalcular folio dentro del lock para evitar duplicados
            $n = (int) ($store['_last_cert_folio'] ?? 0) + 1;
            $folio = 'AD-' . date('Y') . '-' . str_pad((string) $n, 4, '0', STR_PAD_LEFT);
            $certData['folio'] = $folio;
            $store['certificates'][$certId] = $certData;
            $store['_last_cert_folio'] = $n;
            return ['ok' => true, 'folio' => $folio, 'certData' => $certData, 'store' => $store, 'storeDirty' => true];
        });

        if (($savedResult['ok'] ?? false) !== true) {
            json_response([
                'ok'    => false,
                'error' => $savedResult['error'] ?? 'No se pudo guardar el certificado.',
            ], 500);
        }
        // Use the folio assigned inside the lock
        $folio    = $savedResult['folio'];
        $certData = $savedResult['certData'];

        // Generar PDF inline
        $pdfBase64 = self::generatePdfBase64($certData);
        $pdfUrl    = '/api.php?resource=certificate&id=' . $certId . '&format=pdf';

        // Construir URL WhatsApp
        $phone  = $patient['phone'] ?? '';
        $waText = self::buildWhatsAppText($certData);
        $waUrl  = $phone !== ''
            ? 'https://wa.me/' . preg_replace('/[^0-9]/', '', $phone) . '?text=' . urlencode($waText)
            : '';

        json_response([
            'ok'             => true,
            'certificate_id' => $certId,
            'folio'          => $folio,
            'pdf_url'        => $pdfUrl,
            'pdf_base64'     => $pdfBase64,
            'whatsapp_url'   => $waUrl,
            'whatsapp_text'  => $waText,
        ]);
    }

    // ── PDF rendering ─────────────────────────────────────────────────────────

    public static function servePdf(string $certId): void
    {
        $store    = read_store();
        $certData = $store['certificates'][$certId] ?? null;

        if ($certData === null) {
            json_response(['ok' => false, 'error' => 'Certificado no encontrado'], 404);
        }

        $pdf = self::generatePdfBase64($certData);
        $raw = base64_decode($pdf);
        $fileName = 'certificado-' . ($certData['folio'] ?? $certId) . '.pdf';

        if (defined('TESTING_ENV')) {
            $payload = [
                'ok' => true,
                'format' => 'pdf',
                'filename' => $fileName,
                'contentType' => 'application/pdf',
                'contentLength' => strlen((string) $raw),
                'binary' => (string) $raw,
            ];
            $GLOBALS['__TEST_RESPONSE'] = ['payload' => $payload, 'status' => 200];
            if (!defined('TESTING_FORCE_EXIT')) {
                throw new TestingExitException($payload, 200);
            }
        }

        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="' . $fileName . '"');
        header('Content-Length: ' . strlen((string) $raw));
        header('Cache-Control: private, max-age=3600');
        echo $raw;
        exit;
    }

    public static function generatePdfBase64(...$args)
    {
        return CertificateGeneratorService::generatePdfBase64(...$args);
    }

    public static function renderHtmlWithDompdf(...$args)
    {
        return CertificateGeneratorService::renderHtmlWithDompdf(...$args);
    }

    public static function buildFallbackPdf(...$args)
    {
        return CertificateGeneratorService::buildFallbackPdf(...$args);
    }

    public static function buildCertificateHtml(...$args)
    {
        return CertificateGeneratorService::buildCertificateHtml(...$args);
    }

    public static function contentReposoLaboral(...$args)
    {
        return CertificateGeneratorService::contentReposoLaboral(...$args);
    }

    public static function contentAptitud(...$args)
    {
        return CertificateGeneratorService::contentAptitud(...$args);
    }

    public static function contentTratamiento(...$args)
    {
        return CertificateGeneratorService::contentTratamiento(...$args);
    }

    public static function contentControl(...$args)
    {
        return CertificateGeneratorService::contentControl(...$args);
    }

    public static function contentIncapacidad(...$args)
    {
        return CertificateGeneratorService::contentIncapacidad(...$args);
    }

    public static function resolvePatient(...$args)
    {
        return CertificateGeneratorService::resolvePatient(...$args);
    }

    public static function resolveDoctor(...$args)
    {
        return CertificateGeneratorService::resolveDoctor(...$args);
    }

    public static function nextFolio(...$args)
    {
        return CertificateGeneratorService::nextFolio(...$args);
    }

    public static function buildWhatsAppText(...$args)
    {
        return CertificateGeneratorService::buildWhatsAppText(...$args);
    }

    public static function daysToText(...$args)
    {
        return CertificateGeneratorService::daysToText(...$args);
    }

    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'GET:certificate':
                self::index($context);
                return;
            case 'POST:certificate':
                self::store($context);
                return;
            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
                        case 'index':
                            self::index($context);
                            return;
                        case 'store':
                            self::store($context);
                            return;
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
}
