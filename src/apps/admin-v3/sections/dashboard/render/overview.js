import {
    escapeHtml,
    formatDateTime,
    setHtml,
    setText,
} from '../../../shared/ui/render.js';
import { apiRequest } from '../../../shared/core/api-client.js';
import { heroSummary } from '../markup.js';

function normalizeNumber(value) {
    const num = Number(value || 0);
    return Number.isFinite(num) ? Math.max(0, num) : 0;
}

function normalizeString(value) {
    return String(value || '').trim();
}

function resolveBridgeChipTone(ops) {
    if (!ops.available) return 'warning';
    if (ops.bridgeMode === 'online') return 'success';
    if (ops.bridgeMode === 'degraded') return 'warning';
    if (ops.bridgeMode === 'offline') return 'danger';
    return 'neutral';
}

function resolveBridgeChipLabel(ops) {
    switch (ops.bridgeMode) {
        case 'online':
            return 'En linea';
        case 'degraded':
            return 'Degradado';
        case 'offline':
            return 'Offline';
        case 'disabled':
            return 'Deshabilitado';
        default:
            return ops.available ? 'Pendiente' : 'Sin señal';
    }
}

function resolveBridgeMeta(ops) {
    if (!ops.available) {
        return ops.error || 'No se pudo leer el bridge operativo.';
    }

    const marks = [];
    if (ops.lastInboundAt) {
        marks.push(`Inbound ${formatDateTime(ops.lastInboundAt)}`);
    }
    if (ops.lastOutboundAt) {
        marks.push(`Outbound ${formatDateTime(ops.lastOutboundAt)}`);
    }
    if (marks.length > 0) {
        return marks.join(' | ');
    }

    return ops.bridgeConfigured
        ? 'Bridge configurado, esperando actividad reciente.'
        : 'Bridge sin token o aun pendiente de configuracion.';
}

function resolveBridgeSummary(ops) {
    if (!ops.available) {
        return 'La lectura de WhatsApp/OpenClaw no esta disponible todavia en este panel.';
    }
    if (ops.bridgeMode === 'disabled') {
        return 'WhatsApp/OpenClaw esta deshabilitado en este entorno.';
    }
    if (ops.bridgeMode === 'offline') {
        return 'El bridge dejo de reportar señal y conviene revisar helper, token o worker.';
    }
    if (ops.deliveryFailures > 0) {
        return `${ops.deliveryFailures} entrega(s) fallida(s) requieren requeue o revision manual.`;
    }
    if (ops.pendingCheckouts.length > 0) {
        return `${ops.pendingCheckouts.length} checkout(s) mantienen slots retenidos.`;
    }
    if (ops.aliveHolds > 0) {
        return `${ops.aliveHolds} hold(s) siguen activos sin cierre de pago.`;
    }
    return 'Bridge estable, sin fallos de entrega ni checkouts atascados en este momento.';
}

function resolveClinicalChipTone(snapshot) {
    const status = String(snapshot?.summary?.diagnostics?.status || '').trim();
    if (status === 'critical') return 'danger';
    if (status === 'degraded') return 'warning';
    if (status === 'healthy') return 'success';
    return 'neutral';
}

function resolveClinicalChipLabel(snapshot) {
    const status = String(snapshot?.summary?.diagnostics?.status || '').trim();
    switch (status) {
        case 'critical':
            return 'Critico';
        case 'degraded':
            return 'Seguimiento';
        case 'healthy':
            return 'Estable';
        default:
            return 'Pendiente';
    }
}

function resolveClinicalMeta(snapshot) {
    if (!snapshot?.summary?.configured) {
        return 'El snapshot clinico todavia no esta disponible en este panel.';
    }

    const latestActivityAt = String(
        snapshot?.summary?.latestActivityAt || ''
    ).trim();
    const unreadEvents = Number(snapshot?.summary?.events?.unreadCount || 0);
    if (latestActivityAt) {
        return unreadEvents > 0
            ? `Ultima actividad ${formatDateTime(latestActivityAt)} • ${unreadEvents} evento(s) sin leer`
            : `Ultima actividad ${formatDateTime(latestActivityAt)}`;
    }

    return unreadEvents > 0
        ? `${unreadEvents} evento(s) clinicos sin leer.`
        : 'Sin actividad clinica reciente.';
}

