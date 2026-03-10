export const CALLBACKS_CONTEXT = {
    eyebrow: 'SLA Telefonico',
    title: 'Siguiente callback',
    summary:
        'Ordena la cola por urgencia, contacto pendiente y siguiente accion real.',
    actions: [
        {
            action: 'callbacks-triage-next',
            label: 'Siguiente llamada',
            meta: 'Mover foco al siguiente caso',
            shortcut: 'Next',
        },
        {
            action: 'context-open-callbacks-next',
            label: 'Abrir siguiente',
            meta: 'Ir a la tarjeta prioritaria',
            shortcut: 'Alt+Shift+3',
        },
        {
            action: 'context-open-appointments-transfer',
            label: 'Cruzar citas',
            meta: 'Revisar pagos pendientes',
            shortcut: 'Alt+Shift+2',
        },
    ],
};
