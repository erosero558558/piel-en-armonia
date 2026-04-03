<?php

declare(strict_types=1);

final class PortalViewService
{
public static function buildPortalTimelineEvents(
        array $consultation,
        array $documents,
        array $photoSummary
    ): array {
        $events = [[
            'type' => 'consultation',
            'icon' => 'visit',
            'label' => self::buildPortalConsultationEventLabel((string) ($consultation['serviceName'] ?? '')),
            'meta' => trim(
                (string) ($consultation['dateLabel'] ?? '')
                . ((string) ($consultation['timeLabel'] ?? '') !== '' ? ' · ' . (string) ($consultation['timeLabel'] ?? '') : '')
            ),
            'tone' => 'idle',
        ]];

        $prescriptionEvent = self::buildPortalDocumentTimelineEvent(
            is_array($documents['prescription'] ?? null) ? $documents['prescription'] : []
        );
        if ($prescriptionEvent !== null) {
            $events[] = $prescriptionEvent;
        }

        $certificateEvent = self::buildPortalDocumentTimelineEvent(
            is_array($documents['certificate'] ?? null) ? $documents['certificate'] : []
        );
        if ($certificateEvent !== null) {
            $events[] = $certificateEvent;
        }

        $photoEvent = self::buildPortalPhotoTimelineEvent($photoSummary);
        if ($photoEvent !== null) {
            $events[] = $photoEvent;
        }

        return $events;
    }


public static function buildPortalConsultationEventLabel(string $serviceName): string
    {
        $serviceName = trim($serviceName);
        if ($serviceName === '') {
            return 'Consulta registrada';
        }

        $lower = function_exists('mb_strtolower')
            ? mb_strtolower($serviceName, 'UTF-8')
            : strtolower($serviceName);

        if (str_starts_with($lower, 'consulta')) {
            return $serviceName;
        }

        return 'Consulta por ' . $lower;
    }


public static function normalize_clinical_document(array $doc): array
    {
        return [
            'id' => trim((string) ($doc['id'] ?? '')),
            'type' => trim((string) ($doc['type'] ?? '')),
            'title' => trim((string) ($doc['title'] ?? '')),
            'status' => trim((string) ($doc['status'] ?? '')),
            'statusLabel' => trim((string) ($doc['statusLabel'] ?? '')),
            'description' => trim((string) ($doc['description'] ?? '')),
            'issuedAtLabel' => trim((string) ($doc['issuedAtLabel'] ?? '')),
            'voided_at' => trim((string) ($doc['voided_at'] ?? ($doc['voidedAt'] ?? ''))),
            'void_reason' => trim((string) ($doc['void_reason'] ?? ($doc['voidReason'] ?? ''))),
        ];
    }


public static function buildPortalDocumentTimelineEvent(array $document): ?array
    {
        $status = strtolower(trim((string) ($document['status'] ?? '')));
        $type = strtolower(trim((string) ($document['type'] ?? 'document')));
        if (!in_array($status, ['available', 'pending'], true)) {
            return null;
        }

        $isPrescription = $type === 'prescription';
        $label = $status === 'available'
            ? ($isPrescription ? 'Receta lista' : 'Certificado listo')
            : ($isPrescription ? 'Receta en preparación' : 'Certificado en preparación');

        return [
            'type' => $isPrescription ? 'prescription' : 'certificate',
            'icon' => $isPrescription ? 'prescription' : 'document',
            'label' => $label,
            'meta' => trim((string) ($document['issuedAtLabel'] ?? $document['description'] ?? '')),
            'tone' => $status === 'available' ? 'good' : 'warning',
        ];
    }


public static function buildPortalPhotoTimelineEvent(array $photoSummary): ?array
    {
        $count = (int) ($photoSummary['count'] ?? 0);
        if ($count <= 0) {
            return null;
        }

        $bodyZone = trim((string) ($photoSummary['bodyZone'] ?? ''));
        $createdAt = trim((string) ($photoSummary['latestCreatedAt'] ?? ''));
        $label = $count > 1 ? $count . ' fotos de control enviadas' : 'Foto de control enviada';
        $metaParts = [];
        if ($bodyZone !== '') {
            $metaParts[] = self::humanizeValue($bodyZone, '');
        }
        if ($createdAt !== '') {
            $metaParts[] = PortalBillingService::buildPortalDateTimeLabel($createdAt, '');
        }

        return [
            'type' => 'photo',
            'icon' => 'photo',
            'label' => $label,
            'meta' => trim(implode(' · ', array_filter($metaParts))),
            'tone' => 'good',
        ];
    }


public static function historyStatusLabel(string $status): string
    {
        if ($status === 'completed') {
            return 'Atención finalizada';
        }

        if ($status === 'pending') {
            return 'Consulta en seguimiento';
        }

        return 'Consulta registrada';
    }


public static function caseBelongsToPortalPatient(string $caseId, array $caseIds, array $snapshot): bool
    {
        $caseId = trim($caseId);
        if ($caseId === '') {
            return false;
        }

        if (in_array($caseId, $caseIds, true)) {
            return true;
        }

        return $caseId === trim((string) ($snapshot['patientCaseId'] ?? ''));
    }


public static function emitPdfResponse(string $pdfBytes, string $fileName): void
    {
        if (defined('TESTING_ENV')) {
            $payload = [
                'ok' => true,
                'format' => 'pdf',
                'filename' => $fileName,
                'contentType' => 'application/pdf',
                'contentLength' => strlen($pdfBytes),
                'binary' => $pdfBytes,
            ];
            $GLOBALS['__TEST_RESPONSE'] = ['payload' => $payload, 'status' => 200];
            if (!defined('TESTING_FORCE_EXIT')) {
                throw new TestingExitException($payload, 200);
            }
        }

        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="' . $fileName . '"');
        header('Content-Length: ' . strlen($pdfBytes));
        header('Cache-Control: private, max-age=3600');
        echo $pdfBytes;
        exit;
    }


public static function buildFallbackPdf(string $html): string
    {
        $text = strip_tags(str_replace(['<br>', '</div>', '</p>', '</h1>', '</h2>', '</strong>'], "\n", $html));
        if (function_exists('mb_convert_encoding')) {
            $text = mb_convert_encoding(trim($text), 'ISO-8859-1', 'UTF-8');
        } else {
            $text = trim($text);
        }

        $lines = [];
        $lines[] = '%PDF-1.4';
        $lines[] = '1 0 obj<< /Type /Catalog /Pages 2 0 R >> endobj';
        $lines[] = '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >> endobj';
        $lines[] = '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj';

        $content = "BT\n/F1 12 Tf\n20 800 Td\n15 TL\n";
        foreach (explode("\n", $text) as $rawLine) {
            $line = trim($rawLine);
            if ($line === '') {
                $content .= "T*\n";
                continue;
            }

            $clean = strtr($line, ['\\' => '\\\\', '(' => '\\(', ')' => '\\)']);
            $content .= '(' . $clean . ") Tj T*\n";
        }
        $content .= "ET";

        $length = strlen($content);
        $lines[] = "4 0 obj<< /Length {$length} >>\nstream\n{$content}\nendstream\nendobj";
        $lines[] = '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj';

        $pdf = implode("\n", $lines);
        $pdf .= "\nxref\n0 6\n0000000000 65535 f \n";
        $pdf .= "trailer<</Size 6/Root 1 0 R>>\nstartxref\n9\n%%EOF";
        return $pdf;
    }


public static function escapeHtml(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    }


public static function buildRescheduleUrl(string $token): string
    {
        $token = trim($token);
        return $token !== '' ? app_api_relative_url('reschedule', ['token' => $token]) : '';
    }


public static function buildSupportWhatsappUrl(array $patient, array $appointment, ?string $tenantId = null): string
    {
        $digits = preg_replace('/\D+/', '', AppConfig::WHATSAPP_NUMBER);
        if (!is_string($digits) || $digits === '') {
            return '';
        }

        $patientName = trim((string) ($patient['name'] ?? 'Paciente'));
        $serviceName = self::humanizeValue((string) ($appointment['service'] ?? ''), 'mi cita');
        $date = trim((string) ($appointment['date'] ?? ''));
        $time = trim((string) ($appointment['time'] ?? ''));

        $parts = ['Hola, necesito ayuda con mi cita del portal Aurora Derm.'];
        if ($patientName !== '') {
            $parts[] = 'Paciente: ' . $patientName . '.';
        }
        if ($serviceName !== 'mi cita' || $date !== '' || $time !== '') {
            $parts[] = 'Referencia: ' . trim($serviceName . ' ' . $date . ' ' . $time) . '.';
        }

        return 'https://wa.me/' . $digits . '?text=' . rawurlencode(implode(' ', $parts));
    }


public static function buildTelemedicineRoomUrl(int $appointmentId, string $token): string
    {
        if ($token !== '') {
            return app_api_relative_url('telemedicine-preconsultation', ['token' => $token]);
        }
        if ($appointmentId > 0) {
            return app_api_relative_url('telemedicine-preconsultation', ['id' => (string) $appointmentId]);
        }

        return app_api_relative_url('telemedicine-preconsultation');
    }


public static function buildTelemedicinePreConsultationUrl(int $appointmentId, string $token): string
    {
        if ($token !== '') {
            return app_api_relative_url('telemedicine-preconsultation', ['token' => $token]);
        }
        if ($appointmentId > 0) {
            return app_api_relative_url('telemedicine-preconsultation', ['id' => (string) $appointmentId]);
        }

        return app_api_relative_url('telemedicine-preconsultation');
    }


public static function resolveAppointmentTypeKey(array $appointment, ?array $serviceConfig): string
    {
        $visitMode = strtolower(trim((string) ($appointment['visitMode'] ?? '')));
        $telemedicineChannel = strtolower(trim((string) ($appointment['telemedicineChannel'] ?? '')));
        $serviceCategory = strtolower(trim((string) ($serviceConfig['category'] ?? '')));
        $serviceId = strtolower(trim((string) ($appointment['service'] ?? '')));

        if (
            str_contains($visitMode, 'tele')
            || str_contains($visitMode, 'video')
            || str_contains($telemedicineChannel, 'video')
            || str_contains($telemedicineChannel, 'tele')
            || in_array($serviceCategory, ['telemedicina'], true)
            || in_array($serviceId, ['video', 'telefono'], true)
        ) {
            return 'telemedicine';
        }

        return 'in_person';
    }


public static function resolveAppointmentTypeLabel(array $appointment, ?array $serviceConfig): string
    {
        if (self::resolveAppointmentTypeKey($appointment, $serviceConfig) === 'telemedicine') {
            return 'Teleconsulta';
        }

        $serviceCategory = strtolower(trim((string) ($serviceConfig['category'] ?? '')));
        if (in_array($serviceCategory, ['procedimiento', 'estetico'], true)) {
            return 'Procedimiento presencial';
        }

        return 'Consulta presencial';
    }


public static function resolveLocationLabel(array $appointment, ?array $serviceConfig): string
    {
        if (self::resolveAppointmentTypeKey($appointment, $serviceConfig) === 'telemedicine') {
            return 'Atencion virtual por enlace seguro';
        }

        return 'Consultorio Aurora Derm';
    }


public static function resolvePreparationRequired(array $appointment, ?array $serviceConfig): string
    {
        $serviceId = strtolower(trim((string) ($appointment['service'] ?? '')));
        $catalogPreparation = service_catalog_preparation_for($serviceId);
        if ($catalogPreparation !== '') {
            return $catalogPreparation;
        }

        $serviceName = strtolower(trim((string) ($serviceConfig['name'] ?? '')));
        $serviceCategory = strtolower(trim((string) ($serviceConfig['category'] ?? '')));
        $typeKey = self::resolveAppointmentTypeKey($appointment, $serviceConfig);
        $haystack = $serviceId . ' ' . $serviceName;

        if ($typeKey === 'telemedicine') {
            return 'Ten tu celular con buena conexion, fotos de apoyo y resultados recientes a la mano 10 minutos antes.';
        }

        if (str_contains($haystack, 'laser')) {
            return 'Llega con la piel limpia, evita bronceado reciente y no apliques cremas irritantes en la zona el mismo dia.';
        }

        if (
            str_contains($haystack, 'botox')
            || str_contains($haystack, 'peeling')
            || $serviceCategory === 'estetico'
            || $serviceCategory === 'procedimiento'
        ) {
            return 'Llega sin maquillaje en la zona a tratar y avisa si usaste retinoides, exfoliantes o recibiste otro procedimiento reciente.';
        }

        return 'Llega 10 minutos antes y trae tus medicamentos, examenes o fotos previas si ayudan a explicar la evolucion.';
    }


public static function formatDoctorName(string ...$candidates): string
    {
        foreach ($candidates as $candidate) {
            $candidate = trim($candidate);
            if ($candidate === '') {
                continue;
            }

            $candidate = str_replace(['_', '-'], ' ', $candidate);
            if (function_exists('mb_convert_case')) {
                return mb_convert_case($candidate, MB_CASE_TITLE, 'UTF-8');
            }

            return ucwords(strtolower($candidate));
        }

        return 'Especialista Aurora Derm';
    }


public static function buildDateLabel(string $date): string
    {
        $timestamp = strtotime(trim($date) . ' 00:00:00');
        if ($timestamp === false) {
            return trim($date);
        }

        $days = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
        $months = [
            1 => 'ene',
            2 => 'feb',
            3 => 'mar',
            4 => 'abr',
            5 => 'may',
            6 => 'jun',
            7 => 'jul',
            8 => 'ago',
            9 => 'sep',
            10 => 'oct',
            11 => 'nov',
            12 => 'dic',
        ];

        $dayLabel = $days[(int) date('w', $timestamp)] ?? '';
        $monthLabel = $months[(int) date('n', $timestamp)] ?? trim((string) date('m', $timestamp));

        return trim(sprintf(
            '%s %s %s %s',
            $dayLabel,
            date('j', $timestamp),
            $monthLabel,
            date('Y', $timestamp)
        ));
    }


public static function buildTimeLabel(string $time): string
    {
        $time = trim($time);
        if ($time === '') {
            return 'Por confirmar';
        }

        if (preg_match('/^\d{2}:\d{2}/', $time) === 1) {
            return substr($time, 0, 5);
        }

        return $time;
    }


public static function humanizeValue(string $value, string $fallback): string
    {
        $value = trim($value);
        if ($value === '') {
            return $fallback;
        }

        $value = str_replace(['_', '-'], ' ', $value);
        if (function_exists('mb_convert_case')) {
            return mb_convert_case($value, MB_CASE_TITLE, 'UTF-8');
        }

        return ucwords(strtolower($value));
    }


public static function portalPhotoBelongsToCaseMap(array $upload, array $caseMap): bool
    {
        $caseId = PortalHistoryService::firstNonEmptyString(
            (string) ($upload['patientCaseId'] ?? ''),
            (string) ($upload['clinicalHistoryCaseId'] ?? ''),
            (string) ($upload['caseId'] ?? '')
        );

        if ($caseId === '' || !isset($caseMap[$caseId])) {
            return false;
        }

        return strtolower(trim((string) ($upload['kind'] ?? ''))) === 'case_photo';
    }


public static function isPortalVisiblePhoto(array $upload): bool
    {
        $directFlags = [
            $upload['visibleToPatient'] ?? null,
            $upload['visible_to_patient'] ?? null,
            $upload['patientVisible'] ?? null,
            $upload['portalVisible'] ?? null,
            $upload['portal_visible'] ?? null,
            $upload['sharedWithPatient'] ?? null,
            $upload['showInPortal'] ?? null,
            $upload['patientPortalVisible'] ?? null,
        ];

        foreach ($directFlags as $flag) {
            $normalized = self::normalizePortalVisibilityFlag($flag);
            if ($normalized !== null) {
                return $normalized;
            }
        }

        foreach (['visibility', 'sharing', 'portal', 'patientPortal'] as $containerKey) {
            $container = is_array($upload[$containerKey] ?? null) ? $upload[$containerKey] : [];
            foreach (['patient', 'portal', 'visible', 'patientVisible', 'visibleToPatient'] as $nestedKey) {
                $normalized = self::normalizePortalVisibilityFlag($container[$nestedKey] ?? null);
                if ($normalized !== null) {
                    return $normalized;
                }
            }
        }

        return false;
    }


public static function normalizePortalVisibilityFlag($value): ?bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_int($value) || is_float($value)) {
            return ((int) $value) === 1;
        }

        if (!is_string($value)) {
            return null;
        }

        $normalized = strtolower(trim($value));
        if ($normalized === '') {
            return null;
        }

        if (in_array($normalized, ['1', 'true', 'yes', 'si', 'visible', 'shared', 'show'], true)) {
            return true;
        }

        if (in_array($normalized, ['0', 'false', 'no', 'hidden', 'private', 'internal'], true)) {
            return false;
        }

        return null;
    }