function resolveClinicalSummary(snapshot) {
    if (!snapshot?.summary?.configured) {
        return 'La cabina de historia clinica defendible aparecera aqui cuando el backend canonico empiece a emitir episodios, notas y bloqueos legales.';
    }

    const reviewQueueCount = Number(
        snapshot?.summary?.reviewQueueCount ||
            snapshot?.summary?.drafts?.reviewQueueCount ||
            0
    );
    const pendingAiCount = Number(
        snapshot?.summary?.drafts?.pendingAiCount || 0
    );
    const openEventsCount = Number(snapshot?.summary?.events?.openCount || 0);
    const criticalEvents = Number(
        snapshot?.summary?.events?.openBySeverity?.critical || 0
    );
    const pendingCopyRequests = Number(
        snapshot?.summary?.recordsGovernance?.pendingCopyRequests || 0
    );
    const overdueCopyRequests = Number(
        snapshot?.summary?.recordsGovernance?.overdueCopyRequests || 0
    );
    const archiveEligible = Number(
        snapshot?.summary?.recordsGovernance?.archiveEligible || 0
    );
    const hcu001Complete = Number(
        snapshot?.summary?.drafts?.hcu001?.complete || 0
    );
    const hcu001Partial = Number(
        snapshot?.summary?.drafts?.hcu001?.partial || 0
    );
    const hcu001LegacyPartial = Number(
        snapshot?.summary?.drafts?.hcu001?.legacy_partial || 0
    );
    const hcu001Missing = Number(
        snapshot?.summary?.drafts?.hcu001?.missing || 0
    );
    const hcu005Partial = Number(
        snapshot?.summary?.drafts?.hcu005?.partial || 0
    );
    const hcu005Missing = Number(
        snapshot?.summary?.drafts?.hcu005?.missing || 0
    );
    const hcu007Issued = Number(snapshot?.summary?.drafts?.hcu007?.issued || 0);
    const hcu007ReadyToIssue = Number(
        snapshot?.summary?.drafts?.hcu007?.ready_to_issue || 0
    );
    const hcu007Incomplete = Number(
        snapshot?.summary?.drafts?.hcu007?.incomplete || 0
    );
    const hcu007Draft = Number(snapshot?.summary?.drafts?.hcu007?.draft || 0);
    const hcu010AIssued = Number(
        snapshot?.summary?.drafts?.hcu010A?.issued || 0
    );
    const hcu010AReadyToIssue = Number(
        snapshot?.summary?.drafts?.hcu010A?.ready_to_issue || 0
    );
    const hcu010AIncomplete = Number(
        snapshot?.summary?.drafts?.hcu010A?.incomplete || 0
    );
    const hcu010ADraft = Number(
        snapshot?.summary?.drafts?.hcu010A?.draft || 0
    );
    const hcu012AIssued = Number(
        snapshot?.summary?.drafts?.hcu012A?.issued || 0
    );
    const hcu012AReceived = Number(
        snapshot?.summary?.drafts?.hcu012A?.received || 0
    );
    const hcu012AReadyToIssue = Number(
        snapshot?.summary?.drafts?.hcu012A?.ready_to_issue || 0
    );
    const hcu012AIncomplete = Number(
        snapshot?.summary?.drafts?.hcu012A?.incomplete || 0
    );
    const hcu012ADraft = Number(
        snapshot?.summary?.drafts?.hcu012A?.draft || 0
    );

    if (criticalEvents > 0) {
        return `${criticalEvents} evento(s) critico(s) siguen abiertos y requieren validacion medica inmediata.`;
    }
    if (hcu001Missing > 0 || hcu001Partial > 0) {
        return `${hcu001Missing} expediente(s) siguen sin HCU-001 y ${hcu001Partial} mantienen admision parcial que todavia no sostiene cierre defendible.`;
    }
    if (hcu001LegacyPartial > 0) {
        return `${hcu001LegacyPartial} expediente(s) heredado(s) siguen por regularizar en HCU-001, sin bloquear el cierre clinico por defecto.`;
    }
    if (hcu005Partial > 0 || hcu005Missing > 0) {
        return `${hcu005Partial} episodio(s) tienen HCU-005 parcial y ${hcu005Missing} siguen pendientes de cobertura trazable.`;
    }
    if (hcu007Incomplete > 0 || hcu007Draft > 0) {
        return `${hcu007Incomplete} interconsulta(s) HCU-007 siguen incompletas y ${hcu007Draft} permanecen en borrador sin emitir.`;
    }
    if (hcu007ReadyToIssue > 0) {
        return `${hcu007ReadyToIssue} interconsulta(s) HCU-007 ya están listas para emisión y solo esperan acto médico final.`;
    }
    if (hcu010AIncomplete > 0 || hcu010ADraft > 0) {
        return `${hcu010AIncomplete} solicitud(es) HCU-010A siguen incompletas y ${hcu010ADraft} permanecen en borrador sin emitir.`;
    }
    if (hcu010AReadyToIssue > 0) {
        return `${hcu010AReadyToIssue} solicitud(es) HCU-010A ya están listas para emisión y solo esperan validación final.`;
    }
    if (hcu012AIncomplete > 0 || hcu012ADraft > 0) {
        return `${hcu012AIncomplete} solicitud(es) HCU-012A siguen incompletas y ${hcu012ADraft} permanecen en borrador sin emitir.`;
    }
    if (hcu012AReadyToIssue > 0) {
        return `${hcu012AReadyToIssue} solicitud(es) HCU-012A ya están listas para emisión y solo esperan validación final.`;
    }
    if (hcu012AReceived > 0) {
        return `${hcu012AReceived} solicitud(es) HCU-012A ya tienen resultado radiológico recibido como respaldo documental del episodio.`;
    }
    if (overdueCopyRequests > 0) {
        return `${overdueCopyRequests} copia(s) certificada(s) ya vencieron su SLA y requieren entrega o regularizacion.`;
    }
    if (pendingCopyRequests > 0) {
        return `${pendingCopyRequests} solicitud(es) de copia certificada siguen pendientes dentro de la cabina clinica.`;
    }
    if (reviewQueueCount > 0) {
        return `${reviewQueueCount} historia(s) clinica(s) quedaron listas para revision humana desde la misma consola operativa.`;
    }
    if (archiveEligible > 0) {
        return `${archiveEligible} record(s) ya pueden pasar a archivo pasivo segun la regla de custodia.`;
    }
    if (hcu007Issued > 0) {
        return `${hcu007Issued} interconsulta(s) HCU-007 ya quedaron emitidas sin esperar todavía informe del consultado.`;
    }
    if (hcu010AIssued > 0) {
        return `${hcu010AIssued} solicitud(es) HCU-010A ya quedaron emitidas como soporte diagnóstico del episodio.`;
    }
    if (hcu012AIssued > 0) {
        return `${hcu012AIssued} solicitud(es) HCU-012A ya quedaron emitidas como soporte de imagenologia del episodio.`;
    }
    if (pendingAiCount > 0) {
        return `${pendingAiCount} borrador(es) siguen esperando reconciliacion asincrona de OpenClaw.`;
    }
    if (openEventsCount > 0) {
        return `${openEventsCount} evento(s) siguen visibles para seguimiento del staff, aunque no haya cola de revision abierta.`;
    }
    if (hcu001Complete > 0) {
        return `La admision HCU-001 y el seguimiento HCU-005 ya estan alineados para ${hcu001Complete} expediente(s) activos.`;
    }

    return 'Sin cola clinica pendiente: las sesiones recientes ya quedaron estables o aprobadas.';
}

