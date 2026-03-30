<?php

declare(strict_types=1);

final class WhatsappOpenclawPlannerClient
{
    public function plan(array $conversation, array $draft, array $event): array
    {
        $local = $this->planStructuredLocally($conversation, $draft, $event);
        if (is_array($local)) {
            return $local;
        }

        $remote = $this->planWithGateway($conversation, $draft, $event);
        if (is_array($remote)) {
            return $remote;
        }

        $ai = WhatsappAIService::planNativeAi($conversation, $draft, $event);
        if (is_array($ai)) {
            return $ai;
        }

        return $this->heuristicPlan($conversation, $draft, $event);
    }

    private function planStructuredLocally(array $conversation, array $draft, array $event): ?array
    {
        $text = trim((string) ($event['text'] ?? ''));
        if ($text === '') {
            return null;
        }

        $normalized = $this->normalize($text);
        $faqTopics = $this->resolveFaqTopics($normalized);
        $afterHours = $this->isOutsideBusinessHours((string) ($event['receivedAt'] ?? ''));
        $bookingSignals = $this->hasBookingIntentSignals($normalized, $text);

        if ($this->looksLikeClinicalQuestion($normalized, $event) && !$bookingSignals) {
            return [
                'source' => 'local_structured',
                'intent' => 'handoff_clinical',
                'reply' => $this->buildClinicalHandoffReply($afterHours),
                'draftPatch' => [],
            ];
        }

        if ($faqTopics !== [] && !$bookingSignals) {
            return [
                'source' => 'local_structured',
                'intent' => 'faq',
                'reply' => $this->buildStructuredFaqReply($faqTopics, $afterHours),
                'draftPatch' => [],
            ];
        }

        return null;
    }

    private function planWithGateway(array $conversation, array $draft, array $event): ?array
    {
        $endpoint = WhatsappOpenclawConfig::gatewayEndpoint();
        if ($endpoint === '' || !function_exists('curl_init')) {
            return null;
        }

        $payload = [
            'channel' => 'whatsapp',
            'conversation' => $conversation,
            'draft' => $draft,
            'event' => $event,
            'responseFormat' => 'json',
            'model' => WhatsappOpenclawConfig::gatewayModel(),
        ];

        $headers = ['Content-Type: application/json'];
        $apiKey = WhatsappOpenclawConfig::gatewayApiKey();
        if ($apiKey !== '') {
            $headerName = WhatsappOpenclawConfig::gatewayKeyHeader();
            $prefix = trim(WhatsappOpenclawConfig::gatewayKeyPrefix());
            $headerValue = $prefix !== '' ? $prefix . ' ' . $apiKey : $apiKey;
            $headers[] = $headerName . ': ' . $headerValue;
        }

        $ch = curl_init($endpoint);
        if ($ch === false) {
            return null;
        }

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);

        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if (!is_string($raw) || $raw === '' || $status < 200 || $status >= 300) {
            return null;
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return null;
        }

        $plan = isset($decoded['data']) && is_array($decoded['data']) ? $decoded['data'] : $decoded;
        if (!isset($plan['intent']) || !is_string($plan['intent'])) {
            return null;
        }