public static function normalizePortalPhotoItem(array $upload): ?array
    {
        $id = trim((string) ($upload['id'] ?? ''));
        if ($id === '') {
            return null;
        }

        $createdAt = trim((string) ($upload['createdAt'] ?? $upload['updatedAt'] ?? ''));
        $timestamp = PortalHistoryService::recordTimestamp([
            'createdAt' => $createdAt,
            'updatedAt' => (string) ($upload['updatedAt'] ?? ''),
        ]);
        $bodyZone = trim((string) ($upload['bodyZone'] ?? $upload['body_zone'] ?? ''));
        $bodyZoneLabel = self::humanizeValue($bodyZone, 'Seguimiento general');
        $photoRole = trim((string) ($upload['photoRole'] ?? ''));
        $photoRoleLabel = trim((string) ($upload['photoRoleLabel'] ?? self::humanizeValue($photoRole, '')));
        $createdAtLabel = PortalBillingService::buildPortalDateTimeLabel(
            $createdAt,
            $timestamp > 0 ? self::buildDateLabel(date('Y-m-d', $timestamp)) : 'Sin fecha'
        );

        return [
            'id' => $id,
            'bodyZone' => $bodyZone !== '' ? $bodyZone : 'general',
            'bodyZoneLabel' => $bodyZoneLabel,
            'createdAt' => $createdAt,
            'createdAtLabel' => $createdAtLabel,
            'dateLabel' => $timestamp > 0 ? self::buildDateLabel(date('Y-m-d', $timestamp)) : '',
            'timeLabel' => $timestamp > 0 ? self::buildTimeLabel(date('H:i', $timestamp)) : '',
            'photoRole' => $photoRole,
            'photoRoleLabel' => $photoRoleLabel,
            'fileName' => trim((string) ($upload['originalName'] ?? ('foto-' . $id . '.jpg'))),
            'imageUrl' => '/api.php?resource=patient-portal-photo-file&id=' . rawurlencode($id),
            'alt' => trim($bodyZoneLabel . ($createdAtLabel !== '' ? ' · ' . $createdAtLabel : '')),
            'sortTimestamp' => $timestamp,
        ];
    }