function resolveClinicalQueueHeadline(snapshot) {
    const reviewQueue = Array.isArray(snapshot?.reviewQueue)
        ? snapshot.reviewQueue
        : [];
    const first = reviewQueue[0] || null;
    if (!first) {
        return 'Sin casos pendientes';
    }

    return String(first.patientName || first.caseId || 'Caso clinico').trim();
}

function resolveClinicalQueueMeta(snapshot) {
    const reviewQueue = Array.isArray(snapshot?.reviewQueue)
        ? snapshot.reviewQueue
        : [];
    const first = reviewQueue[0] || null;
    if (!first) {
        return 'Cuando existan episodios en revision medico-legal apareceran aqui.';
    }

    const reviewQueueCount = Number(
        snapshot?.summary?.reviewQueueCount ||
            snapshot?.summary?.drafts?.reviewQueueCount ||
            reviewQueue.length
    );
    const missingFields = Array.isArray(first?.missingFields)
        ? first.missingFields.length
        : 0;
    const pendingCopyRequests = Number(
        snapshot?.summary?.recordsGovernance?.pendingCopyRequests || 0
    );
    const hcu001Partial = Number(
        snapshot?.summary?.drafts?.hcu001?.partial || 0
    );
    const hcu001LegacyPartial = Number(
        snapshot?.summary?.drafts?.hcu001?.legacy_partial || 0
    );
    const hcu005Partial = Number(
        snapshot?.summary?.drafts?.hcu005?.partial || 0
    );
    const hcu007ReadyToIssue = Number(
        snapshot?.summary?.drafts?.hcu007?.ready_to_issue || 0
    );
    const hcu007Draft = Number(snapshot?.summary?.drafts?.hcu007?.draft || 0);
    const hcu010AReadyToIssue = Number(
        snapshot?.summary?.drafts?.hcu010A?.ready_to_issue || 0
    );
    const hcu010ADraft = Number(
        snapshot?.summary?.drafts?.hcu010A?.draft || 0
    );
    const hcu012AReadyToIssue = Number(
        snapshot?.summary?.drafts?.hcu012A?.ready_to_issue || 0
    );
    const hcu012ADraft = Number(
        snapshot?.summary?.drafts?.hcu012A?.draft || 0
    );
    const confidence = Number(first?.confidence || 0);
    const confidenceLabel =
        Number.isFinite(confidence) && confidence > 0
            ? `${Math.round(confidence * 100)}% de confianza`
            : 'sin score de confianza';

    return reviewQueueCount > 1
        ? [
              `${reviewQueueCount} caso(s) en cola`,
              String(first?.hcu001Label || '').trim(),
              missingFields > 0 ? `${missingFields} dato(s) faltante(s)` : '',
              pendingCopyRequests > 0
                  ? `${pendingCopyRequests} copia(s) pendiente(s)`
                  : '',
              hcu001Partial > 0 ? `${hcu001Partial} HCU-001 parcial(es)` : '',
              hcu001LegacyPartial > 0
                  ? `${hcu001LegacyPartial} HCU-001 heredada(s)`
                  : '',
              hcu005Partial > 0 ? `${hcu005Partial} HCU-005 parcial(es)` : '',
              hcu007ReadyToIssue > 0
                  ? `${hcu007ReadyToIssue} HCU-007 lista(s)`
                  : '',
              hcu007Draft > 0 ? `${hcu007Draft} HCU-007 borrador(es)` : '',
              hcu010AReadyToIssue > 0
                  ? `${hcu010AReadyToIssue} HCU-010A lista(s)`
                  : '',
              hcu010ADraft > 0
                  ? `${hcu010ADraft} HCU-010A borrador(es)`
                  : '',
              hcu012AReadyToIssue > 0
                  ? `${hcu012AReadyToIssue} HCU-012A lista(s)`
                  : '',
              hcu012ADraft > 0
                  ? `${hcu012ADraft} HCU-012A borrador(es)`
                  : '',
              confidenceLabel,
          ]
              .filter(Boolean)
              .join(' • ')
        : [
              String(first?.hcu001Label || '').trim(),
              String(first?.hcu005Label || '').trim(),
              String(first?.hcu007Label || '').trim(),
              String(first?.hcu010ALabel || '').trim(),
              String(first?.hcu012ALabel || '').trim(),
              missingFields > 0 ? `${missingFields} dato(s) faltante(s)` : '',
              pendingCopyRequests > 0
                  ? `${pendingCopyRequests} copia(s) pendiente(s)`
                  : '',
              confidenceLabel,
          ]
              .filter(Boolean)
              .join(' • ');
}

