<?php

declare(strict_types=1);

final class PrescriptionPdfRenderer
{
    /**
     * Generates a raw PDF string for a prescription
     */
    public static function generatePdfBytes(array $prescription, array $patient, array $clinicProfile): string
    {
        $html = self::buildHtml($prescription, $patient, $clinicProfile);

        // Try dompdf if available
        $pdfPath = __DIR__ . '/../../vendor/dompdf/dompdf/src/Dompdf.php';
        if (file_exists($pdfPath)) {
            try {
                require_once $pdfPath;
                $dompdf = new \Dompdf\Dompdf(['isHtml5ParserEnabled' => true, 'isRemoteEnabled' => true]);
                $dompdf->loadHtml($html, 'UTF-8');
                $dompdf->setPaper('A4', 'portrait');
                $dompdf->render();
                return $dompdf->output();
            } catch (\Throwable $e) {
                // Ignore dompdf errors and fallback
            }
        }

        return self::buildFallbackPdf($html);
    }

    private static function buildHtml(array $prescription, array $patient, array $clinicProfile): string
    {
        // Extract patient details
        $patientName = htmlspecialchars(trim(($patient['firstName'] ?? '') . ' ' . ($patient['lastName'] ?? '')), ENT_QUOTES, 'UTF-8');
        $patientCi   = htmlspecialchars($patient['ci'] ?? $patient['cedula'] ?? $patient['identification'] ?? '', ENT_QUOTES, 'UTF-8');
        $patientAge  = self::calculateAge($patient['birthDate'] ?? '');
        $patientAgeStr = $patientAge !== null ? "{$patientAge} años" : '';

        // Extract doctor details
        require_once __DIR__ . '/../api_helpers.php';
        $doctor = function_exists('doctor_profile_document_fields')
            ? doctor_profile_document_fields(
                isset($prescription['doctor']) && is_array($prescription['doctor'])
                    ? $prescription['doctor']
                    : ['name' => (string) ($prescription['issued_by'] ?? 'Medico tratante')]
            ) : $prescription['doctor'] ?? [];
        $doctorName = htmlspecialchars($doctor['name'] ?? $prescription['issued_by'] ?? 'Medico tratante', ENT_QUOTES, 'UTF-8');
        $doctorSpecialty = htmlspecialchars($doctor['specialty'] ?? '', ENT_QUOTES, 'UTF-8');
        $doctorMsp = htmlspecialchars($doctor['msp'] ?? '', ENT_QUOTES, 'UTF-8');
        $doctorSignatureImage = htmlspecialchars($doctor['signatureImage'] ?? '', ENT_QUOTES, 'UTF-8');
        $doctorSignatureHtml = $doctorSignatureImage !== ''
            ? "<img src=\"{$doctorSignatureImage}\" alt=\"Firma digital del medico\" style=\"max-width: 220px; max-height: 80px; display: block; margin-left: auto; margin-bottom: 10px; object-fit: contain;\">"
            : '';
        $doctorMspLine = $doctorMsp !== ''
            ? "Registro MSP: {$doctorMsp}"
            : 'Firma autorizada';

        // Extract clinic details
        $clinicName = htmlspecialchars($clinicProfile['clinicName'] ?? 'Clínica', ENT_QUOTES, 'UTF-8');
        $clinicAddress = htmlspecialchars($clinicProfile['address'] ?: 'Quito, Ecuador', ENT_QUOTES, 'UTF-8');
        $clinicPhone = htmlspecialchars($clinicProfile['phone'] ?: '', ENT_QUOTES, 'UTF-8');
        $clinicLogoHtml = ($clinicProfile['logoImage'] ?? '') !== '' 
            ? '<img src="' . htmlspecialchars($clinicProfile['logoImage'], ENT_QUOTES, 'UTF-8') . '" style="max-height: 50px; display:inline-block; margin-right:10px; vertical-align:middle;">' 
            : '';

        $dateStr = date('d/m/Y', strtotime($prescription['issued_at'] ?? 'now'));

        $medicationsHtml = '';
        foreach ($prescription['medications'] ?? [] as $med) {
            $medName = htmlspecialchars($med['medication'] ?? '', ENT_QUOTES, 'UTF-8');
            $dose = htmlspecialchars($med['dose'] ?? '', ENT_QUOTES, 'UTF-8');
            $freq = htmlspecialchars($med['frequency'] ?? '', ENT_QUOTES, 'UTF-8');
            $dur = htmlspecialchars($med['duration'] ?? '', ENT_QUOTES, 'UTF-8');
            $inst = htmlspecialchars($med['instructions'] ?? '', ENT_QUOTES, 'UTF-8');
            
            $medicationsHtml .= "
            <div style=\"margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px dashed #ccc;\">
                <h4 style=\"margin: 0 0 5px 0; font-size: 16px;\">{$medName}</h4>
                <p style=\"margin: 0; font-size: 14px; color: #333;\">
                    <strong>Tomar:</strong> {$dose}<br>
                    <strong>Frecuencia:</strong> {$freq} &nbsp;&mdash;&nbsp; <strong>Duración:</strong> {$dur}<br>
                    <strong>Indicaciones:</strong> {$inst}
                </p>
            </div>";
        }

        return "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset=\"utf-8\">
            <title>Receta Médica</title>
            <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #111; }
                .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #c9a96e; padding-bottom: 20px; }
                .header h1 { margin: 0; font-size: 24px; color: #07090c; font-weight: bold; }
                .header p { margin: 5px 0 0 0; font-size: 14px; color: #666; }
                .rx-symbol { font-size: 40px; font-weight: bold; color: #c9a96e; margin-bottom: 20px; font-style: italic; }
                .patient-info { margin-bottom: 30px; padding: 15px; background: #f9f9f9; border-radius: 4px; font-size: 14px; }
                .patient-info strong { display: inline-block; width: 100px; }
                .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
                .signature { margin-top: 60px; text-align: right; }
                .signature-line { border-top: 1px solid #000; width: 200px; display: inline-block; margin-bottom: 5px; }
            </style>
        </head>
        <body>
            <div class=\"header\">
                <div style=\"display: inline-flex; align-items: center; justify-content: center;\">
                    {$clinicLogoHtml}
                    <h1 style=\"display: inline-block; vertical-align: middle;\">{$clinicName}</h1>
                </div>
                <p>Clínica Especializada</p>
                <p>{$clinicAddress} | Telf: {$clinicPhone}</p>
            </div>
            
            <div class=\"patient-info\">
                <div style=\"margin-bottom: 8px;\"><strong>Paciente:</strong> {$patientName}</div>
                " . ($patientCi !== '' ? "<div style=\"margin-bottom: 8px;\"><strong>CI:</strong> {$patientCi}</div>" : '') . "
                " . ($patientAgeStr !== '' ? "<div style=\"margin-bottom: 8px;\"><strong>Edad:</strong> {$patientAgeStr}</div>" : '') . "
                <div><strong>Fecha:</strong> {$dateStr}</div>
            </div>

            <div class=\"rx-symbol\">Rx</div>

            <div class=\"medications\">
                {$medicationsHtml}
            </div>

            <div class=\"signature\">
                {$doctorSignatureHtml}
                <div class=\"signature-line\"></div>
                <div><strong>{$doctorName}</strong></div>
                <div style=\"font-size: 12px; color: #666;\">{$doctorSpecialty}</div>
                <div style=\"font-size: 12px; color: #666;\">{$doctorMspLine}</div>
            </div>

            <div class=\"footer\">
                Generado electrónicamente por Flow OS - Copiloto Clínico
            </div>
        </body>
        </html>
        ";
    }

    private static function buildFallbackPdf(string $html): string
    {
        $text = strip_tags(str_replace(['<br>', '</div>', '</p>', '</h1>', '</h4>'], "\n", $html));
        $text = mb_convert_encoding(trim($text), 'ISO-8859-1', 'UTF-8');
        
        $lines = [];
        $lines[] = '%PDF-1.4';
        $lines[] = '1 0 obj<< /Type /Catalog /Pages 2 0 R >> endobj';
        $lines[] = '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >> endobj';
        $lines[] = '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj';
        
        $content = "BT\n/F1 12 Tf\n20 800 Td\n15 TL\n";
        foreach (explode("\n", $text) as $rawLine) {
            $cl = trim($rawLine);
            if ($cl === '') {
                $content .= "T*\n";
                continue;
            }
            $clean = strtr($cl, ['(' => '\\(', ')' => '\\)', '\\' => '\\\\']);
            $content .= "({$clean}) Tj T*\n";
        }
        $content .= "ET";
        
        $len = strlen($content);
        $lines[] = "4 0 obj<< /Length {$len} >>\nstream\n{$content}\nendstream\nendobj";
        $lines[] = '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj';
        
        $pdf = implode("\n", $lines);
        $pdf .= "\nxref\n0 6\n0000000000 65535 f \n";
        $pdf .= "trailer<</Size 6/Root 1 0 R>>\nstartxref\n9\n%%EOF";
        return $pdf;
    }

    private static function calculateAge(string $birthDate): ?int
    {
        if ($birthDate === '') {
            return null;
        }
        try {
            return (int) (new DateTime($birthDate))->diff(new DateTime())->y;
        } catch (\Throwable $e) {
            return null;
        }
    }
}
