<?php
$contents = file_get_contents('controllers/PatientPortalController.php');
$method = <<<METHOD

    public static function historyPdf(array \$context): void
    {
        \$store = is_array(\$context['store'] ?? null) ? \$context['store'] : [];
        \$session = PatientPortalAuth::authenticateSession(
            \$store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if ((\$session['ok'] ?? false) !== true) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        \$sessionData = is_array(\$session['data'] ?? null) ? \$session['data'] : [];
        \$snapshot = is_array(\$sessionData['snapshot'] ?? null) ? \$sessionData['snapshot'] : [];
        \$patient = is_array(\$sessionData['patient'] ?? null) ? \$sessionData['patient'] : [];

        \$consultations = self::buildPortalHistory(\$store, \$snapshot, \$patient);
        
        \$patientName = htmlspecialchars(\$patient['fullName'] ?? 'Paciente', ENT_QUOTES, 'UTF-8');
        \$patientDocument = htmlspecialchars(\$patient['documentNumber'] ?? '', ENT_QUOTES, 'UTF-8');
        \$dateStr = local_date('d/m/Y');

        \$clinicProfile = read_clinic_profile();
        \$clinicName = htmlspecialchars(\$clinicProfile['clinicName'] ?: 'Aurora Derm');
        \$clinicAddress = htmlspecialchars(\$clinicProfile['address'] ?: 'Quito, Ecuador');
        \$clinicPhone = htmlspecialchars(\$clinicProfile['phone'] ?: '');
        \$clinicLogoHtml = \$clinicProfile['logoImage'] !== '' 
            ? '<img src="' . htmlspecialchars(\$clinicProfile['logoImage'], ENT_QUOTES, 'UTF-8') . '" style="max-height: 50px; display:inline-block; margin-right:10px; vertical-align:middle;" />' 
            : '';

        \$historyHtml = '';
        if (count(\$consultations) === 0) {
            \$historyHtml = '<p>No hay consultas registradas en este portal.</p>';
        } else {
            foreach (\$consultations as \$c) {
                \$fecha = htmlspecialchars(\$c['dateLabel'] ?? '', ENT_QUOTES, 'UTF-8');
                \$medico = htmlspecialchars(\$c['doctorName'] ?? '', ENT_QUOTES, 'UTF-8');
                \$diagnostico = htmlspecialchars(\$c['diagnosis'] ?? 'No especificado', ENT_QUOTES, 'UTF-8');
                \$plan = htmlspecialchars(\$c['treatmentPlan'] ?? 'No especificado', ENT_QUOTES, 'UTF-8');
                
                \$historyHtml .= "
                <div class=\\"section\\">
                    <h3>Consulta: {\$fecha}</h3>
                    <div style=\\"margin-bottom: 8px; font-size: 13px; color: #555;\\"><strong>Médico Tratante:</strong> {\$medico}</div>
                    <div style=\\"margin-bottom: 8px;\\"><strong>Diagnóstico:</strong><br> {\$diagnostico}</div>
                    <div style=\\"margin-bottom: 8px;\\"><strong>Plan/Tratamiento:</strong><br> {\$plan}</div>
                </div>";
            }
        }

        \$html = "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset=\\"utf-8\\">
            <title>Historia Clínica Digital</title>
            <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #111; }
                .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #c9a96e; padding-bottom: 20px; }
                .header-wrapper { display: inline-flex; align-items: center; justify-content: center; }
                .header h1 { margin: 0; font-size: 24px; color: #07090c; font-weight: bold; display: inline-block; vertical-align: middle; }
                .header p { margin: 5px 0 0 0; font-size: 14px; color: #666; }
                .title { font-size: 20px; font-weight: bold; text-align: center; margin-bottom: 30px; }
                .patient-info { margin-bottom: 30px; padding: 15px; background: #f9f9f9; border-radius: 4px; font-size: 14px; }
                .patient-info strong { display: inline-block; width: 100px; }
                .section { margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px dotted #ccc; }
                .section h3 { margin: 0 0 10px 0; font-size: 16px; color: #c9a96e; }
                .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
            </style>
        </head>
        <body>
            <div class=\\"header\\">
                <div class=\\"header-wrapper\\">
                    {\$clinicLogoHtml}
                    <h1>{\$clinicName}</h1>
                </div>
                <p>Clínica Especializada</p>
                <p>{\$clinicAddress} | Telf: {\$clinicPhone}</p>
            </div>
            
            <div class=\\"title\\">HISTORIA CLÍNICA - REPORTE DIGITAL</div>

            <div class=\\"patient-info\\">
                <div style=\\"margin-bottom: 8px;\\"><strong>Paciente:</strong> {\$patientName}</div>
                <div style=\\"margin-bottom: 8px;\\"><strong>Documento:</strong> {\$patientDocument}</div>
                <div><strong>Fecha de emisión:</strong> {\$dateStr}</div>
            </div>

            {\$historyHtml}

            <div class=\\"footer\\">
                Documento generado electrónicamente a través de Flow OS Patient Portal.<br>
                Este documento es una vista simplificada de sus atenciones como paciente.
            </div>
        </body>
        </html>
        ";

        \$pdfPath = __DIR__ . '/../vendor/dompdf/dompdf/src/Dompdf.php';
        if (file_exists(\$pdfPath)) {
            require_once \$pdfPath;
            // Suppress DOMDocument warnings from dompdf on complex HTML attributes if any
            libxml_use_internal_errors(true);
            \$dompdf = new \Dompdf\Dompdf(['isHtml5ParserEnabled' => true, 'isRemoteEnabled' => true]);
            \$dompdf->loadHtml(\$html, 'UTF-8');
            \$dompdf->setPaper('A4', 'portrait');
            \$dompdf->render();
            \$pdfBytes = \$dompdf->output();
        } else {
            \$text = strip_tags(str_replace(['<br>', '</div>', '</p>', '</h1>', '</h3>', '</li>'], "\\n", \$html));
            \$text = mb_convert_encoding(trim(\$text), 'ISO-8859-1', 'UTF-8');
            
            \$lines = [];
            \$lines[] = '%PDF-1.4';
            \$lines[] = '1 0 obj<< /Type /Catalog /Pages 2 0 R >> endobj';
            \$lines[] = '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >> endobj';
            \$lines[] = '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj';
            
            \$content = "BT\\n/F1 12 Tf\\n20 800 Td\\n15 TL\\n";
            foreach (explode("\\n", \$text) as \$rawLine) {
                \$cl = trim(\$rawLine);
                if (\$cl === '') {
                    \$content .= "T*\\n";
                    continue;
                }
                \$clean = strtr(\$cl, ['(' => '\\\(', ')' => '\\\)', '\\\\' => '\\\\\\\\']);
                \$content .= "({\$clean}) Tj T*\\n";
            }
            \$content .= "ET";
            
            \$len = strlen(\$content);
            \$lines[] = "4 0 obj<< /Length {\$len} >>\\nstream\\n{\$content}\\nendstream\\nendobj";
            \$lines[] = '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj';
            
            \$pdf = implode("\\n", \$lines);
            \$pdf .= "\\nxref\\n0 6\\n0000000000 65535 f \\n";
            \$pdf .= "trailer<</Size 6/Root 1 0 R>>\\nstartxref\\n9\\n%%EOF";
            \$pdfBytes = \$pdf;
        }

        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="historia-clinica-' . preg_replace('/[^a-zA-Z0-9]/', '', \$patientName) . '.pdf"');
        echo \$pdfBytes;
        exit;
    }
METHOD;

$contents = preg_replace('/public static function plan\(array \$context\): void/', $method . "\n\n    public static function plan(array \$context): void", $contents);
file_put_contents('controllers/PatientPortalController.php', $contents);
echo "Injected historyPdf method.";
?>