function resolveClinicalEventHeadline(snapshot) {
    const events = Array.isArray(snapshot?.events) ? snapshot.events : [];
    const first = events[0] || null;
    if (!first) {
        return 'Sin actividad reciente';
    }

    return String(first.title || first.patientName || 'Evento clinico').trim();
}

function resolveClinicalEventMeta(snapshot) {
    const events = Array.isArray(snapshot?.events) ? snapshot.events : [];
    const first = events[0] || null;
    if (!first) {
        return 'El feed operativo resumira conciliaciones, alertas y lecturas pendientes.';
    }

    const unreadEvents = Number(snapshot?.summary?.events?.unreadCount || 0);
    const openEvents = Number(snapshot?.summary?.events?.openCount || 0);
    const occurredAt = String(
        first?.occurredAt || first?.createdAt || ''
    ).trim();

    return [
        occurredAt ? formatDateTime(occurredAt) : '',
        openEvents > 0 ? `${openEvents} abierto(s)` : '',
        unreadEvents > 0 ? `${unreadEvents} sin leer` : '',
    ]
        .filter(Boolean)
        .join(' • ');
}

function normalizeMultiClinicOverview(rawOverview) {
    const overview =
        rawOverview && typeof rawOverview === 'object' ? rawOverview : {};
    const summary =
        overview.summary && typeof overview.summary === 'object'
            ? overview.summary
            : {};
    const comparative =
        overview.comparative && typeof overview.comparative === 'object'
            ? overview.comparative
            : {};
    const clinics = Array.isArray(overview.clinics) ? overview.clinics : [];

    return {
        summary: {
            clinicCount: normalizeNumber(summary.clinicCount),
            clinicsWithActivity: normalizeNumber(summary.clinicsWithActivity),
            todayAppointments: normalizeNumber(summary.todayAppointments),
            patientCount: normalizeNumber(summary.patientCount),
            settledRevenueLabel: normalizeString(summary.settledRevenueLabel),
            fallbackAssignedRecords: normalizeNumber(
                summary.fallbackAssignedRecords
            ),
            explicitlyScopedRecords: normalizeNumber(
                summary.explicitlyScopedRecords
            ),
            generatedAt: normalizeString(summary.generatedAt),
        },
        comparative: {
            leaderByRevenue:
                comparative.leaderByRevenue &&
                typeof comparative.leaderByRevenue === 'object'
                    ? comparative.leaderByRevenue
                    : null,
            leaderByDemand:
                comparative.leaderByDemand &&
                typeof comparative.leaderByDemand === 'object'
                    ? comparative.leaderByDemand
                    : null,
        },
        clinics: clinics.map((clinic) => ({
            clinicId: normalizeString(clinic?.clinicId),
            clinicLabel: normalizeString(clinic?.clinicLabel),
            region: normalizeString(clinic?.region),
            status: normalizeString(clinic?.status),
            isActiveClinic: clinic?.isActiveClinic === true,
            isRevenueLeader: clinic?.isRevenueLeader === true,
            isDemandLeader: clinic?.isDemandLeader === true,
            hasActivity: clinic?.hasActivity === true,
            todayAppointments: normalizeNumber(clinic?.todayAppointments),
            patientCount: normalizeNumber(clinic?.patientCount),
            settledRevenueLabel: normalizeString(clinic?.settledRevenueLabel),
        })),
    };
}

