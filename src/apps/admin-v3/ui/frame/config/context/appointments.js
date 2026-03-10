export const APPOINTMENTS_CONTEXT = {
    eyebrow: 'Agenda Clinica',
    title: 'Triage de citas',
    summary:
        'Prioriza transferencias, no show y proximas 48 horas sin perder lectura.',
    actions: [
        {
            action: 'clear-appointment-filters',
            label: 'Limpiar filtros',
            meta: 'Regresar al corte total',
            shortcut: 'Reset',
        },
        {
            action: 'export-csv',
            label: 'Exportar CSV',
            meta: 'Bajar corte operativo',
            shortcut: 'CSV',
        },
        {
            action: 'context-open-callbacks-pending',
            label: 'Ir a callbacks',
            meta: 'Cruzar seguimiento telefonico',
            shortcut: 'Alt+Shift+3',
        },
    ],
};
