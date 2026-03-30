<?php

declare(strict_types=1);

require_once __DIR__ . '/../common.php';

final class ClinicalHistoryAIService
{
    private const FALLBACK_TRIAGE = [
        'urgency' => 3,
        'differential_diagnosis' => ['Requiere evaluación médica directa'],
        'recommended_consultation' => 'consulta_presencial',
        'is_fallback' => true
    ];

    /**
     * Analiza texto y/o fotos para sugerir triage.
     * Retorna ['urgency' => 1-5, 'differential_diagnosis' => [], 'recommended_consultation' => '...']
     * 
     * @param string $description Síntomas o motivo de consulta descrito por el paciente.
     * @param array $base64Images Arreglo de strings en base64 de las lesiones (opcional).
     * @return array
     */
    public static function suggestTriage(string $description, array $base64Images = []): array
    {
        $apiKey = app_env('OPENAI_API_KEY');
        if (!is_string($apiKey) || trim($apiKey) === '') {
            error_log('ClinicalHistoryAIService: OPENAI_API_KEY not found. Using fallback.');
            return self::FALLBACK_TRIAGE;
        }

        $messages = self::buildPromptMessages($description, $base64Images);

        $payload = [
            'model' => 'gpt-4o',
            'messages' => $messages,
            'response_format' => ['type' => 'json_object'],
            'max_tokens' => 800,
            'temperature' => 0.2
        ];

        $ch = curl_init('https://api.openai.com/v1/chat/completions');
        if ($ch === false) {
            return self::FALLBACK_TRIAGE;
        }

        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . trim($apiKey)
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($response === false || $httpCode >= 400) {
            error_log("ClinicalHistoryAIService: OpenAI API Error: HTTP $httpCode - " . ($error ?: $response));
            return self::FALLBACK_TRIAGE;
        }

        $decoded = json_decode((string) $response, true);
        if (!is_array($decoded) || !isset($decoded['choices'][0]['message']['content'])) {
            error_log("ClinicalHistoryAIService: Invalid OpenAI response format.");
            return self::FALLBACK_TRIAGE;
        }

        $content = json_decode($decoded['choices'][0]['message']['content'], true);
        if (!is_array($content)) {
            error_log("ClinicalHistoryAIService: Content is not valid JSON.");
            return self::FALLBACK_TRIAGE;
        }

        return self::normalizeResponse($content);
    }

    private static function buildPromptMessages(string $description, array $base64Images): array
    {
        $systemPrompt = "Eres un asistente médico dermatológico experto diseñado para realizar Triage clínico inicial. "
            . "Basado en la descripción de los síntomas y las imágenes proporcionadas por el paciente (si las hay), "
            . "debes devolver un JSON estricto con la siguiente estructura:\n"
            . "{\n"
            . "  \"urgency\": (entero del 1 al 5, donde 5 es muy urgente/riesgo de vida o secuela severa aguda y 1 es rutina/cosmético),\n"
            . "  \"differential_diagnosis\": [\"condición 1\", \"condición 2\"],\n"
            . "  \"recommended_consultation\": (debe ser exactamente uno de estos tres valores: \"urgencia\", \"consulta_presencial\", \"telemedicina\")\n"
            . "}\n"
            . "Reglas: prioriza 'urgencia' para sangrados incontrolables, infecciones graves o anafilaxia. "
            . "Prioriza 'consulta_presencial' para biopsias, palpación necesaria o lesiones dudosas. "
            . "Prioriza 'telemedicina' para revisiones simples o consultas de skincare.";

        $messages = [
            [
                'role' => 'system',
                'content' => $systemPrompt
            ]
        ];

        $userContent = [];
        $userContent[] = [
            'type' => 'text',
            'text' => "Motivo de consulta y síntomas: " . (trim($description) ?: "No proporcionado.")
        ];

        foreach ($base64Images as $b64) {
            $cleaned = preg_replace('/^data:image\/\w+;base64,/', '', $b64);
            // Defaulting to jpeg for simplicity if mime type header was stripped
            $userContent[] = [
                'type' => 'image_url',
                'image_url' => [
                    'url' => "data:image/jpeg;base64," . $cleaned
                ]
            ];
        }

        $messages[] = [
            'role' => 'user',
            'content' => $userContent
        ];

        return $messages;
    }

    private static function normalizeResponse(array $rawContent): array
    {
        $urgency = isset($rawContent['urgency']) && is_numeric($rawContent['urgency']) ? (int) $rawContent['urgency'] : 3;
        if ($urgency < 1) $urgency = 1;
        if ($urgency > 5) $urgency = 5;

        $ddx = [];
        if (isset($rawContent['differential_diagnosis']) && is_array($rawContent['differential_diagnosis'])) {
            foreach ($rawContent['differential_diagnosis'] as $item) {
                if (is_string($item) && trim($item) !== '') {
                    $ddx[] = trim($item);
                }
            }
        }
        if (empty($ddx)) {
            $ddx = ['Evaluación clínica diferida'];
        }

        $validConsultations = ['urgencia', 'consulta_presencial', 'telemedicina'];
        $recommended = 'consulta_presencial';
        if (isset($rawContent['recommended_consultation']) && is_string($rawContent['recommended_consultation'])) {
            $val = strtolower(trim($rawContent['recommended_consultation']));
            if (in_array($val, $validConsultations, true)) {
                $recommended = $val;
            }
        }

        return [
            'urgency' => $urgency,
            'differential_diagnosis' => $ddx,
            'recommended_consultation' => $recommended,
            'is_fallback' => false
        ];
    }
}
