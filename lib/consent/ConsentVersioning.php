<?php

declare(strict_types=1);

require_once __DIR__ . '/../common.php';

final class ConsentVersioning
{
    /**
     * Registro inmutable de versiones (Reemplaza al JSON externo para evitar el bug del UI del editor).
     * En el futuro, esto puede migrar a la base de datos o a un archivo .json puro protegido.
     */
    private const REGISTRY = [
        'privacy_policy' => [
            '1.0' => [
                'valid_from' => '2026-03-01T00:00:00Z',
                'valid_to' => null,
                'text' => 'Tratamiento responsable de datos personales, usando solo lo necesario para atender y proteger mejor. 1. Datos de contacto que usted comparte por WhatsApp, formularios u otros canales oficiales. 2. Datos tecnicos minimos para seguridad, estabilidad del sitio y mejora del servicio. 3. Informacion clinica solo cuando usted la envia para orientacion o seguimiento. Los datos se usan para continuidad de atencion, soporte operativo y comunicaciones necesarias.'
            ]
        ],
        'medical_disclaimer' => [
            '1.0' => [
                'valid_from' => '2026-03-01T00:00:00Z',
                'valid_to' => null,
                'text' => 'El contenido del sitio puede orientar, pero no sustituye un diagnostico personalizado ni una consulta directa.'
            ]
        ],
        'telemedicine_consent' => [
            '1.0' => [
                'valid_from' => '2026-03-01T00:00:00Z',
                'valid_to' => null,
                'text' => 'Entiendo y acepto que la consulta dermatológica remota tiene limitaciones inherentes al no poder evaluarse ciertas estructuras mediante palpación o dermatoscopía presencial directa. Facilito mi consentimiento explícito para la transmisión digital sincrónica o asincrónica de mi información médica visual, liberando a Aurora Derm de responsabilidades diagnósticas cruzadas derivadas de mala calidad fotográfica o iluminación inadecuada de la lesión.'
            ]
        ]
    ];

    /**
     * @return array{version: string, hash: string, valid_from: string}
     */
    public static function getActiveVersion(string $consentType): array
    {
        if (!isset(self::REGISTRY[$consentType])) {
            throw new \InvalidArgumentException("Consent type not found: $consentType");
        }

        $versions = self::REGISTRY[$consentType];
        
        // Find the active one (valid_to is null or valid_to > now)
        $now = gmdate('Y-m-d\TH:i:s\Z');
        $activeVersionId = null;
        $activeData = null;

        foreach ($versions as $vid => $data) {
            if ($data['valid_to'] === null || $data['valid_to'] > $now) {
                // Si encontramos más de uno, la heurística asume que el último en la lista o el más reciente es el activo.
                // Para mantenerlo simple, tomaremos el primero que cumpla. Lo ideal es ordenar por fecha.
                if ($data['valid_from'] <= $now) {
                    $activeVersionId = $vid;
                    $activeData = $data;
                }
            }
        }

        if (!$activeVersionId || !$activeData) {
            // Fallback al último si no hay condiciones de fechas válidas (no debería pasar)
            $activeVersionId = array_key_last($versions);
            $activeData = $versions[$activeVersionId];
        }

        return [
            'version' => $activeVersionId,
            'hash' => self::computeHash($activeData['text']),
            'valid_from' => $activeData['valid_from']
        ];
    }

    public static function getAllVersions(string $consentType): array
    {
        if (!isset(self::REGISTRY[$consentType])) {
            throw new \InvalidArgumentException("Consent type not found: $consentType");
        }
        
        $list = [];
        foreach (self::REGISTRY[$consentType] as $vid => $data) {
            $list[$vid] = [
                'version' => $vid,
                'hash' => self::computeHash($data['text']),
                'valid_from' => $data['valid_from'],
                'valid_to' => $data['valid_to']
            ];
        }
        return $list;
    }

    public static function resolveVersionByHash(string $hash): ?array
    {
        foreach (self::REGISTRY as $type => $versions) {
            foreach ($versions as $vid => $data) {
                if (self::computeHash($data['text']) === $hash) {
                    return [
                        'type' => $type,
                        'version' => $vid,
                        'valid_from' => $data['valid_from'],
                        'valid_to' => $data['valid_to']
                    ];
                }
            }
        }
        return null;
    }

    private static function computeHash(string $text): string
    {
        return hash('sha256', trim($text));
    }
}