function resolveMultiClinicChipTone(overview) {
    const clinicCount = Number(overview?.summary?.clinicCount || 0);
    const activeCount = Number(overview?.summary?.clinicsWithActivity || 0);
    if (clinicCount <= 1) return 'neutral';
    if (activeCount === clinicCount && clinicCount > 1) return 'success';
    if (activeCount > 0) return 'warning';
    return 'neutral';
}

function resolveMultiClinicChipLabel(overview) {
    const clinicCount = Number(overview?.summary?.clinicCount || 0);
    const activeCount = Number(overview?.summary?.clinicsWithActivity || 0);
    if (clinicCount <= 0) return 'Sin red';
    if (clinicCount === 1) return 'Una sede';
    if (activeCount <= 0) return `${clinicCount} sedes`;
    return `${activeCount}/${clinicCount} activas`;
}

function resolveMultiClinicMeta(overview) {
    const generatedAt = String(overview?.summary?.generatedAt || '').trim();
    const fallbackAssignedRecords = Number(
        overview?.summary?.fallbackAssignedRecords || 0
    );
    const parts = [];

    if (generatedAt) {
        parts.push(`Actualizado ${formatDateTime(generatedAt)}`);
    }
    if (fallbackAssignedRecords > 0) {
        parts.push(
            `${fallbackAssignedRecords} registro(s) siguen cayendo a la clinica activa`
        );
    }

    return parts.length > 0
        ? parts.join(' • ')
        : 'Comparativa operativa por sucursal del tenant.';
}

function resolveMultiClinicSummary(overview) {
    const leaderByRevenue = overview?.comparative?.leaderByRevenue || null;
    const leaderByDemand = overview?.comparative?.leaderByDemand || null;
    const fallbackAssignedRecords = Number(
        overview?.summary?.fallbackAssignedRecords || 0
    );
    const explicitRecords = Number(
        overview?.summary?.explicitlyScopedRecords || 0
    );
    const fragments = [];

    if (leaderByRevenue?.clinicLabel) {
        fragments.push(
            `${leaderByRevenue.clinicLabel} lidera ingresos con ${leaderByRevenue.settledRevenueLabel || '$0.00'}`
        );
    }
    if (leaderByDemand?.clinicLabel) {
        fragments.push(
            `${leaderByDemand.clinicLabel} concentra ${normalizeNumber(
                leaderByDemand.todayAppointments
            )} turno(s) hoy`
        );
    }
    if (fallbackAssignedRecords > 0) {
        fragments.push(
            `${fallbackAssignedRecords} registro(s) siguen usando fallback a la sede activa`
        );
    } else if (explicitRecords > 0) {
        fragments.push(
            `${explicitRecords} registro(s) ya llegaron con clinicId explicito`
        );
    }

    return fragments.length > 0
        ? fragments.join('. ') + '.'
        : 'La red esta cargada pero todavia no hay actividad comparativa por sucursal.';
}

function resolveMultiClinicLeaderHeadline(leader) {
    if (!leader?.clinicLabel) {
        return 'Sin datos';
    }

    return String(leader.clinicLabel || 'Sin datos').trim();
}

function resolveMultiClinicLeaderMeta(leader, kind = 'revenue') {
    if (!leader?.clinicLabel) {
        return kind === 'revenue'
            ? 'La sede con mayor ingreso liquidado aparecera aqui.'
            : 'La sede con mas turnos del dia aparecera aqui.';
    }

    if (kind === 'revenue') {
        return [
            leader.settledRevenueLabel || '$0.00',
            `${normalizeNumber(leader.patientCount)} paciente(s)`,
            normalizeNumber(leader.todayAppointments) > 0
                ? `${normalizeNumber(leader.todayAppointments)} turno(s) hoy`
                : '',
        ]
            .filter(Boolean)
            .join(' • ');
    }

    return [
        `${normalizeNumber(leader.todayAppointments)} turno(s) hoy`,
        `${normalizeNumber(leader.patientCount)} paciente(s)`,
        leader.settledRevenueLabel || '',
    ]
        .filter(Boolean)
        .join(' • ');
}

