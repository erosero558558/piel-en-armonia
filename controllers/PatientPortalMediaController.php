<?php\n\nrequire_once __DIR__ . '/PatientPortalController.php';\n\nclass PatientPortalMediaController\n{\n    public static function photos(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            self::emit($session);
            return;
        }

        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        $patient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));

        self::emit([
            'ok' => true,
            'data' => [
                'authenticated' => true,
                'patient' => $patient,
                'gallery' => self::buildPortalPhotoGallery($store, $snapshot, $tenantId),
                'generatedAt' => local_date('c'),
            ],
        ]);
    }\n\n    public static function photoFile(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            self::emit($session);
            return;
        }

        $photoId = trim((string) ($_GET['id'] ?? ''));
        if ($photoId === '') {
            json_response(['ok' => false, 'error' => 'id requerido'], 400);
        }

        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        $caseIds = self::collectPatientCaseIds($store, $snapshot, $tenantId);

        $upload = self::findPortalVisiblePhotoUpload($store, $caseIds, $photoId);
        if (!is_array($upload)) {
            json_response(['ok' => false, 'error' => 'Foto no disponible para esta sesión'], 404);
        }

        $asset = self::resolvePortalPhotoAsset($upload);
        if (($asset['path'] ?? '') === '') {
            json_response(['ok' => false, 'error' => 'Foto no disponible para esta sesión'], 404);
        }

        self::emitBinaryResponse(
            (string) file_get_contents((string) $asset['path']),
            (string) ($asset['contentType'] ?? 'application/octet-stream'),
            (string) ($asset['fileName'] ?? 'foto-clinica.jpg')
        );
    }\n\n    public static function uploadPhoto(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            self::emit($session);
            return;
        }

        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $patient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $tenantId = trim((string) ($sessionData['tenantId'] ?? ''));
        $patientId = trim((string) ($patient['documentNumber'] ?? ''));
        
        $caseId = '';
        foreach (($store['cases'] ?? $store['patient_cases'] ?? []) as $c) {
            if (($c['patientId'] ?? '') === $patientId && (($c['status'] ?? '') === 'active' || ($c['status'] ?? '') === 'open')) {
                $caseId = $c['id'];
                break;
            }
        }

        if ($caseId === '') {
            self::emit(['ok' => false, 'error' => 'No se encontró un caso activo']);
            return;
        }

        $payload = require_json_body();
        $base64 = trim((string) ($payload['photo'] ?? ''));
        if ($base64 === '') {
            self::emit(['ok' => false, 'error' => 'Se requiere una imagen en formato base64']);
            return;
        }

        if (preg_match('/^data:image\/(\w+);base64,/', $base64, $type)) {
            $data = substr($base64, strpos($base64, ',') + 1);
            $type = strtolower($type[1]);
            
            $allowedTypes = ['jpeg', 'jpg', 'png', 'webp', 'gif'];
            if (!in_array($type, $allowedTypes, true)) {
                self::emit(['ok' => false, 'error' => 'Tipo de imagen no permitido', 'status' => 400]);
                return;
            }

            $data = base64_decode($data);
            if ($data === false) {
                self::emit(['ok' => false, 'error' => 'Imagen invalida']);
                return;
            }
        } else {
            self::emit(['ok' => false, 'error' => 'Formato requerido: data:image/...;base64,...']);
            return;
        }

        $fileName = 'portal_upload_' . uniqid() . '.' . $type;
        $uploadsDir = __DIR__ . '/../data/uploads';
        $savePath = $uploadsDir . '/' . $fileName;
        
        if (!file_exists($uploadsDir)) {
            @mkdir($uploadsDir, 0750, true);
        }
        
        $htaccessPath = $uploadsDir . '/.htaccess';
        if (!file_exists($htaccessPath)) {
            @file_put_contents($htaccessPath, "php_flag engine off\n    ");
        }

        file_put_contents($savePath, $data);

        $upload = [
            'id' => time() . mt_rand(100, 999),
            'patientCaseId' => $caseId,
            'fileName' => $fileName,
            'type' => 'image/' . $type,
            'size' => strlen($data),
            'source' => 'patient_upload',
            'createdAt' => local_date('c'),
        ];

        $lock = mutate_store(static function (array $store) use ($upload) {
            $store['clinical_uploads'] = is_array($store['clinical_uploads'] ?? null) ? $store['clinical_uploads'] : [];
            $store['clinical_uploads'][] = $upload;
            return ['ok' => true, 'store' => $store, 'storeDirty' => true];
        });

        if (($lock['ok'] ?? false) !== true) {
            self::emit(['ok' => false, 'error' => 'Error de concurrencia al guardar foto']);
            return;
        }

        self::emit(['ok' => true]);
    }\n\n}\n