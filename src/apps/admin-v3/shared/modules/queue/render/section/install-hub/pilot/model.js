function formatShortCommit(value) {
    const normalized = String(value || '').trim();
    return normalized ? normalized.slice(0, 8) : '';
}

function buildPublicationReadinessDetail(publicSync, clinicName, release) {
    if (release?.separate_deploy !== true) {
        return 'Este release no exige deploy separado por clínica.';
    }

    if (!publicSync || publicSync.available !== true) {
        return 'El admin no recibió señal de `/health`; falta confirmar el estado público del host antes de abrir.';
    }

    if (publicSync.configured !== true) {
        return 'El host todavía no expone `public_main_sync`; la clínica puede quedar lista localmente, pero no publicada de forma verificable.';
    }

    if (publicSync.healthy !== true) {
        const reason = publicSync.failureReason
            ? ` (${publicSync.failureReason})`
            : '';
        return `public_main_sync sigue ${publicSync.state || 'desconocido'}${reason}. Falta estabilizar la publicación antes de abrir ${clinicName}.`;
    }

    if (publicSync.headDrift === true) {
        const commit = formatShortCommit(publicSync.deployedCommit);
        return commit
            ? `El host reporta commit ${commit}, pero todavía hay drift frente al remoto.`
            : 'El host sigue con drift frente al remoto y no conviene abrir la clínica todavía.';
    }

    if (!publicSync.deployedCommit) {
        return 'La publicación no reporta `deployedCommit`; falta una referencia verificable del release activo.';
    }

    return `public_main_sync sano y commit ${formatShortCommit(publicSync.deployedCommit)} ya coincide con la publicación activa de ${clinicName}.`;
}