function resolveMultiClinicBadgeTone(clinic) {
    if (clinic?.isRevenueLeader || clinic?.isDemandLeader) return 'success';
    if (clinic?.hasActivity) return 'neutral';
    return clinic?.isActiveClinic ? 'warning' : 'neutral';
}

function resolveMultiClinicBadgeLabel(clinic) {
    if (clinic?.isRevenueLeader && clinic?.isDemandLeader) return 'Lider total';
    if (clinic?.isRevenueLeader) return 'Lider ingresos';
    if (clinic?.isDemandLeader) return 'Mayor demanda';
    if (clinic?.isActiveClinic && !clinic?.hasActivity) return 'Sin actividad';
    if (clinic?.hasActivity) return 'Activa';
    return 'En espera';
}

function buildMultiClinicRowsMarkup(overview) {
    const clinics = Array.isArray(overview?.clinics) ? overview.clinics : [];
    if (clinics.length === 0) {
        return `
            <li class="dashboard-attention-item dashboard-multi-clinic__item">
                <div class="dashboard-multi-clinic__copy">
                    <span>Sin sucursales cargadas</span>
                    <small>Cuando exista un catalogo multi-clinica aparecera aqui el comparativo del tenant.</small>
                </div>
            </li>
        `;
    }

    return clinics
        .map(
            (clinic) => `
                <li class="dashboard-attention-item dashboard-multi-clinic__item" data-multi-clinic-row="true">
                    <div class="dashboard-multi-clinic__copy">
                        <div class="dashboard-multi-clinic__head">
                            <span>${escapeHtml(
                                clinic.clinicLabel || clinic.clinicId || 'Clinica'
                            )}</span>
                            <span class="dashboard-signal-chip" data-state="${escapeHtml(
                                resolveMultiClinicBadgeTone(clinic)
                            )}">
                                ${escapeHtml(resolveMultiClinicBadgeLabel(clinic))}
                            </span>
                        </div>
                        <small>${escapeHtml(
                            [
                                clinic.region || 'Tenant',
                                clinic.isActiveClinic ? 'sede activa' : '',
                            ]
                                .filter(Boolean)
                                .join(' • ')
                        )}</small>
                    </div>
                    <div class="dashboard-multi-clinic__metrics">
                        <span class="dashboard-multi-clinic__badge">
                            Turnos hoy ${escapeHtml(clinic.todayAppointments)}
                        </span>
                        <span class="dashboard-multi-clinic__badge">
                            Ingresos ${escapeHtml(
                                clinic.settledRevenueLabel || '$0.00'
                            )}
                        </span>
                        <span class="dashboard-multi-clinic__badge">
                            Pacientes ${escapeHtml(clinic.patientCount)}
                        </span>
                    </div>
                </li>
            `
        )
        .join('');
}

