export const CLINICAL_HISTORY_CONTEXT = {
    eyebrow: 'Cabina medico-legal',
    title: 'Historia clinica defendible',
    summary:
        'Revisa el episodio, ajusta la nota viva y aprueba una salida clinica defendible para Ecuador.',
    actions: [
        {
            action: 'refresh-admin-data',
            label: 'Actualizar cola',
            meta: 'Sincronizar snapshot clinico',
        },
        {
            action: 'context-open-dashboard',
            label: 'Volver al inicio',
            meta: 'Regresar al resumen operativo',
        },
        {
            action: 'context-open-callbacks-pending',
            label: 'Ver pendientes',
            meta: 'Cruzar seguimiento operativo',
        },
    ],
};