public static function findPortalVisiblePhotoUpload(array $store, array $caseIds, string $photoId, ?string $tenantId = null): ?array
    {
        $caseMap = [];
        foreach ($caseIds as $caseId) {
            $caseId = trim((string) $caseId);
            if ($caseId !== '') {
                $caseMap[$caseId] = true;
            }
        }

        foreach (($store['clinical_uploads'] ?? []) as $upload) {
            if (!is_array($upload)) {
                continue;
            }

            if (trim((string) ($upload['id'] ?? '')) !== $photoId) {
                continue;
            }

            if (!self::portalPhotoBelongsToCaseMap($upload, $caseMap)) {
                return null;
            }

            if (!self::isPortalVisiblePhoto($upload)) {
                return null;
            }

            return $upload;
        }

        return null;
    }


public static function resolvePortalPhotoAsset(array $upload): array
    {
        $path = self::resolvePortalPhotoDiskPath($upload);
        if ($path === '' || !is_file($path)) {
            return [];
        }

        $mime = self::safePortalMime((string) ($upload['mime'] ?? ''), $path);
        $extension = pathinfo($path, PATHINFO_EXTENSION);
        $fileName = trim((string) ($upload['originalName'] ?? ''));
        if ($fileName === '') {
            $fileName = 'foto-clinica' . ($extension !== '' ? '.' . strtolower($extension) : '.jpg');
        }

        return [
            'path' => $path,
            'contentType' => $mime,
            'fileName' => $fileName,
        ];
    }