export function setOverviewMetrics(state) {
    const {
        appointments,
        nextAppointment,
        pendingTasks,
        pendingTransfers,
        todayAppointments,
        availabilityDays,
        calledTickets,
        clinicalHistoryMeta,
        multiClinicOverview,
        pendingCallbacks,
        waitingTickets,
        whatsappOpenclawOps,
    } = state;
    const ops = whatsappOpenclawOps || {
        available: false,
        bridgeMode: 'pending',
        bridgeConfigured: false,
        deliveryFailures: 0,
        pendingOutbox: 0,
        aliveHolds: 0,
        pendingCheckouts: [],
        error: '',
        lastInboundAt: '',
        lastOutboundAt: '',
    };
    const clinical = clinicalHistoryMeta || {
        summary: {
            configured: false,
            sessions: { total: 0 },
            drafts: { pendingAiCount: 0, reviewQueueCount: 0 },
            events: { openCount: 0, unreadCount: 0, openBySeverity: {} },
            reviewQueueCount: 0,
            latestActivityAt: '',
            diagnostics: { status: 'unknown' },
        },
        reviewQueue: [],
        events: [],
    };
    const multiClinic = normalizeMultiClinicOverview(multiClinicOverview);

    setText(
        '#dashboardHeroSummary',
        heroSummary({
            pendingCallbacks,
            pendingTransfers,
            nextAppointment,
            urgentCallbacks: state.urgentCallbacks,
            noShows: state.noShows,
        })
    );
    setText('#opsTodayCount', todayAppointments);
    setText(
        '#opsTodayMeta',
        nextAppointment?.item
            ? `${nextAppointment.item.name || 'Paciente'} a las ${nextAppointment.item.time || '--:--'}`
            : appointments.length > 0
              ? `${appointments.length} cita(s) registradas`
              : 'Sin citas cargadas'
    );
    setText('#opsPendingCount', pendingTasks);
    setText(
        '#opsPendingMeta',
        pendingTasks > 0
            ? `${pendingTransfers} pago(s) y ${pendingCallbacks} llamada(s)`
            : 'Sin pagos ni llamadas pendientes'
    );
    setText('#opsAvailabilityCount', availabilityDays);
    setText(
        '#opsAvailabilityMeta',
        availabilityDays > 0
            ? `${availabilityDays} dia(s) con horarios activos`
            : 'Aun no hay horarios cargados'
    );
    setText(
        '#opsQueueStatus',
        waitingTickets > 0
            ? `${waitingTickets} en espera`
            : calledTickets > 0
              ? `${calledTickets} en atencion`
              : 'Listo para abrir'
    );
    setText(
        '#opsQueueMeta',
        waitingTickets > 0 || calledTickets > 0
            ? `Turnero listo para atender ${waitingTickets + calledTickets} ticket(s)`
            : 'Abre la app solo cuando vayas a llamar pacientes'
    );
    setText('#openclawBridgeChip', resolveBridgeChipLabel(ops));
    document
        .getElementById('openclawBridgeChip')
        ?.setAttribute('data-state', resolveBridgeChipTone(ops));
    setText('#openclawBridgeMeta', resolveBridgeMeta(ops));
    setText('#dashboardOpenclawOpsSummary', resolveBridgeSummary(ops));
    setText('#openclawOpsOutboxCount', ops.pendingOutbox);
    setText('#openclawOpsFailCount', ops.deliveryFailures);
    setText('#openclawOpsHoldCount', ops.aliveHolds);
    setText('#openclawOpsCheckoutCount', ops.pendingCheckouts.length);
    setText(
        '#dashboardClinicalHistoryChip',
        resolveClinicalChipLabel(clinical)
    );
    document
        .getElementById('dashboardClinicalHistoryChip')
        ?.setAttribute('data-state', resolveClinicalChipTone(clinical));
    setText('#dashboardClinicalHistoryMeta', resolveClinicalMeta(clinical));
    setText(
        '#dashboardClinicalHistorySummary',
        resolveClinicalSummary(clinical)
    );
    setText(
        '#clinicalHistorySessionCount',
        Number(clinical?.summary?.sessions?.total || 0)
    );
    setText(
        '#clinicalHistoryReviewCount',
        Number(
            clinical?.summary?.reviewQueueCount ||
                clinical?.summary?.drafts?.reviewQueueCount ||
                0
        )
    );
    setText(
        '#clinicalHistoryPendingAiCount',
        Number(clinical?.summary?.drafts?.pendingAiCount || 0)
    );
    setText(
        '#clinicalHistoryEventCount',
        Number(clinical?.summary?.events?.openCount || 0)
    );
    setText(
        '#clinicalHistoryQueueHeadline',
        resolveClinicalQueueHeadline(clinical)
    );
    setText('#clinicalHistoryQueueMeta', resolveClinicalQueueMeta(clinical));
    setText(
        '#clinicalHistoryEventHeadline',
        resolveClinicalEventHeadline(clinical)
    );
    setText('#clinicalHistoryEventMeta', resolveClinicalEventMeta(clinical));
    setText('#dashboardMultiClinicChip', resolveMultiClinicChipLabel(multiClinic));
    document
        .getElementById('dashboardMultiClinicChip')
        ?.setAttribute('data-state', resolveMultiClinicChipTone(multiClinic));
    setText('#dashboardMultiClinicMeta', resolveMultiClinicMeta(multiClinic));
    setText(
        '#dashboardMultiClinicSummary',
        resolveMultiClinicSummary(multiClinic)
    );
    setText('#multiClinicCount', Number(multiClinic?.summary?.clinicCount || 0));
    setText(
        '#multiClinicAppointmentsToday',
        Number(multiClinic?.summary?.todayAppointments || 0)
    );
    setText(
        '#multiClinicRevenueLabel',
        String(multiClinic?.summary?.settledRevenueLabel || '$0.00')
    );
    setText(
        '#multiClinicPatientCount',
        Number(multiClinic?.summary?.patientCount || 0)
    );
    setText(
        '#dashboardMultiClinicRevenueLeaderHeadline',
        resolveMultiClinicLeaderHeadline(
            multiClinic?.comparative?.leaderByRevenue
        )
    );
    setText(
        '#dashboardMultiClinicRevenueLeaderMeta',
        resolveMultiClinicLeaderMeta(
            multiClinic?.comparative?.leaderByRevenue,
            'revenue'
        )
    );
    setText(
        '#dashboardMultiClinicDemandLeaderHeadline',
        resolveMultiClinicLeaderHeadline(
            multiClinic?.comparative?.leaderByDemand
        )
    );
    setText(
        '#dashboardMultiClinicDemandLeaderMeta',
        resolveMultiClinicLeaderMeta(
            multiClinic?.comparative?.leaderByDemand,
            'demand'
        )
    );
    setHtml('#dashboardMultiClinicList', buildMultiClinicRowsMarkup(multiClinic));
    setTelemedicineMetrics(telemedicineMeta);
}

