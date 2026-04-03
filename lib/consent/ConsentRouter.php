<?php

declare(strict_types=1);

class ConsentRouter
{
    /**
     * S9-22: Consentimiento por canal
     * Distingue claramente qué consentimiento mostrar según canal clínico.
     */
    public static function routeConsent(string $channel, ?string $procedure = null): string
    {
        switch ($channel) {
            case 'telemedicina':
                return 'Telemedicina: Acepto los límites del diagnóstico a distancia y la posibilidad de requerir consulta presencial.';
            case 'fotos_clinicas':
                return 'Uso de fotos clínicas: Autorizo el uso de mis fotografías exclusivamente con fines de seguimiento médico en mi historia clínica.';
            case 'marketing':
                return 'Marketing: Acepto recibir comunicaciones promocionales por email o WhatsApp.';
            case 'tratamiento':
                if (str_contains(strtolower((string)$procedure), 'laser')) {
                    return 'Consentimiento específico para Láser: Entiendo los riesgos de fotosensibilidad, quemaduras leves y me comprometo al cuidado solar estricto.';
                }
                if (str_contains(strtolower((string)$procedure), 'bioestimuladores')) {
                    return 'Consentimiento para Bioestimuladores: Entiendo los riesgos de inflamación temporal, nódulos y resultados progresivos.';
                }
                return 'Tratamiento Piel/Cabello: Autorizo la aplicación y pautas médicas prescritas por mi médico tratante.';
            case 'presencial':
            default:
                return 'Consulta presencial: Autorizo mi evaluación dermatológica integral en el centro Aurora Derm.';
        }
    }
}
