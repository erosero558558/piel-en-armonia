<?php

require_once __DIR__ . '/OpenclawController.php';

class OpenclawCertificateController
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
    
            $html = OpenclawController::buildCertificatePdfHtml($certificate, $patient);
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

}
