export const DASHBOARD_CONTEXT = {
    eyebrow: 'Resumen Diario',
    title: 'Que requiere atencion ahora',
    summary:
        'Lee agenda, callbacks y disponibilidad desde un frente claro y sin ruido.',
    actions: [
        {
            action: 'context-open-appointments-transfer',
            label: 'Validar pagos',
            meta: 'Transferencias pendientes',
            shortcut: 'Alt+Shift+T',
        },
        {
            action: 'context-open-callbacks-pending',
            label: 'Llamadas',
            meta: 'Pendientes por contacto',
            shortcut: 'Alt+Shift+P',
        },
        {
            action: 'refresh-admin-data',
            label: 'Actualizar',
            meta: 'Sincronizar tablero',
            shortcut: 'Ctrl+K',
        },
    ],
};
