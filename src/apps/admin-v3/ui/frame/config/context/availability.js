export const AVAILABILITY_CONTEXT = {
    eyebrow: 'Calendario Editorial',
    title: 'Planeacion de disponibilidad',
    summary:
        'Gestiona slots, duplicados y semanas futuras con el calendario como canvas principal.',
    actions: [
        {
            action: 'context-availability-today',
            label: 'Ir a hoy',
            meta: 'Volver al dia actual',
            shortcut: 'Today',
        },
        {
            action: 'context-availability-next',
            label: 'Siguiente con slots',
            meta: 'Buscar siguiente dia util',
            shortcut: 'Next',
        },
        {
            action: 'context-copy-availability-day',
            label: 'Copiar dia',
            meta: 'Duplicar jornada seleccionada',
            shortcut: 'Copy',
        },
    ],
};
