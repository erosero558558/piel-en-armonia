export const QUEUE_CONTEXT = {
    eyebrow: 'Apps Operativas',
    title: 'Operacion simple de recepcion y sala',
    summary:
        'Centraliza instaladores, flujo de operador con numpad y cola en vivo sin mezclar cada equipo en una sola pantalla.',
    actions: [
        {
            action: 'queue-call-next',
            label: 'Llamar C1',
            meta: 'Despachar siguiente ticket',
            shortcut: 'C1',
            queueConsultorio: '1',
        },
        {
            action: 'queue-call-next',
            label: 'Llamar C2',
            meta: 'Despachar consultorio 2',
            shortcut: 'C2',
            queueConsultorio: '2',
        },
        {
            action: 'queue-refresh-state',
            label: 'Refrescar cola',
            meta: 'Sincronizar estado operativo',
            shortcut: 'Sync',
        },
    ],
};
