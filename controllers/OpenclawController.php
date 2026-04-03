<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/openclaw/AIRouter.php';
require_once __DIR__ . '/../lib/DoctorProfileStore.php';
require_once __DIR__ . '/../lib/ClinicProfileStore.php';
require_once __DIR__ . '/../lib/email.php';

/**
 * OpenclawController — Copiloto clínico de Aurora Derm
 *
 * Endpoints consumidos por:
 *   - js/openclaw-chat.js  (interfaz de consulta embebida en admin)
 *   - openapi-openclaw.yaml (Custom GPT Actions de ChatGPT)
 *
 * Todos los endpoints requieren sesión de médico autenticado (admin).
 * El contexto del paciente viene del store de Flow OS.
 */
final class OpenclawController
{
    // ── patient ──────────────────────────────────────────────────────────────

    /**
     * GET /api.php?resource=openclaw-patient&patient_id=X&case_id=Y
     * Carga el contexto completo del paciente para alimentar la IA.
     * Este es el dato que diferencia a OpenClaw de ChatGPT solo.
     */

    // ── cie10Suggest ──────────────────────────────────────────────────────────

    /**
     * GET /api.php?resource=openclaw-cie10-suggest&q=dermatitis+atopica
     * Búsqueda rápida en el catálogo CIE-10 local.
     * Latencia objetivo: <50ms (es solo búsqueda en JSON).
     */

    // ── protocol ─────────────────────────────────────────────────────────────

    /**
     * GET /api.php?resource=openclaw-protocol&code=L20.0
     * Devuelve el protocolo de tratamiento estándar para un diagnóstico CIE-10.
     * Los protocolos se pueden extender en data/protocols/{code}.json
     */

    // ── chat ─────────────────────────────────────────────────────────────────

    /**
     * POST /api.php?resource=openclaw-chat
     * Proxy al AI Router — Tier 1 (Codex OAuth) → Tier 2 (OpenRouter free) → Tier 3 (local)
     * Streaming support: si ?stream=1, devuelve SSE.
     */

    // ── saveDiagnosis ─────────────────────────────────────────────────────────

    // ── saveEvolution ─────────────────────────────────────────────────────────

    // ── savePrescription ─────────────────────────────────────────────────────

    // ── getPrescriptionPdf ────────────────────────────────────────────────────

    // ── generateCertificate ───────────────────────────────────────────────────

    // ── checkInteractions ────────────────────────────────────────────────────

    // ── summarizeSession ─────────────────────────────────────────────────────

    // ── routerStatus ─────────────────────────────────────────────────────────

    // ── nextPatient ───────────────────────────────────────────────────────────

    /**
     * GET /api/openclaw/next-patient
     * Devuelve el paciente que está actualmente en consulta (o el siguiente en cola).
     * Permite al Custom GPT auto-cargar al paciente sin que el médico escriba el ID.
     */

    // ── Utilities ─────────────────────────────────────────────────────────────

    public static function requireAuth(): void
    {
        require_admin_auth();
    }

    public static function requireDoctorAuth(): void
    {
        require_doctor_auth();
    }