        $plan['source'] = 'gateway';
        $plan['draftPatch'] = is_array($plan['draftPatch'] ?? null) ? $plan['draftPatch'] : [];
        $plan['reply'] = trim((string) ($plan['reply'] ?? ''));
        return $plan;
    }

    private function heuristicPlan(array $conversation, array $draft, array $event): array
    {
        $text = trim((string) ($event['text'] ?? ''));
        $normalized = $this->normalize($text);
        $draftPatch = [
            'phone' => whatsapp_openclaw_normalize_phone((string) ($event['phone'] ?? ($draft['phone'] ?? ''))),
        ];

        $email = $this->extractEmail($text);
        if ($email !== '') {
            $draftPatch['email'] = $email;
        }

        $name = $this->extractName($text);
        if ($name !== '') {
            $draftPatch['name'] = $name;
        }

        $service = $this->resolveService($normalized);
        if ($service !== '') {
            $draftPatch['service'] = $service;
        }

        $doctor = $this->resolveDoctor($normalized);
        if ($doctor !== '') {
            $draftPatch['doctor'] = $doctor;
        }

        $date = $this->extractDate($text);
        if ($date !== '') {
            $draftPatch['date'] = $date;
        }

        $time = $this->extractTime($text);
        if ($time !== '') {
            $draftPatch['time'] = $time;
        }

        $paymentMethod = $this->resolvePaymentMethod($normalized);
        if ($paymentMethod !== '') {
            $draftPatch['paymentMethod'] = $paymentMethod;
        }

        if ($this->hasConsent($normalized)) {
            $draftPatch['privacyConsent'] = true;
            $draftPatch['privacyConsentAt'] = local_date('c');
        }

        $mediaProofRefs = [];
        foreach ((array) ($event['media'] ?? []) as $media) {
            if (!is_array($media)) {
                continue;
            }
            $mediaProofRefs[] = [
                'url' => (string) ($media['url'] ?? ''),
                'mime' => (string) ($media['mime'] ?? ''),
                'name' => (string) ($media['name'] ?? ''),
                'providerMediaId' => (string) ($media['id'] ?? ''),
            ];
        }
        if ($mediaProofRefs !== []) {
            $draftPatch['mediaProofRefs'] = $mediaProofRefs;
        }

        $state = array_merge($draft, $draftPatch);
        $intent = 'booking_collect';
        $reply = 'Cuéntame qué servicio necesitas y la fecha u hora que te conviene.';

        if ($this->containsAny($normalized, ['cancelar', 'cancela', 'anular'])) {
            $intent = 'cancel';
            $reply = 'Puedo ayudarte a cancelar tu cita si confirmas que quieres hacerlo desde este número.';
        } elseif ($this->containsAny($normalized, ['reprogram', 'mover', 'cambiar hora', 'cambiar cita'])) {
            $intent = 'reschedule';
            $reply = 'Puedo reprogramar tu cita. Envíame la nueva fecha y hora en formato YYYY-MM-DD y HH:MM.';
        } elseif ($this->containsAny($normalized, ['precio', 'costo', 'cuanto', 'servicio', 'tratamiento'])) {
            $intent = 'faq';
            $reply = $this->buildFaqReply($state);
        } elseif ($this->containsAny($normalized, ['disponible', 'horario', 'agenda', 'hora', 'fecha']) || $date !== '' || $time !== '') {
            $intent = 'availability';
            $reply = 'Voy a revisar la disponibilidad real y te propongo los horarios más cercanos.';
        }

        $serviceReady = trim((string) ($state['service'] ?? '')) !== '';
        $dateReady = trim((string) ($state['date'] ?? '')) !== '';
        $timeReady = trim((string) ($state['time'] ?? '')) !== '';
        $nameReady = trim((string) ($state['name'] ?? '')) !== '';
        $emailReady = trim((string) ($state['email'] ?? '')) !== '';
        $consentReady = ($state['privacyConsent'] ?? false) === true;
        $paymentReady = trim((string) ($state['paymentMethod'] ?? '')) !== '';

        if ($serviceReady || $dateReady || $timeReady || $paymentReady) {
            $intent = 'booking_collect';
            $missing = [];
            if (!$serviceReady) {
                $missing[] = 'servicio';
            }
            if (!$dateReady) {
                $missing[] = 'fecha';
            }
            if (!$timeReady) {
                $missing[] = 'hora';
            }
            if (!$nameReady) {
                $missing[] = 'nombre completo';
            }
            if (!$emailReady) {
                $missing[] = 'email';
            }
            if (!$consentReady) {
                $missing[] = 'consentimiento de datos';
            }
            if (!$paymentReady) {
                $missing[] = 'metodo de pago';
            }

            if ($missing !== []) {
                $reply = 'Para avanzar me falta: ' . implode(', ', $missing) . '.';
            }

            $paymentMethod = strtolower(trim((string) ($state['paymentMethod'] ?? '')));
            if ($missing === [] && $paymentMethod === 'card') {
                $intent = 'booking_card';
                $reply = 'Perfecto. Voy a apartar ese horario y enviarte un checkout seguro para completar el pago.';
            } elseif ($missing === [] && $paymentMethod === 'cash') {
                $intent = 'booking_cash';
                $reply = 'Perfecto. Voy a reservar tu cita para pago en consultorio.';
            } elseif ($missing === [] && $paymentMethod === 'transfer') {
                $hasProof = !empty($state['mediaProofRefs']);
                if ($hasProof) {
                    $intent = 'booking_transfer';
                    $reply = 'Recibido. Voy a registrar tu comprobante y dejar la cita pendiente de verificación.';
                } else {
                    $intent = 'booking_collect';
                    $reply = 'Para transferencia necesito que me envíes el comprobante por este chat.';
                }
            }
        }

        return [
            'source' => 'heuristic',
            'intent' => $intent,
            'reply' => $reply,
            'draftPatch' => $draftPatch,
        ];
    }

    /**
     * @return list<string>
     */
    private function resolveFaqTopics(string $normalized): array
    {
        $topics = [];

        if ($this->containsAny($normalized, ['horario', 'horarios', 'atienden', 'atiende', 'abren', 'abierto', 'cierran'])) {
            $topics[] = 'hours';
        }
        if ($this->containsAny($normalized, ['como llego', 'como llegar', 'donde estan', 'donde queda', 'ubicacion', 'direccion', 'mapa'])) {
            $topics[] = 'location';
        }
        if ($this->containsAny($normalized, ['que debo llevar', 'que llevo', 'debo llevar', 'llevar a la cita', 'que necesito llevar', 'documentos'])) {
            $topics[] = 'bring';
        }

        return $topics;
    }

    private function hasBookingIntentSignals(string $normalized, string $rawText): bool
    {
        if (preg_match('/\b\d{4}-\d{2}-\d{2}\b/', $rawText) === 1 || preg_match('/\b\d{2}:\d{2}\b/', $rawText) === 1) {
            return true;
        }

        return $this->containsAny($normalized, [
            'quiero una cita',
            'quiero cita',
            'quiero consulta',
            'agendar',
            'agenda',
            'reservar',
            'reservame',
            'reagendar',
            'reprogram',
            'pago en',
            'pago con',
            'tarjeta',
            'efectivo',
            'transferencia',
            'autorizo datos',
            'acepto datos',
        ]);
    }

    private function looksLikeClinicalQuestion(string $normalized, array $event): bool
    {
        $hasMedia = is_array($event['media'] ?? null) && $event['media'] !== [];
        $clinicalTokens = [
            'mancha',
            'lunar',
            'lesion',
            'granito',
            'grano',
            'acne',
            'rosacea',
            'psoriasis',
            'roncha',
            'sarpullido',
            'verruga',
            'hongo',
            'picazon',
            'comezon',
            'pica',
            'arde',
            'sangra',
            'inflam',
            'medicamento',
            'receta',
            'sintoma',
            'biopsia',
            'melanoma',
        ];
        $questionSignals = [
            'que me recomienda',
            'que puede ser',
            'es normal',
            'debo preocuparme',
            'me salio',
            'tengo una',
            'tengo un',
            'puedo tomar',
            'puedo usar',
            'revisar',
        ];

        return $hasMedia
            || ($this->containsAny($normalized, $clinicalTokens) && $this->containsAny($normalized, $questionSignals));
    }

    private function buildStructuredFaqReply(array $topics, bool $afterHours): string
    {
        $parts = [];
        if ($afterHours) {
            $parts[] = 'Ahora estamos fuera de horario, pero te dejo la informacion clave.';
        }

        foreach ($topics as $topic) {
            if ($topic === 'hours') {
                $parts[] = $this->buildHoursReply();
                continue;
            }
            if ($topic === 'location') {
                $parts[] = 'Estamos en ' . AppConfig::ADDRESS . '.';
                continue;
            }
            if ($topic === 'bring') {
                $parts[] = 'Para tu cita trae tu cedula, una lista de medicamentos y examenes o fotos previas si las tienes.';
            }
        }

        if ($parts === []) {
            $parts[] = 'Con gusto te comparto la informacion basica de la clinica.';
        }

        return implode(' ', $parts);
    }

    private function buildClinicalHandoffReply(bool $afterHours): string
    {
        if ($afterHours) {
            return 'Tu mensaje parece una pregunta clinica y ahora estamos fuera de horario. Lo voy a dejar escalado para seguimiento humano y un doctor de '
                . AppConfig::BRAND_NAME
                . ' te respondera en cuanto el equipo retome atencion.';
        }

        return 'Tu mensaje parece una pregunta clinica. Lo voy a dejar escalado para seguimiento humano y un doctor de '
            . AppConfig::BRAND_NAME
            . ' te respondera lo antes posible.';
    }

    private function buildHoursReply(): string
    {
        $slots = AppConfig::getAvailabilitySlots();
        $weekday = $this->renderSlotRanges(is_array($slots['weekdays'] ?? null) ? $slots['weekdays'] : []);
        $saturday = $this->renderSlotRanges(is_array($slots['saturday'] ?? null) ? $slots['saturday'] : []);

        return 'Atendemos de lunes a viernes ' . $weekday . ', y los sabados ' . $saturday . '.';
    }

    /**
     * @param list<string> $slots
     */
    private function renderSlotRanges(array $slots): string
    {
        if ($slots === []) {
            return 'sin horario publicado';
        }

        $ranges = [];
        $rangeStart = null;
        $previousMinutes = null;

        foreach ($slots as $slot) {
            $minutes = $this->timeToMinutes((string) $slot);
            if ($minutes === null) {
                continue;
            }

            if ($rangeStart === null) {
                $rangeStart = $slot;
                $previousMinutes = $minutes;
                continue;
            }

            if ($previousMinutes !== null && ($minutes - $previousMinutes) > 30) {
                $ranges[] = $rangeStart . ' a ' . $this->minutesToTime($previousMinutes);
                $rangeStart = $slot;
            }

            $previousMinutes = $minutes;
        }

        if ($rangeStart !== null && $previousMinutes !== null) {
            $ranges[] = $rangeStart . ' a ' . $this->minutesToTime($previousMinutes);
        }

        return implode(' y ', $ranges);
    }

    private function timeToMinutes(string $value): ?int
    {
        if (preg_match('/^(\d{2}):(\d{2})$/', trim($value), $matches) !== 1) {
            return null;
        }

        return ((int) $matches[1] * 60) + (int) $matches[2];
    }

    private function minutesToTime(int $minutes): string
    {
        $hours = (int) floor($minutes / 60);
        $mins = $minutes % 60;
        return sprintf('%02d:%02d', $hours, $mins);
    }

    private function isOutsideBusinessHours(string $value): bool
    {
        try {
            $date = $value !== '' ? new DateTimeImmutable($value) : new DateTimeImmutable(local_date('c'));
        } catch (\Throwable $e) {
            return false;
        }

        $dayOfWeek = (int) $date->format('N');
        if ($dayOfWeek === 7) {
            return true;
        }

        $slots = AppConfig::getAvailabilitySlots();
        $daySlots = $dayOfWeek === 6
            ? (is_array($slots['saturday'] ?? null) ? $slots['saturday'] : [])
            : (is_array($slots['weekdays'] ?? null) ? $slots['weekdays'] : []);
        if ($daySlots === []) {
            return true;
        }

        $current = $this->timeToMinutes($date->format('H:i'));
        if ($current === null) {
            return false;
        }

        $allowed = [];
        foreach ($daySlots as $slot) {
            $slotMinutes = $this->timeToMinutes((string) $slot);
            if ($slotMinutes === null) {
                continue;
            }
            $allowed[$slotMinutes] = true;
        }

        return !isset($allowed[$current]);
    }

    private function buildFaqReply(array $state): string
    {
        $service = trim((string) ($state['service'] ?? ''));
        if ($service !== '' && get_service_config($service) !== null) {
            $label = get_service_label($service);
            $total = get_service_total_price($service);
            return $label . ' tiene un valor referencial de $' . number_format((float) $total, 2) . '. Si quieres, también reviso horarios disponibles.';
        }

        $parts = [];
        foreach (array_keys(get_services_config()) as $slug) {
            $parts[] = get_service_label($slug) . ' $' . number_format((float) get_service_total_price($slug), 2);
            if (count($parts) >= 4) {
                break;
            }
        }
        return 'Puedo ayudarte con ' . implode(', ', $parts) . '. Dime cuál te interesa y te comparto horarios.';
    }

    private function extractEmail(string $text): string
    {
        return preg_match('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i', $text, $matches) === 1
            ? strtolower(trim((string) ($matches[0] ?? '')))
            : '';
    }

    private function extractName(string $text): string
    {
        if (preg_match('/(?:soy|mi nombre es|nombre:)\s+([a-záéíóúñ ]{4,80})/iu', $text, $matches) === 1) {
            return trim((string) ($matches[1] ?? ''));
        }
        return '';
    }

    private function extractDate(string $text): string
    {
        if (preg_match('/\b(\d{4}-\d{2}-\d{2})\b/', $text, $matches) === 1) {
            return (string) ($matches[1] ?? '');
        }
        return '';
    }

    private function extractTime(string $text): string
    {
        if (preg_match('/\b(\d{2}:\d{2})\b/', $text, $matches) === 1) {
            return (string) ($matches[1] ?? '');
        }
        return '';
    }

    private function resolveService(string $text): string
    {
        foreach (
            [
                'consulta' => ['consulta', 'presencial'],
                'telefono' => ['telefono', 'telef'],
                'video' => ['video', 'virtual'],
                'laser' => ['laser'],
                'rejuvenecimiento' => ['rejuvenecimiento'],
                'acne' => ['acne'],
                'cancer' => ['cancer'],
            ] as $service => $tokens
        ) {
            if ($this->containsAny($text, $tokens)) {
                return $service;
            }
        }
        return '';
    }

    private function resolveDoctor(string $text): string
    {
        if ($this->containsAny($text, ['rosero', 'javier'])) {
            return 'rosero';
        }
        if ($this->containsAny($text, ['narvaez', 'carolina'])) {
            return 'narvaez';
        }
        if ($this->containsAny($text, ['cualquiera', 'indiferente', 'el primero disponible'])) {
            return 'indiferente';
        }
        return '';
    }

    private function resolvePaymentMethod(string $text): string
    {
        if ($this->containsAny($text, ['tarjeta', 'card', 'credito', 'debito'])) {
            return 'card';
        }
        if ($this->containsAny($text, ['transferencia', 'transfer'])) {
            return 'transfer';
        }
        if ($this->containsAny($text, ['efectivo', 'cash'])) {
            return 'cash';
        }
        return '';
    }

    private function hasConsent(string $text): bool
    {
        return $this->containsAny($text, ['acepto datos', 'autorizo datos', 'consiento', 'acepto el tratamiento']);
    }

    private function containsAny(string $text, array $tokens): bool
    {
        foreach ($tokens as $token) {
            if (str_contains($text, $token)) {
                return true;
            }
        }
        return false;
    }

    private function normalize(string $value): string
    {
        $value = function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value);
        return strtr($value, [
            'á' => 'a',
            'é' => 'e',
            'í' => 'i',
            'ó' => 'o',
            'ú' => 'u',
            'ñ' => 'n',
        ]);
    }
}