export function buildQueueOpsPilotModel(manifest, detectedPlatform, deps) {
    const {
        ensureOpeningChecklistState,
        buildOpeningChecklistSteps,
        buildOpeningChecklistAssist,
        getQueueSyncHealth,
        getSurfaceTelemetryState,
        getTurneroClinicProfile,
        getTurneroClinicBrandName,
        getTurneroPublicSyncStatus,
        hasRecentQueueSmokeSignal,
        buildPreparedSurfaceUrl,
        defaultAppDownloads,
        ensureInstallPreset,
    } = deps;
    const checklist = ensureOpeningChecklistState();
    const steps = buildOpeningChecklistSteps(manifest, detectedPlatform);
    const assist = buildOpeningChecklistAssist(detectedPlatform);
    const syncHealth = getQueueSyncHealth();
    const telemetry = [
        getSurfaceTelemetryState('operator'),
        getSurfaceTelemetryState('kiosk'),
        getSurfaceTelemetryState('display'),
    ];
    const confirmedCount = steps.filter(
        (step) => checklist.steps[step.id]
    ).length;
    const suggestedCount = assist.suggestedCount;
    const pendingSteps = steps.filter((step) => !checklist.steps[step.id]);
    const pendingAfterSuggestions = pendingSteps.filter(
        (step) => !assist.suggestions[step.id]?.suggested
    );
    const readyEquipmentCount = telemetry.filter(
        (entry) => entry.status === 'ready' && !entry.stale
    ).length;
    const issueCount =
        telemetry.filter((entry) => entry.status !== 'ready' || entry.stale)
            .length + (syncHealth.state === 'ready' ? 0 : 1);
    const progressPct =
        steps.length > 0
            ? Math.max(
                  0,
                  Math.min(
                      100,
                      Math.round((confirmedCount / steps.length) * 100)
                  )
              )
            : 0;
    const profile = getTurneroClinicProfile?.() || null;
    const release =
        profile?.release && typeof profile.release === 'object'
            ? profile.release
            : {};
    const profileSurfaces =
        profile?.surfaces && typeof profile.surfaces === 'object'
            ? profile.surfaces
            : {};
    const clinicName =
        typeof getTurneroClinicBrandName === 'function'
            ? getTurneroClinicBrandName()
            : String(profile?.branding?.name || 'la clínica').trim();
    const publicSync =
        typeof getTurneroPublicSyncStatus === 'function'
            ? getTurneroPublicSyncStatus()
            : null;
    const requiredSurfaceKeys = ['admin', 'operator', 'kiosk', 'display'];
    const enabledSurfaceKeys = requiredSurfaceKeys.filter(
        (surfaceKey) =>
            Boolean(profileSurfaces[surfaceKey]?.enabled) &&
            String(profileSurfaces[surfaceKey]?.route || '').trim() !== ''
    );
    const telemetryReadyCount = telemetry.filter(
        (entry) => entry.status === 'ready' && !entry.stale
    ).length;
    const smokeReady =
        Boolean(checklist.steps.smoke_ready) ||
        Boolean(hasRecentQueueSmokeSignal?.());
    const publicationReady =
        release?.separate_deploy === true
            ? Boolean(
                  publicSync?.configured &&
                  publicSync?.healthy &&
                  publicSync?.headDrift !== true &&
                  String(publicSync?.deployedCommit || '').trim() !== ''
              )
            : true;
    const readinessItems = [
        {
            id: 'profile',
            ready:
                Boolean(profile) &&
                String(profile?.clinic_id || '').trim() !== '' &&
                String(release?.mode || '').trim() === 'web_pilot' &&
                release?.separate_deploy === true &&
                String(release?.admin_mode_default || '').trim() === 'basic',
            label: 'Perfil por clínica',
            detail:
                Boolean(profile) &&
                String(profile?.clinic_id || '').trim() !== '' &&
                String(release?.mode || '').trim() === 'web_pilot' &&
                release?.separate_deploy === true &&
                String(release?.admin_mode_default || '').trim() === 'basic'
                    ? `${clinicName} ya quedó perfilada como piloto web separado.`
                    : 'Falta cerrar `clinic_id`, release web o `basic` por defecto antes de abrir otra clínica.',
            blocker: true,
        },
        {
            id: 'surfaces',
            ready: enabledSurfaceKeys.length === requiredSurfaceKeys.length,
            label: 'Superficies web canónicas',
            detail:
                enabledSurfaceKeys.length === requiredSurfaceKeys.length
                    ? 'Admin, operador, kiosco y sala web ya están declarados como superficies activas del piloto.'
                    : `Solo ${enabledSurfaceKeys.length}/${requiredSurfaceKeys.length} superficies del piloto quedaron habilitadas en el perfil.`,
            blocker: true,
        },
        {
            id: 'publish',
            ready: publicationReady,
            label: 'Publicación del release',
            detail: buildPublicationReadinessDetail(
                publicSync,
                clinicName,
                release
            ),
            blocker: true,
        },
        {
            id: 'health',
            ready:
                syncHealth.state === 'ready' &&
                telemetryReadyCount === telemetry.length,
            label: 'Señal viva + heartbeats',
            detail:
                syncHealth.state === 'ready' &&
                telemetryReadyCount === telemetry.length
                    ? 'Operador, kiosco y sala reportan señal estable para operar la clínica real.'
                    : `Hay ${Math.max(0, telemetry.length - telemetryReadyCount)} superficie(s) sin estado listo o la cola sigue degradada.`,
            blocker: false,
        },
        {
            id: 'smoke',
            ready: smokeReady,
            label: 'Smoke final del turno',
            detail: smokeReady
                ? 'Ya existe evidencia reciente de llamado end-to-end o el smoke quedó confirmado en apertura.'
                : 'Todavía falta un llamado real o de prueba que cierre el flujo completo antes de producción.',
            blocker: false,
        },
    ];
    const readinessBlockingCount = readinessItems.filter(
        (item) => !item.ready
    ).length;
    const readinessCriticalCount = readinessItems.filter(
        (item) => !item.ready && item.blocker
    ).length;
    const readinessState =
        readinessBlockingCount === 0
            ? 'ready'
            : readinessCriticalCount > 0
              ? 'alert'
              : 'warning';
    const readinessTitle =
        readinessState === 'ready'
            ? 'Piloto web listo para abrir'
            : readinessState === 'alert'
              ? 'Piloto web bloqueado'
              : 'Piloto web casi listo';
    const readinessSummary =
        readinessState === 'ready'
            ? `${clinicName} ya cumple el corte web del piloto: perfil separado, superficies activas, publicación verificada, señal estable y smoke confirmado.`
            : readinessState === 'alert'
              ? `Faltan ${readinessBlockingCount} bloqueo(s) para abrir ${clinicName} en piloto web. Resuelve primero perfil, superficies o publicación antes del smoke final.`
              : `Faltan ${readinessBlockingCount} cierre(s) operativos para abrir ${clinicName} en piloto web sin depender del modo expert.`;
    const nativeAppsSupport =
        release?.native_apps_blocking === false
            ? 'Los instaladores quedan fuera del bloqueo de go-live en este corte web.'
            : 'La política de release todavía marca apps nativas como bloqueantes.';
    const readinessSupport = publicationReady
        ? `La clínica ya quedó publicada con commit verificable. ${nativeAppsSupport}`
        : `Este gate ahora separa "lista localmente" de "publicada". ${nativeAppsSupport}`;

    if (syncHealth.state === 'alert') {
        return {
            tone: 'alert',
            eyebrow: 'Siguiente paso',
            title: 'Resuelve la cola antes de abrir',
            summary:
                'Hay fallback o sincronización degradada. Prioriza el refresh de cola antes de validar hardware o instalación.',
            supportCopy:
                'Cuando el sync vuelva a vivo, el panel te devolverá el siguiente paso operativo.',
            progressPct,
            confirmedCount,
            suggestedCount,
            totalSteps: steps.length,
            readyEquipmentCount,
            issueCount,
            readinessState,
            readinessTitle,
            readinessSummary,
            readinessSupport,
            readinessBlockingCount,
            readinessItems,
            primaryAction: {
                kind: 'button',
                id: 'queueOpsPilotRefreshBtn',
                action: 'queue-refresh-state',
                label: 'Refrescar cola ahora',
            },
            secondaryAction: {
                kind: 'anchor',
                href: '/admin.html#queue',
                label: 'Abrir cola admin',
            },
        };
    }

    if (suggestedCount > 0) {
        return {
            tone: 'suggested',
            eyebrow: 'Siguiente paso',
            title: `Confirma ${suggestedCount} paso(s) ya validados`,
            summary:
                pendingAfterSuggestions.length > 0
                    ? `${suggestedCount} paso(s) ya aparecen listos por heartbeat. Después te quedará ${pendingAfterSuggestions[0].title}.`
                    : 'El sistema ya detectó los pasos pendientes como listos. Confírmalos para cerrar la apertura.',
            supportCopy:
                'Usa este botón cuando ya confías en la telemetría y solo quieres avanzar sin recorrer el checklist uno por uno.',
            progressPct,
            confirmedCount,
            suggestedCount,
            totalSteps: steps.length,
            readyEquipmentCount,
            issueCount,
            readinessState,
            readinessTitle,
            readinessSummary,
            readinessSupport,
            readinessBlockingCount,
            readinessItems,
            primaryAction: {
                kind: 'button',
                id: 'queueOpsPilotApplyBtn',
                label: `Confirmar sugeridos (${suggestedCount})`,
            },
            secondaryAction: pendingAfterSuggestions.length
                ? {
                      kind: 'anchor',
                      href: pendingAfterSuggestions[0].href,
                      label: pendingAfterSuggestions[0].actionLabel,
                  }
                : {
                      kind: 'anchor',
                      href: '/admin.html#queue',
                      label: 'Volver a la cola',
                  },
        };
    }

    if (pendingAfterSuggestions.length > 0) {
        return {
            tone: syncHealth.state === 'warning' ? 'warning' : 'active',
            eyebrow: 'Siguiente paso',
            title: `Siguiente paso: ${pendingAfterSuggestions[0].title}`,
            summary:
                pendingAfterSuggestions.length > 1
                    ? `Quedan ${pendingAfterSuggestions.length} validaciones manuales. Empieza por esta para mantener el flujo simple.`
                    : 'Solo queda una validación manual para dejar la apertura lista.',
            supportCopy: String(
                assist.suggestions[pendingAfterSuggestions[0].id]?.reason ||
                    pendingAfterSuggestions[0].hint ||
                    ''
            ),
            progressPct,
            confirmedCount,
            suggestedCount,
            totalSteps: steps.length,
            readyEquipmentCount,
            issueCount,
            readinessState,
            readinessTitle,
            readinessSummary,
            readinessSupport,
            readinessBlockingCount,
            readinessItems,
            primaryAction: {
                kind: 'anchor',
                href: pendingAfterSuggestions[0].href,
                label: pendingAfterSuggestions[0].actionLabel,
            },
            secondaryAction:
                syncHealth.state === 'warning'
                    ? {
                          kind: 'button',
                          id: 'queueOpsPilotRefreshBtn',
                          action: 'queue-refresh-state',
                          label: 'Refrescar cola',
                      }
                    : {
                          kind: 'anchor',
                          href: '/admin.html#queue',
                          label: 'Abrir cola admin',
                      },
        };
    }

    return {
        tone: 'ready',
        eyebrow: 'Operación lista',
        title: 'Apertura completada',
        summary:
            'Operador, kiosco y sala ya están confirmados. Puedes seguir atendiendo o hacer un llamado de prueba final desde la cola.',
        supportCopy:
            'Si cambia un equipo a warning o alert, este panel volverá a priorizar la acción correcta.',
        progressPct,
        confirmedCount,
        suggestedCount,
        totalSteps: steps.length,
        readyEquipmentCount,
        issueCount,
        readinessState,
        readinessTitle,
        readinessSummary,
        readinessSupport,
        readinessBlockingCount,
        readinessItems,
        primaryAction: {
            kind: 'anchor',
            href: '/admin.html#queue',
            label: 'Abrir cola admin',
        },
        secondaryAction: {
            kind: 'anchor',
            href: buildPreparedSurfaceUrl(
                'operator',
                manifest.operator || defaultAppDownloads.operator,
                {
                    ...ensureInstallPreset(detectedPlatform),
                    surface: 'operator',
                }
            ),
            label: 'Abrir operador',
        },
    };
}