    /**
     * Fallback PDF generator when dompdf is not installed.
     * Produces a minimal valid PDF wrapping the HTML content as plain text.
     * NOT a substitute for dompdf — install vendor/dompdf for production.
     */
    public static function buildFallbackPdf(string $html): string
    {
        // Strip HTML tags to extract readable text
        $text = html_entity_decode(strip_tags(str_replace(['<br>', '<br/>', '<br />', '</p>', '</div>', '</tr>'], "\n", $html)), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $lines = array_slice(array_filter(array_map('trim', explode("\n", $text)), static fn ($l) => $l !== ''), 0, 80);

        $bodyLines = '';
        $yPos      = 750;
        foreach ($lines as $line) {
            $safe       = str_replace(['(', ')', '\\'], ['\(', '\)', '\\\\'], mb_substr($line, 0, 120));
            $bodyLines .= "BT /F1 10 Tf {$yPos} TL 72 {$yPos} Td ({$safe}) Tj ET\n";
            $yPos      -= 14;
            if ($yPos < 50) {
                break;
            }
        }

        $stream = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
            . "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
            . "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
            . "4 0 obj\n<< /Length " . strlen($bodyLines) . " >>\nstream\n" . $bodyLines . "endstream\nendobj\n"
            . "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";

        $xref   = strlen("%PDF-1.4\n") + strlen($stream);
        $output = "%PDF-1.4\n" . $stream
            . "xref\n0 6\n0000000000 65535 f \n"
            . str_pad((string) 9, 10, '0', STR_PAD_LEFT) . " 00000 n \n"
            . "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";

        return $output;
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

    public static function readStore(): array
    {
        return read_store();
    }

    public static function mutateStore(callable $fn): array
    {
        return mutate_store($fn);
    }

    public static function calculateAge(string $birthDate): ?int
    {
        if ($birthDate === '') return null;
        try {
            $dob  = new DateTime($birthDate);
            $now  = new DateTime();
            return (int) $now->diff($dob)->y;
        } catch (\Throwable $e) {
            return null;
        }
    }

    public static function normalizePrescriptionItemsPayload(array $medications): array
    {
        require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryRepository.php';

        $items = array_map(static function ($medication): array {
            if (is_string($medication)) {
                return [
                    'medication' => trim($medication),
                ];
            }

            if (!is_array($medication)) {
                return [];
            }

            return [
                'medication' => trim((string) ($medication['medication'] ?? $medication['name'] ?? '')),
                'dose' => trim((string) ($medication['dose'] ?? '')),
                'frequency' => trim((string) ($medication['frequency'] ?? '')),
                'duration' => trim((string) ($medication['duration'] ?? '')),
                'durationDays' => (int) ($medication['duration_days'] ?? $medication['durationDays'] ?? 0),
                'instructions' => trim((string) ($medication['instructions'] ?? $medication['notes'] ?? '')),
            ];
        }, $medications);

        return ClinicalHistoryRepository::normalizePrescriptionItems($items);
    }

    public static function normalizeMedicationNameList($medications): array
    {
        if (!is_array($medications)) {
            return [];
        }

        $normalized = [];
        foreach ($medications as $medication) {
            if (is_string($medication)) {
                $label = trim($medication);
            } elseif (is_array($medication)) {
                $name = trim((string) ($medication['name'] ?? $medication['medication'] ?? ''));
                $dose = trim((string) ($medication['dose'] ?? ''));
                $label = trim($name . ($dose !== '' ? ' ' . $dose : ''));
            } else {
                $label = '';
            }

            if ($label !== '') {
                $normalized[] = $label;
            }
        }

        return array_values(array_unique($normalized));
    }

    public static function resolveActiveMedicationsForCase(string $caseId): array
    {
        try {
            require_once __DIR__ . '/../lib/PatientCaseService.php';
            require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';

            $store = self::readStore();
            $case = $store['cases'][$caseId]
                ?? $store['patient_cases'][$caseId]
                ?? null;
            if ($case === null) {
                foreach (array_merge($store['cases'] ?? [], $store['patient_cases'] ?? []) as $c) {
                    if (($c['id'] ?? '') === $caseId) { $case = $c; break; }
                }
            }
            if (!is_array($case)) {
                return [];
            }

            $patientId = trim((string) ($case['patientId'] ?? ''));
            if ($patientId === '') {
                return [];
            }

            $historyService = new ClinicalHistoryService();
            $history = $historyService->getPatientHistory($store, $patientId);
            $prescriptions = is_array($history['prescriptions'] ?? null) ? array_reverse($history['prescriptions']) : [];
            foreach ($prescriptions as $prescription) {
                if (trim((string) ($prescription['status'] ?? '')) !== 'active') {
                    continue;
                }

                $active = self::normalizeMedicationNameList($prescription['medications'] ?? []);
                if ($active !== []) {
                    return $active;
                }
            }
        } catch (Throwable $error) {
            return [];
        }

        return [];
    }

    public static function normalizeMedicationKey(string $value): string
    {
        $normalized = strtolower(trim($value));
        $normalized = preg_replace('/[^a-z0-9]+/i', ' ', $normalized) ?? '';
        return trim((string) $normalized);
    }

    public static function medicationMatchesInteraction(string $medication, string $interactionDrug): bool
    {
        if ($medication === '' || $interactionDrug === '') {
            return false;
        }

        if ($medication === $interactionDrug) {
            return true;
        }

        if (str_contains($medication, $interactionDrug) || str_contains($interactionDrug, $medication)) {
            return true;
        }

        $medicationTokens = array_values(array_filter(explode(' ', $medication)));
        $interactionTokens = array_values(array_filter(explode(' ', $interactionDrug)));
        if ($medicationTokens === [] || $interactionTokens === []) {
            return false;
        }

        return in_array($interactionTokens[0], $medicationTokens, true)
            || in_array($medicationTokens[0], $interactionTokens, true);
    }

    public static function genericProtocol(string $code): array
    {
        $prefix = substr($code, 0, 1);

        $protocols = [
            'L' => [
                'cie10_code'          => $code,
                'first_line'          => [
                    ['medication' => 'Emoliente', 'dose' => 'aplicar 2-3 veces/día', 'duration' => 'continuo'],
                    ['medication' => 'Hidrocortisona 1%', 'dose' => 'aplicar bid', 'duration' => '14 días'],
                ],
                'alternatives'        => ['Betametasona 0.05% si respuesta pobre', 'Tacrolimus 0.1% para mantenimiento'],
                'follow_up'           => '4 semanas. Si no mejora: biopsia o interconsulta dermatología.',
                'referral_criteria'   => 'Afección >30% superficie corporal, signos sistémicos, sin respuesta a 8 semanas',
                'patient_instructions'=> 'Evitar rascado. Baños cortos con agua tibia. Ropa de algodón.',
            ],
            'B' => [
                'cie10_code'        => $code,
                'first_line'        => [
                    ['medication' => 'Según infección específica', 'dose' => 'ver protocolo', 'duration' => 'variable'],
                ],
                'alternatives'      => ['Consultar protocolo específico'],
                'follow_up'         => '2 semanas post-tratamiento.',
                'referral_criteria' => 'Infección diseminada, inmunocompromiso.',
                'patient_instructions'=> 'Completar tratamiento. Higiene estricta. Evitar contacto.',
            ],
            'C' => [
                'cie10_code'        => $code,
                'first_line'        => [
                    ['medication' => 'Derivación oncología urgente', 'dose' => '-', 'duration' => '<2 semanas'],
                ],
                'alternatives'      => [],
                'follow_up'         => 'Oncología dermatológica.',
                'referral_criteria' => 'SIEMPRE derivar',
                'patient_instructions'=> 'Evitar exposición solar. Acudir urgente a especialista.',
            ],
        ];

        return $protocols[$prefix] ?? [
            'cie10_code'         => $code,
            'first_line'         => [],
            'alternatives'       => [],
            'follow_up'          => 'Evaluación clínica.',
            'referral_criteria'  => 'Según criterio médico.',
            'patient_instructions'=> '',
        ];
    }

    // ── fastClose (S24 — Un click cierra la consulta) ─────────────────────

    /**
     * Fast Close: guarda diagnóstico + nota de evolución + cierra la consulta
     * en una sola request atómica.
     *
     * Payload mínimo:
     *   case_id      (string)  requerido
     *   cie10_code   (string)  requerido
     *   evolution    (string)  requerido (al menos 10 chars)
     *
     * Payload opcional:
     *   cie10_description  (string)
     *   notes              (string)  notas adicionales de diagnóstico
     *   post_instructions  (string)  indicaciones para el paciente
     *   close_stage        (string)  default: 'completed'
     *
     * Respuesta: { ok, closed_at, diagnosis_saved, evolution_id, stage }
     */

    // ── logClinicalAiAction (S10-02) ─────────────────────────────────────────

    /**
     * Escribe un evento de auditoría de IA clínica en data/clinical_ai_actions.jsonl
     *
     * Formato JSONL: un JSON por línea, append-only, nunca se modifica.
     * Campos: action, case_id, outcome, saved_value, ai_suggested, diff, doctor, ts.
     *
     * outcome: 'accepted_as_is' | 'edited' | 'rejected' | 'manual'
     */
    public static function logClinicalAiAction(array $event): void
    {
        try {
            $logPath = __DIR__ . '/../data/clinical_ai_actions.jsonl';
            $doctor  = trim((string) ($_SESSION['admin_email'] ?? 'unknown'));
            $entry   = json_encode(array_merge($event, [
                'doctor' => $doctor,
                'ts'     => gmdate('c'),
                'ip'     => trim((string) ($_SERVER['REMOTE_ADDR'] ?? '')),
            ]), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . "\n";

            // Atomic append — usa file_put_contents con LOCK_EX
            file_put_contents($logPath, $entry, FILE_APPEND | LOCK_EX);
        } catch (\Throwable) {
            // El log de auditoría nunca debe interrumpir el flujo clínico
        }
    }
}