public static function resolvePortalPhotoDiskPath(array $upload): string
    {
        $privatePath = ltrim(str_replace(['\\', '//'], '/', trim((string) ($upload['privatePath'] ?? ''))), '/');
        if ($privatePath !== '') {
            if (str_starts_with($privatePath, 'clinical-media/')) {
                return data_dir_path() . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $privatePath);
            }

            return clinical_media_dir_path() . DIRECTORY_SEPARATOR . basename($privatePath);
        }

        $diskPath = trim((string) ($upload['diskPath'] ?? ''));
        if ($diskPath !== '' && is_file($diskPath)) {
            return $diskPath;
        }

        $legacyPublicPath = trim((string) ($upload['legacyPublicPath'] ?? ''));
        if ($legacyPublicPath !== '' && function_exists('transfer_proof_upload_dir')) {
            return rtrim(transfer_proof_upload_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . basename($legacyPublicPath);
        }

        return '';
    }


public static function safePortalMime(string $mime, string $path): string
    {
        $mime = trim($mime);
        if ($mime !== '') {
            return $mime;
        }

        if (function_exists('mime_content_type')) {
            $detected = @mime_content_type($path);
            if (is_string($detected) && trim($detected) !== '') {
                return trim($detected);
            }
        }

        return 'application/octet-stream';
    }


public static function emitBinaryResponse(
        string $bytes,
        string $contentType,
        string $fileName,
        string $disposition = 'inline'
    ): void {
        if (defined('TESTING_ENV')) {
            $payload = [
                'ok' => true,
                'format' => 'binary',
                'filename' => $fileName,
                'contentType' => $contentType,
                'contentLength' => strlen($bytes),
                'binary' => $bytes,
            ];
            $GLOBALS['__TEST_RESPONSE'] = ['payload' => $payload, 'status' => 200];
            if (!defined('TESTING_FORCE_EXIT')) {
                throw new TestingExitException($payload, 200);
            }
        }

        header('Content-Type: ' . $contentType);
        header('Content-Disposition: ' . $disposition . '; filename="' . $fileName . '"');
        header('Content-Length: ' . strlen($bytes));
        header('Cache-Control: private, max-age=3600');
        echo $bytes;
        exit;
    }


public static function emit(array $result): void
    {
        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo completar la autenticacion del portal'),
                'code' => (string) ($result['code'] ?? 'patient_portal_error'),
            ], (int) ($result['status'] ?? 500));
        }

        json_response([
            'ok' => true,
            'data' => is_array($result['data'] ?? null) ? $result['data'] : [],
        ]);
    }

}
