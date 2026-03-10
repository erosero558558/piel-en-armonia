'use strict';

const OBJECTIVES = new Set(['service_match', 'call_opening', 'whatsapp_draft']);

function promptForObjective(objective) {
    if (objective === 'service_match') {
        return 'Sugiere el mejor servicio y una explicacion breve para el operador.';
    }
    if (objective === 'call_opening') {
        return 'Redacta una apertura de llamada corta y profesional para el operador.';
    }
    return 'Redacta un borrador de WhatsApp corto para cerrar la cita.';
}

function buildLeadOpsMessages(job) {
    const objective = OBJECTIVES.has(job?.objective)
        ? job.objective
        : 'whatsapp_draft';
    const context = [
        `Objetivo: ${objective}`,
        `Prioridad: ${String(job?.priorityBand || 'cold')}`,
        `Score: ${Number(job?.heuristicScore || 0)}`,
        `Telefono enmascarado: ${String(job?.telefonoMasked || 'n/a')}`,
        `Preferencia: ${String(job?.preferencia || 'Sin preferencia')}`,
        `Sugerencias de servicio: ${Array.isArray(job?.serviceHints) ? job.serviceHints.join(', ') : 'ninguna'}`,
        `Razones: ${Array.isArray(job?.reasonCodes) ? job.reasonCodes.join(', ') : 'ninguna'}`,
        `Siguiente accion: ${String(job?.nextAction || 'n/a')}`,
        'Devuelve JSON con llaves summary y draft. No incluyas markdown.',
    ].join('\n');

    return [
        {
            role: 'system',
            content:
                'Eres un asistente comercial interno para una clinica dermatologica. Mantente breve, claro y accionable.',
        },
        {
            role: 'user',
            content: `${promptForObjective(objective)}\n\n${context}`,
        },
    ];
}

function contentToText(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .map((item) => {
                if (typeof item === 'string') return item;
                if (
                    item &&
                    typeof item === 'object' &&
                    typeof item.text === 'string'
                ) {
                    return item.text;
                }
                return '';
            })
            .join('\n');
    }
    return '';
}

function extractResponsesText(payload) {
    if (
        typeof payload?.output_text === 'string' &&
        payload.output_text.trim()
    ) {
        return payload.output_text;
    }

    if (!Array.isArray(payload?.output)) {
        return '';
    }

    return payload.output
        .flatMap((item) => {
            if (!item || typeof item !== 'object') return [];
            if (!Array.isArray(item.content)) return [];
            return item.content
                .map((part) => {
                    if (typeof part?.text === 'string') return part.text;
                    if (typeof part?.content === 'string') return part.content;
                    return '';
                })
                .filter(Boolean);
        })
        .join('\n');
}

function extractJsonObject(text) {
    const raw = String(text || '').trim();
    if (!raw) {
        throw new Error('Gateway devolvio contenido vacio');
    }

    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    const candidate =
        firstBrace >= 0 && lastBrace > firstBrace
            ? raw.slice(firstBrace, lastBrace + 1)
            : raw;

    const parsed = JSON.parse(candidate);
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Gateway devolvio JSON no valido');
    }
    return parsed;
}

function parseLeadOpsGatewayResponse(payload) {
    const content = contentToText(
        payload?.choices?.[0]?.message?.content ??
            extractResponsesText(payload) ??
            ''
    );
    const parsed = extractJsonObject(content);
    const summary = String(parsed.summary || '').trim();
    const draft = String(parsed.draft || '').trim();

    if (!summary && !draft) {
        throw new Error('Gateway devolvio JSON sin summary ni draft');
    }

    return { summary, draft };
}

function buildLeadOpsGatewayBody(job, config = {}) {
    const messages = buildLeadOpsMessages(job);
    const instructions = messages
        .filter(
            (message) =>
                message?.role === 'system' || message?.role === 'developer'
        )
        .map((message) => String(message.content || '').trim())
        .filter(Boolean)
        .join('\n\n');
    const input = messages
        .filter((message) => message?.role === 'user')
        .map((message) => String(message.content || '').trim())
        .filter(Boolean)
        .join('\n\n');

    return {
        model: String(config.model || 'openclaw:main'),
        instructions,
        input,
        user:
            Number(job?.callbackId || 0) > 0
                ? `callback:${Number(job.callbackId)}`
                : undefined,
        max_output_tokens: 300,
    };
}

function buildLeadOpsResult(job, gatewayPayload, provider) {
    const parsed = parseLeadOpsGatewayResponse(gatewayPayload);
    return {
        callbackId: Number(job?.callbackId || 0),
        objective: String(job?.objective || 'whatsapp_draft'),
        status: 'completed',
        summary: parsed.summary,
        draft: parsed.draft,
        provider: String(provider || 'openclaw'),
    };
}

module.exports = {
    buildLeadOpsGatewayBody,
    buildLeadOpsMessages,
    buildLeadOpsResult,
    parseLeadOpsGatewayResponse,
};
