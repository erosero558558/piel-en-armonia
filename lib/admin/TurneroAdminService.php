<?php

declare(strict_types=1);

final class TurneroAdminService
{
public static function buildTurneroV2Readiness(array $store): array
    {
        $profile = isset($store['turneroClinicProfile']) && is_array($store['turneroClinicProfile'])
            ? $store['turneroClinicProfile']
            : read_turnero_clinic_profile();
        $release = isset($profile['release']) && is_array($profile['release'])
            ? $profile['release']
            : [];
        $releaseMode = trim((string) ($release['mode'] ?? ''));
        $localWebPilot = $releaseMode === 'web_pilot';
        $nativeAppsBlocking = (bool) ($release['native_apps_blocking'] ?? false);
        $operatorAccessMeta = isset($store['turneroOperatorAccessMeta']) && is_array($store['turneroOperatorAccessMeta'])
            ? $store['turneroOperatorAccessMeta']
            : turnero_operator_access_meta();
        $surfaceStatus = isset($store['queueSurfaceStatus']) && is_array($store['queueSurfaceStatus'])
            ? $store['queueSurfaceStatus']
            : QueueSurfaceStatusStore::readSummary();

        $operatorSurface = self::buildTurneroSurfaceReadiness(
            'operator',
            $localWebPilot ? 'browser' : 'desktop',
            $surfaceStatus['operator'] ?? null,
            $nativeAppsBlocking
        );
        $kioskSurface = self::buildTurneroSurfaceReadiness(
            'kiosk',
            $localWebPilot ? 'browser' : 'desktop',
            $surfaceStatus['kiosk'] ?? null,
            $nativeAppsBlocking
        );
        $displaySurface = self::buildTurneroSurfaceReadiness(
            'display',
            $localWebPilot ? 'browser' : 'android_tv',
            $surfaceStatus['display'] ?? null,
            $nativeAppsBlocking
        );

        $adminReady = (string) ($release['admin_mode_default'] ?? '') === 'basic'
            && !empty($profile['surfaces']['admin']['enabled'])
            && trim((string) ($profile['surfaces']['admin']['route'] ?? '')) !== '';
        $adminSurface = [
            'surface' => 'admin',
            'label' => 'Admin',
            'expectedAppMode' => 'web',
            'appMode' => 'web',
            'ready' => $adminReady,
            'blocking' => false,
            'state' => $adminReady ? 'ready' : 'warning',
            'summary' => $adminReady
                ? ($localWebPilot
                    ? 'Admin listo como consola web local y centro de supervisión.'
                    : 'Admin listo como consola de supervisión y fallback.')
                : ($localWebPilot
                    ? 'Admin debe quedar habilitado en basic como consola local del piloto.'
                    : 'Admin debe quedar habilitado en basic como consola de recuperación.'),
            'stale' => false,
            'updatedAt' => '',
        ];

        $operatorDetails = self::surfaceLatestDetails($surfaceStatus['operator'] ?? null);
        $kioskDetails = self::surfaceLatestDetails($surfaceStatus['kiosk'] ?? null);
        $displayDetails = self::surfaceLatestDetails($surfaceStatus['display'] ?? null);

        $hardware = [
            'assistant' => self::buildTurneroHardwareReadiness(
                $localWebPilot || trim((string) ($kioskDetails['assistantSessionId'] ?? '')) !== '',
                'Asistente de kiosco',
                $localWebPilot
                    ? 'El asistente de kiosco queda diferido para la ola nativa y no bloquea el piloto web local.'
                    : (trim((string) ($kioskDetails['assistantSessionId'] ?? '')) !== ''
                        ? 'Asistente activo y midiendo sesiones.'
                        : 'Falta confirmar el asistente del kiosco con una sesión activa.')
            ),
            'printer' => self::buildTurneroHardwareReadiness(
                $localWebPilot || (bool) ($kioskDetails['printerPrinted'] ?? false),
                'Impresora térmica',
                $localWebPilot
                    ? 'La impresión térmica queda como validación posterior y no bloquea este corte local.'
                    : ((bool) ($kioskDetails['printerPrinted'] ?? false)
                        ? 'Impresora térmica validada con ticket reciente.'
                        : 'Falta una impresión térmica satisfactoria para salida.')
            ),
            'numpad' => self::buildTurneroHardwareReadiness(
                $localWebPilot || (bool) ($operatorDetails['numpadReady'] ?? false),
                'Numpad operador',
                $localWebPilot
                    ? 'El numpad del operador queda diferido para la superficie nativa y no bloquea el piloto web.'
                    : ((bool) ($operatorDetails['numpadReady'] ?? false)
                        ? 'Numpad operativo confirmado.'
                        : 'Falta validar el numpad antes del primer llamado.')
            ),
            'desktopShell' => self::buildTurneroHardwareReadiness(
                $localWebPilot || (($operatorSurface['ready'] ?? false) === true && ($kioskSurface['ready'] ?? false) === true),
                'Shell desktop',
                $localWebPilot
                    ? 'Las shells desktop quedan como etapa posterior; el piloto actual valida solo las superficies web locales.'
                    : ((($operatorSurface['ready'] ?? false) === true && ($kioskSurface['ready'] ?? false) === true)
                        ? 'Operator y kiosk reportan shell nativa lista.'
                        : 'Falta confirmar operator y kiosk como apps nativas listas.')
            ),
            'tvAudio' => self::buildTurneroHardwareReadiness(
                $localWebPilot || ((bool) ($displayDetails['bellPrimed'] ?? false) && !($displayDetails['bellMuted'] ?? false)),
                'Audio sala TV',
                $localWebPilot
                    ? 'El audio de sala TV queda diferido hasta la ola nativa y no bloquea el piloto web local.'
                    : (((bool) ($displayDetails['bellPrimed'] ?? false) && !($displayDetails['bellMuted'] ?? false))
                        ? 'Audio y campanilla de sala TV listos.'
                        : 'Falta destrabar audio o reactivar campanilla en sala TV.')
            ),
            'syncMode' => self::buildTurneroHardwareReadiness(
                (string) ($operatorDetails['queueSyncMode'] ?? '') === 'live'
                    && (string) ($kioskDetails['connection'] ?? '') === 'live'
                    && (string) ($displayDetails['connection'] ?? '') === 'live',
                'Sync clínico',
                (
                    (string) ($operatorDetails['queueSyncMode'] ?? '') === 'live'
                    && (string) ($kioskDetails['connection'] ?? '') === 'live'
                    && (string) ($displayDetails['connection'] ?? '') === 'live'
                )
                    ? 'Operator, kiosk y display reportan sync vivo.'
                    : 'Alguna superficie sigue en fallback, paused u offline.'
            ),
        ];

        $surfaceBlockingCount = count(array_filter([
            !$operatorSurface['ready'],
            !$kioskSurface['ready'],
            !$displaySurface['ready'],
            !((bool) ($operatorAccessMeta['configured'] ?? false)),
        ]));
        $hardwareBlockingCount = count(array_filter([
            !((bool) ($hardware['assistant']['ready'] ?? false)),
            !((bool) ($hardware['printer']['ready'] ?? false)),
            !((bool) ($hardware['numpad']['ready'] ?? false)),
            !((bool) ($hardware['desktopShell']['ready'] ?? false)),
            !((bool) ($hardware['tvAudio']['ready'] ?? false)),
            !((bool) ($hardware['syncMode']['ready'] ?? false)),
        ]));
        $releaseEnabled = in_array($releaseMode, ['web_pilot', 'suite_v2'], true)
            && (string) ($release['admin_mode_default'] ?? '') === 'basic'
            && ($release['separate_deploy'] ?? null) === true
            && (($localWebPilot && $nativeAppsBlocking === false) || (!$localWebPilot && $releaseMode === 'suite_v2' && $nativeAppsBlocking === true));
        $blockingCount = $surfaceBlockingCount + $hardwareBlockingCount;

        return [
            'enabled' => $releaseEnabled,
            'releaseMode' => $releaseMode,
            'nativeAppsBlocking' => $nativeAppsBlocking,
            'ready' => $releaseEnabled && $blockingCount === 0,
            'blockingCount' => $releaseEnabled ? $blockingCount : 0,
            'surfaceBlockingCount' => $releaseEnabled ? $surfaceBlockingCount : 0,
            'hardwareBlockingCount' => $releaseEnabled ? $hardwareBlockingCount : 0,
            'operatorAccess' => [
                'configured' => (bool) ($operatorAccessMeta['configured'] ?? false),
                'detail' => (bool) ($operatorAccessMeta['configured'] ?? false)
                    ? 'PIN operativo configurado.'
                    : 'Falta configurar el PIN operativo de la clínica.',
            ],
            'surfaces' => [
                'admin' => $adminSurface,
                'operator' => $operatorSurface,
                'kiosk' => $kioskSurface,
                'display' => $displaySurface,
            ],
            'hardware' => $hardware,
            'generatedAt' => local_date('c'),
        ];
    }

public static function buildTurneroSurfaceReadiness(
        string $surfaceKey,
        string $expectedAppMode,
        $surfaceGroup,
        bool $nativeAppsBlocking
    ): array {
        $group = is_array($surfaceGroup) ? $surfaceGroup : [];
        $latest = isset($group['latest']) && is_array($group['latest']) ? $group['latest'] : [];
        $appMode = trim((string) ($latest['appMode'] ?? ''));
        $effectiveStatus = trim((string) ($latest['effectiveStatus'] ?? $latest['status'] ?? 'unknown'));
        $statusReady = $effectiveStatus === 'ready' && (($latest['stale'] ?? true) !== true);
        $nativeModeReady = !$nativeAppsBlocking || $appMode === $expectedAppMode;
        $ready = $statusReady && $nativeModeReady;

        return [
            'surface' => $surfaceKey,
            'label' => (string) ($group['label'] ?? ucfirst($surfaceKey)),
            'expectedAppMode' => $expectedAppMode,
            'appMode' => $appMode,
            'ready' => $ready,
            'blocking' => true,
            'state' => $ready ? 'ready' : ($statusReady ? 'warning' : 'alert'),
            'summary' => $ready
                ? (string) ($group['summary'] ?? 'Superficie lista.')
                : (!$statusReady
                    ? (string) ($group['summary'] ?? 'Sin heartbeat listo.')
                    : sprintf(
                        'La superficie reporta %s, pero este release exige %s.',
                        $appMode !== '' ? $appMode : 'modo desconocido',
                        $expectedAppMode
                    )),
            'stale' => (bool) ($latest['stale'] ?? true),
            'updatedAt' => (string) ($latest['updatedAt'] ?? ''),
        ];
    }

