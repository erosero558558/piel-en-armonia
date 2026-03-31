<?php

declare(strict_types=1);

/**
 * S29-11
 * Formulario MSP H002 (consulta externa) - Ecuador
 */

if (!interface_exists('ClinicalFormInterface')) {
    interface ClinicalFormInterface
    {
        public function getFormId(): string;
        public function serialize(): array;
        public function validate(): array;
    }
}

class H002Form implements ClinicalFormInterface
{
    private array $data;

    public function __construct(array $data = [])
    {
        $this->data = $data;
    }

    public function getFormId(): string
    {
        return 'H002';
    }

    public function validate(): array
    {
        $errors = [];
        $required = [
            'motivo_consulta',
            'enfermedad_actual',
            'antecedentes_personales',
            'antecedentes_familiares',
            'revision_sistemas',
            'examen_fisico',
            'diagnostico_cie10',
            'plan_tratamiento',
            'indicaciones_seguimiento'
        ];

        foreach ($required as $field) {
            if (empty(trim((string) ($this->data[$field] ?? '')))) {
                $errors[] = "El campo '{$field}' es obligatorio.";
            }
        }

        return $errors;
    }

    public function serialize(): array
    {
        return [
            'motivo_consulta' => trim((string) ($this->data['motivo_consulta'] ?? '')),
            'enfermedad_actual' => trim((string) ($this->data['enfermedad_actual'] ?? '')),
            'antecedentes_personales' => trim((string) ($this->data['antecedentes_personales'] ?? '')),
            'antecedentes_familiares' => trim((string) ($this->data['antecedentes_familiares'] ?? '')),
            'revision_sistemas' => trim((string) ($this->data['revision_sistemas'] ?? '')),
            'examen_fisico' => trim((string) ($this->data['examen_fisico'] ?? '')),
            // Diagnostic code should be exactly like cpockets: no dots, UPPERCASE
            'diagnostico_cie10' => strtoupper(str_replace('.', '', trim((string) ($this->data['diagnostico_cie10'] ?? '')))),
            'diagnostico_label' => trim((string) ($this->data['diagnostico_label'] ?? '')),
            'plan_tratamiento' => trim((string) ($this->data['plan_tratamiento'] ?? '')),
            'indicaciones_seguimiento' => trim((string) ($this->data['indicaciones_seguimiento'] ?? '')),
        ];
    }
}
