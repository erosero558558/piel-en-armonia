export const REVIEWS_CONTEXT = {
    eyebrow: 'Lectura De Calidad',
    title: 'Resenas y senal reciente',
    summary:
        'Resume rating, volumen y comentarios utiles sin convertir feedback en ruido.',
    actions: [
        {
            action: 'refresh-admin-data',
            label: 'Actualizar',
            meta: 'Sincronizar resenas',
            shortcut: 'Sync',
        },
        {
            action: 'context-open-dashboard',
            label: 'Volver al dashboard',
            meta: 'Regresar al resumen diario',
            shortcut: 'Alt+Shift+1',
        },
        {
            action: 'context-open-callbacks-pending',
            label: 'Ir a callbacks',
            meta: 'Cerrar seguimiento operativo',
            shortcut: 'Alt+Shift+3',
        },
    ],
};
