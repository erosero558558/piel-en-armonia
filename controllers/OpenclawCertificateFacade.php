<?php

declare(strict_types=1);

/**
 * OpenclawCertificateFacade — Facade para generación de certificados médicos.
 *
 * Se extrajo de OpenclawController (S42-05) para aislar la generación de PDFs
 * de descansos médicos y constancias de atención.
 */
class OpenclawCertificateFacade
{

    public static function generateCertificate(array $context): void
    {
        OpenclawController::requireDoctorAuth();
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

        OpenclawController::mutateStore(static function (array $store) use ($certId, $certData): array {
            if (!isset($store['certificates'])) $store['certificates'] = [];
            $store['certificates'][$certId] = $certData;
            return ['ok' => true, 'store' => $store, 'storeDirty' => true];
        });

        $pdfUrl  = '/api.php?resource=openclaw-certificate&id=' . $certId . '&format=pdf';
        $store   = OpenclawController::readStore();
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
        OpenclawController::requireAuth();

        $certId = trim((string) ($_GET['id'] ?? ''));
        if ($certId === '') {
            json_response(['ok' => false, 'error' => 'id requerido'], 400);
        }

        $store = OpenclawController::readStore();
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
            $pdfBytes = OpenclawController::buildFallbackPdf($html);
        }

        $fileName = preg_replace('/[^a-zA-Z0-9_-]/', '-', (string) ($certificate['folio'] ?? $certId));
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="certificado-' . $fileName . '.pdf"');
        echo $pdfBytes;
        exit;
    }

        public static function buildCertificatePdfHtml(array $certificate, array $patient): string
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
}