function resolveTelemedicineChipTone(snapshot) {
    const status = String(snapshot?.diagnostics?.status || '').trim();
    if (status === 'critical') return 'danger';
    if (status === 'degraded') return 'warning';
    if (status === 'healthy') return 'success';
    return 'neutral';
}

function resolveTelemedicineChipLabel(snapshot) {
    const status = String(snapshot?.diagnostics?.status || '').trim();
    switch (status) {
        case 'critical':
            return 'Critico';
        case 'degraded':
            return 'Degradado';
        case 'healthy':
            return 'Estable';
        default:
            return 'Pendiente';
    }
}

function setTelemedicineMetrics(telemedicineMeta) {
    const defaultMeta = typeof telemedicineMeta === 'object' && telemedicineMeta !== null 
        ? telemedicineMeta 
        : {};
    
    const summary = defaultMeta.summary || {};
    const integrity = summary.integrity || {};
    const intakes = summary.intakes || {};
    
    const stagingCount = Number(integrity.stagedLegacyUploadsCount || 0);
    const pendingAiCount = Number(intakes.photoAiPendingValidationCount || 0);
    const urgencyAiCount = Number(intakes.photoAiHighUrgencyCount || 0);
    const pendingEvalsCount = Number(summary.reviewQueueCount || 0);
    
    const bySuitability = intakes.bySuitability || {};
    const suitableCount = Number(bySuitability.fit || 0) + Number(bySuitability.review_required || 0);
    const unsuitableCount = Number(bySuitability.unsuitable || 0);
    const totalSuitated = suitableCount + unsuitableCount;
    const suitabilityScore = totalSuitated > 0 
        ? Math.round((suitableCount / totalSuitated) * 100) + '%' 
        : 'Sin datos';

    setText('#dashboardTelemedicineStatusChip', resolveTelemedicineChipLabel(defaultMeta));
    document
        .getElementById('dashboardTelemedicineStatusChip')
        ?.setAttribute('data-state', resolveTelemedicineChipTone(defaultMeta));

    setText('#telemedicineStagingCount', stagingCount);
    setText('#telemedicinePhotoAiPendingCount', pendingAiCount);
    setText('#telemedicinePhotoAiUrgencyCount', urgencyAiCount);
    setText('#telemedicinePendingEvalsCount', pendingEvalsCount);

    setText('#telemedicineSuitabilityScoreHeadline', suitabilityScore);

    const issuesCount = Number(defaultMeta.diagnostics?.summary?.totalIssues || 0);
    setText(
        '#telemedicineIntegrityHeadline',
        issuesCount > 0 ? `${issuesCount} anomalia(s) en funnel` : 'Ops sin obstrucciones'
    );
}

export async function loadBusinessMetrics() {
    try {
        const response = await apiRequest({ resource: 'business-metrics' });
        if (response.ok && response.data) {
            setText('#businessPatientsSeen', response.data.patients_seen);
            setText('#businessNewPatients', response.data.new_patients);
            setText('#businessNoShowRate', `${response.data.no_show_rate}%`);
            setText('#businessRevenue', `$${Number(response.data.revenue_estimate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            
            const services = response.data.top_services || [];
            setText('#businessTopService1', services[0] ? String(services[0]).toUpperCase() : 'Ninguno');
            setText('#businessTopService2', services[1] ? String(services[1]).toUpperCase() : 'Ninguno');
            setText('#businessTopService3', services[2] ? String(services[2]).toUpperCase() : 'Ninguno');

            setText('#dashboardBusinessChip', 'Calculado');
            document.getElementById('dashboardBusinessChip')?.setAttribute('data-state', 'success');
        } else {
            document.getElementById('dashboardBusinessChip')?.setAttribute('data-state', 'alert');
        }
    } catch (e) {
        console.error('BusinessMetrics Error:', e);
        setText('#dashboardBusinessChip', 'Restringido');
        document.getElementById('dashboardBusinessChip')?.setAttribute('data-state', 'warning');
    }
}
