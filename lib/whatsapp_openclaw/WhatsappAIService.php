<?php

declare(strict_types=1);

require_once __DIR__ . '/../../common.php';

final class WhatsappAIService
{
    /**
     * Intenta planificar una respuesta al paciente usando Inteligencia Artificial.
     * Retorna el diccionario de Plan si es seguro y exitoso, o null si falla para caer al Heuristico.
     * 
     * @param array $conversation
     * @param array $draft
     * @param array $event
     * @return array|null
     */
    public static function planNativeAi(array $conversation, array $draft, array $event): ?array
    {
        $apiKey = app_env('OPENAI_API_KEY');
        if (!is_string($apiKey) || trim($apiKey) === '') {
            return null;
        }

        $text = trim((string) ($event['text'] ?? ''));
        if ($text === '') {
            // Solo procesamos texto de forma fluida. Si solo envia media, dejamos a Heuristic decidir.
            return null;
        }

        $payload = [
            'model' => 'gpt-4o-mini', // 4o-mini es rapidisimo y barato para faq bots
            'messages' => self::buildPromptMessages($draft, $text),
            'response_format' => ['type' => 'json_object'],
            'max_tokens' => 300,
            'temperature' => 0.1
        ];

        $ch = curl_init('https://api.openai.com/v1/chat/completions');
        if ($ch === false) {
            return null;
        }

        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . trim($apiKey)
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 8);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false || $httpCode >= 400) {
            return null;
        }

        $decoded = json_decode((string) $response, true);
        if (!is_array($decoded) || !isset($decoded['choices'][0]['message']['content'])) {
            return null;
        }

        $content = json_decode($decoded['choices'][0]['message']['content'], true);
        if (!is_array($content) || !isset($content['intent']) || !isset($content['reply'])) {
            return null;
        }

        // Si la IA decide un intent desconocido, lo forzamos a faq para que devuelva el reply generado.
        $validIntents = ['faq', 'booking_collect', 'handoff_clinical', 'other'];
        $intent = strtolower(trim((string)$content['intent']));
        if (!in_array($intent, $validIntents, true)) {
            $intent = 'faq'; 
        }

        if ($intent === 'handoff_clinical') {
            $content['reply'] = "Dado que tienes dudas clínicas específicas, voy a transferir tu caso para que un doctor de " . AppConfig::BRAND_NAME . " revise tus síntomas personalmente.";
        }

        return [
            'source' => 'native_ai',
            'intent' => $intent,
            'reply' => trim((string)$content['reply']),
            'draftPatch' => is_array($content['draftPatch'] ?? null) ? $content['draftPatch'] : [],
        ];
    }

    private static function buildPromptMessages(array $draft, string $text): array
    {
        $clinicName = AppConfig::BRAND_NAME;
        $address = AppConfig::ADDRESS;
        $services = AppConfig::getServices();
        
        $pricelist = [];
        foreach ($services as $slug => $s) {
            $total = get_service_total_price($slug);
            $pricelist[] = "- {$s['name']} (\${$total})";
        }
        $pricelistStr = implode("\n", $pricelist);

        $systemPrompt = <<<PROMPT
Eres la recepcionista médica de {$clinicName}. Tu meta es responder preguntas frecuentes sobre precios, qué hacemos y dónde estamos, en tono amable y profesional por WhatsApp.

DETALLES CLÍNICOS:
- Dirección: {$address}
- Servicios y referencias de precio:
{$pricelistStr}

REGLAS ESTRICTAS:
1. NUNCA recetes, diagnostiques, ni des un criterio sobre fotos/problemas ("tengo una mancha", "me pica la cara"). Si preguntan algo clínico, usa intent 'handoff_clinical'.
2. Si el usuario pregunta precios/horarios/ubicación, responde corto y amable (intent 'faq').
3. Si el usuario desea agendar ahora, usa intent 'booking_collect' y dale instrucciones de enviarte fecha y servicio.
4. Responde SIEMPRE bajo un output JSON con este formato:
{
  "intent": "faq" o "booking_collect" o "handoff_clinical",
  "reply": "Tu mensaje al paciente corto, máximo 2 oraciones. Usa emojis médicos.",
  "draftPatch": {} // Vacío por ahora
}
PROMPT;

        return [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => "Paciente dice: " . $text]
        ];
    }
}
