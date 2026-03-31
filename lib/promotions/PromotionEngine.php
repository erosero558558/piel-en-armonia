<?php

declare(strict_types=1);

class PromotionEngine
{
    /**
     * Evaluates a list of promotions against a patient context.
     * 
     * @param array $promotions array of promotion records from store
     * @param array|null $patient patient context (can be null if anonymous)
     * @return array list of matching promotions
     */
    public static function evaluatePromotions(array $promotions, ?array $patient): array
    {
        $activePromotions = [];
        $now = date('Y-m-d');

        foreach ($promotions as $promo) {
            // 1. Verificar si está activa
            $isActive = isset($promo['is_active']) ? (bool) $promo['is_active'] : true;
            if (!$isActive) {
                continue;
            }

            // 2. Verificar vigencia
            $start = $promo['vigencia_start'] ?? null;
            $end = $promo['vigencia_end'] ?? null;
            
            if ($start && $start > $now) {
                continue;
            }
            if ($end && $end < $now) {
                continue;
            }

            // 3. Verificar elegibilidad
            $elegibilidad = $promo['elegibilidad'] ?? 'todos'; // primera_vez | miembro | referido | todos
            $exclusiones = $promo['exclusiones'] ?? [];

            if (!self::isEligible($elegibilidad, $patient)) {
                continue;
            }

            if (self::isExcluded($exclusiones, $patient)) {
                continue;
            }

            $activePromotions[] = $promo;
        }

        return $activePromotions;
    }

    private static function isEligible(string $elegibilidad, ?array $patient): bool
    {
        if ($elegibilidad === 'todos') {
            return true;
        }

        if ($elegibilidad === 'primera_vez') {
            // Si el paciente no existe, o existe y no tiene historial
            return self::isPrimeraVez($patient);
        }

        if ($elegibilidad === 'miembro') {
            // Requiere autenticación y estado de miembro activo
            if (!$patient) {
                return false;
            }
            return self::isMiembro($patient);
        }

        if ($elegibilidad === 'referido') {
            return self::isReferido($patient);
        }

        return false;
    }

    private static function isExcluded(array $exclusiones, ?array $patient): bool
    {
        if (!$patient) {
            return false;
        }
        
        foreach ($exclusiones as $exclusion) {
            if ($exclusion === 'miembro' && self::isMiembro($patient)) {
                return true;
            }
            if ($exclusion === 'paciente_existente' && !self::isPrimeraVez($patient)) {
                return true;
            }
        }

        return false;
    }

    private static function isPrimeraVez(?array $patient): bool
    {
        if (!$patient) {
            return true; // Un paciente no autenticado se asume como potencial primera vez
        }

        $appointmentsCount = isset($patient['appointments_count']) ? (int) $patient['appointments_count'] : 0;
        return $appointmentsCount === 0;
    }

    private static function isMiembro(array $patient): bool
    {
        return isset($patient['has_active_membership']) && $patient['has_active_membership'] === true;
    }

    private static function isReferido(array $patient): bool
    {
        $source = $patient['acquisition_source'] ?? '';
        return $source === 'referral';
    }
}
