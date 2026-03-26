import { setText } from '../../../../ui/render.js';
import { normalize, toMillis } from '../../helpers.js';

function countRiskTickets(visible = []) {
    return visible.filter((item) => {
        if (item.status !== 'waiting') return false;
        const ageMinutes = Math.max(
            0,
            Math.round((Date.now() - toMillis(item.createdAt)) / 60000)
        );
        return (
            ageMinutes >= 20 || normalize(item.priorityClass) === 'appt_overdue'
        );
    }).length;
}

function readTicketCode(ticket) {
    return String(
        ticket?.ticketCode || ticket?.ticket_code || ticket?.ticket || '--'
    ).trim() || '--';
}

export function updateQueueOpsConsoleSummary({
    state,
    queueMeta,
    visible,
    activeStationTicket,
}) {
    const nextTicket = Array.isArray(queueMeta?.nextTickets)
        ? queueMeta.nextTickets[0] || null
        : null;
    const activeHelpRequests = Array.isArray(queueMeta?.activeHelpRequests)
        ? queueMeta.activeHelpRequests
        : [];
    const riskCount = countRiskTickets(visible);
    const station = Number(state?.queue?.stationConsultorio || 1) === 2 ? 2 : 1;
    const stationLocked = String(state?.queue?.stationMode || '') === 'locked';
    const practiceMode = Boolean(state?.queue?.practiceMode);
    const oneTap = Boolean(state?.queue?.oneTap);
    const activeTicketCode = readTicketCode(activeStationTicket);
    const nextTicketCode = readTicketCode(nextTicket);

    let status = 'ready';
    let statusLabel = 'Recepcion al dia';
    if (riskCount > 0) {
        status = 'attention';
        statusLabel = `${riskCount} turno(s) ya piden llamado`;
    } else if (activeHelpRequests.length > 0) {
        status = 'watch';
        statusLabel = `${activeHelpRequests.length} apoyo(s) piden respuesta`;
    }

    const nowText = activeStationTicket
        ? `${activeTicketCode} está activo en C${station}.`
        : nextTicket
          ? `${nextTicketCode} está listo para el siguiente llamado.`
          : 'No hay turnos esperando ahora.';
    const whyText = riskCount > 0
        ? `${riskCount} turno(s) ya superan la espera cómoda o vienen con prioridad sensible.`
        : activeHelpRequests.length > 0
          ? `Recepción tiene ${activeHelpRequests.length} apoyo(s) abiertos con siguiente paso sugerido.`
          : 'La operación sigue pareja y sin apoyos pendientes.';
    const riskText = riskCount > 0
        ? 'Si no actúas ahora, la espera se estira y la sala pierde claridad.'
        : activeHelpRequests.length > 0
          ? 'Si no se atienden los apoyos, recepción vuelve a improvisar sin contexto.'
          : 'El riesgo operativo inmediato está bajo.';
    const actionText = activeStationTicket
        ? `Desde este puesto puedes completar, volver a llamar o liberar ${activeTicketCode}.`
        : nextTicket
          ? `La siguiente accion util es llamar ${nextTicketCode}${stationLocked ? ` en C${station}` : ''}.`
          : activeHelpRequests.length > 0
            ? 'La siguiente accion util es abrir la guia de recepcion y responder el apoyo pendiente.'
            : 'No hay una accion urgente. Manten la cola visible y refresca si llega un turno nuevo.';
    const approvalText = practiceMode
        ? 'Modo práctica activo. No hagas llamados reales hasta salir de práctica.'
        : stationLocked
          ? `El puesto está fijado en C${station}. Confirma ese consultorio antes de llamar.`
          : oneTap
            ? 'Un toque está activo. El siguiente llamado saldrá con un solo paso.'
            : 'No requiere aprobación adicional. Recepción puede seguir con la cola actual.';
    const stationText = stationLocked
        ? `Puesto fijado en C${station}`
        : `Puesto libre · C${station} sugerido`;

    setText('#queueOpsConsoleStatus', statusLabel);
    setText('#queueOpsConsoleStation', stationText);
    setText('#queueOpsConsoleNowBody', nowText);
    setText('#queueOpsConsoleWhyBody', whyText);
    setText('#queueOpsConsoleRiskBody', riskText);
    setText('#queueOpsConsoleActionBody', actionText);
    setText('#queueOpsConsoleApprovalBody', approvalText);

    const statusNode = document.getElementById('queueOpsConsoleStatus');
    if (statusNode instanceof HTMLElement) {
        statusNode.setAttribute('data-state', status);
    }
}
