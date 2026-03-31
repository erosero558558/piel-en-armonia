<?php

declare(strict_types=1);

final class ClinicalPhotosController
{
    public static function index(array $context): void
    {
        if (!($context['isAdmin'] ?? false)) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        $caseId = trim((string) ($_GET['caseId'] ?? ''));
        if ($caseId === '') {
            json_response(['ok' => false, 'error' => 'Falta caseId'], 400);
        }

        $store = $context['store'] ?? read_store();
        $allUploads = isset($store['clinical_uploads']) && is_array($store['clinical_uploads'])
            ? $store['clinical_uploads']
            : [];

        $photos = [];
        foreach ($allUploads as $upload) {
            if (!is_array($upload)) {
                continue;
            }

            if (($upload['kind'] ?? '') !== 'clinical_photo') {
                continue;
            }

            if (($upload['patientCaseId'] ?? '') !== $caseId) {
                continue;
            }

            $uploadId = (int) ($upload['id'] ?? 0);
            $url = '/api.php?resource=media-flow-private-asset&assetId=cma_' . $uploadId;
            
            $photos[] = [
                'id' => $uploadId,
                'url' => (string) ($upload['url'] ?? $url),
                'thumbnailUrl' => (string) ($upload['thumbnailUrl'] ?? $url),
                'region' => (string) ($upload['region'] ?? ''),
                'notes' => (string) ($upload['notes'] ?? ''),
                'capturedAt' => (string) ($upload['capturedAt'] ?? $upload['createdAt'] ?? ''),
                'visitLabel' => (string) ($upload['visitLabel'] ?? ''),
            ];
        }

        usort($photos, static function (array $a, array $b): int {
            return strcmp($a['capturedAt'], $b['capturedAt']);
        });

        json_response([
            'ok' => true,
            'photos' => $photos,
        ]);
    }

    public static function upload(array $context): void
    {
        if (!($context['isAdmin'] ?? false)) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        $caseId = trim((string) ($_POST['caseId'] ?? ''));
        $region = trim((string) ($_POST['region'] ?? ''));
        $notes = trim((string) ($_POST['notes'] ?? ''));

        if ($caseId === '') {
            json_response(['ok' => false, 'error' => 'Validacion: caseId es requerido'], 400);
        }
        if ($region === '') {
            json_response(['ok' => false, 'error' => 'Validacion: region anatomica es requerida'], 400);
        }

        $photoFile = $_FILES['photo'] ?? null;
        if (!is_array($photoFile) || ($photoFile['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            json_response(['ok' => false, 'error' => 'Validacion: photo es requerida o error de subida'], 400);
        }

        $tmpName = (string) ($photoFile['tmp_name'] ?? '');
        $size = (int) ($photoFile['size'] ?? 0);
        if ($tmpName === '' || !is_file($tmpName) || $size === 0) {
            json_response(['ok' => false, 'error' => 'Validacion: archivo invalido'], 400);
        }

        // Max 10MB
        if ($size > 10 * 1024 * 1024) {
            json_response(['ok' => false, 'error' => 'Validacion: maximo 10MB'], 400);
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = $finfo ? (string) finfo_file($finfo, $tmpName) : '';
        if ($finfo) {
            finfo_close($finfo);
        }

        $allowedMimeTypes = [
            'image/jpeg' => 'jpg',
            'image/png'  => 'png',
            'image/webp' => 'webp'
        ];

        if (!isset($allowedMimeTypes[$mime])) {
            json_response(['ok' => false, 'error' => 'Validacion: solo se permiten JPEG, PNG, o WebP'], 400);
        }
        
        $ext = $allowedMimeTypes[$mime];
        $targetDir = __DIR__ . '/../uploads/clinical/' . $caseId;
        if (!is_dir($targetDir) && !mkdir($targetDir, 0750, true) && !is_dir($targetDir)) {
             json_response(['ok' => false, 'error' => 'Error de sistema: no se pudo crear el directorio'], 500);
        }

        $sha256 = hash_file('sha256', $tmpName);
        $shortSha = substr(is_string($sha256) ? $sha256 : bin2hex(random_bytes(16)), 0, 8);
        $timestamp = time();
        $filename = "{$timestamp}-{$shortSha}.{$ext}";
        $targetPath = $targetDir . '/' . $filename;

        if (!move_uploaded_file($tmpName, $targetPath)) {
            if (@copy($tmpName, $targetPath)) {
                @unlink($tmpName);
            } else {
                json_response(['ok' => false, 'error' => 'Error de sistema: no se pudo guardar el archivo'], 500);
            }
        }
        @chmod($targetPath, 0640);

        $now = local_date('c');
        $lockResult = with_store_lock(static function () use ($caseId, $mime, $size, $sha256, $filename, $region, $notes, $now): array {
            $store = read_store();
            
            $maxId = 0;
            $pastPhotos = 0;
            $clinicalUploads = isset($store['clinical_uploads']) && is_array($store['clinical_uploads'])
                ? array_values($store['clinical_uploads'])
                : [];
                
            foreach ($clinicalUploads as $upload) {
                if (!is_array($upload)) {
                    continue;
                }
                $maxId = max($maxId, (int) ($upload['id'] ?? 0));
                
                if ((string) ($upload['patientCaseId'] ?? '') === $caseId && (string) ($upload['kind'] ?? '') === 'clinical_photo') {
                    $pastPhotos++;
                }
            }

            $newId = $maxId + 1;
            // S29-06: Tag de visita
            $visitLabel = 'Consulta ' . ($pastPhotos + 1);

            $newUpload = [
                'id' => $newId,
                'patientCaseId' => $caseId,
                'kind' => 'clinical_photo',
                'storageMode' => 'private_path',
                'privatePath' => 'uploads/clinical/' . $caseId . '/' . $filename,
                'mime' => $mime,
                'size' => $size,
                'sha256' => $sha256,
                'region' => $region,
                'notes' => $notes,
                'visitLabel' => $visitLabel,
                'createdAt' => $now,
                'capturedAt' => $now,
                'updatedAt' => $now,
            ];

            $clinicalUploads[] = $newUpload;
            $store['clinical_uploads'] = $clinicalUploads;
            
            if (!write_store($store, false)) {
                return ['ok' => false, 'error' => 'No se pudo guardar en la base de datos'];
            }

            return ['ok' => true, 'photo' => $newUpload];
        });

        if (!is_array($lockResult) || ($lockResult['ok'] ?? false) !== true) {
            json_response(['ok' => false, 'error' => $lockResult['error'] ?? 'Error de concurrencia'], 500);
        }

        $result = is_array($lockResult['result'] ?? null) ? $lockResult['result'] : [];
        if (($result['ok'] ?? false) !== true) {
            json_response(['ok' => false, 'error' => $result['error'] ?? 'Error interno al guardar'], 500);
        }

        $photo = $result['photo'] ?? [];
        $url = '/api.php?resource=media-flow-private-asset&assetId=cma_' . $photo['id'];
        $photo['url'] = $url;
        $photo['thumbnailUrl'] = $url;

        json_response([
            'ok' => true,
            'photo' => $photo,
        ], 201);
    }
}
