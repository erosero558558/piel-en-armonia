export const SETTINGS_CONTEXT = {
    eyebrow: 'Settings',
    title: 'Perfil del medico principal',
    summary:
        'Centraliza nombre, especialidad, registro MSP y firma digital para certificados, recetas y evoluciones.',
    actions: [
        {
            action: 'refresh-admin-data',
            label: 'Recargar perfil',
            meta: 'Volver a leer el JSON canonico',
        },
        {
            action: 'open-command-palette',
            label: 'Abrir acciones',
            meta: 'Usar atajos del panel admin',
        },
    ],
};
