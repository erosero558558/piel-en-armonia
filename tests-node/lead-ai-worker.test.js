#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildLeadOpsGatewayBody,
    buildLeadOpsMessages,
    buildLeadOpsResult,
    parseLeadOpsGatewayResponse,
} = require('../bin/lib/lead-ai-worker');

test('lead ai worker builds OpenResponses payload with instructions and input', () => {
    const body = buildLeadOpsGatewayBody(
        {
            callbackId: 91,
            objective: 'whatsapp_draft',
            priorityBand: 'hot',
            heuristicScore: 82,
            telefonoMasked: '********22',
            preferencia: 'Necesito botox hoy',
            serviceHints: ['Botox medico'],
            reasonCodes: ['keyword_precio'],
            nextAction: 'Cerrar cita hoy',
        },
        { model: 'openclaw:main' }
    );

    assert.equal(body.model, 'openclaw:main');
    assert.equal(body.user, 'callback:91');
    assert.equal(body.max_output_tokens, 300);
    assert.match(body.instructions, /asistente comercial interno/i);
    assert.match(body.input, /Devuelve JSON con llaves summary y draft/i);
    assert.equal('messages' in body, false);
});

test('lead ai worker keeps objective-specific prompts', () => {
    const messages = buildLeadOpsMessages({
        objective: 'service_match',
        priorityBand: 'warm',
    });

    assert.equal(messages.length, 2);
    assert.match(
        String(messages[1].content || ''),
        /Sugiere el mejor servicio/i
    );
});

test('lead ai worker parses OpenResponses payloads from output_text and output content', () => {
    assert.deepEqual(
        parseLeadOpsGatewayResponse({
            output_text:
                '{"summary":"Priorizar llamada","draft":"Hola, te contacto hoy."}',
        }),
        {
            summary: 'Priorizar llamada',
            draft: 'Hola, te contacto hoy.',
        }
    );

    assert.deepEqual(
        parseLeadOpsGatewayResponse({
            output: [
                {
                    type: 'message',
                    content: [
                        {
                            type: 'output_text',
                            text: '{"summary":"Servicio sugerido","draft":"Te propongo botox medico."}',
                        },
                    ],
                },
            ],
        }),
        {
            summary: 'Servicio sugerido',
            draft: 'Te propongo botox medico.',
        }
    );
});

test('lead ai worker rejects empty JSON responses and builds final result payload', () => {
    assert.throws(
        () =>
            parseLeadOpsGatewayResponse({
                output_text: '{}',
            }),
        /sin summary ni draft/i
    );

    assert.deepEqual(
        buildLeadOpsResult(
            {
                callbackId: 77,
                objective: 'call_opening',
            },
            {
                output_text:
                    '{"summary":"Abrir con contexto","draft":"Hola, te llamo por tu consulta."}',
            },
            'openclaw:main'
        ),
        {
            callbackId: 77,
            objective: 'call_opening',
            status: 'completed',
            summary: 'Abrir con contexto',
            draft: 'Hola, te llamo por tu consulta.',
            provider: 'openclaw:main',
        }
    );
});