    /**
     * @param mixed $surfaceGroup
     * @return array<string,mixed>
     */

public static function surfaceLatestDetails($surfaceGroup): array
    {
        $group = is_array($surfaceGroup) ? $surfaceGroup : [];
        $latest = isset($group['latest']) && is_array($group['latest']) ? $group['latest'] : [];
        return isset($latest['details']) && is_array($latest['details']) ? $latest['details'] : [];
    }

    /**
     * @return array<string,mixed>
     */

public static function buildTurneroHardwareReadiness(bool $ready, string $label, string $detail): array
    {
        return [
            'label' => $label,
            'ready' => $ready,
            'state' => $ready ? 'ready' : 'warning',
            'detail' => $detail,
        ];
    }

public static function buildAppDownloads(): array
    {
        return build_app_downloads_runtime_payload();
    }

public static function buildQueueOperatorStore(array $store, array $context): array
    {
        $queueOperatorSession = isset($context['queueOperatorSession']) && is_array($context['queueOperatorSession'])
            ? $context['queueOperatorSession']
            : null;

        return [
            'appointments' => [],
            'callbacks' => [],
            'reviews' => [],
            'availability' => [],
            'availabilityMeta' => [],
            'queue_tickets' => isset($store['queue_tickets']) && is_array($store['queue_tickets'])
                ? $store['queue_tickets']
                : [],
            'doctorProfile' => read_doctor_profile(),
            'clinicProfile' => read_clinic_profile(),
            'queueMeta' => isset($store['queueMeta']) && is_array($store['queueMeta'])
                ? $store['queueMeta']
                : null,
            'queueSurfaceStatus' => isset($store['queueSurfaceStatus']) && is_array($store['queueSurfaceStatus'])
                ? $store['queueSurfaceStatus']
                : null,
            'appDownloads' => isset($store['appDownloads']) && is_array($store['appDownloads'])
                ? $store['appDownloads']
                : null,
            'turneroClinicProfile' => isset($store['turneroClinicProfile']) && is_array($store['turneroClinicProfile'])
                ? $store['turneroClinicProfile']
                : null,
            'turneroClinicProfileMeta' => isset($store['turneroClinicProfileMeta']) && is_array($store['turneroClinicProfileMeta'])
                ? $store['turneroClinicProfileMeta']
                : null,
            'turneroClinicProfileCatalogStatus' => isset($store['turneroClinicProfileCatalogStatus']) && is_array($store['turneroClinicProfileCatalogStatus'])
                ? $store['turneroClinicProfileCatalogStatus']
                : null,
            'turneroClinicProfiles' => isset($store['turneroClinicProfiles']) && is_array($store['turneroClinicProfiles'])
                ? $store['turneroClinicProfiles']
                : [],
            'turneroRegionalClinics' => isset($store['turneroRegionalClinics']) && is_array($store['turneroRegionalClinics'])
                ? $store['turneroRegionalClinics']
                : [],
            'turneroOperatorAccessMeta' => isset($store['turneroOperatorAccessMeta']) && is_array($store['turneroOperatorAccessMeta'])
                ? $store['turneroOperatorAccessMeta']
                : null,
            'turneroV2Readiness' => isset($store['turneroV2Readiness']) && is_array($store['turneroV2Readiness'])
                ? $store['turneroV2Readiness']
                : null,
            'queueOperatorSession' => $queueOperatorSession,
            'funnelMetrics' => [],
        ];
    }

}
